import { type NextRequest } from 'next/server';
import { number, date, ValidationError } from 'yup';
import { events } from '@/lib/events';

const countSchema = number().required('`count` query parameter is required').min(0, '`count` must not be negative');
const dateSchema = date()
	.default(new Date())
	.transform((_, x: string): Date => {
		const date = new Date(x);
		return !x || isNaN(date.getTime()) ? new Date() : date;
	});

export async function GET(request: NextRequest) {
	let date,
		count = 0;
	const searchParams = request.nextUrl.searchParams;
	try {
		count = countSchema.cast(searchParams.get('count'));
		countSchema.validateSync(count);
		date = dateSchema.cast(searchParams.get('date'));
		dateSchema.validateSync(date);
	} catch (error) {
		if (error instanceof ValidationError || error instanceof TypeError) return new Response(error.message, { status: 400 });
		else {
			console.error(error);
			return new Response('Unknown error', { status: 500 });
		}
	}
	return Response.json(await events(date, count));
}
