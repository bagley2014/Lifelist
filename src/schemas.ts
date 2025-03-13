import * as chrono from 'chrono-node';

import { InferType, array, date, number, object, ref, string } from 'yup';

// Cheat sheet for null and undefined in yup
// By default, properties can be undefined, but they cannot be null

// .optional -> add undefined
// .nullable -> add null
// .notRequired -> add undefined and null

// .defined -> remove undefined
// .nonNullable -> remove null
// .required -> remove undefined and null

const myDateSchema = date().transform((value, originalValue, context) => {
	if (value === null || value === undefined) return value;

	if (context.isType(value)) return value;

	return chrono.parseDate(originalValue);
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
	frequency: string().default('once'),
	tags: array().of(string().required()).default([]),
}).exact();

export const dataSchema = object({ upcoming: array().of(eventSchema).required() }).exact();

export type Event = InferType<typeof eventSchema>;
export type MyDate = InferType<typeof myDateSchema>;
