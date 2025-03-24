// I should write up some tests and set them to skip, so I don't spam the apis
// But by having the tests FIRST, I'll be able to easily check which apis _work_ for my use case
import { describe, expect, test } from 'vitest';

import { englishToEvent } from './englishToEvent';

describe.skip('englishToEvent', () => {
	test('works with a simple event', async () => {
		const result = await englishToEvent('I have a Lifelist demo at 3pm on April 1st');
		expect(result?.name.toLowerCase()).toBe('lifelist demo');
		expect(result?.start?.month).toBe(4);
		expect(result?.start?.day).toBe(1);
		expect(result?.start?.hour).toBe(15);
	});

	test('fails with bad input', async () => {
		const result = await englishToEvent('~~~~');
		expect(result).toBeNull();
	});
});
