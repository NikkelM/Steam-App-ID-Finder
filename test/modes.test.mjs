// Description: Integration tests for the modes and the endpoints they depend on.

// The per-mode tests run the tool end to end and are skipped unless their credential is set:
//   STEAM_API_KEY (gameNames, steamAccount), STEAM_TEST_STEAMID (steamAccount),
//   GOG_REFRESH_TOKEN (gogAccount), EPIC_COOKIE (epicGamesAccount).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexJs = path.join(repoRoot, 'index.js');

// ---------- Endpoint liveness (no credentials) ----------

// Expected unauthenticated status per endpoint (a 404 means the method was removed).
const ENDPOINTS = [
	{ mode: 'gameNames', name: 'Steam IStoreService/GetAppList', expected: 403,
		url: 'https://api.steampowered.com/IStoreService/GetAppList/v1/' },
	{ mode: 'steamAccount', name: 'Steam IPlayerService/GetOwnedGames', expected: 401,
		url: 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?format=json' },
	{ mode: 'gogAccount', name: 'GOG auth.gog.com/token', expected: 400,
		url: 'https://auth.gog.com/token', init: { method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'grant_type=refresh_token&refresh_token=invalid&client_id=46899977096215655' } },
	{ mode: 'gogAccount', name: 'GOG embed.gog.com/user/data/games', expected: 302,
		url: 'https://embed.gog.com/user/data/games' },
	{ mode: 'epicGamesAccount', name: 'Epic accounts.epicgames.com/ajaxGetOrderHistory', expected: 302,
		url: 'https://accounts.epicgames.com/account/v2/payment/ajaxGetOrderHistory?count=25&sortDir=DESC&sortBy=DATE&locale=en-US' },
];

async function fetchStatus(url, init) {
	// Retry once on a network error or 5xx.
	for (let attempt = 1; attempt <= 2; attempt++) {
		try {
			const response = await fetch(url, { redirect: 'manual', ...init });
			if (response.status >= 500 && attempt === 1) continue;
			return { status: response.status };
		} catch (error) {
			if (attempt === 1) continue;
			return { error: error.message ?? String(error) };
		}
	}
}

describe('Endpoint liveness', () => {
	for (const endpoint of ENDPOINTS) {
		it(`${endpoint.name} [${endpoint.mode}] responds ${endpoint.expected}`, async () => {
			const result = await fetchStatus(endpoint.url, endpoint.init);
			assert.ok(!result.error, `${endpoint.name} unreachable: ${result.error}`);
			assert.notEqual(result.status, 404, `${endpoint.name} returned 404 - endpoint likely retired`);
			assert.equal(result.status, endpoint.expected, `${endpoint.name} returned ${result.status}, expected ${endpoint.expected} - endpoint may have moved/changed`);
		});
	}
});

// ---------- Live smoke tests (credential-gated) ----------

// Run the tool in an isolated temp directory so the repo's own config/output are untouched.
function runMode(config, extraFiles = {}) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saidf-test-'));
	fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
	// The tool loads the schema files relative to the working directory.
	for (const file of fs.readdirSync(path.join(repoRoot, 'config'))) {
		if (file.endsWith('.schema.json') || file.startsWith('schema.')) {
			fs.copyFileSync(path.join(repoRoot, 'config', file), path.join(dir, 'config', file));
		}
	}
	fs.writeFileSync(path.join(dir, 'config', 'config.json'), JSON.stringify(config, null, 2));
	for (const [relativePath, content] of Object.entries(extraFiles)) {
		fs.writeFileSync(path.join(dir, relativePath), content);
	}
	const proc = spawnSync(process.execPath, [indexJs], { cwd: dir, encoding: 'utf8', timeout: 5 * 60 * 1000 });
	return { code: proc.status, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '', dir };
}

function cleanup(dir) {
	fs.rmSync(dir, { recursive: true, force: true });
}

// Short-lived GOG/Epic credentials: treat an auth failure as a skip rather than a failure.
function isExpiredCredentialFailure(output) {
	return /invalid_grant|missing or expired|redirected the request/i.test(output);
}

describe('Steam live smoke tests', () => {
	it('gameNames resolves known game names to their App IDs', { skip: process.env.STEAM_API_KEY ? false : 'STEAM_API_KEY not set' }, () => {
		const config = {
			mode: 'gameNames',
			inputFile: { fileName: 'testInput', fileType: 'txt', delimiter: ',' },
			steamAPIKey: process.env.STEAM_API_KEY,
			onlyFullMatches: true,
		};
		const { code, stderr, dir } = runMode(config, { 'testInput.txt': 'Portal,Half-Life 2,Celeste' });
		try {
			assert.equal(code, 0, `tool exited ${code}: ${stderr.trim().slice(0, 200)}`);
			const output = JSON.parse(fs.readFileSync(path.join(dir, 'output', 'gameNames', 'steamAppIds_fullMatches.json'), 'utf8'));
			assert.equal(output['Portal'], 400, `Portal resolved to ${output['Portal']}`);
			assert.equal(output['Half-Life 2'], 220, `Half-Life 2 resolved to ${output['Half-Life 2']}`);
			assert.equal(output['Celeste'], 504230, `Celeste resolved to ${output['Celeste']}`);
		} finally {
			cleanup(dir);
		}
	});

	it('steamAccount returns owned games with appID + name', { skip: (process.env.STEAM_API_KEY && process.env.STEAM_TEST_STEAMID) ? false : 'STEAM_API_KEY and/or STEAM_TEST_STEAMID not set' }, () => {
		const steamId = process.env.STEAM_TEST_STEAMID;
		const config = { mode: 'steamAccount', steamId, steamAPIKey: process.env.STEAM_API_KEY, outputProperties: { appID: true, name: true } };
		const { code, stderr, dir } = runMode(config);
		try {
			assert.equal(code, 0, `tool exited ${code}: ${stderr.trim().slice(0, 200)}`);
			const output = JSON.parse(fs.readFileSync(path.join(dir, 'output', 'steamAccount', `${steamId}.json`), 'utf8'));
			assert.ok(Array.isArray(output) && output.length > 0, 'no games returned (private profile or shape change?)');
			assert.ok(output.every(game => typeof game.appID === 'number' && typeof game.name === 'string'), 'some entries are missing appID/name');
		} finally {
			cleanup(dir);
		}
	});
});

describe('GOG/Epic live smoke tests', () => {
	it('gogAccount writes a non-empty list of game names', { skip: process.env.GOG_REFRESH_TOKEN ? false : 'GOG_REFRESH_TOKEN not set' }, (t) => {
		const config = { mode: 'gogAccount', refreshToken: process.env.GOG_REFRESH_TOKEN };
		const { code, stdout, stderr, dir } = runMode(config);
		try {
			if (code !== 0 && isExpiredCredentialFailure(stdout + stderr)) {
				t.skip('GOG_REFRESH_TOKEN appears expired or invalid');
				return;
			}
			assert.equal(code, 0, `tool exited ${code}: ${stderr.trim().slice(0, 200)}`);
			const names = fs.readFileSync(path.join(dir, 'output', 'gogAccount', 'gogGameNames.txt'), 'utf8').split('\n').filter(Boolean);
			assert.ok(names.length > 0, 'no game names were written');
		} finally {
			cleanup(dir);
		}
	});

	it('epicGamesAccount writes a non-empty list of game names', { skip: process.env.EPIC_COOKIE ? false : 'EPIC_COOKIE not set' }, (t) => {
		const config = { mode: 'epicGamesAccount', epicGamesCookie: process.env.EPIC_COOKIE };
		const { code, stdout, stderr, dir } = runMode(config);
		try {
			if (code !== 0 && isExpiredCredentialFailure(stdout + stderr)) {
				t.skip('EPIC_COOKIE appears expired or invalid');
				return;
			}
			assert.equal(code, 0, `tool exited ${code}: ${stderr.trim().slice(0, 200)}`);
			const names = fs.readFileSync(path.join(dir, 'output', 'epicGamesAccount', 'epicGamesGameNames.txt'), 'utf8').split('\n').filter(Boolean);
			assert.ok(names.length > 0, 'no game names were written');
		} finally {
			cleanup(dir);
		}
	});
});
