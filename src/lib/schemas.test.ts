import { Frequency, dateTimeSchema, eventSchema } from './schemas';
import { describe, expect, test } from '@jest/globals';

import { DateTime } from 'luxon';

describe('dateTimeSchema', () => {
	test("doesn't modify existing DateTime objects", () => {
		const date = new Date();
		const dateTime = dateTimeSchema.required().validateSync(DateTime.fromJSDate(date));
		expect(dateTime).toBeInstanceOf(DateTime);
		expect(dateTime.isValid).toBe(true);
		expect(dateTime.toJSDate()).toEqual(date);
		expect(dateTime).toStrictEqual(DateTime.fromJSDate(date));
	});

	describe('parses dates', () => {
		test('with the year first', () => {
			const result = dateTimeSchema.required().validateSync('1996-01-25');
			expect(result.isValid).toBe(true);
			expect(result.day).toEqual(25);
			expect(result.month).toEqual(1);
			expect(result.year).toEqual(1996);
			expect(result.hour).toEqual(0);
			expect(result.minute).toEqual(0);
			expect(result.second).toEqual(0);
		});
		test('in the American order', () => {
			const result = dateTimeSchema.required().validateSync('6/13/2014');
			expect(result.isValid).toBe(true);
			expect(result.day).toEqual(13);
			expect(result.month).toEqual(6);
			expect(result.year).toEqual(2014);
			expect(result.hour).toEqual(0);
			expect(result.minute).toEqual(0);
			expect(result.second).toEqual(0);
		});
	});
	describe('parses times', () => {
		test('with an informal format', () => {
			const result = dateTimeSchema.required().validateSync('7pm PT');
			expect(result.isValid).toBe(true);
			expect(result.hour).toEqual(19);
			expect(result.minute).toEqual(0);
			expect(result.second).toEqual(0);

			const timezone = result.zone;
			expect(timezone.offsetName(1740043708614, { format: 'short', locale: 'en-US' })).toEqual('PST');
			expect(timezone.offsetName(1742459157854, { format: 'short', locale: 'en-US' })).toEqual('PDT');
		});
		test('with a formal format', () => {
			const result = dateTimeSchema.required().validateSync('14:30:00 CT');
			expect(result.isValid).toBe(true);
			expect(result.hour).toEqual(14);
			expect(result.minute).toEqual(30);
			expect(result.second).toEqual(0);

			const timezone = result.zone;
			expect(timezone.offsetName(1740043708614, { format: 'short', locale: 'en-US' })).toEqual('CST');
			expect(timezone.offsetName(1742459157854, { format: 'short', locale: 'en-US' })).toEqual('CDT');
		});
		test('with a foreign timezone', () => {
			const result = dateTimeSchema.required().validateSync('5:00 AM JST');
			expect(result.isValid).toBe(true);
			expect(result.hour).toEqual(5);
			expect(result.minute).toEqual(0);
			expect(result.second).toEqual(0);

			const timezone = result.zone;
			expect(timezone.offsetName(1740043708614, { format: 'short', locale: 'en-US' })).toEqual('UTC+9');
		});
	});

	describe('fails input', () => {
		test('that is very vague', () => {
			expect(() => {
				dateTimeSchema.required().validateSync('12');
			}).toThrow();
		});
	});
});

describe('eventSchema', () => {
	const validEvent = {
		name: 'Test Event',
		priority: 5,
		start: '2022-01-01',
		end: '2022-01-02',
		location: 'Test Location',
		tags: ['Test Tag'],
	};

	describe('to pass', () => {
		test('on a valid event', () => {
			const result = eventSchema.validateSync(validEvent);
			expect(result).toEqual({
				...validEvent,
				frequency: Frequency.Once,
				start: dateTimeSchema.validateSync(validEvent.start),
				end: dateTimeSchema.validateSync(validEvent.end),
			});
		});

		test('on an event with no end time', () => {
			const result = eventSchema.validateSync({ ...validEvent, end: undefined });
			expect(result).toEqual({
				...validEvent,
				frequency: Frequency.Once,
				start: dateTimeSchema.validateSync(validEvent.start),
				end: undefined,
			});
		});
	});

	describe('to fail', () => {
		test('on an event with missing required fields', () => {
			expect(() => {
				eventSchema.validateSync({});
			}).toThrow();
		});

		test('on an event with an invalid name', () => {
			expect(() => {
				eventSchema.validateSync({ ...validEvent, name: '' });
			}).toThrow();
		});

		test('on an event with an invalid priority', () => {
			expect(() => {
				eventSchema.validateSync({ ...validEvent, priority: -1 });
			}).toThrow();
		});

		test('on an event with an invalid frequency', () => {
			expect(() => {
				eventSchema.validateSync({ ...validEvent, frequency: 'invalid' });
			}).toThrow();
		});

		test('on an event with an invalid start date', () => {
			expect(() => {
				eventSchema.validateSync({ ...validEvent, start: 'invalid' });
			}).toThrow();
		});

		test('on an event with an invalid end date', () => {
			expect(() => {
				eventSchema.validateSync({ ...validEvent, end: 'invalid' });
			}).toThrow();
		});

		test('on an event with an end date before the start date', () => {
			expect(() => {
				eventSchema.validateSync({ ...validEvent, end: '2021-01-01' });
			}).toThrow();
		});

		test('on an event with an end date but no start date', () => {
			expect(() => {
				eventSchema.validateSync({ ...validEvent, start: null });
			}).toThrow();
		});
	});
});
