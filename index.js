// Author: NikkelM
// Description: Matches game names to their Steam App ID's. Games whose names do not have an exact match in Steam's database are matched using string similarity.

// Suppresses the warning about the fetch API being unstable
process.removeAllListeners('warning');

// Utility libraries
import fs from 'fs';
import jsonschema from 'jsonschema';
import stringSimilarity from 'string-similarity';
import cliProgress from 'cli-progress';

// Utility for getting the directory of the current file
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------- Setup ----------

// ----- Config -----

try {
	let configFileName;
	if (fs.existsSync(__dirname + '/config.json')) {
		console.log("Loading configuration file \"config.json\"...");
		configFileName = 'config.json';
	} else if (fs.existsSync(__dirname + '/config.default.json')) {
		console.log("!!! No custom configuration file found! Loading default configuration file \"config.default.json\"...");
		configFileName = 'config.default.json';
	}
	var CONFIG = JSON.parse(fs.readFileSync(__dirname + '/' + configFileName));
} catch (error) {
	console.error("Error loading configuration file: " + error);
	process.exit(1);
}

// Validate the config file against the schema
console.log("Validating configuration file...\n");
try {
	const validator = new jsonschema.Validator();
	validator.validate(CONFIG, JSON.parse(fs.readFileSync(__dirname + '/config.schema.json')), { throwError: true });
} catch (error) {
	console.error("Error validating configuration file: " + error);
	process.exit(1);
}

// ----- Output -----

// Create the output directory if it doesn't exist
if (!fs.existsSync(__dirname + '/output')) {
	fs.mkdirSync(__dirname + '/output');
}

// ---------- Main ----------

await main();

async function main() {
	// Fetch Steam games from API
	const steamApps = await fetchSteamApps();
	console.log(`Found ${steamApps.length} games in Steam's database.`);

	// Import the game names from the input file
	const gameNames = await importGameNames();
	console.log(`The input file contained ${Object.keys(gameNames).length} game names.\n`);

	// Find Steam App ID's for full matches
	const steamIDsFullMatch = await findSteamAppIdsFullMatch(gameNames, steamApps);

	// Save the full matches to a .json file
	console.log(`Writing game names and Steam App ID's for full matches to \"${__dirname}\\output\\steamAppIds_fullMatch.json\"...\n`);
	fs.writeFileSync('./output/steamAppIds_fullMatch.json', JSON.stringify(steamIDsFullMatch, null, 2));

	if (!CONFIG.onlyFullMatches) {
		// Find Steam App ID's for best matches
		const steamIDsBestMatch = await findSteamAppIdsBestMatch(gameNames, steamApps);

		// Save the best matches to a .json file
		console.log(`Writing game names and Steam App ID's for partial matches to \"${__dirname}\\output\\steamAppIds_bestMatch.json\"...\n`);
		fs.writeFileSync('./output/steamAppIds_bestMatch.json', JSON.stringify(steamIDsBestMatch, null, 2));
	}
}

async function fetchSteamApps() {
	return await fetch("https://api.steampowered.com/ISteamApps/GetAppList/v2/")
		.then((response) => response.json())
		.then((data) => data.applist.apps);
}

async function importGameNames() {
	let gameNames = fs.readFileSync(`${CONFIG.inputFile.fileName}.${CONFIG.inputFile.fileType}`, 'utf8');

	// If the input file indicates that game names are separated by a delimiter, split the read game names by that delimiter
	if (["csv", "txt"].includes(CONFIG.inputFile.fileType)) {
		gameNames = Object.assign({}, ...gameNames.split(CONFIG.inputFile.delimiter).map((game) => ({ [game]: -1 })));
	} else {
		// Currently, no other file types are supported
		console.log("Error: Input file type not supported.");
		process.exit(1);
	}

	return gameNames;
}

async function findSteamAppIdsFullMatch(gameNames, steamApps) {
	console.log("Searching for full matches...");

	// Get all games where the name is a full match
	let steamIDsFullMatch = {};
	for (const game in gameNames) {
		const fullMatch = steamApps.find((app) => app.name === game);
		if (fullMatch) {
			steamIDsFullMatch[game] = fullMatch.appid;
			// Remove the found game from gameNames to not be searched again in the next step
			delete gameNames[game];
		}
	}

	console.log(`Found full matches for ${Object.keys(steamIDsFullMatch).length} games.`);

	return steamIDsFullMatch;
}


async function findSteamAppIdsBestMatch(gameNames, steamApps) {
	console.log(`Searching for partial matches for the remaining ${Object.keys(gameNames).length} games...`);

	const progressBar = new cliProgress.SingleBar({
		hideCursor: true,
		format: '|{bar}| {percentage}% | {eta}s left | {value}/{total} games matched'
	}, cliProgress.Presets.legacy);

	progressBar.start(Object.keys(gameNames).length, 0);

	// For all games we couldn't get a full match, find the most similar title
	// Some manual cleanup may be necessary
	let steamIDsBestMatch = {};
	for (const game in gameNames) {
		const bestMatch = stringSimilarity.findBestMatch(game.toLowerCase(), steamApps.map((app) => app.name.toLowerCase()));
		steamIDsBestMatch[game] = {
			"appId": steamApps[bestMatch.bestMatchIndex].appid,
			"similarity": bestMatch.bestMatch.rating,
			"steamName": steamApps[bestMatch.bestMatchIndex].name
		}
		progressBar.increment();
	}

	progressBar.stop();

	return steamIDsBestMatch;
}