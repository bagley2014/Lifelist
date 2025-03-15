import * as chrono from 'chrono-node';

import { InferType, array, date, mixed, number, object, ref, string } from 'yup';

export enum Frequency {
	Once = 'once',
	Weekly = 'weekly',
	Biweekly = 'biweekly',
	Weekdays = 'weekdays',
}

// Cheat sheet for null and undefined in yup
// By default, properties can be undefined, but they cannot be null

// .optional -> add undefined
// .nullable -> add null
// .notRequired -> add undefined and null

// .defined -> remove undefined
// .nonNullable -> remove null
// .required -> remove undefined and null

chrono.strict.refiners.push({
	refine: (_, results) => {
		// If there is no time specified, then the time should default to midnight
		results.forEach(result => {
			if (!result.start.isCertain('hour')) {
				result.start.assign('hour', 0);
				result.start.assign('minute', 0);
				result.start.assign('second', 0);
			} else if (!result.start.isCertain('minute')) {
				result.start.assign('minute', 0);
				result.start.assign('second', 0);
			} else if (!result.start.isCertain('second')) {
				result.start.assign('second', 0);
			}
		});
		return results;
	},
});

const myDateSchema = date().transform((value, originalValue, context) => {
	if (value === null || value === undefined) return value;

	if (context.isType(value)) return value;

	return chrono.strict.parseDate(originalValue);
});

const eventSchema = object({
	name: string().required(),
	priority: number().required().min(0).max(10),
	location: string().notRequired().default(null),
	start: myDateSchema.defined().nullable().default(null),
	end: myDateSchema.notRequired().when('start', {
		is: null,
		then: schema => schema.test('is-null-or-undefined', '${path} is defined but start is not', value => value === null || value === undefined),
		otherwise: schema => schema.min(ref('start'), 'End date must be after start date'),
	}),
	frequency: mixed<Frequency>()
		.oneOf(Object.values(Frequency))
		.default(Frequency.Once)
		.when('start', {
			is: null,
			then: schema => schema.test('is-once', '${path} must be "once" if start is null', value => value == 'once'),
		}),
	tags: array().of(string().required()).default([]),
}).exact();

export const dataSchema = object({ upcoming: array().of(eventSchema).required() }).exact();

export type Event = InferType<typeof eventSchema>;
export type MyDate = InferType<typeof myDateSchema>;
