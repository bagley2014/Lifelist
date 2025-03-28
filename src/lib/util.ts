import { DateTime } from 'luxon';

// Original debounce code: https://gist.github.com/carlhannes/4b318c28e95f635191bffb656b9a2cfe
// ES6 Async version of the "classic" JavaScript Debounce function.
// Works both with and without promises, so you can replace your existing
// debounce helper function with this one (and it will behave the same).
// The only difference is that this one returns a promise, so you can use
// it with async/await.
//
// I've converted this into a TypeScript module, and added a few more
// features to it, such as the ability to cancel the debounce, and also
// execute the function immediately, using the `doImmediately` method.
//
// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
//
// @author: @carlhannes
// @param {Function} func - The function to debounce.
// @param {Number} wait - The number of milliseconds to delay.
// @param {Boolean} immediate - Whether to execute the function at the beginning.
// @returns {Function} - The debounced function.
// @example
// import debounce from 'utils/debounce';
//
// const debounced = debounce(() => {
//   console.log('Hello world!');
// }, 1000);
//
// debounced();
//
interface DebounceConstructor {
	(func: () => void, wait: number): DebouncedFunction;
}

export interface DebouncedFunction {
	(...args: unknown[]): Promise<unknown>;
	cancel(): void;
	doImmediately(...args: unknown[]): Promise<unknown>;
}

export const debounce: DebounceConstructor = (func: (...args: unknown[]) => void, wait: number) => {
	let timeout: NodeJS.Timeout | undefined = undefined;
	const debouncedFn: DebouncedFunction = (...args) =>
		new Promise(resolve => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				timeout = undefined;
				void Promise.resolve(func.apply(this, [...args])).then(resolve);
			}, wait);
		});

	debouncedFn.cancel = () => {
		clearTimeout(timeout);
		timeout = undefined;
	};

	debouncedFn.doImmediately = (...args) =>
		new Promise(resolve => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				timeout = undefined;
				void Promise.resolve(func.apply(this, [...args])).then(resolve);
			}, 0);
		});

	return debouncedFn;
};

const propertyOrderArray = ['name', 'priority', 'location', 'start', 'end', 'frequency', 'tags', 'old', 'upcoming'];

export function yamlStringifyReplacer(key: string, value: unknown) {
	// If the key is a known DateTime property, format it in a human readable way
	if (key === 'start' || key === 'end') {
		if (value === null || value === undefined) return value;

		const dateTime = value as DateTime;
		const hasTime = dateTime.hour !== 0 || dateTime.minute !== 0;
		return dateTime.toLocaleString({
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: hasTime ? 'numeric' : undefined,
			minute: hasTime ? '2-digit' : undefined,
			timeZoneName: hasTime ? 'shortGeneric' : undefined,
		});
	}

	// If the value is an object in one of our arrays, reorder the properties in a clean, consistent way
	if (value instanceof Object && value !== null && !Array.isArray(value)) {
		return propertyOrderArray.reduce((obj: Record<string, unknown>, prop) => {
			obj[prop] = (value as Record<string, unknown>)[prop];
			return obj;
		}, {});
	}
	return value;
}
