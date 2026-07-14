// Shared mode dispatcher used by both the CLI (bin/cli.js) and the legacy entry (index.js).

import { initConfig } from './utils.js';
import { steamAppIDsFromGameNames } from './gameNames.js';
import { steamAppIDsFromSteamAccount } from './steamGames.js';
import { steamAppIDsFromGOGAccount } from './gogGames.js';
import { getEpicGamesGames } from './epicGames.js';

// Activate the given (already validated) config and run its mode.
export async function runMode(config) {
	initConfig(config);

	switch (config.mode) {
		case 'gameNames':
			await steamAppIDsFromGameNames();
			break;
		case 'steamAccount':
			await steamAppIDsFromSteamAccount();
			break;
		case 'gogAccount':
			await steamAppIDsFromGOGAccount();
			break;
		case 'epicGamesAccount':
			await getEpicGamesGames();
			break;
		default:
			console.error(`Error: No mode provided, or mode not supported: ${config.mode}.`);
			process.exit(1);
	}
}
