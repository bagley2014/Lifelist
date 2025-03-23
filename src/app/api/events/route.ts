import { type NextRequest } from 'next/server';
import { number, ValidationError, string } from 'yup';
import { EventsManager } from '@/lib/events';
import { dateTimeSchema } from '@/lib/schemas';
import { DateTime } from 'luxon';

const countSchema = number().required('`count` query parameter is required').min(0, '`count` must not be negative');
const timezoneSchema = string()
	.required('`timezone` query parameter is required')
	.matches(/^[a-zA-Z0-9\/_+-]+\/[a-zA-Z0-9\/_+-]+$/, '`timezone` must be a valid IANA timezone');
const manager = new EventsManager();

export async function GET(request: NextRequest) {
	let count;
	let timezone = '';
	let date;
	const searchParams = request.nextUrl.searchParams;
	try {
		count = countSchema.validateSync(searchParams.get('count'));
		timezone = timezoneSchema.validateSync(searchParams.get('timezone'));
		date = dateTimeSchema
			.transform((value, _originalValue, context) => {
				if (value && context.isType(value)) return value;
				return DateTime.now().setZone(timezone);
			})
			.defined()
			.validateSync(searchParams.get('date'));
	} catch (error) {
		if (error instanceof ValidationError || error instanceof TypeError) return new Response(error.message, { status: 400 });
		else {
			console.error(error);
			return new Response('Unknown error', { status: 500 });
		}
	}

	// TODO: Add a timeout to keep the client from waiting forever
	return Response.json(await manager.events(date, count));
}
