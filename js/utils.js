
import jsonschema from 'jsonschema';
import fs from 'fs';

// ---------- Setup ----------

setupOutput();
export const CONFIG = loadConfig();

// ----- Config -----

function loadConfig() {
	let CONFIG;
	try {
		let configFileName;
		if (fs.existsSync('config.json')) {
			console.log("Loading configuration file \"config.json\"...");
			configFileName = 'config.json';
		} else if (fs.existsSync('/config.default.json')) {
			console.log("!!! No custom configuration file found! Loading default configuration file \"config.default.json\"...");
			configFileName = 'config.default.json';
		}
		CONFIG = JSON.parse(fs.readFileSync(configFileName));
	} catch (error) {
		console.error("Error loading configuration file: " + error);
		process.exit(1);
	}

	// Validate the config file against the schema
	console.log("Validating configuration file...\n");
	try {
		const validator = new jsonschema.Validator();
		validator.validate(CONFIG, JSON.parse(fs.readFileSync('config.schema.json')), { throwError: true });
	} catch (error) {
		console.error("Error validating configuration file: " + error);
		process.exit(1);
	}

	return CONFIG;
}

// ----- Output -----

function setupOutput() {
	// Create the output directory if it doesn't exist
	if (!fs.existsSync('output')) {
		fs.mkdirSync('output');
	}
}