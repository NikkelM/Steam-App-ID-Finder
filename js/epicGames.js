// Description: Utility to find the names of games owned on Epic Games.

import fs from 'fs';

import { CONFIG } from './utils.js';

export async function getEpicGamesGames() {
	console.log("Running in \"epicGamesAccount\" mode.\n");
	console.log("Fetching games from Epic Games account...");

	let games = [];
	let nextPageToken = null;
	let pageNumber = 0;

	// The order history is paginated via a "nextPageToken" (an ISO timestamp) returned with each page
	// Keep requesting pages until no token is returned. There is no total count available.
	try {
		do {
			const page = await getOrderHistoryPage(nextPageToken);
			pageNumber++;
			addGamesFromOrders(page?.orders ?? [], games);
			nextPageToken = page?.nextPageToken ?? null;
			console.log(`  Page ${pageNumber} fetched - ${games.length} games so far.`);
		} while (nextPageToken);
	} catch (error) {
		console.error("\nError fetching games from Epic Games account. Please check/refresh the \"epicGamesCookie\" in the configuration file and try again.");
		console.error(error.message ?? error);
		process.exit(1);
	}

	console.log(`\nWriting ${games.length} game names to "output/${CONFIG.mode}/epicGamesGameNames.txt"`);
	fs.writeFileSync(`output/${CONFIG.mode}/epicGamesGameNames.txt`, games.join('\n'));
}

function addGamesFromOrders(orders, games) {
	for (const order of orders) {
		// An order can contain more than one item (e.g. bundles), so include all of them.
		for (const item of order.items ?? []) {
			if (item.status !== "REFUNDED" && item.description !== undefined) {
				games.push(item.description);
			}
		}
	}
}

async function epicFetchJson(url) {
	let response;
	try {
		response = await fetch(url, {
			method: 'GET',
			headers: {
				'cookie': CONFIG.epicGamesCookie
			},
			redirect: 'manual'
		});
	} catch (error) {
		throw new Error(`Network error while contacting Epic Games: ${error.message ?? error}`);
	}

	// The endpoint responds with a redirect (302 to a logout URL) when the cookie is missing or expired.
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
