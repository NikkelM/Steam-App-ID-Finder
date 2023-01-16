// Description: Utility to find the names of games owned on Epic Games.

import fs from 'fs';
import cliProgress from 'cli-progress';

import { CONFIG } from './utils.js';

export async function getEpicGamesGames() {
	console.log("Running in \"epicGamesAccount\" mode.\n");

	let pageNumber = 1;
	let games = [];

	console.log("Fetching games from Epic Games account...");

	try {
		var firstPage = await getFirstPage();
	} catch (error) {
		console.error("\nError fetching games from Epic Games account. Please check/refresh the \"epicGamesCookie\" in the configuration file and try again.");
		console.log(error);
		process.exit(1);
	}

	for (const game of firstPage.orders) {
		games.push(game.items[0].description);
	}

	let lastCreatedAt = new Date(firstPage.orders.slice(-1)[0].createdAtMillis).toISOString();
	const totalItemsApproximation = firstPage.total;

	const progressBar = new cliProgress.SingleBar({
		hideCursor: true,
		format: '|{bar}| {percentage}% | {eta}s left | {value}/{total} games processed'
	}, cliProgress.Presets.legacy);

	progressBar.start(totalItemsApproximation, 0);

	while (true) {
		const page = await getPage(pageNumber, lastCreatedAt);

		// No more games
		if (page.orders.length === 0) {
			break;
		}

		for (const game of page.orders) {
			if(game.items[0].status !== "REFUNDED")
			games.push(game.items[0].description);
		}

		lastCreatedAt = new Date(page.orders.slice(-1)[0].createdAtMillis).toISOString();

		pageNumber++;
		progressBar.increment(10);
	}
	progressBar.stop();

	// Write the game names to a file
	console.log(`\nWriting game names to "output/${CONFIG.mode}/epicGamesGameNames.txt"`)
	fs.writeFileSync(`output/${CONFIG.mode}/epicGamesGameNames.txt`, games.join('\n'));
}

async function getPage(pageNumber, lastCreatedAt) {
	const response = await fetch(`https://www.epicgames.com/account/v2/payment/ajaxGetOrderHistory?page=${pageNumber}&lastCreatedAt=${lastCreatedAt}&locale=en-US`, {
		method: 'GET',
		headers: {
			'cookie': CONFIG.epicGamesCookie
		}
	})
		.then(response => response.json())
		.then(data => {
			return data;
		});

	// console.log(response);
	return response;
}

async function getFirstPage() {
	const response = await fetch('https://www.epicgames.com/account/v2/payment/ajaxGetOrderHistory?locale=en-US', {
		method: 'GET',
		headers: {
			'cookie': CONFIG.epicGamesCookie
		}
	})
		.then(response => response.json())
		.then(data => {
			return data;
		});

	// console.log(response);
	return response;
}