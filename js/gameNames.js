// Description: Utility to find Steam App IDs for game names.

import fs from 'fs';
import stringSimilarity from 'string-similarity';
import cliProgress from 'cli-progress';

import { CONFIG } from './utils.js';

// ----- Input -----

async function loadInputGameNames() {
	if (!["csv", "txt"].includes(CONFIG.inputFile.fileType)) {
		console.error(`Error: Input file type not supported: ${CONFIG.inputFile.fileType}.`);
		process.exit(1);
	}

	try {
		var gameNames = fs.readFileSync(`${CONFIG.inputFile.fileName}.${CONFIG.inputFile.fileType}`, 'utf8');
	} catch (error) {
		console.error("Error: Could not read input file.");
		console.error(error);
		process.exit(1);
	}

	return gameNames.split(CONFIG.inputFile.delimiter);
}

async function fetchSteamApps() {
	return await fetch("https://api.steampowered.com/ISteamApps/GetAppList/v2/")
		.then((response) => response.json())
		.then((data) => data.applist.apps);
}

// ----------- Main -----------

export async function steamAppIDsFromGameNames() {
	console.log("Running in \"gameNames\" mode.\n");

	// Fetch Steam games from API
	const steamApps = await fetchSteamApps();
	console.log(`Found ${steamApps.length} games in Steam's database.`);

	// Import the game names from the input file
	let gameNames = await loadInputGameNames();
	console.log(`The input file (${CONFIG.inputFile.fileName}.${CONFIG.inputFile.fileType}) contained ${Object.keys(gameNames).length} game names.\n`);

	// Find Steam App ID's for full matches
	const { steamIDsSingleFullMatch, steamIDsMultipleFullMatches, remainingGameNames } = await findSteamAppIdsFullMatch(gameNames, steamApps);
	gameNames = remainingGameNames;

	// Save the full matches to .json files
	if (Object.keys(steamIDsSingleFullMatch).length > 0) {
		console.log(`Writing game names and Steam App ID's for games with one full match to \"output/${CONFIG.mode}/steamAppIds_fullMatches.json\"...`);
		fs.writeFileSync(`./output/${CONFIG.mode}/steamAppIds_fullMatches.json`, JSON.stringify(steamIDsSingleFullMatch, null, 2));
	}
	if (Object.keys(steamIDsMultipleFullMatches).length > 0) {
		console.log(`Writing game names and Steam App ID's for games with multiple full matches to \"output/${CONFIG.mode}/steamAppIds_multipleFullMatches.json\"...`);
		fs.writeFileSync(`./output/${CONFIG.mode}/steamAppIds_multipleFullMatches.json`, JSON.stringify(steamIDsMultipleFullMatches, null, 2));
	}
	console.log();

	if (!CONFIG.onlyFullMatches) {
		// Find Steam App ID's for best matches
		const { steamIDsBestMatch, steamIDsNoMatch } = await findSteamAppIdsBestMatch(gameNames, steamApps);

		// Save the best matches to a .json file
		console.log(`\nWriting game names and Steam App ID's for partial matches to \"output/${CONFIG.mode}/steamAppIds_bestMatch.json\"...`);
		fs.writeFileSync(`./output/${CONFIG.mode}/steamAppIds_bestMatch.json`, JSON.stringify(steamIDsBestMatch, null, 2));

		if (Object.keys(steamIDsNoMatch).length > 0) {
			console.log(`Writing the names of the remaining ${Object.keys(steamIDsNoMatch).length} games for which no satisfying match was found to \"output/${CONFIG.mode}/steamAppIds_noMatch.json\"...`);
			fs.writeFileSync(`./output/${CONFIG.mode}/steamAppIds_noMatch.json`, JSON.stringify(steamIDsNoMatch, null, 2));
		}
	}
}

// ---------- ID matching ----------

async function findSteamAppIdsFullMatch(gameNames, steamApps) {
	console.log("Searching for full matches...");

	let steamIDsSingleFullMatch = {};
	let steamIDsMultipleFullMatches = {};
	let remainingGameNames = [];

	for (const game of gameNames) {
		const fullMatches = Object.values(steamApps).filter((app) => (app.name === game));

		if (fullMatches.length === 1) {
			steamIDsSingleFullMatch[game] = fullMatches[0].appid;
		} else if (fullMatches.length > 1) {
			// More than one match for this game was found, save all matches
			steamIDsMultipleFullMatches[game] = fullMatches.map((app) => app.appid);
		} else {
			// No full match was found for this game
			remainingGameNames.push(game);
		}
	}

	console.log(`Found full matches for ${Object.keys(steamIDsSingleFullMatch).length + Object.keys(steamIDsMultipleFullMatches).length} games${Object.keys(steamIDsMultipleFullMatches).length > 1 ? `, of which ${Object.keys(steamIDsMultipleFullMatches).length} games had more than one match.` : "."}\n`);

	return { steamIDsSingleFullMatch, steamIDsMultipleFullMatches, remainingGameNames };
}

async function findSteamAppIdsBestMatch(gameNames, steamApps) {
	let partialMatchThreshold = 0;
	if (CONFIG.partialMatchThreshold) {
		partialMatchThreshold = CONFIG.partialMatchThreshold;
	}

	console.log(`Searching for partial matches with a similarity score >=${partialMatchThreshold} for the remaining ${gameNames.length} games...`);

	// Convert to lowercase to make matches case insensitive and thereby more accurate
	const steamAppsLowercase = steamApps.map((app) => app.name.toLowerCase());
	const gameNamesLowercase = gameNames.map((game) => game.toLowerCase());

	// For all games we couldn't get a full match, find the most similar title
	let steamIDsBestMatch = {};
	let steamIDsNoMatch = [];

	const progressBar = new cliProgress.SingleBar({
		hideCursor: true,
		format: '|{bar}| {percentage}% | {eta}s left | {value}/{total} games processed'
	}, cliProgress.Presets.legacy);

	progressBar.start(gameNames.length, 0);

	for (let i = 0; i < gameNamesLowercase.length; i++) {
		const bestMatch = stringSimilarity.findBestMatch(gameNamesLowercase[i], steamAppsLowercase);
		if (bestMatch.bestMatch.rating >= partialMatchThreshold) {
			steamIDsBestMatch[gameNames[i]] = {
				"appId": steamApps[bestMatch.bestMatchIndex].appid,
				"similarity": bestMatch.bestMatch.rating,
				"steamName": steamApps[bestMatch.bestMatchIndex].name
			}
		} else {
			// The similarity score is too low
			steamIDsNoMatch.push(gameNames[i]);
		}

		progressBar.increment();
	}

	progressBar.stop();

	// Sort the matches by similarity score
	steamIDsBestMatch = Object.fromEntries(Object.entries(steamIDsBestMatch).sort(([, a], [, b]) => b.similarity - a.similarity));

	console.log(`Found partial matches with a similarity score >=${partialMatchThreshold} for ${Object.keys(steamIDsBestMatch).length} games.`);

	return { steamIDsBestMatch, steamIDsNoMatch };
}