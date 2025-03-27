import * as chrono from 'chrono-node';

import { DateTime, FixedOffsetZone, IANAZone } from 'luxon';

import { extractAndConvertTimezone } from './timezones';
import z from 'zod';

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

const frequencyKind = z
	.literal('once')
	.or(z.literal('daily'))
	.or(z.literal('weekly'))
	.or(z.literal('biweekly'))
	.or(z.literal('weekdays'))
	.or(z.literal('monthly'))
	.or(z.literal('annually'))
	.or(z.literal('floating'))
	.default('once');

export const dateTimeSchema = z
	.custom<DateTime>(value => value instanceof DateTime)
	.or(
		z
			.string()
			.nullish()
			.transform(value => {
				// We can't do anything with null or undefined
				if (value === null || value === undefined) return value;

				// Otherwise, we need to parse the value
				const parseResults = chrono.strict.parse(value);

				// If the value is not a valid date, then we return an invalid DateTime object
				if (parseResults.length === 0) return DateTime.invalid('Invalid date');

				// If the value is a valid date, then we return a new DateTime object
				const year = parseResults[0].start.isCertain('year') ? parseResults[0].start.get('year')! : undefined;
				const month = parseResults[0].start.isCertain('month') ? parseResults[0].start.get('month')! : undefined;
				const day = parseResults[0].start.isCertain('day') ? parseResults[0].start.get('day')! : undefined;
				const hour = parseResults[0].start.get('hour')!;
				const minute = parseResults[0].start.get('minute')!;
				const timezoneOffset = parseResults[0].start.isCertain('timezoneOffset') ? parseResults[0].start.get('timezoneOffset')! : undefined;
				const ianaTimezone = extractAndConvertTimezone(value);
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
			}),
	)
	.refine(
		value => value === null || value === undefined || value.isValid,
		value => ({ message: `${value} is not a valid date` }),
	);

export const eventSchema = z
	.object({
		name: z.string().trim().nonempty(),
		priority: z.number().min(0).max(10),
		location: z.string().nullish().default(null),
		start: dateTimeSchema.nullable().default(null),
		end: dateTimeSchema.nullish(),
		frequency: frequencyKind,
		tags: z.string().array().default([]),
	})
	.strict()
	.refine(value => value.start || value.frequency === 'once', { message: 'start must be defined if frequency is not "once"' })
	.refine(value => !value.end || value.start, { message: 'end cannot be defined if start is null' })
	.refine(value => !value.start || !value.end || value.start <= value.end, { message: 'start must be before end' });

export const dataSchema = z.object({ upcoming: eventSchema.array() }).passthrough();

export type Event = z.infer<typeof eventSchema>;
