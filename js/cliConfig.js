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

// Commander option parser for --cache-hours.
export function parseCacheHours(value) {
	const number = Number.parseFloat(value);
	if (Number.isNaN(number) || number < 0) {
		throw new InvalidArgumentError('The cache duration must be a number of hours >= 0 (0 disables caching).');
	}
	return number;
}

// Set the output directory on a config when the --out flag was provided.
function withOutputDirectory(config, options) {
	if (options.out) {
		config.outputDirectory = options.out;
	}
	return config;
}

export function buildGameNamesConfig(options) {
	if (!options.input) {
		throw new Error('provide -i, --input (the input file name, without extension), or a config.json.');
	}
	const inputFile = { fileName: options.input, fileType: options.type };
	if (options.delimiter !== undefined) {
		inputFile.delimiter = options.delimiter;
	}
	const config = {
		mode: 'gameNames',
		inputFile
	};
	if (options.onlyFullMatches) {
		config.onlyFullMatches = true;
	}
	if (options.threshold !== undefined) {
		config.partialMatchThreshold = options.threshold;
	}
	if (options.refreshCache) {
		config.refreshCache = true;
	}
	if (options.cacheHours !== undefined) {
		config.appListCacheHours = options.cacheHours;
	}
	return withOutputDirectory(config, options);
}

export function buildSteamAccountConfig(options) {
	if (!options.steamId) {
		throw new Error('provide -s, --steam-id (a 17-digit SteamID64), or a config.json.');
	}
	const requested = String(options.props ?? 'appID,name').split(',').map((value) => value.trim()).filter(Boolean);
	const invalid = requested.filter((value) => !STEAM_OUTPUT_PROPERTIES.includes(value));
	if (invalid.length > 0) {
		throw new Error(`invalid --props value(s): ${invalid.join(', ')}. Valid properties are: ${STEAM_OUTPUT_PROPERTIES.join(', ')}.`);
	}
	const outputProperties = {};
	for (const property of requested) {
		outputProperties[property] = true;
	}
	return withOutputDirectory({
		mode: 'steamAccount',
		steamId: options.steamId,
		outputProperties
	}, options);
}

export function buildGogAccountConfig(options) {
	return withOutputDirectory({ mode: 'gogAccount' }, options);
}

export function buildEpicGamesConfig(options) {
	return withOutputDirectory({ mode: 'epicGamesAccount' }, options);
}
