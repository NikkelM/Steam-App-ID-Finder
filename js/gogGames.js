// Description: Utility to find game names, and by extension Steam App IDs, for games owned on GOG.

import fs from 'fs';

import { CONFIG } from './utils.js';


export async function steamAppIDsFromGOGAccount() {
	// Log in to GOG
	// visit:
	// auth.gog.com/auth?client_id=46899977096215655&redirect_uri=https%3A%2F%2Fembed.gog.com%2Fon_login_success%3Forigin%3Dclient&response_type=code&layout=client2
	// take the "code" from the response url and use it to get the access token

	const { accessToken, refreshToken } = await getGogAccessToken();
	console.log(accessToken);
	console.log(refreshToken);
}

async function getGogAccessToken() {
	return await fetch('https://auth.gog.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: `client_id=46899977096215655&client_secret=9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9&grant_type=authorization_code&code=${CONFIG.gogLoginCode}&redirect_uri=https%3A%2F%2Fembed.gog.com%2Fon_login_success%3Forigin%3Dclient`
	})
		.then(response => response.json())
		.then(data => {
			console.log(data);
			const accessToken = data.access_token;
			const refreshToken = data.refresh_token;
			return { accessToken, refreshToken };
		}
		);
}