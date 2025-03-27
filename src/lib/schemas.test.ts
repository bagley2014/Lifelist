import { dateTimeSchema, eventSchema } from './schemas';
import { describe, expect, test } from 'vitest';

import { DateTime } from 'luxon';

describe('dateTimeSchema', () => {
	test("doesn't modify existing DateTime objects", () => {
		const date = new Date();
		const dateTime = dateTimeSchema.parse(DateTime.fromJSDate(date));
		expect(dateTime).toBeTruthy();
		expect(dateTime).toBeInstanceOf(DateTime);
		expect(dateTime!.isValid).toBe(true);
		expect(dateTime!.toJSDate()).toEqual(date);
		expect(dateTime).toStrictEqual(DateTime.fromJSDate(date));
	});

	describe('parses dates', () => {
		test('with the year first', () => {
			const result = dateTimeSchema.parse('1996-01-25');
			expect(result).toBeTruthy();
			expect(result!.isValid).toBe(true);
			expect(result!.day).toEqual(25);
			expect(result!.month).toEqual(1);
			expect(result!.year).toEqual(1996);
			expect(result!.hour).toEqual(0);
			expect(result!.minute).toEqual(0);
			expect(result!.second).toEqual(0);
		});
		test('in the American order', () => {
			const result = dateTimeSchema.parse('6/13/2014');
			expect(result).toBeTruthy();
			expect(result!.isValid).toBe(true);
			expect(result!.day).toEqual(13);
			expect(result!.month).toEqual(6);
			expect(result!.year).toEqual(2014);
			expect(result!.hour).toEqual(0);
			expect(result!.minute).toEqual(0);
			expect(result!.second).toEqual(0);
		});
	});
	describe('parses times', () => {
		test('with an informal format', () => {
			const result = dateTimeSchema.parse('7pm PT');
			expect(result).toBeTruthy();
			expect(result!.isValid).toBe(true);
			expect(result!.hour).toEqual(19);
			expect(result!.minute).toEqual(0);
			expect(result!.second).toEqual(0);

			const timezone = result!.zone;
			expect(timezone.offsetName(1740043708614, { format: 'short', locale: 'en-US' })).toEqual('PST');
			expect(timezone.offsetName(1742459157854, { format: 'short', locale: 'en-US' })).toEqual('PDT');
		});
		test('with a formal format', () => {
			const result = dateTimeSchema.parse('14:30:00 CT');
			expect(result).toBeTruthy();
			expect(result!.isValid).toBe(true);
			expect(result!.hour).toEqual(14);
			expect(result!.minute).toEqual(30);
			expect(result!.second).toEqual(0);

			const timezone = result!.zone;
			expect(timezone.offsetName(1740043708614, { format: 'short', locale: 'en-US' })).toEqual('CST');
			expect(timezone.offsetName(1742459157854, { format: 'short', locale: 'en-US' })).toEqual('CDT');
		});
		test('with a foreign timezone', () => {
			const result = dateTimeSchema.parse('5:00 AM JST');
			expect(result).toBeTruthy();
			expect(result!.isValid).toBe(true);
			expect(result!.hour).toEqual(5);
			expect(result!.minute).toEqual(0);
			expect(result!.second).toEqual(0);

			const timezone = result!.zone;
			expect(timezone.offsetName(1740043708614, { format: 'short', locale: 'en-US' })).toEqual('UTC+9');
		});
	});

	describe('fails input', () => {
		test('that is very vague', () => {
			expect(() => {
				dateTimeSchema.parse('12');
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

	describe('passes', () => {
		test('on a valid event', () => {
			const result = eventSchema.parse(validEvent);
			expect(result).toEqual({
				...validEvent,
				frequency: 'once',
				start: dateTimeSchema.parse(validEvent.start),
				end: dateTimeSchema.parse(validEvent.end),
			});
		});

		test('on an event with no end time', () => {
			const result = eventSchema.parse({ ...validEvent, end: undefined });
			expect(result).toEqual({
				...validEvent,
				frequency: 'once',
				start: dateTimeSchema.parse(validEvent.start),
				end: undefined,
			});
		});
	});

	describe('fails', () => {
		test('on an event with missing required fields', () => {
			expect(() => {
				eventSchema.parse({});
			}).toThrow('invalid_type');
		});

		test('on an event with an invalid name', () => {
			expect(() => {
				eventSchema.parse({ ...validEvent, name: '' });
			}).toThrow('String must contain at least 1 character(s)');
		});

		test('on an event with an invalid priority', () => {
			expect(() => {
				eventSchema.parse({ ...validEvent, priority: -1 });
			}).toThrow('Number must be greater than or equal to 0');
		});

		test('on an event with an invalid frequency', () => {
			expect(() => {
				eventSchema.parse({ ...validEvent, frequency: 'invalid' });
			}).toThrow('Invalid enum value');
		});

		test('on an event with an invalid start date', () => {
			expect(() => {
				eventSchema.parse({ ...validEvent, start: 'invalid' });
			}).toThrow('Invalid DateTime is not a valid date');
		});

		test('on an event with an invalid end date', () => {
			expect(() => {
				eventSchema.parse({ ...validEvent, end: 'invalid' });
			}).toThrow('Invalid DateTime is not a valid date');
		});

		test('on an event with an end date before the start date', () => {
			expect(() => {
				eventSchema.parse({ ...validEvent, end: '2021-01-01' });
			}).toThrow('start must be before end');
		});

		test('on an event with an end date but no start date', () => {
			expect(() => {
				eventSchema.parse({ ...validEvent, start: null });
			}).toThrow('end cannot be defined if start is null');
		});
	});
});
