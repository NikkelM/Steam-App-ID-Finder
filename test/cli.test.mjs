// Description: Tests for the CLI command wrappers (bin/cli.js) and the flag -> config builders.

// The builder tests are pure and always run. The subprocess tests run the actual CLI binary
// for paths that exit before any network call (help, version, argument validation), so they
// need no credentials. Credential env vars are cleared so a local setup cannot affect them.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
	parseThreshold,
	buildGameNamesConfig,
	buildSteamAccountConfig,
	buildGogAccountConfig,
	buildEpicGamesConfig,
	STEAM_OUTPUT_PROPERTIES
} from '../js/cliConfig.js';
import { validateConfigResult, describeConfigFields } from '../js/utils.js';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cliJs = path.join(repoRoot, 'bin', 'cli.js');

// Run the CLI from an empty temp directory by default so a config.json in the repo
// (or the developer's working tree) cannot influence the config-file fallback tests.
const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saif-cli-'));

function runCli(args, env = {}, cwd = emptyCwd) {
	return spawnSync(process.execPath, [cliJs, ...args], {
		cwd,
		encoding: 'utf8',
		env: { ...process.env, STEAM_API_KEY: '', GOG_REFRESH_TOKEN: '', EPIC_COOKIE: '', ...env }
	});
}

const isValid = (config) => validateConfigResult(config).errors.length === 0;

// ---------- Config builders ----------

describe('CLI config builders', () => {
	it('gameNames maps flags to the expected config and validates', () => {
		const config = buildGameNamesConfig(
			{ input: 'games', type: 'txt', delimiter: ',', steamApiKey: 'KEY', threshold: 0.7 },
			{}
		);
		assert.deepEqual(config, {
			mode: 'gameNames',
			inputFile: { fileName: 'games', fileType: 'txt', delimiter: ',' },
			steamAPIKey: 'KEY',
			partialMatchThreshold: 0.7
		});
		assert.ok(isValid(config));
	});

	it('gameNames sets onlyFullMatches and omits threshold when not provided', () => {
		const config = buildGameNamesConfig({ input: 'g', type: 'csv', delimiter: ';', steamApiKey: 'K', onlyFullMatches: true }, {});
		assert.equal(config.onlyFullMatches, true);
		assert.ok(!('partialMatchThreshold' in config));
		assert.ok(isValid(config));
	});

	it('gameNames omits the delimiter when not provided (the runtime default applies), and still validates', () => {
		const config = buildGameNamesConfig({ input: 'g', type: 'txt', steamApiKey: 'K' }, {});
		assert.ok(!('delimiter' in config.inputFile));
		assert.ok(isValid(config));
	});

	it('steamAPIKey falls back to the STEAM_API_KEY env var', () => {
		const config = buildGameNamesConfig({ input: 'g', type: 'txt', delimiter: ',' }, { STEAM_API_KEY: 'FROM_ENV' });
		assert.equal(config.steamAPIKey, 'FROM_ENV');
	});

	it('gameNames throws when --input is missing', () => {
		assert.throws(() => buildGameNamesConfig({ type: 'txt' }, {}), /--input/);
	});

	it('--out sets outputDirectory (and it validates), while omitting it leaves the default', () => {
		const withOut = buildGameNamesConfig({ input: 'g', type: 'txt', steamApiKey: 'K', out: 'custom-out' }, {});
		assert.equal(withOut.outputDirectory, 'custom-out');
		assert.ok(isValid(withOut));

		const withoutOut = buildGameNamesConfig({ input: 'g', type: 'txt', steamApiKey: 'K' }, {});
		assert.ok(!('outputDirectory' in withoutOut));
	});

	it('steamAccount maps --props to outputProperties and validates', () => {
		const config = buildSteamAccountConfig({ steamId: '12345678901234567', steamApiKey: 'K', props: 'appID, logo' }, {});
		assert.deepEqual(config.outputProperties, { appID: true, logo: true });
		assert.ok(isValid(config));
	});

	it('steamAccount defaults --props to appID,name', () => {
		const config = buildSteamAccountConfig({ steamId: '12345678901234567', steamApiKey: 'K' }, {});
		assert.deepEqual(config.outputProperties, { appID: true, name: true });
		assert.ok(isValid(config));
	});

	it('every builder threads --out into outputDirectory', () => {
		assert.equal(buildSteamAccountConfig({ steamId: '12345678901234567', steamApiKey: 'K', out: 'o' }, {}).outputDirectory, 'o');
		assert.equal(buildGogAccountConfig({ refreshToken: 'T', out: 'o' }, {}).outputDirectory, 'o');
		assert.equal(buildEpicGamesConfig({ epicCookie: 'C', out: 'o' }, {}).outputDirectory, 'o');
	});

	it('steamAccount throws on an invalid prop', () => {
		assert.throws(
			() => buildSteamAccountConfig({ steamId: '12345678901234567', steamApiKey: 'K', props: 'appID,bogus' }, {}),
			/invalid --props/
		);
	});

	it('steamAccount throws when --steam-id is missing', () => {
		assert.throws(() => buildSteamAccountConfig({ props: 'appID' }, {}), /--steam-id/);
	});

	it('every documented steam property is accepted', () => {
		const config = buildSteamAccountConfig({ steamId: '12345678901234567', steamApiKey: 'K', props: STEAM_OUTPUT_PROPERTIES.join(',') }, {});
		assert.deepEqual(Object.keys(config.outputProperties), STEAM_OUTPUT_PROPERTIES);
		assert.ok(isValid(config));
	});

	it('gogAccount takes the refresh token from a flag or the env var', () => {
		assert.deepEqual(buildGogAccountConfig({ refreshToken: 'T' }, {}), { mode: 'gogAccount', refreshToken: 'T' });
		assert.deepEqual(buildGogAccountConfig({}, { GOG_REFRESH_TOKEN: 'ENV' }), { mode: 'gogAccount', refreshToken: 'ENV' });
	});

	it('gogAccount accepts a login code', () => {
		const config = buildGogAccountConfig({ gogLoginCode: 'CODE' }, {});
		assert.deepEqual(config, { mode: 'gogAccount', gogLoginCode: 'CODE' });
		assert.ok(isValid(config));
	});

	it('gogAccount throws when neither credential is provided', () => {
		assert.throws(() => buildGogAccountConfig({}, {}), /refresh-token|login-code/);
	});

	it('epicGamesAccount takes the cookie from a flag or the env var', () => {
		assert.deepEqual(buildEpicGamesConfig({ epicCookie: 'C' }, {}), { mode: 'epicGamesAccount', epicGamesCookie: 'C' });
		assert.deepEqual(buildEpicGamesConfig({}, { EPIC_COOKIE: 'ENV' }), { mode: 'epicGamesAccount', epicGamesCookie: 'ENV' });
	});

	it('epicGamesAccount throws when no cookie is provided', () => {
		assert.throws(() => buildEpicGamesConfig({}, {}), /epic-cookie/);
	});

	it('parseThreshold accepts values in [0, 1] and rejects the rest', () => {
		assert.equal(parseThreshold('0'), 0);
		assert.equal(parseThreshold('0.65'), 0.65);
		assert.equal(parseThreshold('1'), 1);
		assert.throws(() => parseThreshold('5'));
		assert.throws(() => parseThreshold('-0.1'));
		assert.throws(() => parseThreshold('abc'));
	});

	it('describeConfigFields surfaces schema descriptions, including nested fields', () => {
		const gameNames = describeConfigFields('gameNames');
		assert.match(gameNames, /Configuration fields/);
		assert.match(gameNames, /partialMatchThreshold/);
		assert.match(gameNames, /similarity score of at least this threshold/);
		assert.match(gameNames, /inputFile\.delimiter/);
		assert.match(gameNames, /outputDirectory/);
		assert.match(describeConfigFields('steamAccount'), /outputProperties\.appID/);
	});
});

// ---------- CLI binary ----------

describe('CLI command wrappers', () => {
	it('--version prints the package version', () => {
		const result = runCli(['--version']);
		assert.equal(result.status, 0);
		assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+/);
	});

	it('--help lists every command', () => {
		const result = runCli(['--help']);
		assert.equal(result.status, 0);
		for (const command of ['run', 'gameNames', 'steamAccount', 'gogAccount', 'epicGamesAccount', 'init']) {
			assert.match(result.stdout, new RegExp(command));
		}
	});

	it('no arguments prints help and exits 0', () => {
		const result = runCli([]);
		assert.equal(result.status, 0);
		assert.match(result.stdout, /Usage:/);
	});

	it('an unknown command exits non-zero', () => {
		const result = runCli(['definitelyNotACommand']);
		assert.notEqual(result.status, 0);
	});

	it('a kebab-case alias resolves to its command', () => {
		const result = runCli(['game-names', '--help']);
		assert.equal(result.status, 0);
		assert.match(result.stdout, /--input/);
	});

	it('gameNames with flags but without --input errors', () => {
		const result = runCli(['gameNames', '--type', 'csv']);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /--input/);
	});

	it('gameNames rejects an out-of-range --threshold', () => {
		const result = runCli(['gameNames', '--input', 'x', '--threshold', '5']);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /between 0 and 1|invalid/i);
	});

	it('steamAccount with flags but without --steam-id errors', () => {
		const result = runCli(['steamAccount', '--props', 'name']);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /--steam-id/);
	});

	it('steamAccount rejects an invalid --props value', () => {
		const result = runCli(['steamAccount', '--steam-id', '12345678901234567', '--props', 'bogus']);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /invalid --props/);
	});

	it('steamAccount rejects a non-17-digit steam-id before calling the API', () => {
		const result = runCli(['steamAccount', '--steam-id', 'DEADBEEF', '--steam-api-key', 'K']);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /not a valid SteamID64/);
	});

	it('steamAccount requires a Steam Web API key', () => {
		const result = runCli(['steamAccount', '--steam-id', '12345678901234567']);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Steam Web API key is required/);
	});

	// With no flags, a mode command falls back to a config file; with none present it says so.
	for (const command of ['gameNames', 'steamAccount', 'gogAccount', 'epicGamesAccount']) {
		it(`${command} with no flags and no config file reports a missing config`, () => {
			const result = runCli([command]);
			assert.notEqual(result.status, 0);
			assert.match(result.stderr, /no configuration file found/i);
		});
	}

	it('a mode command falls back to a config file, requiring a matching mode', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saif-cli-cfg-'));
		fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ mode: 'epicGamesAccount', epicGamesCookie: 'x' }));
		const result = runCli(['gameNames'], {}, dir);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /is for "epicGamesAccount" mode/);
	});

	it('a mode --help includes the detailed configuration fields', () => {
		const result = runCli(['gameNames', '--help']);
		assert.equal(result.status, 0);
		assert.match(result.stdout, /Configuration fields/);
		assert.match(result.stdout, /similarity score of at least this threshold/);
	});

	it('run with a non-existent --config errors before running', () => {
		const result = runCli(['run', '--config', 'this-file-does-not-exist.json']);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /no configuration file found|configuration file/i);
	});

	it('rejects a config with an unknown top-level key', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saif-unknown-'));
		fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ mode: 'gameNames', inputFile: { fileName: 'g', fileType: 'txt' }, steamAPIKey: 'K', totallyBogusKey: 1 }));
		const result = runCli(['run'], {}, dir);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /unknown top-level key/i);
	});

	it('parses a config.json that has a UTF-8 BOM (not a load error)', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saif-bom-'));
		// BOM + a config that parses but is missing required fields, so it reaches schema validation
		fs.writeFileSync(path.join(dir, 'config.json'), '\uFEFF' + JSON.stringify({ mode: 'gameNames' }), 'utf8');
		const result = runCli(['run'], {}, dir);
		assert.notEqual(result.status, 0);
		assert.doesNotMatch(result.stderr, /Error loading configuration file/);
		assert.match(result.stderr, /Error validating configuration file/i);
	});

	it('gameNames errors on an empty input file before fetching', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saif-empty-'));
		fs.writeFileSync(path.join(dir, 'games.txt'), '');
		fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ mode: 'gameNames', inputFile: { fileName: 'games', fileType: 'txt' }, steamAPIKey: 'K' }));
		const result = runCli(['run'], {}, dir);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /no game names/i);
	});
});
