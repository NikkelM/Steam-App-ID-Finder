// Description: Utility to find the names of games owned on Epic Games.

import fs from 'fs';

import { CONFIG, outputPath } from './utils.js';

export async function getEpicGamesGames() {
	console.log("Running in \"epicGamesAccount\" mode.\n");
	console.log("Fetching games from Epic Games account...");

	let games = [];
	let nextPageToken = null;
	let pageNumber = 0;

	// Paginate via the nextPageToken returned with each page.
	try {
		do {
			const page = await getOrderHistoryPage(nextPageToken);
			pageNumber++;
			addGamesFromOrders(page?.orders ?? [], games);
			console.log(`  Page ${pageNumber} fetched - ${games.length} games so far.`);

			const next = page?.nextPageToken ?? null;
			// Stop if Epic hands back the same token again, to avoid an infinite loop
			nextPageToken = next === nextPageToken ? null : next;
		} while (nextPageToken);
	} catch (error) {
		console.error("\nError fetching games from Epic Games account. Please check/refresh your Epic Games cookie (--epic-cookie, the EPIC_COOKIE environment variable, or \"epicGamesCookie\" in your config) and try again.");
		console.error(error.message ?? error);
		console.error("\nIf Epic keeps blocking access, use the manual workaround: https://github.com/NikkelM/Steam-App-ID-Finder#workaround-if-the-tool-throws-an-error");
		process.exit(1);
	}

	console.log(`\nWriting ${games.length} game names to "${outputPath('epicGamesGameNames.txt')}"`);
	fs.writeFileSync(outputPath('epicGamesGameNames.txt'), games.join('\n'));
}

function addGamesFromOrders(orders, games) {
	for (const order of orders) {
		// An order can contain multiple items (bundles).
		for (const item of order.items ?? []) {
			if (item.status !== "REFUNDED" && item.description) {
				games.push(item.description);
			}
		}
	}
}

// Accept the bare EPIC_BEARER_TOKEN value, an "EPIC_BEARER_TOKEN=<value>" pair, or a full cookie string, and always send just the bearer token cookie.
function epicBearerCookie() {
	const raw = (CONFIG.epicGamesCookie ?? "").trim();
	const match = raw.match(/EPIC_BEARER_TOKEN=([^;]+)/);
	const token = (match ? match[1] : raw).trim();
	return `EPIC_BEARER_TOKEN=${token}`;
}

async function epicFetchJson(url) {
	let response;
	try {
		response = await fetch(url, {
			method: 'GET',
			headers: {
				'cookie': epicBearerCookie()
			},
			redirect: 'manual'
		});
	} catch (error) {
		throw new Error(`Network error while contacting Epic Games: ${error.message ?? error}`);
	}

	// A 3xx redirect means the cookie is missing or expired.
	if (response.status >= 300 && response.status < 400) {
		throw new Error("Epic Games redirected the request - the \"epicGamesCookie\" is likely missing or expired.");
	}

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`Epic Games responded with status ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${body ? `: ${body.slice(0, 200)}` : ""}`);
	}

	try {
		return await response.json();
	} catch (error) {
		throw new Error(`Could not parse the Epic Games response as JSON (the cookie may be expired): ${error.message ?? error}`);
	}
}

async function getOrderHistoryPage(nextPageToken) {
	const params = new URLSearchParams({ count: "25", sortDir: "DESC", sortBy: "DATE", locale: "en-US" });
	if (nextPageToken) {
		params.set("nextPageToken", nextPageToken);
	}
	return await epicFetchJson(`https://accounts.epicgames.com/account/v2/payment/ajaxGetOrderHistory?${params.toString()}`);
}
