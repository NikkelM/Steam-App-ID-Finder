// Description: Subprocess tests for the CLI command wrappers (bin/cli.js).

// They run the paths that exit before any network call (help, version, argument
// validation), so they need no credentials. Credential env vars are cleared so a
// local setup cannot affect them.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

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

	it('no arguments with no config file reports a missing config (non-interactive)', () => {
		const result = runCli([]);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /no "config\.json" found/i);
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
			assert.match(result.stderr, /no "config\.json" found/i);
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
		fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ mode: 'gameNames', inputFile: { fileName: 'games', fileType: 'txt' } }));
		const result = runCli(['run'], { STEAM_API_KEY: 'K' }, dir);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /no game names/i);
	});
});
