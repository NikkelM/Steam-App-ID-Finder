// Suppresses the warning about the fetch API being unstable
process.removeAllListeners('warning');

import fs from 'fs';
import stringSimilarity from 'string-similarity';

// ---------- Setup ----------

// ----- Config -----

// console.log("Loading config.json...");
// import CONFIG from './config.json' assert { type: "json" };

// ----- Other -----

// Create the output directory if it doesn't exist
if (!fs.existsSync('./output')) {
	fs.mkdirSync('./output');
}

// A JSON object with all Steam games
console.log("Fetching Steam games...");
const steamApps = await fetch("https://api.steampowered.com/ISteamApps/GetAppList/v2/")
	.then((response) => response.json())
	.then((data) => data.applist.apps);

console.log("Found " + steamApps.length + " Steam games.\n");

// ---------- Import the game names ----------

let gameNames = fs.readFileSync("./input/gameNames.txt", "utf-8");
gameNames = Object.assign({}, ...gameNames.split("\r\n").map((game) => ({[game]: -1})));

const numGameNames = Object.keys(gameNames).length;
console.log("\"./input/gameNames.txt\" contained " + numGameNames + " game names for which to find the Steam App ID's.\n");

// ---------- Find a Steam App ID for each game ----------

// ----- Full matches -----

console.log("Searching for full matches...\n");

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

console.log("Found a full match for " + Object.keys(steamIDsFullMatch).length + "/" + numGameNames + " games.");
console.log("Writing game names and Steam App ID's to \"./output/steamAppIds_fullMatch.json\"...\n");

// Save the full matches to a .json file
fs.writeFileSync('./output/steamAppIds_fullMatch.json', JSON.stringify(steamIDsFullMatch, null, 2));

// ----- Best matches -----

console.log("Searching for best matches using string similarity...\n");

for(const app in steamApps) {
	steamApps[app].name = steamApps[app].name.toLowerCase();
}

// For all games we couldn't get a full match, find the most similar title
// Some manual cleanup may be necessary
let steamIDsBestMatch = {};
for (const game in gameNames) {
	const bestMatch = stringSimilarity.findBestMatch(game.toLowerCase(), steamApps.map((app) => app.name));
	steamIDsBestMatch[game] = {
		"appId": steamApps[bestMatch.bestMatchIndex].appid,
		"similarity": bestMatch.bestMatch.rating,
		"steamName": steamApps[bestMatch.bestMatchIndex].name
	}
}

console.log("Found a partial match for the remaining " + (numGameNames - Object.keys(steamIDsFullMatch).length) + " games.");
console.log("Writing game names and Steam App ID's to \"./output/steamAppIds_bestMatch.json\"...\n");

// Save the best matches to a .json file
fs.writeFileSync('./output/steamAppIds_bestMatch.json', JSON.stringify(steamIDsBestMatch, null, 2));