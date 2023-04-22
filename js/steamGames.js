// Description: Utility to find Steam App IDs for games owned on Steam.

import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

import { CONFIG } from './utils.js';

export async function steamAppIDsFromSteamAccount() {
	console.log("Running in \"steamAccount\" mode.\n");
	console.log(`Getting information for apps owned by Steam account "${CONFIG.steamAccountName}"...`);

	const gameList = await getGameList();
	const parsedGameList = await parseAppList(gameList);

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
	return await fetch(`https://steamcommunity.com/profiles/${CONFIG.steamAccountName}/games?xml=1`)
		.then(response => response.text());
}

async function parseAppList(gameList) {
	const parser = new XMLParser();
	const xmlDoc = parser.parse(gameList);
	
	if(!xmlDoc.gamesList?.games?.game) {
		console.error("Error: XML document does not contain an app list. Most likely, the account is private. Make sure the game library for this account is publicly accessible and try again.");
		console.log("The XML document returned by Steam was:");
		console.log(xmlDoc);
		console.log(`Game information must be accessible via this link: https://steamcommunity.com/profiles/${CONFIG.steamAccountName}/games`);
		process.exit(1);
	}

	return xmlDoc.gamesList.games.game;
}

function formatPropertiesForApp(game, requestedProperties) {
	let output = {};

	for(const requestedProperty of requestedProperties) {
		if (game[requestedProperty]) {
			output[requestedProperty] = game[requestedProperty];
		}
	}

	return output;
}
