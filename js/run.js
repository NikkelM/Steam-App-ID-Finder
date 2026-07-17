// Shared mode dispatcher used by both the CLI (bin/cli.js) and the legacy entry (index.js).

import { initConfig } from './utils.js';
import { resolveModeSecrets } from './secrets.js';
import { steamAppIDsFromGameNames } from './gameNames.js';
import { steamAppIDsFromSteamAccount } from './steamGames.js';
import { steamAppIDsFromGOGAccount } from './gogGames.js';
import { getEpicGamesGames } from './epicGames.js';

// Activate the given (already validated) config, resolve its secret(s), and run its mode.
export async function runMode(config, flags = {}) {
	initConfig(config);
	await resolveModeSecrets(config, flags);

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
