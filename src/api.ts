import { Event, Frequency, dataSchema } from './schemas';

import { promises as fsp } from 'fs';
import { inPlaceSort } from 'fast-sort';
import { parse as yamlParse } from 'yaml';

// GLOBALS ******
const CACHED_RESULTS: { [key: string]: [Event[], AsyncGenerator<Event, void, unknown>] } = {};

// We load the events once at boot and cache them for the lifetime of the server
// Would be cool to watch the events file and update this when it changes (maybe lock the cache while updating)
const PARSED_EVENTS = parseEvents();

// **************

function addDays(date: Date, days: number) {
	const newDate = new Date(date);
	newDate.setDate(newDate.getDate() + days);
	return newDate;
}

function sortEvents(events: Event[]) {
	// Sort the events so that the earliest ones come first (null represents "immediate" TODOs and so should come first)
	inPlaceSort(events).asc(e => e.start?.valueOf() ?? -1);
}

async function parseEvents() {
	const DATA_FILE = 'data/events.yaml';

	const eventDataFileContent = await fsp.readFile(DATA_FILE, {
		encoding: 'utf8',
	});

	const events = dataSchema.cast(yamlParse(eventDataFileContent)).upcoming;
	sortEvents(events);
	return events;
}

async function* enumerateEventsFromDate(date: Date = new Date()) {
	// Clone the parsed events data so we can modify it
	const events = (await PARSED_EVENTS).slice();

	while (events.length) {
		const event = events.shift() as Event;

		// Add a new event to the list if this event is repeating
		if (event.frequency !== Frequency.Once) {
			// The schema ensures that any event with a frequency other than "once" has a start date
			if (event.frequency === Frequency.Weekly) {
				const nextEvent = { ...event, start: addDays(event.start!, 7), end: event.end ? addDays(event.end, 7) : event.end };
				events.push(nextEvent);
			} else if (event.frequency === Frequency.Biweekly) {
				const nextEvent = { ...event, start: addDays(event.start!, 14), end: event.end ? addDays(event.end, 14) : event.end };
				events.push(nextEvent);
			} else if (event.frequency === Frequency.Weekdays) {
				let daysToAdd = 1;
				let nextDay = addDays(event.start!, daysToAdd);
				while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
					nextDay = addDays(event.start!, ++daysToAdd);
				}
				const nextEvent = { ...event, start: nextDay, end: event.end ? addDays(event.end, daysToAdd) : event.end };
				events.push(nextEvent);
			}

			// Sort the events after adding a new one
			sortEvents(events);
		}

		// Skip events that have already occurred
		if (event.start && event.start < date) {
			continue;
		}

		// Add a new event for events that span multiple days
		if (event.end && event.end.getDate() > event.start!.getDate()) {
			// The schema ensures that any event with an end date has a start date
			const nextEvent = { ...event, start: addDays(event.start!, 1) };
			events.push(nextEvent);

			// Sort the events after adding a new one
			sortEvents(events);
		}

		// Return valid upcoming events
		if (event.start === null || event.start > date) {
			yield event;
		}
	}
}

async function enumerateEvents(from: Date, count: number): Promise<Event[]> {
	// The key for the cache is the date without the time
	const cacheKey = from.toDateString();

	// Initialize the cache if it didn't already exist
	if (!CACHED_RESULTS[cacheKey]) CACHED_RESULTS[cacheKey] = [[], enumerateEventsFromDate(from)];

	// If we already have enough results, return them
	if (CACHED_RESULTS[cacheKey][0].length >= count) return CACHED_RESULTS[cacheKey][0].slice(0, count);

	// Otherwise, keep generating events until we have enough
	while (CACHED_RESULTS[cacheKey][0].length < count) {
		const nextEvent = await CACHED_RESULTS[cacheKey][1].next();
		if (nextEvent.done) {
			break;
		}
		CACHED_RESULTS[cacheKey][0].push(nextEvent.value);
	}

	return CACHED_RESULTS[cacheKey][0];
}

export async function events(from: Date, count: number): Promise<Event[]> {
	return await enumerateEvents(from, count);
}
