import { Event, Frequency, dataSchema } from './schemas';

import { DateTime } from 'luxon';
import { debounce } from './util';
import { promises as fsp, watch, type FSWatcher } from 'fs';
import { inPlaceSort } from 'fast-sort';
import { parse as yamlParse } from 'yaml';

let INITIALIZED = false;
let CACHED_RESULTS: { [key: string]: [Event[], AsyncGenerator<Event, void, unknown>] } = {};
let PARSED_EVENTS: Promise<Event[]>;
let WATCHER: FSWatcher;

export interface EventSummary {
	name: string;
	priority: number;
	location: string | null;
	startTime: string | undefined;
	endTime: string | undefined;
	tags: string[];
}

function init() {
	const DATA_FILE = process.env.DATA_FILE ?? 'example/data.yaml';

	if (INITIALIZED) throw new Error('Already initialized - `init` should only be called once');

	console.log(`Using data file: ${DATA_FILE}`);

	// TODO: Make this first call lazy
	PARSED_EVENTS = parseEvents();

	const debouncedParse = debounce(() => {
		CACHED_RESULTS = {};
		PARSED_EVENTS = parseEvents();
	}, 500);

	// When the data file changes, we parse it again and clear the old cache
	WATCHER = watch(DATA_FILE, eventType => {
		console.log(`Data file changed (${eventType})`);
		if (eventType === 'change') debouncedParse();
	});

	INITIALIZED = true;

	async function parseEvents() {
		console.log('Parsing events data file');
		const eventDataFileContent = await fsp.readFile(DATA_FILE, {
			encoding: 'utf8',
		});

		const events = dataSchema.validateSync(yamlParse(eventDataFileContent)).upcoming;
		sortEvents(events);

		console.log('Events parsed');
		return events;
	}
}

export function reset() {
	if (process.env.NODE_ENV !== 'test') throw new Error('reset should only be called in test environment');

	if (!INITIALIZED) return;

	INITIALIZED = false;
	CACHED_RESULTS = {};
	PARSED_EVENTS = Promise.resolve([]);
	WATCHER.close();

	// console.log was spied on in the test file
	console.log('Reset');
}

function sortEvents(events: Event[]) {
	// Sort the events so that the earliest ones come first (null represents "immediate" TODOs and so should come first)
	inPlaceSort(events).asc(e => e.start?.valueOf() ?? -1);
}

async function* enumerateEventsFromDate(date: DateTime) {
	// Clone the parsed events data so we can modify it
	const events = (await PARSED_EVENTS).slice();

	while (events.length) {
		const event = events.shift() as Event;

		// Add a new event to the list if this event is repeating
		if (event.frequency !== Frequency.Once) {
			// The schema ensures that any event with a frequency other than "once" has a start date
			if (event.frequency === Frequency.Weekly) {
				const nextEvent = { ...event, start: event.start!.plus({ weeks: 1 }), end: event.end ? event.end.plus({ weeks: 1 }) : event.end };
				events.push(nextEvent);
			} else if (event.frequency === Frequency.Biweekly) {
				const nextEvent = { ...event, start: event.start!.plus({ weeks: 2 }), end: event.end ? event.end.plus({ weeks: 2 }) : event.end };
				events.push(nextEvent);
			} else if (event.frequency === Frequency.Weekdays) {
				let daysToAdd = 1;
				let nextDay = event.start!.plus({ days: daysToAdd });
				while (nextDay.isWeekend) {
					nextDay = event.start!.plus({ days: ++daysToAdd });
				}
				const nextEvent = { ...event, start: nextDay, end: event.end ? event.end.plus({ days: daysToAdd }) : event.end };
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
		if (event.end && event.end.day > event.start!.day) {
			// The schema ensures that any event with an end date has a start date
			const nextEvent = { ...event, start: event.start!.plus({ days: 1 }) };
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

function toDateString(date: DateTime) {
	// The client expects dates in a form like "Wed Mar 19 2025" since that's what `Date.toDateString` outputs
	return date.toFormat('ccc LLL dd yyyy');
}

async function enumerateEvents(from: DateTime, count: number): Promise<Event[]> {
	// The key for the cache is the date without the time
	const cacheKey = toDateString(from);

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

function groupAndCleanEvents(events: Event[]) {
	// The client prints the times as is, so formatting is left to the server
	const getTime = (date: DateTime) =>
		date.toLocaleString({
			hour: 'numeric',
			minute: 'numeric',
			hour12: true,
			timeZoneName: 'shortGeneric',
		});

	const groups: { [key: string]: EventSummary[] } = {};

	for (const event of events) {
		const key = event.start ? toDateString(event.start) : 'TODO';
		if (!groups[key]) groups[key] = [];
		groups[key].push({
			name: event.name,
			priority: event.priority,
			location: event.location,
			startTime: event.start && (event.start.hour !== 0 || event.start.minute !== 0) ? getTime(event.start!) : undefined,
			endTime: event.end && (event.end.hour !== 0 || event.end.minute !== 0) ? getTime(event.end!) : undefined,
			tags: event.tags,
		});
	}

	const results: [string, EventSummary[]][] = Object.keys(groups).map(key => {
		inPlaceSort(groups[key]).desc(e => e.priority);
		return [key, groups[key]];
	});
	inPlaceSort(results).asc([([key]) => new Date(key === 'TODO' ? '1970-01-01' : key)]);
	return results;
}

export async function events(from: DateTime, count: number): Promise<[string, EventSummary[]][]> {
	if (!INITIALIZED) init();
	else console.log('Already initialized');

	const events = await enumerateEvents(from, count);
	const groups = groupAndCleanEvents(events);
	return groups;
}
