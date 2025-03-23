import { Event, Frequency, dataSchema } from './schemas';
import { promises as fsp, watch } from 'fs';

import { DateTime } from 'luxon';
import { debounce } from './util';
import { inPlaceSort } from 'fast-sort';
import { parse as yamlParse } from 'yaml';

export interface EventSummary {
	name: string;
	priority: number;
	location: string | null;
	startTime: string | undefined;
	endTime: string | undefined;
	tags: string[];
}

export class EventsManager {
	private cachedResults: { [key: string]: [Event[], AsyncGenerator<Event, void, unknown>] } = {};
	private parsedEvents: Promise<Event[]> = Promise.resolve([]);
	private dataFile: Promise<fsp.FileHandle> | undefined = undefined;

	constructor() {
		const dataFilename = process.env.DATA_FILE ?? 'example/data.yaml';

		const debouncedParse = debounce(() => {
			this.cachedResults = {};
			this.parsedEvents = this.parseEvents();
		}, 500);

		console.log(`Initializing ${EventsManager.name} using data file: ${dataFilename}`);

		// Open the data file and start watching it (we watch the file only after opening it to ensure it exists)
		this.dataFile = fsp
			.open(dataFilename)
			.then(file => {
				// When the data file changes, we parse it again and clear the old cache
				watch(dataFilename, eventType => {
					console.log(`Data file changed (${eventType})`);
					if (eventType === 'change') debouncedParse();
				});
				return file;
			})
			.catch(() => {
				throw new Error(`Data file not found: ${dataFilename}`);
			});

		// TODO: Make this first call lazy
		this.parsedEvents = this.parseEvents();
	}

	async events(from: DateTime, count: number): Promise<[string, EventSummary[]][]> {
		const events = await this.enumerateEvents(from, count);
		const groups = this.groupAndCleanEvents(events);
		return groups;
	}

	private async parseEvents(): Promise<Event[]> {
		const file = await this.dataFile!.catch(error => {
			console.log('Error opening data file');
			console.log(error);
			throw error;
		});
		console.log('Parsing events data file');
		const eventDataFileContent = await file.readFile({
			encoding: 'utf8',
		});

		const events = dataSchema.validateSync(yamlParse(eventDataFileContent)).upcoming;
		this.sortEvents(events);

		console.log('Events parsed');
		return events;
	}

	private sortEvents(events: Event[]): void {
		// Sort the events so that the earliest ones come first (null represents "immediate" TODOs and so should come first)
		inPlaceSort(events).asc(e => e.start?.valueOf() ?? -1);
	}

	private async *enumerateEventsFromDate(date: DateTime) {
		// Clone the parsed events data so we can modify it
		const events = (await this.parsedEvents).slice();

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
				this.sortEvents(events);
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
				this.sortEvents(events);
			}

			// Return valid upcoming events
			if (event.start === null || event.start > date) {
				yield event;
			}
		}
	}

	private toDateString(date: DateTime): string {
		// The client expects dates in a form like "Wed Mar 19 2025" since that's what `Date.toDateString` outputs
		return date.toFormat('ccc LLL dd yyyy');
	}

	private async enumerateEvents(from: DateTime, count: number): Promise<Event[]> {
		// The key for the cache is the date without the time
		const cacheKey = this.toDateString(from);

		// Initialize the cache if it didn't already exist
		if (!this.cachedResults[cacheKey]) this.cachedResults[cacheKey] = [[], this.enumerateEventsFromDate(from)];

		// If we already have enough results, return them
		if (this.cachedResults[cacheKey][0].length >= count) return this.cachedResults[cacheKey][0].slice(0, count);

		// Otherwise, keep generating events until we have enough
		while (this.cachedResults[cacheKey][0].length < count) {
			const nextEvent = await this.cachedResults[cacheKey][1].next();
			if (nextEvent.done) {
				break;
			}
			this.cachedResults[cacheKey][0].push(nextEvent.value);
		}

		return this.cachedResults[cacheKey][0];
	}

	private groupAndCleanEvents(events: Event[]): [string, EventSummary[]][] {
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
			const key = event.start ? this.toDateString(event.start) : 'TODO';
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
}
