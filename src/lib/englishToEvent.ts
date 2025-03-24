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
- start: a string that is a valid date (time optional) that won't be included on TODO items
- end: a string that is a valid date (time optional) that won't be included on events without a start date
- frequency: one of the following strings: "once", "daily", "weekly", "biweekly", "monthly", "yearly"
`);
	return llm;
}

export async function englishToEvent(englishInput: string): Promise<Event | null> {
	const llm = getLLM();
	const json = await llm.chat(englishInput, {
		service: 'google',
		parser: LLM.parsers.json,
	});

	return eventSchema.validate(json).catch(() => null);
}
