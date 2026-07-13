// Description: Find Steam App IDs from game names or a Steam account, and export owned-game lists from GOG and Epic Games accounts.

import { loadConfig } from './js/utils.js';
import { runMode } from './js/run.js';

// ---------- Main ----------

// Backwards-compatible entry point: load and validate the configuration file, then run the selected mode.
// The CLI (bin/cli.js) is the primary interface.
try {
	await runMode(loadConfig());
} catch (error) {
	console.error("Error: " + (error?.message ?? error));
	process.exit(1);
}