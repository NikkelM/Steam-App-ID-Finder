// Description: Offline tests for the flag -> config builders (js/cliConfig.js), the config-field help text, and saveConfigToFile

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
	parseThreshold,
	parseCacheHours,
	buildGameNamesConfig,
	buildSteamAccountConfig,
	buildGogAccountConfig,
	buildEpicGamesConfig,
	STEAM_OUTPUT_PROPERTIES
} from '../js/cliConfig.js';
import { validateConfigResult, describeConfigFields, saveConfigToFile } from '../js/utils.js';

const isValid = (config) => validateConfigResult(config).errors.length === 0;

describe('CLI config builders', () => {
	it('gameNames maps flags to the expected config and validates', () => {
		const config = buildGameNamesConfig(
			{ input: 'games', type: 'txt', delimiter: ',', threshold: 0.7 }
		);
		assert.deepEqual(config, {
			mode: 'gameNames',
			inputFile: { fileName: 'games', fileType: 'txt', delimiter: ',' },
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

	it('gameNames maps --refresh-cache and --cache-hours, and omits them otherwise', () => {
		const withCache = buildGameNamesConfig({ input: 'g', type: 'txt', steamApiKey: 'K', refreshCache: true, cacheHours: 12 }, {});
		assert.equal(withCache.refreshCache, true);
		assert.equal(withCache.appListCacheHours, 12);
		assert.ok(isValid(withCache));

		const withCacheZero = buildGameNamesConfig({ input: 'g', type: 'txt', steamApiKey: 'K', cacheHours: 0 }, {});
		assert.equal(withCacheZero.appListCacheHours, 0);
		assert.ok(isValid(withCacheZero));

		const withoutCache = buildGameNamesConfig({ input: 'g', type: 'txt', steamApiKey: 'K' }, {});
		assert.ok(!('refreshCache' in withoutCache));
		assert.ok(!('appListCacheHours' in withoutCache));
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

	it('gogAccount builds a bare config (credentials are resolved at runtime)', () => {
		assert.deepEqual(buildGogAccountConfig({}), { mode: 'gogAccount' });
		assert.deepEqual(buildGogAccountConfig({ refreshToken: 'T' }), { mode: 'gogAccount' });
		assert.ok(isValid(buildGogAccountConfig({})));
	});

	it('epicGamesAccount builds a bare config (the cookie is resolved at runtime)', () => {
		assert.deepEqual(buildEpicGamesConfig({}), { mode: 'epicGamesAccount' });
		assert.ok(isValid(buildEpicGamesConfig({})));
	});

	it('parseThreshold accepts values in [0, 1] and rejects the rest', () => {
		assert.equal(parseThreshold('0'), 0);
		assert.equal(parseThreshold('0.65'), 0.65);
		assert.equal(parseThreshold('1'), 1);
		assert.throws(() => parseThreshold('5'));
		assert.throws(() => parseThreshold('-0.1'));
		assert.throws(() => parseThreshold('abc'));
	});

	it('parseCacheHours accepts values >= 0 and rejects the rest', () => {
		assert.equal(parseCacheHours('0'), 0);
		assert.equal(parseCacheHours('24'), 24);
		assert.equal(parseCacheHours('0.5'), 0.5);
		assert.throws(() => parseCacheHours('-1'));
		assert.throws(() => parseCacheHours('abc'));
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

describe('saveConfigToFile', () => {
	it('writes a validated flag-built config and strips secret fields', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saif-save-'));
		const out = path.join(dir, 'config.json');
		try {
			const config = { ...buildGameNamesConfig({ input: 'games', type: 'txt' }, {}), steamAPIKey: 'secret_should_not_persist' };
			await saveConfigToFile(config, out, ['steamAPIKey']);
			const written = JSON.parse(fs.readFileSync(out, 'utf8'));
			assert.ok(!('steamAPIKey' in written), 'the secret must never be written to disk');
			assert.equal(written.mode, 'gameNames');
			assert.equal(validateConfigResult(written).errors.length, 0);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it('refuses to overwrite an existing file non-interactively', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saif-save-'));
		const out = path.join(dir, 'config.json');
		try {
			fs.writeFileSync(out, '{"existing":true}');
			const originalIsTTY = process.stdin.isTTY;
			process.stdin.isTTY = false;
			try {
				await assert.rejects(saveConfigToFile(buildGameNamesConfig({ input: 'g', type: 'txt' }, {}), out), /already exists/);
			} finally {
				process.stdin.isTTY = originalIsTTY;
			}
			assert.equal(fs.readFileSync(out, 'utf8'), '{"existing":true}', 'the existing file must be left untouched');
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
