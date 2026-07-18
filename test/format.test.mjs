// Description: Offline tests for the game-name matching helpers (exact-match classification and similarity ranking)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyFullMatches, rankPartialMatches } from '../js/gameNames.js';

// A small stand-in for the Steam app list: { appid, name }
const apps = [
	{ appid: 400, name: 'Portal' },
	{ appid: 620, name: 'Portal 2' },
	{ appid: 220, name: 'Half-Life 2' },
	{ appid: 500, name: 'Left 4 Dead' },
	{ appid: 501, name: 'Left 4 Dead' },
	{ appid: 504230, name: 'Celeste' }
];

describe('classifyFullMatches', () => {
	it('maps a unique exact match to its single App ID', () => {
		const { steamIDsSingleFullMatch } = classifyFullMatches(['Portal', 'Celeste'], apps);
		assert.deepEqual(steamIDsSingleFullMatch, { Portal: 400, Celeste: 504230 });
	});

	it('collects every App ID when a name matches more than once', () => {
		const { steamIDsMultipleFullMatches } = classifyFullMatches(['Left 4 Dead'], apps);
		assert.deepEqual(steamIDsMultipleFullMatches, { 'Left 4 Dead': [500, 501] });
	});

	it('deduplicates repeated App IDs so an identical duplicate is a single match', () => {
		const dupes = [{ appid: 42, name: 'Bastion' }, { appid: 42, name: 'Bastion' }];
		const { steamIDsSingleFullMatch, steamIDsMultipleFullMatches } = classifyFullMatches(['Bastion'], dupes);
		assert.deepEqual(steamIDsSingleFullMatch, { Bastion: 42 });
		assert.deepEqual(steamIDsMultipleFullMatches, {});
	});

	it('is case-sensitive, leaving a differently-cased name unmatched', () => {
		const { steamIDsSingleFullMatch, remainingGameNames } = classifyFullMatches(['portal'], apps);
		assert.deepEqual(steamIDsSingleFullMatch, {});
		assert.deepEqual(remainingGameNames, ['portal']);
	});

	it('returns names with no match in remainingGameNames', () => {
		const { remainingGameNames } = classifyFullMatches(['Nonexistent Game'], apps);
		assert.deepEqual(remainingGameNames, ['Nonexistent Game']);
	});
});

describe('rankPartialMatches', () => {
	it('matches a near-miss name (case-insensitive) above the threshold', () => {
		const { steamIDsBestMatch, steamIDsNoMatch } = rankPartialMatches(['celeste'], apps, 0.65);
		assert.equal(steamIDsBestMatch['celeste'].appId, 504230);
		assert.equal(steamIDsBestMatch['celeste'].steamName, 'Celeste');
		assert.equal(steamIDsBestMatch['celeste'].similarity, 1);
		assert.deepEqual(steamIDsNoMatch, []);
	});

	it('drops a name whose best similarity is below the threshold', () => {
		const { steamIDsBestMatch, steamIDsNoMatch } = rankPartialMatches(['Totally Unrelated Title XYZ'], apps, 0.65);
		assert.deepEqual(steamIDsBestMatch, {});
		assert.deepEqual(steamIDsNoMatch, ['Totally Unrelated Title XYZ']);
	});

	it('sorts the matches by descending similarity score', () => {
		const { steamIDsBestMatch } = rankPartialMatches(['Celeste', 'Portal 3'], apps, 0.3);
		const scores = Object.values(steamIDsBestMatch).map((match) => match.similarity);
		assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
	});

	it('invokes the progress callback once per game name', () => {
		let ticks = 0;
		rankPartialMatches(['Portal', 'Celeste', 'Bastion'], apps, 0.65, () => ticks++);
		assert.equal(ticks, 3);
	});
});
