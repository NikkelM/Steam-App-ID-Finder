// Description: Utility to find Steam App IDs from a list of game names.

import fs from 'fs';
import os from 'os';
import path from 'path';
import stringSimilarity from 'string-similarity';
import cliProgress from 'cli-progress';

import { CONFIG, outputPath } from './utils.js';

// Machine-global cache for the large Steam app list, shared across working directories
const APP_LIST_CACHE_FILE = path.join(os.tmpdir(), 'steam-app-id-finder', 'appList.json');

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

	const cacheHours = CONFIG.appListCacheHours ?? 24;
	const cacheEnabled = cacheHours > 0;

	// Reuse a fresh cache unless caching is disabled or a refresh was requested
	if (cacheEnabled && !CONFIG.refreshCache) {
		const cached = readAppListCache(cacheHours);
		if (cached) {
			console.log(`Using the cached Steam app list from ${new Date(cached.fetchedAt).toLocaleString()} (${cached.apps.length} apps). Pass --refresh-cache to refetch.`);
			return cached.apps;
		}
	}

	const apps = await fetchSteamAppListFromApi(apiKey);

	// An empty catalogue means Steam gave us nothing usable (transient outage or a key without access).
	// Treat it as a failure and never cache it, otherwise the empty list poisons the cache for appListCacheHours.
	if (apps.length === 0) {
		console.error("\nERROR: Steam's IStoreService/GetAppList returned an empty app list.");
		console.error("This is usually a temporary Steam-side issue or an API key without access. Try again in a few minutes.");
		process.exit(1);
	}

	if (cacheEnabled) {
		writeAppListCache(apps);
	}

	return apps;
}

// Read the cached Steam app list if it exists and is younger than cacheHours, otherwise null
function readAppListCache(cacheHours) {
	try {
		if (!fs.existsSync(APP_LIST_CACHE_FILE)) return null;
		const cache = JSON.parse(fs.readFileSync(APP_LIST_CACHE_FILE, "utf8"));
		if (!Array.isArray(cache?.apps) || typeof cache?.fetchedAt !== "number") return null;
		const ageHours = (Date.now() - cache.fetchedAt) / (1000 * 60 * 60);
		return ageHours <= cacheHours ? cache : null;
	} catch {
		return null;
	}
}

// Best-effort cache write - a failure here never aborts the run
function writeAppListCache(apps) {
	try {
		fs.mkdirSync(path.dirname(APP_LIST_CACHE_FILE), { recursive: true });
		fs.writeFileSync(APP_LIST_CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), apps }));
	} catch (error) {
		console.error(`Warning: could not write the Steam app-list cache (${error.message ?? error}). Continuing without caching.`);
	}
}

async function fetchSteamAppListFromApi(apiKey) {
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
	if (gameNames.length === 0) {
		console.error("\nERROR: The input file contained no game names. Add at least one game name and try again.");
		process.exit(1);
	}

	// Fetch Steam games from API
	const steamApps = await fetchSteamApps();
	console.log(`Found ${steamApps.length} games in Steam's database.\n`);

	// Find Steam App ID's for full matches
	const { steamIDsSingleFullMatch, steamIDsMultipleFullMatches, remainingGameNames } = await findSteamAppIdsFullMatch(gameNames, steamApps);
	gameNames = remainingGameNames;

	// Save the full matches to .json files
	if (Object.keys(steamIDsSingleFullMatch).length > 0) {
		console.log(`Writing game names and Steam App ID's for games with one full match (total of ${Object.keys(steamIDsSingleFullMatch).length}) to "${outputPath('steamAppIds_fullMatches.json')}"...`);
		fs.writeFileSync(outputPath('steamAppIds_fullMatches.json'), JSON.stringify(steamIDsSingleFullMatch, null, 2));
	}
	if (Object.keys(steamIDsMultipleFullMatches).length > 0) {
		console.log(`Writing game names and Steam App ID's for games with multiple full matches (total of ${Object.keys(steamIDsMultipleFullMatches).length}) to "${outputPath('steamAppIds_multipleFullMatches.json')}"...`);
		fs.writeFileSync(outputPath('steamAppIds_multipleFullMatches.json'), JSON.stringify(steamIDsMultipleFullMatches, null, 2));
	}
	console.log();

	if (!CONFIG.onlyFullMatches) {
		// Find Steam App ID's for best matches
		const { steamIDsBestMatch, steamIDsNoMatch } = await findSteamAppIdsBestMatch(gameNames, steamApps);

		// Save the best matches to a .json file
		console.log(`\nWriting game names and Steam App ID's for partial matches to "${outputPath('steamAppIds_bestMatch.json')}"...`);
		fs.writeFileSync(outputPath('steamAppIds_bestMatch.json'), JSON.stringify(steamIDsBestMatch, null, 2));

		if (Object.keys(steamIDsNoMatch).length > 0) {
			console.log(`Writing the names of the remaining ${Object.keys(steamIDsNoMatch).length} games for which no satisfying match was found to "${outputPath('steamAppIds_noMatch.json')}"...`);
			fs.writeFileSync(outputPath('steamAppIds_noMatch.json'), JSON.stringify(steamIDsNoMatch, null, 2));
		}
	}
}

// ---------- ID matching ----------

// Classify each game name as a single full match, multiple full matches, or no match at all (pure - the core exact-match logic)
export function classifyFullMatches(gameNames, steamApps) {
	let steamIDsSingleFullMatch = {};
	let steamIDsMultipleFullMatches = {};
	let remainingGameNames = [];

	for (const game of gameNames) {
		// Get and de-duplicate matches. One game can be in the database multiple times with the same appid
		const fullMatches = [...new Set(steamApps.filter(app => app.name === game).map(app => app.appid))];

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

	return { steamIDsSingleFullMatch, steamIDsMultipleFullMatches, remainingGameNames };
}

// Rank the remaining game names against the Steam catalogue by similarity, keeping those at or above the threshold (pure - onProgress reports per-item progress)
export function rankPartialMatches(gameNames, steamApps, threshold, onProgress = () => {}) {
	// With no catalogue to compare against, every game is a no-match. findBestMatch throws on an empty list, so guard first.
	if (steamApps.length === 0) {
		gameNames.forEach(() => onProgress());
		return { steamIDsBestMatch: {}, steamIDsNoMatch: [...gameNames] };
	}

	// Convert to lowercase to make matches case insensitive and thereby more accurate
	const steamAppsLowercase = steamApps.map((app) => (app.name ?? "").toLowerCase());
	const gameNamesLowercase = gameNames.map((game) => game.toLowerCase());

	// For all games we couldn't get a full match, find the most similar title
	let steamIDsBestMatch = {};
	let steamIDsNoMatch = [];

	for (let i = 0; i < gameNamesLowercase.length; i++) {
		const bestMatch = stringSimilarity.findBestMatch(gameNamesLowercase[i], steamAppsLowercase);
		if (bestMatch.bestMatch.rating >= threshold) {
			steamIDsBestMatch[gameNames[i]] = {
				"appId": steamApps[bestMatch.bestMatchIndex].appid,
				"similarity": bestMatch.bestMatch.rating,
				"steamName": steamApps[bestMatch.bestMatchIndex].name
			}
		} else {
			// The similarity score is too low
			steamIDsNoMatch.push(gameNames[i]);
		}

		onProgress();
	}

	// Sort the matches by similarity score
	steamIDsBestMatch = Object.fromEntries(Object.entries(steamIDsBestMatch).sort(([, a], [, b]) => b.similarity - a.similarity));

	return { steamIDsBestMatch, steamIDsNoMatch };
}

async function findSteamAppIdsFullMatch(gameNames, steamApps) {
	console.log("Searching for full matches...");

	const { steamIDsSingleFullMatch, steamIDsMultipleFullMatches, remainingGameNames } = classifyFullMatches(gameNames, steamApps);

	const multipleMatchCount = Object.keys(steamIDsMultipleFullMatches).length;
	console.log(`Found full matches for ${Object.keys(steamIDsSingleFullMatch).length + multipleMatchCount} games${multipleMatchCount > 0 ? `, of which ${multipleMatchCount} game${multipleMatchCount === 1 ? '' : 's'} had more than one match.` : "."}\n`);

	return { steamIDsSingleFullMatch, steamIDsMultipleFullMatches, remainingGameNames };
}

async function findSteamAppIdsBestMatch(gameNames, steamApps) {
	const partialMatchThreshold = CONFIG.partialMatchThreshold ?? 0.65;

	console.log(`Searching for partial matches with a similarity score >=${partialMatchThreshold} for the remaining ${gameNames.length} games...`);

	const progressBar = new cliProgress.SingleBar({
		hideCursor: true,
		format: '|{bar}| {percentage}% | {eta}s left | {value}/{total} games processed'
	}, cliProgress.Presets.legacy);

	progressBar.start(gameNames.length, 0);

	const { steamIDsBestMatch, steamIDsNoMatch } = rankPartialMatches(gameNames, steamApps, partialMatchThreshold, () => progressBar.increment());

	progressBar.stop();

	console.log(`Found partial matches with a similarity score >=${partialMatchThreshold} for ${Object.keys(steamIDsBestMatch).length} games.`);

	return { steamIDsBestMatch, steamIDsNoMatch };
}