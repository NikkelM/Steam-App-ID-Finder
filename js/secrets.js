// Description: Resolves the credential each mode needs at runtime from flags, environment variables, config (discouraged) or an interactive prompt - never writing secrets to disk

import { select, input, password } from '@inquirer/prompts';

import { resolveSecret, envVarInstructions } from './utils.js';

// Resolve and set the secret(s) the given mode needs, mutating the config in place
export async function resolveModeSecrets(config, flags = {}) {
	switch (config.mode) {
		case 'gameNames':
		case 'steamAccount':
			config.steamAPIKey = await resolveSecret({
				flagValue: flags.steamApiKey,
				envVar: 'STEAM_API_KEY',
				configValue: config.steamAPIKey,
				configField: 'steamAPIKey',
				promptMessage: 'Steam Web API key (https://steamcommunity.com/dev/apikey):',
				label: 'Steam Web API key'
			});
			break;
		case 'epicGamesAccount':
			config.epicGamesCookie = await resolveSecret({
				flagValue: flags.epicCookie,
				envVar: 'EPIC_COOKIE',
				configValue: config.epicGamesCookie,
				configField: 'epicGamesCookie',
				promptMessage: 'EPIC_BEARER_TOKEN cookie value:',
				label: 'Epic Games cookie'
			});
			break;
		case 'gogAccount':
			await resolveGogCredentials(config, flags);
			break;
	}
}

// GOG accepts either a refresh token (persistent, preferred) or a single-use login code, so it needs its own resolution
async function resolveGogCredentials(config, flags) {
	if (config.refreshToken?.trim() || config.gogLoginCode?.trim()) {
		throw new Error(`for your security, GOG credentials must not be stored in the configuration file. Remove "refreshToken"/"gogLoginCode" from your config, then set the GOG_REFRESH_TOKEN environment variable instead:\n${envVarInstructions('GOG_REFRESH_TOKEN')}`);
	}

	const flagRefresh = flags.refreshToken?.trim();
	const flagCode = flags.gogLoginCode?.trim();
	if (flagRefresh) {
		config.refreshToken = flagRefresh;
		return;
	}
	if (flagCode) {
		config.gogLoginCode = flagCode;
		return;
	}

	const envRefresh = process.env.GOG_REFRESH_TOKEN?.trim();
	if (envRefresh) {
		config.refreshToken = envRefresh;
		return;
	}

	if (process.stdin.isTTY) {
		const method = await select({
			message: 'How do you want to authenticate with GOG?',
			choices: [
				{ name: 'Refresh token (from a previous run)', value: 'refreshToken' },
				{ name: 'Login code (from the GOG login page, valid for 60 seconds)', value: 'gogLoginCode' }
			]
		});
		if (method === 'refreshToken') {
			const value = await password({ message: 'GOG refresh token:', mask: true, validate: (entered) => entered.trim() ? true : 'A refresh token is required.' });
			config.refreshToken = value.trim();
		} else {
			const value = await input({ message: 'GOG login code:', validate: (entered) => entered.trim() ? true : 'A login code is required.' });
			config.gogLoginCode = value.trim();
		}
		return;
	}

	throw new Error(`GOG credentials are required - set the GOG_REFRESH_TOKEN environment variable, pass --refresh-token or --gog-login-code, or run in an interactive terminal to be prompted:\n${envVarInstructions('GOG_REFRESH_TOKEN')}`);
}
