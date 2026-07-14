#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';

import { loadConfig, validateConfig, describeConfigFields } from '../js/utils.js';
import { runMode } from '../js/run.js';
import { runWizard } from '../js/wizard.js';
import { parseThreshold, parseCacheHours, buildGameNamesConfig, buildSteamAccountConfig, buildGogAccountConfig, buildEpicGamesConfig } from '../js/cliConfig.js';

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

// Validate a config assembled from flags, then run its mode.
async function runConfig(config) {
	validateConfig(config);
	await runMode(config);
}

// True if the user passed at least one option for this command on the command line
// (defaults and environment variables do not count).
function usedCliFlags(command) {
	return command.options.some((option) => command.getOptionValueSource(option.attributeName()) === 'cli');
}

// Fallback for a mode command invoked without any flags: load the config file and run it,
// requiring its mode to match the command that was invoked.
async function runConfigFile(expectedMode) {
	const config = loadConfig();
	if (config.mode !== expectedMode) {
		throw new Error(`the configuration file is for "${config.mode}" mode, but you ran the "${expectedMode}" command. Run the "run" command to use the mode from the config file, or pass ${expectedMode} options directly.`);
	}
	await runMode(config);
}

const program = new Command();

program
	.name('steam-app-id-finder')
	.description('Find Steam App IDs from game names or a Steam account, and export owned-game lists from GOG and Epic Games accounts.')
	.version(pkg.version);

program
	.command('run')
	.description('Run using a configuration file (the mode is read from the file)')
	.option('-c, --config <path>', 'path to a config.json (defaults to ./config.json)')
	.action(async (options) => {
		await runMode(loadConfig(options.config));
	});

program
	.command('gameNames')
	.alias('game-names')
	.description('Match a list of game names to Steam App IDs')
	.option('-i, --input <name>', 'input file name, without extension')
	.option('-t, --type <type>', 'input file type: txt or csv', 'txt')
	.option('-d, --delimiter <char>', 'delimiter between game names (default: newline for txt, comma for csv)')
	.option('-k, --steam-api-key <key>', 'Steam Web API key (falls back to the STEAM_API_KEY env var)')
	.option('--only-full-matches', 'only output full matches')
	.option('--threshold <number>', 'partial match threshold between 0 and 1', parseThreshold)
	.option('--refresh-cache', 'refetch the Steam app list even if a fresh cache exists')
	.option('--cache-hours <number>', 'how long the cached Steam app list stays fresh, in hours (0 disables caching; default 24)', parseCacheHours)
	.option('-o, --out <dir>', 'directory to write output files to (default: output)')
	.action(async (options, command) => {
		if (!usedCliFlags(command)) {
			await runConfigFile('gameNames');
			return;
		}
		await runConfig(buildGameNamesConfig(options));
	})
	.addHelpText('after', () => '\n' + describeConfigFields('gameNames'));

program
	.command('steamAccount')
	.alias('steam-account')
	.description('Get Steam App IDs for the apps owned by a public Steam account')
	.option('-s, --steam-id <id>', 'SteamID64 (17-digit number)')
	.option('-k, --steam-api-key <key>', 'Steam Web API key (falls back to the STEAM_API_KEY env var)')
	.option('-p, --props <list>', 'comma-separated output properties (appID,name,logo,storeLink,statsLink,globalStatsLink)', 'appID,name')
	.option('-o, --out <dir>', 'directory to write output files to (default: output)')
	.action(async (options, command) => {
		if (!usedCliFlags(command)) {
			await runConfigFile('steamAccount');
			return;
		}
		await runConfig(buildSteamAccountConfig(options));
	})
	.addHelpText('after', () => '\n' + describeConfigFields('steamAccount'));

program
	.command('gogAccount')
	.alias('gog-account')
	.description('Get the names of games owned on a GOG account')
	.option('--gog-login-code <code>', 'GOG login code (valid for ~60 seconds)')
	.option('-r, --refresh-token <token>', 'GOG refresh token (falls back to the GOG_REFRESH_TOKEN env var)')
	.option('-o, --out <dir>', 'directory to write output files to (default: output)')
	.action(async (options, command) => {
		if (!usedCliFlags(command)) {
			await runConfigFile('gogAccount');
			return;
		}
		await runConfig(buildGogAccountConfig(options));
	})
	.addHelpText('after', () => '\n' + describeConfigFields('gogAccount'));

program
	.command('epicGamesAccount')
	.alias('epic-games-account')
	.description('Get the names of games from an Epic Games purchase history')
	.option('-e, --epic-cookie <value>', 'EPIC_BEARER_TOKEN cookie value (falls back to the EPIC_COOKIE env var)')
	.option('-o, --out <dir>', 'directory to write output files to (default: output)')
	.action(async (options, command) => {
		if (!usedCliFlags(command)) {
			await runConfigFile('epicGamesAccount');
			return;
		}
		await runConfig(buildEpicGamesConfig(options));
	})
	.addHelpText('after', () => '\n' + describeConfigFields('epicGamesAccount'));

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
	console.error('Error: ' + (error?.message ?? error));
	process.exit(1);
}
