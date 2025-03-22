import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { debounce } from './util';

describe('debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('calls callback only when it should', async () => {
		const callback = vi.fn();
		const debounced = debounce(callback, 1000);

		debounced();
		expect(callback).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		debounced();
		debounced();
		expect(callback).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1000);
		expect(callback).toHaveBeenCalledTimes(1);

		debounced();
		vi.advanceTimersByTime(1000);
		expect(callback).toHaveBeenCalledTimes(2);
	});
});
