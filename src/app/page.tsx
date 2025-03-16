'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { EventSummary } from '@/lib/events';

const EventCalendar = () => {
	// Sample data based on the provided structure
	const [_isLoading, setLoading] = useState(true);
	const [eventData, setEventData] = useState<[string, EventSummary[]][]>([]);

	const START_DATE = useMemo(() => new Date(), []);

	useEffect(() => {
		fetch(`/api/events?count=100&date=${START_DATE.toDateString()}`)
			.then(res => res.json())
			.then(data => {
				setEventData(data);
				setLoading(false);
			});
	}, [START_DATE]);

	// Get all dates in range, including ones with no events
	const getDatesInRange = () => {
		// Get a list of the relevant date objects for the strings in the data
		const dates: Date[] = eventData.map(([dateStr, _]) => new Date(dateStr)).filter(date => !isNaN(date.getTime()));

		// If there aren't enough valid dates that one could be missing, return the data as is
		if (!dates || dates.length <= 1) {
			return eventData;
		}

		const results: [string, EventSummary[]][] = [];

		// Add invalid dates to the results
		const invalidDateCount = eventData.length - dates.length;
		for (let i = 0; i < invalidDateCount; i++) {
			results.push(eventData[i]);
		}

		// Loop through all dates in range
		let currentIndex = invalidDateCount;
		const currentDate = new Date(START_DATE);
		while (currentDate <= dates[dates.length - 1]) {
			// Add the current date to the results, either with an empty array (thus not bumping the index yet) or with the relevant events
			if (currentDate.toDateString() === eventData[currentIndex][0]) {
				results.push(eventData[currentIndex]);
				currentIndex++;
			} else {
				results.push([currentDate.toDateString(), []]);
			}

			// Increment the date
			currentDate.setDate(currentDate.getDate() + 1);
		}

		console.log(results);
		return results;
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
