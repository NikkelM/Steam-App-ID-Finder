// Description: Verifies the init wizard assembles and writes a schema-valid config (prompts mocked)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateConfigResult } from '../js/utils.js';

test('the wizard writes a schema-valid gameNames configuration file', async (t) => {
	// Mock @inquirer/prompts so the wizard runs without a TTY, answering by prompt message
	t.mock.module('@inquirer/prompts', {
		namedExports: {
			input: async ({ message }) => {
				if (message.includes('Input file name')) return 'myGames';
				if (message.includes('threshold')) return '0.65';
				if (message.includes('Cache')) return '24';
				if (message.includes('Output directory')) return 'output';
				return '';
			},
			select: async ({ message }) => {
				if (message.includes('Which mode')) return 'gameNames';
				if (message.includes('Input file type')) return 'txt';
				if (message.includes('separated')) return '\n';
				return '';
			},
			checkbox: async () => [],
			password: async () => '',
			confirm: async ({ message }) => {
				// Only full matches? / Run this mode now? / Overwrite?
				return false;
			}
		}
	});

	const { runWizard } = await import('../js/wizard.js');

	const outputPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'saif-wiz-')), 'config.json');
	await runWizard(outputPath);

	assert.ok(fs.existsSync(outputPath), 'the wizard should write the config file');
	const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

	assert.equal(written.mode, 'gameNames');
	assert.equal(written.inputFile.fileName, 'myGames');
	assert.equal(written.inputFile.fileType, 'txt');
	assert.equal(written.partialMatchThreshold, 0.65);
	assert.ok(!('appListCacheHours' in written), 'the default cache duration should be omitted');
	assert.ok(!('outputDirectory' in written), 'the default output directory should be omitted');
	assert.ok(!('steamAPIKey' in written), 'the API key must never be written to the config file');
	assert.equal(validateConfigResult(written).errors.length, 0, 'the written config should validate against the schema');

	fs.rmSync(path.dirname(outputPath), { recursive: true, force: true });
});
