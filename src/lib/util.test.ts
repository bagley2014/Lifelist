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
		vi.advanceTimersByTime(900);
		expect(callback).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		expect(callback).toHaveBeenCalledTimes(1);

		debounced();
		vi.advanceTimersByTime(1000);
		expect(callback).toHaveBeenCalledTimes(2);
	});

	test('calls callback immediately', async () => {
		const callback = vi.fn();
		const debounced = debounce(callback, 1000);

		debounced();
		expect(callback).toHaveBeenCalledTimes(0);

		debounced.doImmediately();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	test('cancels the debounce', async () => {
		const callback = vi.fn();
		const debounced = debounce(callback, 1000);

		debounced();
		debounced.cancel();
		vi.advanceTimersByTime(1500);

		expect(callback).not.toHaveBeenCalled();
	});
});
