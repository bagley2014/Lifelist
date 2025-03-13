import { dataSchema } from './schemas';
import { promises as fsp } from 'fs';
import { parse as yamlParse } from 'yaml';

const DATA_FILE = 'data/events.yaml';

async function parseEvents() {
	const eventDataFileContent = await fsp.readFile(DATA_FILE, {
		encoding: 'utf8',
	});

	const events = dataSchema.cast(yamlParse(eventDataFileContent));

	return events;
}

async function main() {
	console.log(await parseEvents());
}

main();
