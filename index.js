// Description: Matches game names to their Steam App ID's. Games whose names do not have an exact match in Steam's database are matched using string similarity.

// Suppresses the warning about the fetch API being unstable
process.removeAllListeners('warning');

import { CONFIG } from './js/utils.js';

// ---------- Main ----------

await main();

async function main() {
	// Depending on the chosen "mode" in the config file, run the corresponding function
	switch (CONFIG.mode) {
		case 'gameNames':
			await steamAppIDsFromGameNames();
			break;
		default:
			console.error(`Error: No mode provided in the configuration file, or mode not supported: ${CONFIG.mode}.`);
			process.exit(1);
	}
}