// Description: Utility to find Steam App IDs for games owned on Steam.

import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

import { CONFIG } from './utils.js';

export async function steamAppIDsFromSteamAccount() {
	console.log("Running in \"steamAccount\" mode.\n");
	console.log(`Getting information for apps owned by Steam account "${CONFIG.steamAccountName}"...`);

	const parsedGameList = await getGameList();

	console.log(`Found ${parsedGameList.length} apps.`);

	const requestedProperties = [];
	for (const requestedProperty in CONFIG.outputProperties) {
		if (CONFIG.outputProperties[requestedProperty]) {
			requestedProperties.push(requestedProperty);
		}
	}

	let output = [];
	for (const game of parsedGameList) {
		output.push(formatPropertiesForApp(game, requestedProperties));
	}

	console.log(`\nWriting app information to "output/${CONFIG.mode}/${CONFIG.steamAccountName}.json"...`);
	fs.writeFileSync(`./output/${CONFIG.mode}/${CONFIG.steamAccountName}.json`, JSON.stringify(output, null, 2));
}

async function getGameList() {
	let gameList = null;
	const parser = new XMLParser();
	let parsedXmlDoc = null;

	// Depending on whether or not a Steam account name or ID is used, the URL format is different.
	// We first try the URL format that expects a Steam account name.
	gameList = await fetch(`https://steamcommunity.com/id/${CONFIG.steamAccountName}/games?xml=1`)
		.then(response => response.text());
	parsedXmlDoc = parser.parse(gameList);

	// If the previous request failed to return a valid response, we try the URL format that expects a Steam account ID.
	if (!parsedXmlDoc.gamesList?.games?.game) {
		gameList = await fetch(`https://steamcommunity.com/profiles/${CONFIG.steamAccountName}/games?xml=1`)
			.then(response => response.text());
			parsedXmlDoc = parser.parse(gameList);
	}

	if (!parsedXmlDoc.gamesList?.games?.game) {
		console.error("\nERROR: XML document does not contain an app list. Most likely, the account's app library is private. Make sure the game library for this account is publicly accessible and try again.");
		console.error(`App information must be accessible via this link: https://steamcommunity.com/id/${CONFIG.steamAccountName}/games or this link: https://steamcommunity.com/profiles/${CONFIG.steamAccountName}/games\n`);
		console.error("The XML document returned by Steam was:");
		console.error(parsedXmlDoc);
		process.exit(1);
	}

	return parsedXmlDoc.gamesList.games.game;
}

function formatPropertiesForApp(game, requestedProperties) {
	let output = {};

	for (const requestedProperty of requestedProperties) {
		if (game[requestedProperty]) {
			output[requestedProperty] = game[requestedProperty];
		}
	}

	return output;
}