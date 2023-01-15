// Description: This project is a collection of utilities that can be used to find Steam App IDs from a variety of sources.

// Suppresses the warning about the fetch API being unstable
process.removeAllListeners('warning');

import { CONFIG } from './js/utils.js';
import { steamAppIDsFromGameNames } from './js/gameNames.js';
import { steamAppIDsFromSteamAccount } from './js/steamGames.js';
import { steamAppIDsFromGOGAccount } from './js/gogGames.js';

// ---------- Main ----------

await main();

async function main() {
	// Depending on the chosen "mode" in the config file, run the corresponding function
	switch (CONFIG.mode) {
		case 'gameNames':
			await steamAppIDsFromGameNames();
			break;
		case 'steamAccount':
			await steamAppIDsFromSteamAccount();
			break;
		case 'gogAccount':
			await steamAppIDsFromGOGAccount();
			break;
		default:
			console.error(`Error: No mode provided in the configuration file, or mode not supported: ${CONFIG.mode}.`);
			process.exit(1);
	}
}