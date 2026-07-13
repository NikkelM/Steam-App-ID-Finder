#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, InvalidArgumentError } from 'commander';

import { loadConfig, validateConfig } from '../js/utils.js';
import { runMode } from '../js/run.js';
import { runWizard } from '../js/wizard.js';

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

// Validate a config assembled from flags, then run its mode.
async function runConfig(config) {
	validateConfig(config);
	await runMode(config);
}

function parseThreshold(value) {
	const number = Number.parseFloat(value);
	if (Number.isNaN(number) || number < 0 || number > 1) {
		throw new InvalidArgumentError('Threshold must be a number between 0 and 1.');
	}
	return number;
}

const program = new Command();

program
	.name('steam-app-id-finder')
	.description('Find Steam App IDs from game names or a Steam account, and export owned-game lists from GOG and Epic Games accounts.')
	.version(pkg.version);

program
	.command('run')
	.description('Run using a configuration file (the mode is read from the file)')
	.option('-c, --config <path>', 'path to a config.json (defaults to ./config/config.json or ./config.json)')
	.action(async (options) => {
		await runMode(loadConfig(options.config));
	});

program
	.command('gameNames')
	.alias('game-names')
	.description('Match a list of game names to Steam App IDs')
	.requiredOption('-i, --input <name>', 'input file name, without extension')
	.option('-t, --type <type>', 'input file type: txt or csv', 'txt')
	.option('-d, --delimiter <char>', 'delimiter between game names', ',')
	.option('-k, --steam-api-key <key>', 'Steam Web API key (falls back to the STEAM_API_KEY env var)')
	.option('--only-full-matches', 'only output full matches')
	.option('--threshold <number>', 'partial match threshold between 0 and 1', parseThreshold)
	.action(async (options) => {
		const config = {
			mode: 'gameNames',
			inputFile: { fileName: options.input, fileType: options.type, delimiter: options.delimiter },
			steamAPIKey: options.steamApiKey ?? process.env.STEAM_API_KEY ?? ''
		};
		if (options.onlyFullMatches) {
			config.onlyFullMatches = true;
		}
		if (options.threshold !== undefined) {
			config.partialMatchThreshold = options.threshold;
		}
		await runConfig(config);
	});

program
	.command('steamAccount')
	.alias('steam-account')
	.description('Get Steam App IDs for the apps owned by a public Steam account')
	.requiredOption('-s, --steam-id <id>', 'SteamID64 (17-digit number)')
	.option('-k, --steam-api-key <key>', 'Steam Web API key (falls back to the STEAM_API_KEY env var)')
	.option('-p, --props <list>', 'comma-separated output properties (appID,name,logo,storeLink,statsLink,globalStatsLink)', 'appID,name')
	.action(async (options) => {
		const validProps = ['appID', 'name', 'logo', 'storeLink', 'statsLink', 'globalStatsLink'];
		const requested = options.props.split(',').map((value) => value.trim()).filter(Boolean);
		const invalid = requested.filter((value) => !validProps.includes(value));
		if (invalid.length > 0) {
			console.error(`Error: invalid --props value(s): ${invalid.join(', ')}. Valid properties are: ${validProps.join(', ')}.`);
			process.exit(1);
		}
		const outputProperties = {};
		for (const property of requested) {
			outputProperties[property] = true;
		}
		await runConfig({
			mode: 'steamAccount',
			steamId: options.steamId,
			steamAPIKey: options.steamApiKey ?? process.env.STEAM_API_KEY ?? '',
			outputProperties
		});
	});

program
	.command('gogAccount')
	.alias('gog-account')
	.description('Get the names of games owned on a GOG account')
	.option('--gog-login-code <code>', 'GOG login code (valid for ~60 seconds)')
	.option('-r, --refresh-token <token>', 'GOG refresh token (falls back to the GOG_REFRESH_TOKEN env var)')
	.action(async (options) => {
		const config = { mode: 'gogAccount' };
		const refreshToken = options.refreshToken ?? process.env.GOG_REFRESH_TOKEN;
		if (refreshToken) {
			config.refreshToken = refreshToken;
		}
		if (options.gogLoginCode) {
			config.gogLoginCode = options.gogLoginCode;
		}
		if (!config.refreshToken && !config.gogLoginCode) {
			console.error('Error: provide --refresh-token (or the GOG_REFRESH_TOKEN env var) or --gog-login-code.');
			process.exit(1);
		}
		await runConfig(config);
	});

program
	.command('epicGamesAccount')
	.alias('epic-games-account')
	.description('Get the names of games from an Epic Games purchase history')
	.option('-e, --epic-cookie <value>', 'EPIC_BEARER_TOKEN cookie value (falls back to the EPIC_COOKIE env var)')
	.action(async (options) => {
		const epicGamesCookie = options.epicCookie ?? process.env.EPIC_COOKIE;
		if (!epicGamesCookie) {
			console.error('Error: provide --epic-cookie (or the EPIC_COOKIE env var).');
			process.exit(1);
		}
		await runConfig({ mode: 'epicGamesAccount', epicGamesCookie });
	});

program
	.command('init')
	.description('Interactively build a configuration file')
	.option('-o, --output <path>', 'where to write the configuration file', 'config.json')
	.action(async (options) => {
		await runWizard(options.output);
	});

program.showHelpAfterError('(run with --help to see available commands)');

// Show help when invoked with no command.
if (process.argv.length <= 2) {
	program.help();
}

try {
	await program.parseAsync(process.argv);
} catch (error) {
	console.error(error?.message ?? error);
	process.exit(1);
}
