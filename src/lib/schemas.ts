import * as chrono from 'chrono-node';

import { DateTime, FixedOffsetZone, IANAZone } from 'luxon';
import { InferType, array, mixed, number, object, string } from 'yup';

import { extractAndConvertTimezone } from './timezones';

export enum Frequency {
	Once = 'once',
	Weekly = 'weekly',
	Biweekly = 'biweekly',
	Weekdays = 'weekdays',
}

chrono.strict.refiners.push({
	refine: (_, results) => {
		// If there is no time specified, then the time should default to midnight
		results.forEach(result => {
			if (!result.start.isCertain('hour')) {
				result.start.assign('hour', 0);
				result.start.assign('minute', 0);
				result.start.assign('second', 0);
			}
		});
		return results;
	},
});

// Cheat sheet for null and undefined in yup
// By default, properties can be undefined, but they cannot be null

// .optional -> add undefined
// .nullable -> add null
// .notRequired -> add undefined and null

// .defined -> remove undefined
// .nonNullable -> remove null
// .required -> remove undefined and null

export const dateTimeSchema = mixed<DateTime>((input): input is DateTime => input instanceof DateTime)
	.transform((value, originalValue, context) => {
		// We can't do anything with null or undefined
		if (value === null || value === undefined) return value;

		// If the value is already a DateTime object, then we don't need to do anything
		if (context.isType(value)) return value;

		// Otherwise, we need to parse the value
		const parseResults = chrono.strict.parse(originalValue);

		// If the value is not a valid date, then we return an invalid DateTime object
		if (parseResults.length === 0) return DateTime.invalid('Invalid date');

		// If the value is a valid date, then we return a new DateTime object
		const year = parseResults[0].start.isCertain('year') ? parseResults[0].start.get('year')! : undefined;
		const month = parseResults[0].start.isCertain('month') ? parseResults[0].start.get('month')! : undefined;
		const day = parseResults[0].start.isCertain('day') ? parseResults[0].start.get('day')! : undefined;
		const hour = parseResults[0].start.get('hour')!;
		const minute = parseResults[0].start.get('minute')!;
		const timezoneOffset = parseResults[0].start.isCertain('timezoneOffset') ? parseResults[0].start.get('timezoneOffset')! : undefined;
		const ianaTimezone = extractAndConvertTimezone(originalValue);
		return DateTime.fromObject(
			{
				year: year,
				month: month,
				day: day,
				hour: hour,
				minute: minute,
			},
			ianaTimezone ? { zone: IANAZone.create(ianaTimezone) } : timezoneOffset ? { zone: FixedOffsetZone.instance(timezoneOffset) } : {},
		);
	})
	.test('is-valid', '${path} is not a valid date', value => value === null || value === undefined || value.isValid);

export const eventSchema = object({
	name: string().required(),
	priority: number().required().min(0).max(10),
	location: string().notRequired().default(null),
	start: dateTimeSchema.defined().nullable().default(null),
	end: dateTimeSchema.notRequired().when('start', {
		is: null,
		then: schema => schema.test('is-null-or-undefined', '${path} is defined but start is not', value => value === null || value === undefined),
	}),
	frequency: mixed<Frequency>()
		.oneOf(Object.values(Frequency))
		.default(Frequency.Once)
		.when('start', {
			is: null,
			then: schema => schema.test('is-once', '${path} must be "once" if start is null', value => value == 'once'),
		}),
	tags: array().of(string().required()).default([]),
})
	.exact()
	.test('start-before-end', 'start must be before end', function (value) {
		if (value.start && value.end && value.start >= value.end) {
			return this.createError({ path: 'start' });
		}
		return true;
	});

export const dataSchema = object({ upcoming: array().of(eventSchema).required() });

export type Event = InferType<typeof eventSchema>;
