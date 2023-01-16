// Description: Utility to find the names of games owned on GOG.

import fs from 'fs';
import cliProgress from 'cli-progress';

import { CONFIG } from './utils.js';

export async function steamAppIDsFromGOGAccount() {
	if (CONFIG.refreshToken) {
		var { accessToken, refreshToken } = await getGogAccessToken(null, CONFIG.refreshToken);
	} else if (CONFIG.gogLoginCode) {
		var { accessToken, refreshToken } = await getGogAccessToken(CONFIG.gogLoginCode, null);
	}

	console.log(`Writing refresh token to "output/${CONFIG.mode}/gogRefreshToken.txt". Use this token in the config file to avoid having to log in next time you run the script.\n`);
	fs.writeFileSync(`output/${CONFIG.mode}/gogRefreshToken.txt`, refreshToken, 'utf8');

	// Get the list of apps owned on GOG
	const gogAppIds = await getGogApps(accessToken);

	// Get the game names for the corresponding game IDs
	const gogGameNames = await getGogGameNames(gogAppIds, accessToken);

	console.log(`Writing game names to "output/${CONFIG.mode}/gogGameNames.txt"`);
	fs.writeFileSync(`output/${CONFIG.mode}/gogGameNames.txt`, gogGameNames.join('\n'), 'utf8');
}

// ---------- GOG games ----------

async function getGogApps(accessToken) {
	console.log("Getting apps owned on GOG...");

	const gogAppIds = await fetch('https://embed.gog.com/user/data/games', {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${accessToken}`
		}
	})
		.then(response => response.json())
		.then(data => data.owned);

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
	return await fetch(`https://embed.gog.com/account/gameDetails/${gogGameId}.json`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${accessToken}`
		}
	})
		.then(response => response.json())
		.then(data => data.title);
}

// ---------- Access tokens ----------

async function getGogAccessToken(gogLoginCode, gogRefreshToken) {
	console.log("Getting/refreshing GOG access token...");

	return await fetch('https://auth.gog.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: gogLoginCode !== null
			? `client_id=46899977096215655&client_secret=9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9&grant_type=authorization_code&code=${gogLoginCode}&redirect_uri=https%3A%2F%2Fembed.gog.com%2Fon_login_success%3Forigin%3Dclient`
			: `client_id=46899977096215655&client_secret=9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9&grant_type=refresh_token&refresh_token=${gogRefreshToken}`
	})
		.then(response => response.json())
		.then(data => {
			const accessToken = data.access_token;
			const refreshToken = data.refresh_token;

			if (!accessToken || !refreshToken) {
				console.error("Error: Could not fetch GOG access and/or refresh token. The GOG API returned the following response:");
				console.log(data);
				console.log("If this keeps happening, try logging in to GOG again and getting a new login code.");
				process.exit(1);
			}

			return { accessToken, refreshToken };
		});
}