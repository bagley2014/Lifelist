import { EventsManager } from '@/lib/eventManager';
import { englishToEvent } from '@/lib/englishToEvent';

let manager: EventsManager | null = null;

export async function POST(request: Request) {
	manager = manager ?? (await EventsManager.create());
	const userInput = await request.text();
	const event = await englishToEvent(userInput);
	if (event) {
		await manager.addEvent(event);
		return new Response('Event added', { status: 201 });
	} else {
		return new Response(null, { status: 204 });
	}
}
