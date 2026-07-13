// Pure builders that turn parsed CLI options into a mode configuration object.
// They are kept separate from bin/cli.js so the command wrappers can be unit tested,
// and they throw on invalid input so the CLI can report the error and exit.

import { InvalidArgumentError } from 'commander';

export const STEAM_OUTPUT_PROPERTIES = ['appID', 'name', 'logo', 'storeLink', 'statsLink', 'globalStatsLink'];

// Commander option parser for --threshold.
export function parseThreshold(value) {
	const number = Number.parseFloat(value);
	if (Number.isNaN(number) || number < 0 || number > 1) {
		throw new InvalidArgumentError('Threshold must be a number between 0 and 1.');
	}
	return number;
}

export function buildGameNamesConfig(options, env = process.env) {
	const inputFile = { fileName: options.input, fileType: options.type };
	if (options.delimiter !== undefined) {
		inputFile.delimiter = options.delimiter;
	}
	const config = {
		mode: 'gameNames',
		inputFile,
		steamAPIKey: options.steamApiKey ?? env.STEAM_API_KEY ?? ''
	};
	if (options.onlyFullMatches) {
		config.onlyFullMatches = true;
	}
	if (options.threshold !== undefined) {
		config.partialMatchThreshold = options.threshold;
	}
	return config;
}

export function buildSteamAccountConfig(options, env = process.env) {
	const requested = String(options.props ?? 'appID,name').split(',').map((value) => value.trim()).filter(Boolean);
	const invalid = requested.filter((value) => !STEAM_OUTPUT_PROPERTIES.includes(value));
	if (invalid.length > 0) {
		throw new Error(`invalid --props value(s): ${invalid.join(', ')}. Valid properties are: ${STEAM_OUTPUT_PROPERTIES.join(', ')}.`);
	}
	const outputProperties = {};
	for (const property of requested) {
		outputProperties[property] = true;
	}
	return {
		mode: 'steamAccount',
		steamId: options.steamId,
		steamAPIKey: options.steamApiKey ?? env.STEAM_API_KEY ?? '',
		outputProperties
	};
}

export function buildGogAccountConfig(options, env = process.env) {
	const config = { mode: 'gogAccount' };
	const refreshToken = options.refreshToken ?? env.GOG_REFRESH_TOKEN;
	if (refreshToken) {
		config.refreshToken = refreshToken;
	}
	if (options.gogLoginCode) {
		config.gogLoginCode = options.gogLoginCode;
	}
	if (!config.refreshToken && !config.gogLoginCode) {
		throw new Error('provide --refresh-token (or the GOG_REFRESH_TOKEN env var) or --gog-login-code.');
	}
	return config;
}

export function buildEpicGamesConfig(options, env = process.env) {
	const epicGamesCookie = options.epicCookie ?? env.EPIC_COOKIE;
	if (!epicGamesCookie) {
		throw new Error('provide --epic-cookie (or the EPIC_COOKIE env var).');
	}
	return { mode: 'epicGamesAccount', epicGamesCookie };
}
