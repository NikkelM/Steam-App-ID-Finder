// Description: Utility to find the names of games owned on GOG.

import fs from 'fs';
import cliProgress from 'cli-progress';

import { CONFIG, outputDir } from './utils.js';

export async function steamAppIDsFromGOGAccount() {
	if (CONFIG.refreshToken) {
		var { accessToken, refreshToken } = await getGogAccessToken(null, CONFIG.refreshToken);
	} else if (CONFIG.gogLoginCode) {
		var { accessToken, refreshToken } = await getGogAccessToken(CONFIG.gogLoginCode, null);
	} else {
		console.error("\nERROR: No GOG credentials provided. Provide --refresh-token or --gog-login-code (or the GOG_REFRESH_TOKEN environment variable, or \"refreshToken\"/\"gogLoginCode\" in your config).");
		console.error("See the README (gogAccount mode) for how to obtain a login code.");
		process.exit(1);
	}

	console.log(`Writing refresh token to "${outputDir()}/gogRefreshToken.txt". Use it via --refresh-token, the GOG_REFRESH_TOKEN environment variable, or "refreshToken" in your config to skip logging in next time.\n`);
	fs.writeFileSync(`${outputDir()}/gogRefreshToken.txt`, refreshToken, 'utf8');

	// Get the list of apps owned on GOG
	const gogAppIds = await getGogApps(accessToken);

	// Get the game names for the corresponding game IDs
	const gogGameNames = await getGogGameNames(gogAppIds, accessToken);

	console.log(`Writing game names to "${outputDir()}/gogGameNames.txt"`);
	fs.writeFileSync(`${outputDir()}/gogGameNames.txt`, gogGameNames.join('\n'), 'utf8');
}

// ---------- GOG games ----------

async function gogResponseToJson(response, description) {
	if (!response.ok) {
		const body = await response.text().catch(() => "");
		console.error(`\nERROR: The GOG API (${description}) responded with status ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`);
		if (response.status === 401) console.error("A 401 usually means your GOG access/refresh token has expired - log in again to get a new login code.");
		if (body) console.error(`Response body: ${body.slice(0, 200)}`);
		process.exit(1);
	}

	try {
		return await response.json();
	} catch (error) {
		console.error(`\nERROR: Could not parse the GOG API (${description}) response as JSON.`);
		console.error(error.message ?? error);
		process.exit(1);
	}
}

async function getGogApps(accessToken) {
	console.log("Getting apps owned on GOG...");

	const gogResponse = await fetch('https://embed.gog.com/user/data/games', {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${accessToken}`
		}
	});

	const gogAppIds = (await gogResponseToJson(gogResponse, "user/data/games")).owned ?? [];

	console.log(`Found ${gogAppIds.length} apps in GOG account.\n`);
	return gogAppIds;
}

async function getGogGameNames(gogGameIds, accessToken) {
	console.log("Getting game names from the GOG API. This may take a bit longer, the API is slow...");

	const progressBar = new cliProgress.SingleBar({
		hideCursor: true,
		format: '|{bar}| {percentage}% | {eta}s left | {value}/{total} apps processed'
	}, cliProgress.Presets.legacy);

	progressBar.start(gogGameIds.length, 0);

	let gameNames = [];
	let numUndefined = 0;
	for (const gogGameId of gogGameIds) {
		// Get the game name from GOG
		const gameName = await getGogGameName(gogGameId, accessToken);
		if (gameName !== undefined) {
			gameNames.push(gameName);
		} else {
			numUndefined++;
		}

		progressBar.increment();
	}

	progressBar.stop();

	console.log(`\nFound ${gameNames.length} named games. ${numUndefined} apps had no game associated with them. These are likely DLC and are not included.`);

	return gameNames;
}

async function getGogGameName(gogGameId, accessToken) {
	const gameResponse = await fetch(`https://embed.gog.com/account/gameDetails/${gogGameId}.json`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${accessToken}`
		}
	});

	if (!gameResponse.ok) {
		return undefined;
	}

	try {
		return (await gameResponse.json()).title;
	} catch {
		return undefined;
	}
}

// ---------- Access tokens ----------

async function getGogAccessToken(gogLoginCode, gogRefreshToken) {
	console.log("Getting/refreshing GOG access token...");

	const tokenResponse = await fetch('https://auth.gog.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: gogLoginCode !== null
			? `client_id=46899977096215655&client_secret=9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9&grant_type=authorization_code&code=${gogLoginCode}&redirect_uri=https%3A%2F%2Fembed.gog.com%2Fon_login_success%3Forigin%3Dclient`
			: `client_id=46899977096215655&client_secret=9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9&grant_type=refresh_token&refresh_token=${gogRefreshToken}`
	});

	if (!tokenResponse.ok) {
		const body = await tokenResponse.text().catch(() => "");
		console.error(`\nError: The GOG token endpoint responded with status ${tokenResponse.status}${tokenResponse.statusText ? ` ${tokenResponse.statusText}` : ""}.`);
		if (body) console.error(`Response body: ${body.slice(0, 200)}`);
		console.log("If this keeps happening, try logging in to GOG again and getting a new login code.");
		process.exit(1);
	}

	let data;
	try {
		data = await tokenResponse.json();
	} catch (error) {
		console.error("Error: Could not parse the GOG token endpoint response as JSON.");
		console.error(error.message ?? error);
		process.exit(1);
	}

	const accessToken = data.access_token;
	const refreshToken = data.refresh_token;

	if (!accessToken || !refreshToken) {
		console.error("Error: Could not fetch GOG access and/or refresh token. The GOG API returned the following response:");
		console.log(data);
		console.log("If this keeps happening, try logging in to GOG again and getting a new login code.");
		process.exit(1);
	}

	return { accessToken, refreshToken };
}