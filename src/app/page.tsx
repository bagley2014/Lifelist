'use client';

import React, { useEffect, useState } from 'react';

import { EventSummary } from '@/lib/events';

const EventCalendar = () => {
	// Sample data based on the provided structure
	const [_isLoading, setLoading] = useState(true);
	const [eventData, setEventData] = useState<[string, EventSummary[]][]>([]);

	useEffect(() => {
		fetch('/api/events?count=100')
			.then(res => res.json())
			.then(data => {
				setEventData(data);
				setLoading(false);
			});
	}, []);

	// Get all dates in range, including ones with no events
	const getDatesInRange = () => {
		// Function to create date range with all dates (including ones with no events)
		// For the sample data, just show the actual dates
		return eventData;
	};

	// Calculate font size based on priority (0-10)
	const getFontSize = (priority: number, maxFontSize: number = 18) => {
		const baseFontSize = 8;
		const maxIncrease = maxFontSize - baseFontSize;
		return baseFontSize + (priority / 10) * maxIncrease;
	};

	// Format time function
	const formatTimeRange = (startTime: string | undefined, endTime: string | undefined) => {
		if (!startTime) return '';
		if (!endTime) return startTime;
		return `${startTime} - ${endTime}`;
	};

	return (
		<div className="max-w-4xl mx-auto py-2 px-4 bg-gray-50">
			<h1 className="text-2xl font-bold mb-6 text-center">Lifelist</h1>

			<div className="space-y-2">
				{getDatesInRange().map(([date, events]) => (
					<div key={date} className="bg-white rounded-lg shadow p-4">
						<h2 className="text-lg font-semibold border-b border-gray-200">{date}</h2>

						{events.length === 0 ? (
							<p className="text-gray-500 py-2 italic">No events</p>
						) : (
							<ul className="divide-y divide-gray-100">
								{events.map((event, index) => (
									<li key={index} className="py-0.5 flex flex-wrap items-center gap-2">
										<span style={{ fontSize: `${getFontSize(event.priority)}px` }} className="font-medium flex-grow">
											{event.name}
										</span>

										{(event.startTime || event.endTime) && (
											<span style={{ fontSize: `${getFontSize(event.priority, 14)}px` }} className="text-gray-600 bg-blue-50 px-2 py-1 rounded text-sm">
												{formatTimeRange(event.startTime, event.endTime)}
											</span>
										)}

										{event.location && (
											<span style={{ fontSize: `${getFontSize(event.priority, 14)}px` }} className="text-gray-600 bg-gray-100 px-2 py-1 rounded text-sm">
												{event.location}
											</span>
										)}

										<div className="flex flex-wrap gap-1">
											{event.tags.map((tag, tagIndex) => (
												<span
													key={tagIndex}
													style={{ fontSize: `${getFontSize(event.priority, 12)}px` }}
													className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs"
												>
													{tag}
												</span>
											))}
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				))}
			</div>
		</div>
	);
};

export default EventCalendar;
