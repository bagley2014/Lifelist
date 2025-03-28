import { DebouncedFunction, debounce, yamlStringifyReplacer } from './util';
import { Event, dataSchema } from './schemas';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

import { DateTime } from 'luxon';
import chokidar from 'chokidar';
import { promises as fsp } from 'fs';
import { inPlaceSort } from 'fast-sort';

export interface EventSummary {
	name: string;
	priority: number;
	location: string | null;
	startTime: string | undefined;
	endTime: string | undefined;
	tags: string[];
}

function toDateString(date: DateTime): string {
	// The client expects dates in a form like "Wed Mar 19 2025" since that's what `Date.toDateString` outputs
	return date.toFormat('ccc LLL dd yyyy');
}

function sortEvents(events: Event[]): void {
	// Sort the events so that the earliest ones come first (null represents "immediate" TODOs and so should come first)
	inPlaceSort(events).asc(e => e.start?.valueOf() ?? -1);
}

export class EventsManager {
	// We don't want more than one instance watching the same data file
	static instanceCache: Record<string, EventsManager> = {};

	static async create() {
		const manager = new EventsManager();
		if (EventsManager.instanceCache[manager.dataFilename]) {
			return EventsManager.instanceCache[manager.dataFilename];
		}

		console.log(`Initializing new ${EventsManager.name} using data file: ${manager.dataFilename}`);
		EventsManager.instanceCache[manager.dataFilename] = manager;

		const parseEvents = async (): Promise<void> => {
			console.log('Parsing events data file');
			const eventDataFileContent = await fsp
				.readFile(manager.dataFilename, {
					encoding: 'utf8',
				})
				.catch(() => {
					throw new Error(`Data file not found: ${manager.dataFilename}`);
				});

			const events = await dataSchema
				.parseAsync(yamlParse(eventDataFileContent))
				.catch(error => {
					throw new Error(`Data file is not valid: ${error}`);
				})
				.then(data => data.upcoming);
			sortEvents(events);

			console.log('Events parsed');
			manager.parsedEvents = events;
			manager.cachedResults = {};
		};

		manager.debouncedParse = debounce(() => {
			manager.parsingWork = parseEvents();
		}, 800);

		// TODO: Maybe make this first call lazy
		manager.parsingWork = parseEvents().then(_ => {
			// Start watching the data file for changes after we first parse it
			chokidar.watch(manager.dataFilename, { persistent: false, usePolling: true }).on('all', (event, path) => {
				console.log(`Data file changed (${event} | ${path})`);
				if (event === 'change') manager.debouncedParse();
			});
		});
		await manager.parsingWork;

		return manager;
	}

	private constructor() {
		this.dataFilename = process.env.DATA_FILE ?? 'example/data.yaml';
	}

	async getEvents(from: DateTime, count: number): Promise<[string, EventSummary[]][]> {
		await this.parsingWork;
		const events = await this.enumerateEvents(from, count);
		const groups = this.groupAndCleanEvents(events);
		return groups;
	}

	async addEvent(event: Event): Promise<void> {
		await this.parsingWork;
		const eventDataFileContent = await fsp
			.readFile(this.dataFilename, {
				encoding: 'utf8',
			})
			.catch(() => {
				throw new Error(`Data file not found: ${this.dataFilename}`);
			});

		const data = await dataSchema.parseAsync(yamlParse(eventDataFileContent));
		data.upcoming.push(event);

		const yaml = yamlStringify(data, yamlStringifyReplacer);
		return fsp.writeFile(this.dataFilename, yaml).then(() => {
			// Manually update the data, in case the file system watcher doesn't trigger
			this.parsingWork = this.debouncedParse();
		});
	}

	private groupAndCleanEvents(events: Event[]): [string, EventSummary[]][] {
		// The client prints the times as is, so formatting is left to the server
		const getTime = (date: DateTime, shortened: boolean = false) =>
			date
				.toLocaleString({
					hour: 'numeric',
					minute: date.minute ? 'numeric' : undefined,
					hour12: true,
					timeZoneName: shortened ? undefined : 'shortGeneric',
				})
				.replace(/ (AM|PM)/, (_, p1) => p1.toLowerCase());

		const groups: { [key: string]: EventSummary[] } = {};

		for (const event of events) {
			const key = event.start ? toDateString(event.start) : 'TODO';
			if (!groups[key]) groups[key] = [];
			const hasStart = event.start && (event.start.hour !== 0 || event.start.minute !== 0);
			const hasEnd = event.end && (event.end.hour !== 0 || event.end.minute !== 0);
			groups[key].push({
				name: event.name,
				priority: event.priority,
				location: event.location,
				startTime: hasStart ? (hasEnd ? getTime(event.start!, true) : getTime(event.start!)) : undefined,
				endTime: hasEnd ? getTime(event.end!) : undefined,
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

	private async enumerateEvents(from: DateTime, count: number): Promise<Event[]> {
		// The key for the cache is the date without the time
		const cacheKey = toDateString(from);

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

	private async *enumerateEventsFromDate(date: DateTime) {
		// Clone the parsed events data so we can modify it
		const events = this.parsedEvents.slice();

		while (events.length) {
			const event = events.shift() as Event;

			// Add a new event to the list if this event is repeating
			if (event.frequency !== 'once') {
				// The schema ensures that any event with a frequency other than "once" has a start date
				if (event.frequency === 'weekly') {
					const nextEvent = { ...event, start: event.start!.plus({ weeks: 1 }), end: event.end ? event.end.plus({ weeks: 1 }) : event.end };
					events.push(nextEvent);
				} else if (event.frequency === 'biweekly') {
					const nextEvent = { ...event, start: event.start!.plus({ weeks: 2 }), end: event.end ? event.end.plus({ weeks: 2 }) : event.end };
					events.push(nextEvent);
				} else if (event.frequency === 'weekdays') {
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
			if (event.end && event.end.set({ hour: 0, minute: 0, second: 0 }) > event.start!.set({ hour: 0, minute: 0, second: 0 })) {
				// The schema ensures that any event with an end date has a start date
				const nextEvent = { ...event, start: event.start!.plus({ days: 1 }) };
				events.push(nextEvent);

				// Sort the events after adding a new one
				sortEvents(events);
			}

			// Return valid upcoming events
			if (event.start === null || event.start.set({ hour: 0, minute: 0, second: 0 }) >= date.set({ hour: 0, minute: 0, second: 0 })) {
				yield event;
			}
		}
	}

	private debouncedParse!: DebouncedFunction;
	private dataFilename: string;
	private cachedResults: { [key: string]: [Event[], AsyncGenerator<Event, void, unknown>] } = {};
	private parsedEvents: Event[] = [];
	private parsingWork!: Promise<unknown>;
}
