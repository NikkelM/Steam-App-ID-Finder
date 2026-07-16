import jsonschema from 'jsonschema';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const packageConfigDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config');
export let CONFIG;

// ----- Config -----

// Load a config from the given path, or discover ./config.json in the current directory, then validate it against the shipped schema
export function loadConfig(configPath) {
	let configFileName = configPath;
	if (!configFileName) {
		if (fs.existsSync('config.json')) {
			console.log("Loading configuration file \"config.json\"...");
			configFileName = 'config.json';
		} else {
			console.error("Error loading configuration file: no \"config.json\" found in the current directory. Run \"steam-app-id-finder init\" to create one, pass --config <path>, or run a mode directly with flags (see --help).");
			process.exit(1);
		}
	} else if (!fs.existsSync(configFileName)) {
		console.error(`Error loading configuration file: no configuration file found at "${configFileName}".`);
		process.exit(1);
	} else {
		console.log(`Loading configuration file "${configFileName}"...`);
	}

	let config;
	try {
		config = JSON.parse(fs.readFileSync(configFileName, 'utf8').replace(/^\uFEFF/, ''));
	} catch (error) {
		console.error(`Error parsing configuration file "${configFileName}" as JSON: ${error.message ?? error}`);
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

	const unknownKeys = unknownTopLevelKeys(config);
	if (unknownKeys.length > 0) {
		console.error(`Error validating configuration file: unknown top-level ${unknownKeys.length === 1 ? "key" : "keys"} ${unknownKeys.map((key) => `"${key}"`).join(", ")}. Check for typos, or fields that belong to a different mode.`);
		process.exit(1);
	}

	console.log("Configuration file validated successfully!\n");
}

// The jsonschema validator can't reject unknown top-level keys injected via $ref/if-then, so check them against the schemas ourselves
function unknownTopLevelKeys(config) {
	if (!config || typeof config !== "object") return [];

	const root = JSON.parse(fs.readFileSync(path.join(packageConfigDir, "config.schema.json")));
	const allowed = new Set(Object.keys(root.properties ?? {}));

	const subSchemaByMode = {
		gameNames: "schema.gameNames.json",
		steamAccount: "schema.steamAccount.json",
		gogAccount: "schema.gogAccount.json",
		epicGamesAccount: "schema.epicGamesAccount.json"
	};
	const subSchemaFile = subSchemaByMode[config.mode];
	if (subSchemaFile) {
		const sub = JSON.parse(fs.readFileSync(path.join(packageConfigDir, subSchemaFile)));
		for (const key of Object.keys(sub.properties ?? {})) allowed.add(key);
	}

	return Object.keys(config).filter((key) => !allowed.has(key));
}

// Build a human-readable description of a mode's configuration fields from its JSON schema,
// used to enrich the CLI's per-mode --help output.
export function describeConfigFields(mode) {
	const schema = JSON.parse(fs.readFileSync(path.join(packageConfigDir, `schema.${mode}.json`), 'utf8'));
	const lines = ['Configuration fields (each maps to an option above and can also be set in a config.json):', ''];

	function wrap(text, indent) {
		const width = 80 - indent.length;
		const wrapped = [];
		let current = '';
		for (const word of text.split(/\s+/)) {
			if (current && (current.length + word.length + 1) > width) {
				wrapped.push(indent + current);
				current = word;
			} else {
				current = current ? `${current} ${word}` : word;
			}
		}
		if (current) wrapped.push(indent + current);
		return wrapped.join('\n');
	}

	function addProperties(properties, prefix) {
		for (const [name, definition] of Object.entries(properties ?? {})) {
			const key = prefix ? `${prefix}.${name}` : name;
			if (definition.description) {
				lines.push(`  ${key}`);
				lines.push(wrap(definition.description, '      '));
			}
			if (definition.type === 'object' && definition.properties) {
				addProperties(definition.properties, key);
			}
		}
	}

	addProperties(schema.properties, '');

	// Also surface shared, top-level fields (e.g. outputDirectory) that apply to every mode.
	const rootSchema = JSON.parse(fs.readFileSync(path.join(packageConfigDir, 'config.schema.json'), 'utf8'));
	const sharedFields = Object.fromEntries(
		Object.entries(rootSchema.properties ?? {}).filter(([name]) => !['$schema', 'mode'].includes(name))
	);
	addProperties(sharedFields, '');

	return lines.join('\n');
}

export function initConfig(config) {
	CONFIG = config;
	setupOutput();
}

// ----- Output -----

// The directory a mode writes its output files to: <outputDirectory>/<mode> (default "output").
export function outputDir() {
	return path.join(CONFIG.outputDirectory ?? 'output', CONFIG.mode);
}

// A path to a file inside the current mode's output directory, joined with OS-native separators
export function outputPath(...segments) {
	return path.join(outputDir(), ...segments);
}

function setupOutput() {
	// Create the output directory if it doesn't exist
	const dir = outputDir();
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}