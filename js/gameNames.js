// Description: Utility to find Steam App IDs from a list of game names.

import fs from 'fs';
import stringSimilarity from 'string-similarity';
import cliProgress from 'cli-progress';

import { CONFIG, outputDir } from './utils.js';

// ----- Input -----

// Resolve the input file path, tolerating the extension already being part of the
// configured file name (it is expected without one, e.g. "games" -> "games.txt").
function resolveInputPath() {
	const { fileName, fileType } = CONFIG.inputFile;
	return fileName.endsWith(`.${fileType}`) ? fileName : `${fileName}.${fileType}`;
}

async function loadInputGameNames() {
	if (!["csv", "txt"].includes(CONFIG.inputFile.fileType)) {
		console.error(`Error: Input file type not supported: ${CONFIG.inputFile.fileType}.`);
		process.exit(1);
	}

	const inputPath = resolveInputPath();

	let fileContents;
	try {
		fileContents = fs.readFileSync(inputPath, 'utf8');
	} catch (error) {
		console.error(`\nERROR: Could not read the input file "${inputPath}".`);
		console.error(error.code === 'ENOENT'
			? "The file does not exist. Check that the path is correct and relative to your current directory."
			: (error.message ?? error));
		process.exit(1);
	}

	// The delimiter defaults to a newline for txt files and a comma for csv files.
	const delimiter = CONFIG.inputFile.delimiter ?? (CONFIG.inputFile.fileType === "csv" ? "," : "\n");

	// Split the input by the delimiter, then trim any stray characters (e.g. a trailing \r) to ensure optimal full match functionality
	return fileContents
		.split(delimiter)
		.map((gameName) => gameName.trim())
		.filter((gameName) => gameName.length > 0);
}

async function fetchSteamApps() {
	const apiKey = (CONFIG.steamAPIKey ?? "").trim();

	if (!apiKey) {
		console.error("\nERROR: A Steam Web API key is required to fetch the list of Steam apps.");
		console.error("Steam retired the keyless \"ISteamApps/GetAppList\" endpoint; this mode now uses \"IStoreService/GetAppList\", which needs an API key.");
		console.error("Provide a free Steam Web API key (https://steamcommunity.com/dev/apikey) via --steam-api-key, the STEAM_API_KEY environment variable, or \"steamAPIKey\" in your config.");
		process.exit(1);
	}

	// Page through the results (max 50,000 per request).
	let apps = [];
	let lastAppId = 0;
	while (true) {
		const url = new URL("https://api.steampowered.com/IStoreService/GetAppList/v1/");
		url.searchParams.set("key", apiKey);
		url.searchParams.set("include_games", "true");
		url.searchParams.set("include_dlc", "true");
		url.searchParams.set("include_software", "true");
		url.searchParams.set("include_videos", "true");
		url.searchParams.set("include_hardware", "true");
		url.searchParams.set("max_results", "50000");
		if (lastAppId) {
			url.searchParams.set("last_appid", String(lastAppId));
		}

		let response;
		try {
			response = await fetch(url);
		} catch (error) {
			console.error("\nERROR: Network error while fetching the Steam app list (IStoreService/GetAppList).");
			console.error(error.message ?? error);
			process.exit(1);
		}
		if (!response.ok) {
			const body = await response.text().catch(() => "");
			console.error(`\nERROR: Steam's IStoreService/GetAppList responded with status ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`);
			if (response.status === 403) console.error("A 403 usually means your Steam Web API key (--steam-api-key / STEAM_API_KEY / \"steamAPIKey\") is missing or invalid.");
			if (body) console.error(`Response body: ${body.slice(0, 200)}`);
			process.exit(1);
		}

		let data;
		try {
			data = await response.json();
		} catch (error) {
			console.error("\nERROR: Could not parse the IStoreService/GetAppList response as JSON.");
			console.error(error.message ?? error);
			process.exit(1);
		}
		const page = data?.response?.apps ?? [];
		apps = apps.concat(page);

		const nextAppId = data?.response?.last_appid;
		if (!data?.response?.have_more_results || page.length === 0 || nextAppId === lastAppId) {
			break;
		}
		lastAppId = nextAppId;
	}

	return apps;
}

// ----------- Main -----------

export async function steamAppIDsFromGameNames() {
	console.log("Running in \"gameNames\" mode.\n");

	// Read the input file first, so a missing or empty input path fails fast, before the slow Steam fetch.
	let gameNames = await loadInputGameNames();
	console.log(`The input file (${resolveInputPath()}) contained ${gameNames.length} game names.`);

	// Fetch Steam games from API
	const steamApps = await fetchSteamApps();
	console.log(`Found ${steamApps.length} games in Steam's database.\n`);

	// Find Steam App ID's for full matches
	const { steamIDsSingleFullMatch, steamIDsMultipleFullMatches, remainingGameNames } = await findSteamAppIdsFullMatch(gameNames, steamApps);
	gameNames = remainingGameNames;

	// Save the full matches to .json files
	if (Object.keys(steamIDsSingleFullMatch).length > 0) {
		console.log(`Writing game names and Steam App ID's for games with one full match (total of ${Object.keys(steamIDsSingleFullMatch).length}) to "${outputDir()}/steamAppIds_fullMatches.json"...`);
		fs.writeFileSync(`${outputDir()}/steamAppIds_fullMatches.json`, JSON.stringify(steamIDsSingleFullMatch, null, 2));
	}
	if (Object.keys(steamIDsMultipleFullMatches).length > 0) {
		console.log(`Writing game names and Steam App ID's for games with multiple full matches (total of ${Object.keys(steamIDsMultipleFullMatches).length}) to "${outputDir()}/steamAppIds_multipleFullMatches.json"...`);
		fs.writeFileSync(`${outputDir()}/steamAppIds_multipleFullMatches.json`, JSON.stringify(steamIDsMultipleFullMatches, null, 2));
	}
	console.log();

	if (!CONFIG.onlyFullMatches) {
		// Find Steam App ID's for best matches
		const { steamIDsBestMatch, steamIDsNoMatch } = await findSteamAppIdsBestMatch(gameNames, steamApps);

		// Save the best matches to a .json file
		console.log(`\nWriting game names and Steam App ID's for partial matches to "${outputDir()}/steamAppIds_bestMatch.json"...`);
		fs.writeFileSync(`${outputDir()}/steamAppIds_bestMatch.json`, JSON.stringify(steamIDsBestMatch, null, 2));

		if (Object.keys(steamIDsNoMatch).length > 0) {
			console.log(`Writing the names of the remaining ${Object.keys(steamIDsNoMatch).length} games for which no satisfying match was found to "${outputDir()}/steamAppIds_noMatch.json"...`);
			fs.writeFileSync(`${outputDir()}/steamAppIds_noMatch.json`, JSON.stringify(steamIDsNoMatch, null, 2));
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
		// Get and de-duplicate matches. One game can be in the database multiple times with the same appid
		const fullMatches = [...new Set(Object.values(steamApps).filter(app => app.name === game).map(app => app.appid))];

		if (fullMatches.length === 1) {
			steamIDsSingleFullMatch[game] = fullMatches[0];
		} else if (fullMatches.length > 1) {
			// More than one match for this game was found, save all matches
			steamIDsMultipleFullMatches[game] = fullMatches;
		} else {
			// No full match was found for this game
			remainingGameNames.push(game);
		}
	}

	console.log(`Found full matches for ${Object.keys(steamIDsSingleFullMatch).length + Object.keys(steamIDsMultipleFullMatches).length} games${Object.keys(steamIDsMultipleFullMatches).length > 1 ? `, of which ${Object.keys(steamIDsMultipleFullMatches).length} games had more than one match.` : "."}\n`);

	return { steamIDsSingleFullMatch, steamIDsMultipleFullMatches, remainingGameNames };
}

async function findSteamAppIdsBestMatch(gameNames, steamApps) {
	const partialMatchThreshold = CONFIG.partialMatchThreshold ?? 0.65;

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