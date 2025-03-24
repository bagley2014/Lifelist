import { Event, Frequency } from '@/lib/schemas';

import { DateTime } from 'luxon';
import { EventsManager } from '@/lib/eventManager';

function fakeLLM(_input: string): Event {
	return {
		name: 'Fake Event',
		priority: 5,
		start: DateTime.now(),
		end: DateTime.now().plus({ hours: 2 }),
		location: 'Fake Location',
		tags: ['Fake Tag'],
		frequency: Frequency.Once,
	};
}

let manager: EventsManager | null = null;

export async function POST(request: Request) {
	manager = manager ?? (await EventsManager.create());
	const userInput = await request.text();
	await manager.addEvent(fakeLLM(userInput));
	return new Response('Event added', { status: 200 });
}
