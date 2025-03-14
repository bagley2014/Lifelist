import { Joi, Segments, celebrate, errors } from 'celebrate';
import express, { Request, Response } from 'express';

import { events } from './api';
import { promises as fsp } from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API route to fetch events
app.get(
	'/api/events',
	celebrate({
		[Segments.QUERY]: Joi.object({
			// An ISO date string that defaults to the current date if omitted
			date: Joi.date().iso().default(new Date().toISOString()).description('Earliest date for events'),
			// A required integer that limits the number of results returned
			count: Joi.number().integer().required().description('Result limit'),
		}),
	}),
	async (
		req: Request<
			unknown,
			unknown,
			unknown,
			{
				date: string;
				count: number;
			}
		>,
		res: Response,
	) => {
		// Get query parameters
		const { date, count } = req.query;

		// Use api to get the requested events
		const filteredEvents = await events(new Date(date), count);

		res.json(filteredEvents);
	},
);

// Route for the SPA
app.get('/', async (req, res) => {
	try {
		const htmlContent = await fsp.readFile(path.join(__dirname, '../public', 'index.html'), 'utf8');
		res.send(htmlContent);
	} catch (err) {
		console.log(err);
		res.status(500).send('Error loading the SPA');
	}
});

// Error handler for celebrate validation errors
app.use(errors());

// Start the server
app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
