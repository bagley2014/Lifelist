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

const myDateSchema = date().transform((value, originalValue, context) => {
	if (value === null || value === undefined) return value;

	if (context.isType(value)) return value;

	const chronoResult = chrono.strict.parse(originalValue);
	if (chronoResult.length === 0) return value;

	const today = new Date();
	const year = (chronoResult[0].start.isCertain('year') && chronoResult[0].start.get('year')) || today.getFullYear();
	const month = (chronoResult[0].start.isCertain('month') && chronoResult[0].start.get('month')) || today.getMonth() + 1; // Chrono uses 1-indexed months but Date uses a 0-indexed month
	const day = (chronoResult[0].start.isCertain('day') && chronoResult[0].start.get('day')) || today.getDate();

	const result = new Date(year, month - 1, day);

	if (chronoResult[0].start.isCertain('hour')) result.setHours(chronoResult[0].start.get('hour')!);
	if (chronoResult[0].start.isCertain('minute')) result.setMinutes(chronoResult[0].start.get('minute')!);
	if (chronoResult[0].start.isCertain('second')) result.setSeconds(chronoResult[0].start.get('second')!);

	return result;
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
