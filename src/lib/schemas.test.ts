import { describe, expect, test } from '@jest/globals';

import { myTempDateSchema } from './schemas';

describe('myDateSchema', () => {
	describe('parses dates', () => {
		test('with the year first', () => {
			const result = myTempDateSchema.required().validateSync('1996-01-25');
			expect(result.isValid).toBe(true);
			expect(result?.day).toEqual(25);
			expect(result?.month).toEqual(1);
			expect(result?.year).toEqual(1996);
		});
		test('in the American order', () => {
			const result = myTempDateSchema.required().validateSync('6/13/2014');
			expect(result.isValid).toBe(true);
			expect(result.day).toEqual(13);
			expect(result.month).toEqual(6);
			expect(result.year).toEqual(2014);
		});
	});
	describe('parses times', () => {
		test('with an informal format', () => {
			const result = myTempDateSchema.required().validateSync('7pm PT');
			expect(result.isValid).toBe(true);
			expect(result.hour).toEqual(19);
			expect(result.minute).toEqual(0);
			expect(result.second).toEqual(0);

			const timezone = result.zone;
			expect(timezone.offsetName(1740043708614, { format: 'short', locale: 'en-US' })).toEqual('PST');
			expect(timezone.offsetName(1742459157854, { format: 'short', locale: 'en-US' })).toEqual('PDT');
		});
		test('with a formal format', () => {
			const result = myTempDateSchema.required().validateSync('14:30:00 CT');
			expect(result.isValid).toBe(true);
			expect(result.hour).toEqual(14);
			expect(result.minute).toEqual(30);
			expect(result.second).toEqual(0);

			const timezone = result.zone;
			expect(timezone.offsetName(1740043708614, { format: 'short', locale: 'en-US' })).toEqual('CST');
			expect(timezone.offsetName(1742459157854, { format: 'short', locale: 'en-US' })).toEqual('CDT');
		});
		test('with a foreign timezone', () => {
			const result = myTempDateSchema.required().validateSync('5:00 AM JST');
			expect(result.isValid).toBe(true);
			expect(result.hour).toEqual(5);
			expect(result.minute).toEqual(0);
			expect(result.second).toEqual(0);

			const timezone = result.zone;
			expect(timezone.offsetName(1740043708614, { format: 'short', locale: 'en-US' })).toEqual('UTC+9');
		});
	});
});
