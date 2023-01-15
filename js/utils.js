
import jsonschema from 'jsonschema';
import fs from 'fs';

// ---------- Setup ----------

export const CONFIG = loadConfig();
setupOutput(CONFIG.mode);

// ----- Config -----

function loadConfig() {
	let CONFIG;
	try {
		let configFileName;
		if (fs.existsSync('config.json')) {
			console.log("Loading configuration file \"config.json\"...");
			configFileName = 'config.json';
		} else if (fs.existsSync(`config/config.json`)) {
			console.log("Loading configuration file \"config/config.json\"...");
			configFileName = 'config/config.json';
		}
		CONFIG = JSON.parse(fs.readFileSync(configFileName));
	} catch (error) {
		console.error("Error loading configuration file: " + error);
		process.exit(1);
	}

	// Validate the config file against the schema
	let schemaFileName;
	switch (CONFIG.mode) {
		case 'gameNames':
			schemaFileName = 'config/config.gameNames.schema.json';
			break;
		case 'steamAccount':
			schemaFileName = 'config/config.steamAccount.schema.json';
		default:
			console.error(`Error: No mode provided in the configuration file, or mode not supported: ${CONFIG.mode}.`);
			process.exit(1);
	}

	console.log("Validating configuration file...\n");
	try {
		const validator = new jsonschema.Validator();
		validator.validate(CONFIG, JSON.parse(fs.readFileSync(schemaFileName)), { throwError: true });
	} catch (error) {
		console.error("Error validating configuration file: " + error);
		process.exit(1);
	}

	return CONFIG;
}

// ----- Output -----

function setupOutput(mode) {
	// Create the output directory if it doesn't exist
	if (!fs.existsSync('output/' + mode)) {
		fs.mkdirSync('output/' + mode, { recursive: true });
	}
}