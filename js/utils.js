import jsonschema from 'jsonschema';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const packageConfigDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config');
export let CONFIG;

// ----- Config -----

export function loadConfig(configPath) {
	let config;
	let configFileName = configPath;
	try {
		if (!configFileName) {
			if (fs.existsSync('config/config.json')) {
				configFileName = 'config/config.json';
			} else if (fs.existsSync('config.json')) {
				configFileName = 'config.json';
			}
		}
		if (!configFileName || !fs.existsSync(configFileName)) {
			console.error("Error loading configuration file: no configuration file found. Provide \"config/config.json\" or \"config.json\".");
			process.exit(1);
		}
		console.log(`Loading configuration file "${configFileName}"...`);
		config = JSON.parse(fs.readFileSync(configFileName));
	} catch (error) {
		console.error("Error loading configuration file: " + error);
		process.exit(1);
	}

	validateConfig(config);
	return config;
}

// Validate the config file against the schema
export function validateConfigResult(config) {
	const validator = new jsonschema.Validator();
	// Register the per-mode sub-schemas referenced by config.schema.json.
	for (const subSchema of ['schema.gameNames.json', 'schema.steamAccount.json', 'schema.gogAccount.json', 'schema.epicGamesAccount.json']) {
		validator.addSchema(JSON.parse(fs.readFileSync(path.join(packageConfigDir, subSchema))), `/${subSchema}`);
	}
	return validator.validate(config, JSON.parse(fs.readFileSync(path.join(packageConfigDir, 'config.schema.json'))));
}

// Validate the config file against the schema, exiting the process on failure
export function validateConfig(config) {
	console.log("Validating configuration file...");
	const result = validateConfigResult(config);
	if (result.errors.length > 0) {
		console.error("Error validating configuration file: " + result.errors.map((error) => error.stack).join('; '));
		process.exit(1);
	}

	console.log("Configuration file validated successfully!\n");
}

export function initConfig(config) {
	CONFIG = config;
	setupOutput(CONFIG.mode);
}

// ----- Output -----

function setupOutput(mode) {
	// Create the output directory if it doesn't exist
	if (!fs.existsSync('output/' + mode)) {
		fs.mkdirSync('output/' + mode, { recursive: true });
	}
}