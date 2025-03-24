import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fs, vol } from 'memfs';

import { NextRequest } from 'next/server';
import { POST } from './route';

vi.mock('node:fs');
vi.mock('node:fs/promises');

const exampleEventYaml = `
  - name: "Test Event"
    priority: 5
    location: "Test Location"
    start: "2023-01-01"
    tags:
      - "Test Tag"
`;

describe('new event route', () => {
	beforeEach(() => {
		vi.stubEnv('DATA_FILE', 'data.yaml');
		vol.fromJSON({
			'./data.yaml': `upcoming:${exampleEventYaml}`,
		});
	});

	test('works with valid input', async () => {
		const request: NextRequest = new NextRequest('https://example.com/api/new', {
			method: 'POST',
			body: 'valid input',
		});

		const response = await POST(request);
		expect(response.status).toBe(200);
		expect(response.body).toBeDefined();

		const data = await response.text();
		expect(data).toBe('Event added');

		const dataFile = fs.readFileSync('./data.yaml', 'utf8');
		expect(dataFile).toContain('Fake Event');
	});
});
