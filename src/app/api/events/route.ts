import { type NextRequest } from 'next/server';
import z, { ZodError } from 'zod';
import { EventsManager } from '@/lib/eventManager';
import { dateTimeSchema } from '@/lib/schemas';
import { DateTime } from 'luxon';

const countSchema = z.coerce.number().min(0, '`count` must not be negative');
const timezoneSchema = z.string().regex(/^[a-zA-Z0-9\/_+-]+\/[a-zA-Z0-9\/_+-]+$/, '`timezone` must be a valid IANA timezone');

let manager: EventsManager | undefined;

export async function GET(request: NextRequest) {
	let count;
	let timezone = '';
	let date;
	const searchParams = request.nextUrl.searchParams;
	try {
		manager = manager ?? (await EventsManager.create());
		count = countSchema.parse(searchParams.get('count') ?? -1);
		timezone = timezoneSchema.parse(searchParams.get('timezone'));
		date = dateTimeSchema
			.transform(value => {
				if (value) return value;
				return DateTime.now().setZone(timezone);
			})
			.parse(searchParams.get('date'));
	} catch (error) {
		if (error instanceof ZodError) return new Response(error.message, { status: 400 });
		else {
			console.error(error);
			return new Response('Unknown error', { status: 500 });
		}
	}

	// TODO: Add a timeout to keep the client from waiting forever
	return Response.json(await manager.getEvents(date, count));
}
