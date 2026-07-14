// Description: Utility to find Steam App IDs for games owned on Steam.

import fs from 'fs';

import { CONFIG, outputDir } from './utils.js';

export async function steamAppIDsFromSteamAccount() {
	console.log("Running in \"steamAccount\" mode.\n");
	console.log(`Getting information for apps owned by Steam account ID "${CONFIG.steamId}"...`);

	const rawGameList = await getGameList();
	const normalizedGameList = rawGameList.map(normalizeGame);

	console.log(`Found ${normalizedGameList.length} apps.`);

	const requestedProperties = [];
	for (const requestedProperty in CONFIG.outputProperties) {
		if (CONFIG.outputProperties[requestedProperty]) {
			requestedProperties.push(requestedProperty);
		}
	}

	let output = [];
	for (const game of normalizedGameList) {
		output.push(formatPropertiesForApp(game, requestedProperties));
	}

	console.log(`\nWriting app information to "${outputDir()}/${CONFIG.steamId}.json"...`);
	fs.writeFileSync(`${outputDir()}/${CONFIG.steamId}.json`, JSON.stringify(output, null, 2));
}

async function getGameList() {
	const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${CONFIG.steamAPIKey}&steamid=${CONFIG.steamId}&include_appinfo=1&include_played_free_games=1&format=json`;
	let json = null;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			const body = await response.text().catch(() => '');
			console.error(`Steam Web API responded with status ${response.status}${response.statusText ? ' ' + response.statusText : ''}`);
			if (body) console.error('Response body:', body);
			throw new Error(`Steam Web API responded with status ${response.status}`);
		}
		json = await response.json();
	} catch (error) {
		console.error("\nERROR: Failed to fetch owned games from Steam Web API. See response body above.");
		console.error(error.message ?? error);
		process.exit(1);
	}

	const games = json?.response?.games;
	if (!games) {
		console.error("\nERROR: Steam Web API response does not contain a games list. The profile may be private or the API key/steamId is incorrect.");
		console.error("The response returned by Steam was:");
		console.error(JSON.stringify(json, null, 2));
		process.exit(1);
	}

	return games;
}

function normalizeGame(game) {
	const appid = game.appid;
	return {
		appID: appid,
		name: game.name,
		logo: buildLogoUrl(appid, game.img_logo_url || game.img_icon_url),
		storeLink: buildStoreLink(appid),
		statsLink: buildStatsLink(CONFIG.steamId, appid),
		globalStatsLink: buildGlobalStatsLink(appid)
	};
}

function buildLogoUrl(appid, hash) {
	if (!appid || !hash) return undefined;
	return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`;
}

function buildStoreLink(appid) {
	return appid ? `https://store.steampowered.com/app/${appid}` : undefined;
}

function buildStatsLink(steamId, appid) {
	return steamId && appid ? `https://steamcommunity.com/profiles/${steamId}/stats/${appid}` : undefined;
}

function buildGlobalStatsLink(appid) {
	return appid ? `https://steamcommunity.com/stats/${appid}/achievements` : undefined;
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