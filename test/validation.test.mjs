// Description: Offline tests for schema validation of the per-mode configuration files

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateConfigResult } from '../js/utils.js';

const accepts = (config) => validateConfigResult(config).errors.length === 0;

// A minimal valid config for each mode
const validByMode = {
	gameNames: { mode: 'gameNames', inputFile: { fileName: 'games', fileType: 'txt' } },
	steamAccount: { mode: 'steamAccount', steamId: '12345678901234567', outputProperties: { appID: true } },
	gogAccount: { mode: 'gogAccount' },
	epicGamesAccount: { mode: 'epicGamesAccount' }
};

describe('config schema validation', () => {
	for (const [mode, config] of Object.entries(validByMode)) {
		it(`accepts a minimal valid ${mode} config`, () => {
			assert.ok(accepts(config));
		});
	}

	it('accepts the shared optional outputDirectory field', () => {
		assert.ok(accepts({ ...validByMode.gameNames, outputDirectory: 'out' }));
	});

	it('rejects a config without a mode', () => {
		assert.ok(!accepts({ inputFile: { fileName: 'g', fileType: 'txt' } }));
	});

	it('rejects an unknown mode', () => {
		assert.ok(!accepts({ mode: 'notARealMode' }));
	});

	it('rejects a gameNames config missing the required inputFile', () => {
		assert.ok(!accepts({ mode: 'gameNames' }));
	});

	it('rejects a gameNames config with an invalid inputFile.fileType', () => {
		assert.ok(!accepts({ mode: 'gameNames', inputFile: { fileName: 'g', fileType: 'xml' } }));
	});

	it('rejects a gameNames partialMatchThreshold outside 0-1', () => {
		assert.ok(!accepts({ mode: 'gameNames', inputFile: { fileName: 'g', fileType: 'txt' }, partialMatchThreshold: 2 }));
	});

	it('rejects a steamAccount config missing the required steamId and outputProperties', () => {
		assert.ok(!accepts({ mode: 'steamAccount' }));
	});

	it('accepts a steamAccount config with every documented output property', () => {
		const outputProperties = { appID: true, name: true, logo: true, storeLink: true, statsLink: true, globalStatsLink: true };
		assert.ok(accepts({ mode: 'steamAccount', steamId: '12345678901234567', outputProperties }));
	});
});
