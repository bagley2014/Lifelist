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
