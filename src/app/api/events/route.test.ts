import { describe, expect, test, vi } from 'vitest';

import { DateTime } from 'luxon';
import { GET } from './route';
import { NextRequest } from 'next/server';

describe('events route', () => {
	// Test order matters for this test; it must be first. TODO: Change how the EventsManager is cached to fix this.
	test('returns 500 on missing data file', async () => {
		vi.stubEnv('DATA_FILE', 'missing/data.yaml');
		const request: NextRequest = new NextRequest('https://example.com/api/events?count=1&timezone=America/Los_Angeles', {
			method: 'GET',
		});

		const response = await GET(request);
		expect(response.status).toBe(500);

		const data = await response.text();
		expect(data).toBe('Unknown error');

		vi.unstubAllEnvs();
	});

	test('works with valid parameters', async () => {
		const request: NextRequest = new NextRequest('https://example.com/api/events?count=1&timezone=America/Los_Angeles&date=2023-01-01T00:00:00.000-08:00', {
			method: 'GET',
		});

		const response = await GET(request);
		expect(response.status).toBe(200);
		expect(response.body).toBeDefined();

		const data = await response.json();
		expect(data).toBeInstanceOf(Array);
		expect(data.length).toBe(1);
	});

	test('works with missing date', async () => {
		const request: NextRequest = new NextRequest('https://example.com/api/events?count=1&timezone=America/Los_Angeles', {
			method: 'GET',
		});

		const response = await GET(request);
		expect(response.status).toBe(200);
		expect(response.body).toBeDefined();

		const data = await response.json();
		expect(data).toBeInstanceOf(Array);
		expect(data.length).toBe(1);
	});

	test('returns 400 with invalid date', async () => {
		const request: NextRequest = new NextRequest('https://example.com/api/events?count=1&timezone=America/Los_Angeles&date=02-31-2025', {
			method: 'GET',
		});

		const response = await GET(request);
		expect(response.status).toBe(400);

		const data = await response.text();
		expect(data).toBe('this is not a valid date');
	});

	test('returns 400 when timezone is invalid', async () => {
		const request: NextRequest = new NextRequest('https://example.com/api/events?count=1&timezone=invalid&date=2023-01-01T00:00:00.000-08:00', {
			method: 'GET',
		});

		const response = await GET(request);
		expect(response.status).toBe(400);

		const data = await response.text();
		expect(data).toBe('`timezone` must be a valid IANA timezone');
	});

	test('returns 400 when timezone is missing', async () => {
		const request: NextRequest = new NextRequest('https://example.com/api/events?count=1&date=2023-01-01T00:00:00.000-08:00', {
			method: 'GET',
		});

		const response = await GET(request);
		expect(response.status).toBe(400);

		const data = await response.text();
		expect(data).toBe('`timezone` query parameter is required');
	});

	test('returns 400 when count is invalid', async () => {
		const request: NextRequest = new NextRequest('https://example.com/api/events?count=-1&timezone=America/Los_Angeles&date=2023-01-01T00:00:00.000-08:00', {
			method: 'GET',
		});

		const response = await GET(request);
		expect(response.status).toBe(400);

		const data = await response.text();
		expect(data).toBe('`count` must not be negative');
	});

	test('returns 400 when count is missing', async () => {
		const request: NextRequest = new NextRequest('https://example.com/api/events?timezone=America/Los_Angeles&date=2023-01-01T00:00:00.000-08:00', {
			method: 'GET',
		});

		const response = await GET(request);
		expect(response.status).toBe(400);

		const data = await response.text();
		expect(data).toBe('`count` query parameter is required');
	});

	test('returns 500 on unknown error', async () => {
		vi.spyOn(DateTime, 'now').mockImplementation(() => {
			throw new Error('Artificial error');
		});
		const request: NextRequest = new NextRequest('https://example.com/api/events?count=1&timezone=America/Los_Angeles', {
			method: 'GET',
		});

		const response = await GET(request);
		expect(response.status).toBe(500);

		const data = await response.text();
		expect(data).toBe('Unknown error');

		vi.resetAllMocks();
	});
});
