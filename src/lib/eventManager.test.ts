import { afterEach, describe, expect, test, vi } from 'vitest';
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
  - name: "Weekday Event"
    priority: 1
    start: "2023-01-09"
    frequency: "weekdays"
    tags: []
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
  - name: "Long Event"
    priority: 4
    start: "2023-01-01"
    end: "2023-01-03"
    tags: []
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

	test('watches the data file being overwritten', async () => {
		vi.useFakeTimers();
		vi.stubEnv('DATA_FILE', 'data.yaml');
		vol.fromJSON({
			'./data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 1);
		expect(result[0][1][0].name).toEqual('Test Event');

		vol.fromJSON({
			'./data.yaml': `upcoming:${exampleEventYaml2}`,
		});
		vi.advanceTimersByTime(10_000);

		const newResult = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 1);
		expect(newResult[0][1][0].name).toEqual('Test Event 2');
		vi.useRealTimers();
	});

	test('watches the data file being modified', async () => {
		vi.useFakeTimers();
		vi.stubEnv('DATA_FILE', 'data.yaml');
		vol.fromJSON({
			'./data.yaml': `upcoming:${exampleEventYaml}`,
		});

		const manager = await EventsManager.create();
		let result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 1);
		expect(result[0][1][0].name).toEqual('Test Event');

		fs.appendFileSync('./data.yaml', `\n${exampleEventYaml2}`);
		vi.advanceTimersByTime(10_000);

		result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 2);
		expect(result[1][1][0].name).toEqual('Test Event 2');

		fs.appendFileSync('./data.yaml', `\n${earlyExampleEventYaml}`);
		vi.advanceTimersByTime(10_000);

		result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 2);
		expect(result[0][1][0].name).toEqual("Last Year's Test Event");

		vi.useRealTimers();
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
		const result = await manager.getEvents(DateTime.fromISO('2022-01-01T00:00:00.000-08:00'), 5);

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBe(3);
		expect(result[0][0]).toEqual('Sun Jan 01 2023');
		expect(result[1][0]).toEqual('Mon Jan 02 2023');
		expect(result[2][0]).toEqual('Tue Jan 03 2023');
	});
});

describe('addEvent', () => {
	const newEvent = eventSchema.cast({
		name: 'New Event',
		priority: 3,
		location: 'New Location',
		start: DateTime.fromISO('2024-01-25T00:00:00.000-08:00'),
		tags: ['New Tag'],
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

		console.log(data);
		expect(data.upcoming[1].name).toBe(newEvent.name);
		expect(data.upcoming[1].priority).toBe(newEvent.priority);
		expect(data.upcoming[1].location).toBe(newEvent.location);
		expect(data.upcoming[1].start).toBe(newEvent.start?.toISO());
		expect(data.upcoming[1].tags).toEqual(newEvent.tags);
	});
});
