// Interactive configuration builder for the CLI (`steam-app-id-finder init`).

import fs from 'fs';
import { input, select, checkbox, confirm, password } from '@inquirer/prompts';

import { validateConfig } from './utils.js';
import { runMode } from './run.js';

export async function runWizard(outputPath = 'config.json') {
	const mode = await select({
		message: 'Which mode do you want to configure?',
		choices: [
			{ name: 'gameNames - match a list of game names to Steam App IDs', value: 'gameNames' },
			{ name: 'steamAccount - apps owned by a public Steam account', value: 'steamAccount' },
			{ name: 'gogAccount - games owned on a GOG account', value: 'gogAccount' },
			{ name: 'epicGamesAccount - games from an Epic Games purchase history', value: 'epicGamesAccount' }
		]
	});

	let config;
	switch (mode) {
		case 'gameNames':
			config = await gameNamesWizard();
			break;
		case 'steamAccount':
			config = await steamAccountWizard();
			break;
		case 'gogAccount':
			config = await gogAccountWizard();
			break;
		case 'epicGamesAccount':
			config = await epicGamesWizard();
			break;
	}

	// A shared, optional setting for every mode: only stored when changed from the default.
	const outputDirectory = await input({
		message: 'Output directory:',
		default: 'output',
		validate: (value) => value.trim() ? true : 'An output directory is required.'
	});
	if (outputDirectory.trim() !== 'output') {
		config.outputDirectory = outputDirectory.trim();
	}

	// Sanity-check the assembled configuration against the schema before writing it.
	validateConfig(config);

	if (fs.existsSync(outputPath)) {
		const overwrite = await confirm({ message: `"${outputPath}" already exists. Overwrite it?`, default: false });
		if (!overwrite) {
			console.log("Aborted - existing configuration file was not changed.");
			return;
		}
	}

	fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
	console.log(`\nWrote configuration to "${outputPath}".`);

	const runNow = await confirm({ message: 'Run this mode now?', default: true });
	if (runNow) {
		await runMode(config);
	}
}

async function gameNamesWizard() {
	const fileName = await input({
		message: 'Input file name (without extension):',
		default: 'gameNames',
		validate: (value) => value.trim() ? true : 'A file name is required.'
	});
	const fileType = await select({
		message: 'Input file type:',
		choices: [{ name: 'txt', value: 'txt' }, { name: 'csv', value: 'csv' }],
		default: 'txt'
	});
	let delimiter = await select({
		message: 'How are the game names separated in the file?',
		choices: [
			{ name: 'One per line (newline)', value: '\n' },
			{ name: 'Comma', value: ',' },
			{ name: 'Something else', value: 'custom' }
		],
		default: fileType === 'csv' ? ',' : '\n'
	});
	if (delimiter === 'custom') {
		delimiter = await input({ message: 'Enter the delimiter:', validate: (value) => value.length > 0 ? true : 'A delimiter is required.' });
	}
	const steamAPIKey = await password({
		message: 'Steam Web API key (get one at https://steamcommunity.com/dev/apikey):',
		mask: true,
		validate: (value) => value.trim() ? true : 'A Steam Web API key is required for this mode.'
	});
	const onlyFullMatches = await confirm({ message: 'Only output full matches?', default: false });

	const config = {
		mode: 'gameNames',
		inputFile: { fileName: fileName.trim(), fileType, delimiter },
		steamAPIKey: steamAPIKey.trim(),
		onlyFullMatches
	};

	if (!onlyFullMatches) {
		const threshold = await input({
			message: 'Partial match threshold (0-1, higher is stricter):',
			default: '0.65',
			validate: (value) => {
				const number = Number.parseFloat(value);
				return (!Number.isNaN(number) && number >= 0 && number <= 1) ? true : 'Enter a number between 0 and 1.';
			}
		});
		config.partialMatchThreshold = Number.parseFloat(threshold);
	}

	return config;
}

async function steamAccountWizard() {
	const steamId = await input({
		message: 'SteamID64 (17-digit number):',
		validate: (value) => /^\d{17}$/.test(value.trim()) ? true : 'Enter a 17-digit SteamID64.'
	});
	const steamAPIKey = await password({
		message: 'Steam Web API key (get one at https://steamcommunity.com/dev/apikey):',
		mask: true,
		validate: (value) => value.trim() ? true : 'A Steam Web API key is required for this mode.'
	});
	const selected = await checkbox({
		message: 'Which properties should be included in the output?',
		required: true,
		choices: [
			{ name: 'appID', value: 'appID', checked: true },
			{ name: 'name', value: 'name', checked: true },
			{ name: 'logo', value: 'logo' },
			{ name: 'storeLink', value: 'storeLink' },
			{ name: 'statsLink', value: 'statsLink' },
			{ name: 'globalStatsLink', value: 'globalStatsLink' }
		]
	});

	const outputProperties = {};
	for (const property of selected) {
		outputProperties[property] = true;
	}

	return { mode: 'steamAccount', steamId: steamId.trim(), steamAPIKey: steamAPIKey.trim(), outputProperties };
}

async function gogAccountWizard() {
	const method = await select({
		message: 'How do you want to authenticate with GOG?',
		choices: [
			{ name: 'Refresh token (from a previous run)', value: 'refreshToken' },
			{ name: 'Login code (from the GOG login page)', value: 'gogLoginCode' }
		]
	});
	const value = await input({
		message: method === 'refreshToken' ? 'Enter your GOG refresh token:' : 'Enter your GOG login code:',
		validate: (entered) => entered.trim() ? true : 'A value is required.'
	});

	return { mode: 'gogAccount', [method]: value.trim() };
}

async function epicGamesWizard() {
	console.log('\nGet the EPIC_BEARER_TOKEN cookie value from https://accounts.epicgames.com/account/transactions/purchases');
	console.log('(open DevTools with F12 -> Application -> Cookies -> accounts.epicgames.com -> EPIC_BEARER_TOKEN).\n');
	const epicGamesCookie = await input({
		message: 'EPIC_BEARER_TOKEN cookie value:',
		validate: (value) => value.trim() ? true : 'The cookie value is required.'
	});

	return { mode: 'epicGamesAccount', epicGamesCookie: epicGamesCookie.trim() };
}
