import { Event, eventSchema } from './schemas';

import LLM from '@themaximalist/llm.js';

function getLLM(): LLM {
	const llm: LLM = new LLM();
	llm.system(`
The user will give you information about an event, and you will respond with just a JSON object containing information about that event.
The event MUST have the following properties:
- name: a string that is not empty
- priority: a number between 0 and 10, inclusive
The event may optionally have the following properties:
- location: a string that is not empty
- start: a date that won't be included on TODO items
- end: a date that won't be included on events without a start date
- frequency: one of the following strings: "once", "daily", "weekly", "biweekly", "monthly", "annually"
- tags: an array of title-cased strings that describe the event
The dates should be formatted like \`April 3, 2025 at 1:30 PM CT\` if present; the time is optional, but the timezone is required if the time is present.
`);
	return llm;
}

export async function englishToEvent(englishInput: string): Promise<Event | null> {
	const llm = getLLM();
	const json = await llm.chat(englishInput, {
		service: 'google',
		parser: LLM.parsers.json,
	});

	return eventSchema.parseAsync(json).catch(() => null);
}
