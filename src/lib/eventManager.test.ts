import { afterEach, describe, expect, test, vi } from 'vitest';
import chokidar, { FSWatcher } from 'chokidar';
import { fs, vol } from 'memfs';

import { DateTime } from 'luxon';
import { EventsManager } from './eventManager';
import { eventSchema } from './schemas';
import { parse as yamlParse } from 'yaml';

vi.mock('node:fs');
vi.mock('node:fs/promises');

afterEach(() => {
	vol.reset();
	vi.unstubAllEnvs();
	vi.resetAllMocks();
});

const exampleEventYaml = `
  - name: "Test Event"
    priority: 5
    location: "Test Location"
    start: "2023-01-01"
    tags:
      - "Test Tag"
`;
const exampleEventYaml2 = `
  - name: "Test Event 2"
    priority: 7
    location: "Test Location"
    start: "2023-01-12"
    tags:
      - "Test Tag"
`;
const earlyExampleEventYaml = `
  - name: "Last Year's Test Event"
    priority: 2
    location: null
    start: "2022-10-01"
    tags: []
`;
const todoExampleEventYaml = `
  - name: "TODO Test Event"
    priority: 10
    location: null
    tags: []
`;
const weeklyEventYaml = `
  - name: "Weekly Event"
    priority: 5
    start: "2023-01-01"
    frequency: "weekly"
    tags: []
`;
const weeklyEventWithEndTimeYaml = `
  - name: Abomination Vaults
    priority: 9
    location: Online
    start: 2023-04-12 19:00:00 PT
    end: 2023-04-12 22:00:00 PT
    frequency: weekly
    tags:
      - Pathfinder
`;
const biweeklyEventYaml = `
  - name: "Biweekly Event"
    priority: 5
    start: "2023-01-01"
    frequency: "biweekly"
    tags: []
`;
const biweeklyEventWithEndTimeYaml = `
  - name: Kingmaker
    priority: 8
    location: Online
    start: 2023-03-01 18:30:00 PT
    end: 2023-03-01 21:30:00 PT
    frequency: biweekly
    tags:
      - Pathfinder
`;
const weekdayEventYaml = `
  - name: Work
    priority: 1
    location: Online
    start: January 1, 2025
    frequency: weekdays
    tags:
      - Work
`;
const weekdayEventWithEndTimeYaml = `
  - name: "Prime Time TV"
    priority: 1
    start: "2023-01-09 18:30:00 PT"
    end: "2023-01-09 21:30:00 PT"
    frequency: "weekdays"
    tags: []
`;
const multiDayEventYaml = `
  - name: Dragon*Con
    priority: 10
    location: Atlanta
    start: August 27, 2025
    end: September 1, 2025
    frequency: once
    tags:
      - Convention
`;
const wellOrderedEventYaml = `
  - name: Dragon*Con
    priority: 10
    location: Atlanta
    start: August 27, 2025
    end: September 1, 2025
    frequency: once
    tags:
      - Convention
`;

describe('getEvents', () => {
	test('fails if the data file is not found', async () => {
		vi.stubEnv('DATA_FILE', 'data.yaml');
		await expect(EventsManager.create()).rejects.toThrow('Data file not found: data.yaml');
	});

	test('fails if the data file is invalid', async () => {
		vi.stubEnv('DATA_FILE', 'invalid/data.yaml');
		vol.fromJSON({
			'./invalid/data.yaml': `${exampleEventYaml}`,
		});
		await expect(EventsManager.create()).rejects.toThrow('Data file is not valid');
	});

	test('loads the example data when environment variable is unset', async () => {
		vi.stubEnv('DATA_FILE', undefined);
		vol.fromJSON({
			'./example/data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 1);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(1);
		expect(result[0].length).toBe(2);
		expect(result[0][0]).toEqual('Sun Jan 01 2023');
		expect(result[0][1][0].name).toEqual('Test Event');
	});

	test('watches the data file', async () => {
		vi.stubEnv('DATA_FILE', 'data.yaml');
		vol.fromJSON({
			'./data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const mockedDebouncedParse = vi.fn();
		vi.spyOn(chokidar, 'watch').mockImplementation((_, __) => {
			return fs.watch('./data.yaml', {}, eventType => {
				if (eventType === 'change') mockedDebouncedParse();
			}) as unknown as FSWatcher;
		});

		const _manager = await EventsManager.create();
		expect(chokidar.watch).toHaveBeenCalledWith('data.yaml', { persistent: false, usePolling: true });
		expect(chokidar.watch).toHaveBeenCalledTimes(1);
		expect(mockedDebouncedParse).not.toHaveBeenCalled();

		vol.fromJSON({
			'./data.yaml': `upcoming:${exampleEventYaml2}`,
		});

		expect(chokidar.watch).toHaveBeenCalledTimes(1);
		expect(mockedDebouncedParse).toHaveBeenCalled();
	});

	// I don't have a way to verify that the cache is actually being used, but this test adds code coverage
	test('returns cached events when possible', async () => {
		vi.stubEnv('DATA_FILE', 'data.yaml');
		vol.fromJSON({
			'./data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result1 = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 1);
		const result2 = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 1);

		expect(result1).toEqual(result2);
		expect(result1).toBeInstanceOf(Array);
		expect(result1.length).toBe(1);
	});

	test('handles requests for more events than are available', async () => {
		vi.stubEnv('DATA_FILE', 'little/data.yaml');
		vol.fromJSON({
			'./little/data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 20);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(1);
		expect(result[0][0]).toEqual('Sun Jan 01 2023');
		expect(result[0][1][0].name).toEqual('Test Event');
	});

	test('skips events that have already passed', async () => {
		vi.stubEnv('DATA_FILE', 'old/data.yaml');
		vol.fromJSON({
			'./old/data.yaml': `upcoming:${earlyExampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2023-01-01T00:00:00.000-08:00'), 1);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(0);
	});

	test('handles todo events', async () => {
		vi.stubEnv('DATA_FILE', 'todo/data.yaml');
		vol.fromJSON({
			'./todo/data.yaml': `upcoming:${exampleEventYaml}${todoExampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 2);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(2);
		expect(result[0][0]).toEqual('TODO');
		expect(result[0][1][0].name).toEqual('TODO Test Event');
		expect(result[1][0]).toEqual('Sun Jan 01 2023');
		expect(result[1][1][0].name).toEqual('Test Event');
	});

	test('handles weekly events', async () => {
		vi.stubEnv('DATA_FILE', 'weekly/data.yaml');
		vol.fromJSON({
			'./weekly/data.yaml': `upcoming:${weeklyEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 5);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(5);
		expect(result[0][0]).toEqual('Sun Jan 01 2023');
		expect(result[1][0]).toEqual('Sun Jan 08 2023');
		expect(result[2][0]).toEqual('Sun Jan 15 2023');
		expect(result[3][0]).toEqual('Sun Jan 22 2023');
		expect(result[4][0]).toEqual('Sun Jan 29 2023');
	});

	test('handles weekly events with end times', async () => {
		vi.stubEnv('DATA_FILE', 'weekly/data.yaml');
		vol.fromJSON({
			'./weekly/data.yaml': `upcoming:${weeklyEventWithEndTimeYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 5);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(5);
		expect(result[0][0]).toEqual('Wed Apr 12 2023');
		expect(result[1][0]).toEqual('Wed Apr 19 2023');
		expect(result[2][0]).toEqual('Wed Apr 26 2023');
		expect(result[3][0]).toEqual('Wed May 03 2023');
		expect(result[4][0]).toEqual('Wed May 10 2023');
	});

	test('handles biweekly events', async () => {
		vi.stubEnv('DATA_FILE', 'biweekly/data.yaml');
		vol.fromJSON({
			'./biweekly/data.yaml': `upcoming:${biweeklyEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 5);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(5);
		expect(result[0][0]).toEqual('Sun Jan 01 2023');
		expect(result[1][0]).toEqual('Sun Jan 15 2023');
		expect(result[2][0]).toEqual('Sun Jan 29 2023');
		expect(result[3][0]).toEqual('Sun Feb 12 2023');
		expect(result[4][0]).toEqual('Sun Feb 26 2023');
	});

	test('handles biweekly events with end times', async () => {
		vi.stubEnv('DATA_FILE', 'biweekly/data.yaml');
		vol.fromJSON({
			'./biweekly/data.yaml': `upcoming:${biweeklyEventWithEndTimeYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 5);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(5);
		expect(result[0][0]).toEqual('Wed Mar 01 2023');
		expect(result[1][0]).toEqual('Wed Mar 15 2023');
		expect(result[2][0]).toEqual('Wed Mar 29 2023');
		expect(result[3][0]).toEqual('Wed Apr 12 2023');
		expect(result[4][0]).toEqual('Wed Apr 26 2023');
	});

	test('handles weekday events', async () => {
		vi.stubEnv('DATA_FILE', 'weekday/data.yaml');
		vol.fromJSON({
			'./weekday/data.yaml': `upcoming:${weekdayEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2025-03-25T00:00:00.000-07:00'), 10);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(10);
		expect(result[0][0]).toEqual('Tue Mar 25 2025');
		expect(result[1][0]).toEqual('Wed Mar 26 2025');
		expect(result[2][0]).toEqual('Thu Mar 27 2025');
		expect(result[3][0]).toEqual('Fri Mar 28 2025');
		expect(result[4][0]).toEqual('Mon Mar 31 2025');
		expect(result[5][0]).toEqual('Tue Apr 01 2025');
		expect(result[6][0]).toEqual('Wed Apr 02 2025');
		expect(result[7][0]).toEqual('Thu Apr 03 2025');
		expect(result[8][0]).toEqual('Fri Apr 04 2025');
		expect(result[9][0]).toEqual('Mon Apr 07 2025');
	});

	test('handles weekday events with end times', async () => {
		vi.stubEnv('DATA_FILE', 'weekday/data.yaml');
		vol.fromJSON({
			'./weekday/data.yaml': `upcoming:${weekdayEventWithEndTimeYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 10);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(10);
		expect(result[0][0]).toEqual('Mon Jan 09 2023');
		expect(result[1][0]).toEqual('Tue Jan 10 2023');
		expect(result[2][0]).toEqual('Wed Jan 11 2023');
		expect(result[3][0]).toEqual('Thu Jan 12 2023');
		expect(result[4][0]).toEqual('Fri Jan 13 2023');
		expect(result[5][0]).toEqual('Mon Jan 16 2023');
		expect(result[6][0]).toEqual('Tue Jan 17 2023');
		expect(result[7][0]).toEqual('Wed Jan 18 2023');
		expect(result[8][0]).toEqual('Thu Jan 19 2023');
		expect(result[9][0]).toEqual('Fri Jan 20 2023');
	});

	test('handles multiDay events', async () => {
		vi.stubEnv('DATA_FILE', 'multiDay/data.yaml');
		vol.fromJSON({
			'./multiDay/data.yaml': `upcoming:${multiDayEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 6);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(6);
		expect(result[0][0]).toEqual('Wed Aug 27 2025');
		expect(result[1][0]).toEqual('Thu Aug 28 2025');
		expect(result[2][0]).toEqual('Fri Aug 29 2025');
		expect(result[3][0]).toEqual('Sat Aug 30 2025');
		expect(result[4][0]).toEqual('Sun Aug 31 2025');
		expect(result[5][0]).toEqual('Mon Sep 01 2025');
	});
});

describe('addEvent', () => {
	const newEvent = eventSchema.parse({
		name: 'New Event',
		priority: 3,
		location: 'New Location',
		start: DateTime.fromISO('2024-01-25T00:00:00.000-08:00'),
		tags: ['New Tag'],
	});

	const newEventWithTimezone = eventSchema.parse({
		name: 'New East Coast Event',
		priority: 3,
		location: 'Florida',
		start: DateTime.fromObject(
			{
				year: 2024,
				month: 1,
				day: 25,
				hour: 19,
				minute: 47,
			},
			{ zone: 'America/New_York' },
		),
		tags: [],
	});

	const newTodoEvent = eventSchema.parse({
		name: 'New Todo Event',
		priority: 10,
		tags: [],
	});

	const newDisorganizedEvent = eventSchema.parse({
		location: 'Atlanta',
		name: 'Dragon*Con',
		start: DateTime.fromObject({
			year: 2025,
			month: 8,
			day: 27,
		}),
		priority: 10,
		end: DateTime.fromObject({
			year: 2025,
			month: 9,
			day: 1,
		}),
		tags: ['Convention'],
	});

	test('fails if the data file is not found', async () => {
		vi.stubEnv('DATA_FILE', 'data.yaml');
		await expect(EventsManager.create()).rejects.toThrow('Data file not found: data.yaml');
	});

	test('fails if the data file is deleted', async () => {
		vi.stubEnv('DATA_FILE', 'data.yaml');
		vol.fromJSON({
			'./data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		fs.unlinkSync('./data.yaml');
		await expect(manager.addEvent(newEvent)).rejects.toThrow('Data file not found: data.yaml');
	});

	test('adds a new event to the data file', async () => {
		vi.stubEnv('DATA_FILE', 'unfinished/data.yaml');
		vol.fromJSON({
			'./unfinished/data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		await manager.addEvent(newEvent);

		const data = yamlParse(fs.readFileSync('./unfinished/data.yaml', 'utf8').toString());

		expect(data.upcoming[1].name).toBe(newEvent.name);
		expect(data.upcoming[1].priority).toBe(newEvent.priority);
		expect(data.upcoming[1].location).toBe(newEvent.location);
		expect(data.upcoming[1].start).toBe('January 25, 2024');
		expect(data.upcoming[1].tags).toEqual(newEvent.tags);
	});

	test('adds a new event with a timezone to the data file', async () => {
		vi.stubEnv('DATA_FILE', 'timezone/data.yaml');
		vol.fromJSON({
			'./timezone/data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		await manager.addEvent(newEventWithTimezone);

		const data = yamlParse(fs.readFileSync('./timezone/data.yaml', 'utf8').toString());

		expect(data.upcoming[1].name).toBe(newEventWithTimezone.name);
		expect(data.upcoming[1].priority).toBe(newEventWithTimezone.priority);
		expect(data.upcoming[1].location).toBe(newEventWithTimezone.location);
		expect(data.upcoming[1].start).toContain('7:47');
		expect(data.upcoming[1].start).toContain('ET');
	});

	test('adds a new todo event to the data file', async () => {
		vi.stubEnv('DATA_FILE', 'todo/data.yaml');
		vol.fromJSON({
			'./todo/data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		await manager.addEvent(newTodoEvent);

		const data = yamlParse(fs.readFileSync('./todo/data.yaml', 'utf8').toString());

		expect(data.upcoming[1].name).toBe(newTodoEvent.name);
		expect(data.upcoming[1].priority).toBe(newTodoEvent.priority);
		expect(data.upcoming[1].location).toBeNull();
		expect(data.upcoming[1].tags).toEqual(newTodoEvent.tags);
		expect(data.upcoming[1].start).toBeNull();
	});

	test('organizes the data file after adding an event', async () => {
		vi.stubEnv('DATA_FILE', 'disorganized/data.yaml');
		vol.fromJSON({
			'./disorganized/data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		await manager.addEvent(newDisorganizedEvent);

		const text = fs.readFileSync('./disorganized/data.yaml', 'utf8').toString();

		expect(text).toContain(wellOrderedEventYaml);
	});
});
