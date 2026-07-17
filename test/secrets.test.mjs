// Description: Offline tests for runtime secret resolution (flag/env/config precedence, non-interactive errors, per-mode wiring)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSecret } from '../js/utils.js';
import { resolveModeSecrets } from '../js/secrets.js';

describe('resolveSecret', () => {
	it('prefers an explicit flag value over the env var', async () => {
		process.env.SAIDF_TEST_SECRET = 'from-env';
		try {
			const value = await resolveSecret({ flagValue: '  from-flag  ', envVar: 'SAIDF_TEST_SECRET', promptMessage: 'x', label: 'test secret' });
			assert.equal(value, 'from-flag');
		} finally {
			delete process.env.SAIDF_TEST_SECRET;
		}
	});

	it('uses the env var when no flag is given', async () => {
		process.env.SAIDF_TEST_SECRET = '  from-env  ';
		try {
			const value = await resolveSecret({ envVar: 'SAIDF_TEST_SECRET', promptMessage: 'x', label: 'test secret' });
			assert.equal(value, 'from-env');
		} finally {
			delete process.env.SAIDF_TEST_SECRET;
		}
	});

	it('rejects a secret stored in the config file', async () => {
		delete process.env.SAIDF_TEST_SECRET;
		await assert.rejects(
			resolveSecret({ envVar: 'SAIDF_TEST_SECRET', configValue: '  from-config  ', configField: 'steamAPIKey', promptMessage: 'x', label: 'test secret' }),
			/must not be stored in the configuration file/
		);
	});

	it('throws when nothing is available in a non-interactive shell', async () => {
		delete process.env.SAIDF_TEST_SECRET;
		const original = process.stdin.isTTY;
		process.stdin.isTTY = false;
		try {
			await assert.rejects(
				resolveSecret({ envVar: 'SAIDF_TEST_SECRET', configValue: '', promptMessage: 'x', label: 'test secret' }),
				/test secret is required/
			);
		} finally {
			process.stdin.isTTY = original;
		}
	});
});

describe('resolveModeSecrets', () => {
	it('resolves the Steam API key from a flag for gameNames', async () => {
		const config = { mode: 'gameNames' };
		await resolveModeSecrets(config, { steamApiKey: 'FLAGKEY' });
		assert.equal(config.steamAPIKey, 'FLAGKEY');
	});

	it('resolves the GOG refresh token from the env var', async () => {
		process.env.GOG_REFRESH_TOKEN = 'ENVTOKEN';
		try {
			const config = { mode: 'gogAccount' };
			await resolveModeSecrets(config, {});
			assert.equal(config.refreshToken, 'ENVTOKEN');
		} finally {
			delete process.env.GOG_REFRESH_TOKEN;
		}
	});

	it('rejects GOG credentials stored in the config file', async () => {
		delete process.env.GOG_REFRESH_TOKEN;
		await assert.rejects(
			resolveModeSecrets({ mode: 'gogAccount', refreshToken: 'stored' }, {}),
			/must not be stored in the configuration file/
		);
	});

	it('prefers a GOG login code flag over the env refresh token', async () => {
		process.env.GOG_REFRESH_TOKEN = 'ENVTOKEN';
		try {
			const config = { mode: 'gogAccount' };
			await resolveModeSecrets(config, { gogLoginCode: 'CODE' });
			assert.equal(config.gogLoginCode, 'CODE');
			assert.ok(!('refreshToken' in config));
		} finally {
			delete process.env.GOG_REFRESH_TOKEN;
		}
	});

	it('throws for gogAccount when no credentials are available and non-interactive', async () => {
		delete process.env.GOG_REFRESH_TOKEN;
		const original = process.stdin.isTTY;
		process.stdin.isTTY = false;
		try {
			await assert.rejects(resolveModeSecrets({ mode: 'gogAccount' }, {}), /GOG credentials are required/);
		} finally {
			process.stdin.isTTY = original;
		}
	});
});
