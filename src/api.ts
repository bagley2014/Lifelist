import { Event, Frequency, dataSchema } from './schemas';

import { promises as fsp } from 'fs';
import { inPlaceSort } from 'fast-sort';
import { parse as yamlParse } from 'yaml';

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

// We load the events once at boot and cache them for the lifetime of the server
// Would be cool to watch the events file and update this when it changes (maybe lock the cache while updating)
const PARSED_EVENTS = parseEvents();

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

async function* enumerateEventsFromDate(date: Date = new Date()) {
	// Clone the parsed events data so we can modify it
	const events = (await PARSED_EVENTS).slice();

	while (events.length) {
		const event = events.shift() as Event;

		// Add a new event to the list if this event is repeating
		if (event.frequency !== Frequency.Once) {
			if (event.frequency === Frequency.Weekly) {
				const nextEvent = { ...event, start: new Date(event.start!.valueOf() + 7 * DAY_MILLISECONDS) };
				events.push(nextEvent);
			} else if (event.frequency === Frequency.Biweekly) {
				const nextEvent = { ...event, start: new Date(event.start!.valueOf() + 14 * DAY_MILLISECONDS) };
				events.push(nextEvent);
			} else if (event.frequency === Frequency.Weekdays) {
				const nextDay = new Date(event.start!.valueOf() + DAY_MILLISECONDS);
				while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
					nextDay.setDate(nextDay.getDate() + 1);
				}
				const nextEvent = { ...event, start: nextDay };
				events.push(nextEvent);
			}

			// Sort the events after adding a new one
			sortEvents(events);
		}

		// Skip events that have already occurred
		if (event.start && event.start < date) {
			continue;
		}

		// Return valid upcoming events
		if (event.start === null || event.start > date) {
			yield event;
		}
	}
}

export async function events(from: Date, count: number): Promise<Event[]> {
	const results: Event[] = [];
	const generator = enumerateEventsFromDate(from);
	for (let i = 0; i < count; i++) {
		const nextEvent = await generator.next();
		if (nextEvent.done) {
			break;
		}
		results.push(nextEvent.value);
	}
	return results;
}
