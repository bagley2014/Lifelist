'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { EventSummary } from '@/lib/events';

type DateEntry = [string, EventSummary[]];

const EventCalendar = () => {
	// Sample data based on the provided structure
	const [_isLoading, setLoading] = useState(true);
	const [eventData, setEventData] = useState<DateEntry[]>([]);
	const [filteredData, setFilteredData] = useState<DateEntry[]>([]);
	const [showEmptyDates, setShowEmptyDates] = useState(true);
	const [minPriority, setMinPriority] = useState(0);
	const [maxPriority, setMaxPriority] = useState(10);
	const [availableTags, setAvailableTags] = useState<string[]>([]);
	const [selectedTags, setSelectedTags] = useState<{ [tag: string]: boolean }>({});

	const START_DATE = useMemo(() => new Date(), []);

	useEffect(() => {
		fetch(`/api/events?count=100&date=${START_DATE.toDateString()}`)
			.then(res => res.json())
			.then(data => {
				setEventData(data);
				setLoading(false);
			});
	}, [START_DATE]);

	// Extract all unique tags from the data
	useEffect(() => {
		const tags = new Set<string>();
		eventData.forEach(([_, events]) => {
			events.forEach(event => {
				event.tags.forEach(tag => tags.add(tag));
			});
		});

		const tagArray = Array.from(tags).sort();
		setAvailableTags(tagArray);

		// Initialize selected tags object
		const initialSelectedTags: { [tag: string]: boolean } = {};
		tagArray.forEach(tag => {
			initialSelectedTags[tag] = true; // All tags selected by default
		});
		setSelectedTags(initialSelectedTags);
	}, [eventData]);

	// Apply filters
	const filterEventSummary = useCallback(
		([date, events]: DateEntry): DateEntry => {
			const filteredEvents = events.filter(event => {
				// Check if event priority is within range
				const isPriorityInRange = event.priority >= minPriority && event.priority <= maxPriority;

				// Check if event has at least one selected tag
				const hasSelectedTag = event.tags.some(tag => selectedTags[tag]);

				return isPriorityInRange && hasSelectedTag;
			});

			return [date, filteredEvents];
		},
		[minPriority, maxPriority, selectedTags],
	);

	// Get all dates in range, including ones with no events
	useEffect(() => {
		// Get a list of the relevant date objects for the strings in the data
		const dates: Date[] = eventData.map(([dateStr, _]) => new Date(dateStr)).filter(date => !isNaN(date.getTime()));

		// If there aren't enough valid dates that one could be missing, return the data as is
		if (!dates || dates.length <= 1) {
			setFilteredData(eventData.map(filterEventSummary));
			return;
		}

		const results: DateEntry[] = [];

		// Add invalid dates to the results
		const invalidDateCount = eventData.length - dates.length;
		for (let i = 0; i < invalidDateCount; i++) {
			results.push(filterEventSummary(eventData[i]));
		}

		// Loop through all dates in range
		let currentIndex = invalidDateCount;
		const currentDate = new Date(START_DATE);
		while (currentDate <= dates[dates.length - 1]) {
			// Add the current date to the results, either with an empty array (thus not bumping the index yet) or with the relevant events
			if (currentDate.toDateString() === eventData[currentIndex][0]) {
				results.push(filterEventSummary(eventData[currentIndex]));
				currentIndex++;
			} else {
				results.push([currentDate.toDateString(), []]);
			}

			// Increment the date
			currentDate.setDate(currentDate.getDate() + 1);
		}

		setFilteredData(results);
	}, [START_DATE, eventData, filterEventSummary]);

	// Toggle tag selection
	const toggleTag = (tag: string) => {
		setSelectedTags(prev => ({
			...prev,
			[tag]: !prev[tag],
		}));
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
		<div className="max-w-4xl mx-auto bg-gray-50 min-h-screen">
			{/* Sticky Header with Filters */}
			<div className="sticky top-0 bg-white shadow-md p-4 z-10">
				<h1 className="text-2xl font-bold mb-4 text-center">Event Calendar</h1>

				<div className="flex flex-wrap gap-2">
					{/* Priority Range Slider */}
					<div className="mb-4">
						<label className="block text-sm font-medium mb-2">
							Priority Range: {minPriority} - {maxPriority}
						</label>
						<div className="flex items-center gap-2">
							<input
								type="range"
								min="0"
								max="10"
								step="1"
								value={minPriority}
								onChange={e => setMinPriority(Math.min(parseInt(e.target.value), maxPriority))}
								className="w-full"
							/>
							<input
								type="range"
								min="0"
								max="10"
								step="1"
								value={maxPriority}
								onChange={e => setMaxPriority(Math.max(parseInt(e.target.value), minPriority))}
								className="w-full"
							/>
						</div>
					</div>

					<label className="inline-flex items-center">
						<input type="checkbox" checked={showEmptyDates} onChange={() => setShowEmptyDates(!showEmptyDates)} className="mr-1" />
						<span className={`text-sm py-1`}>Include empty days</span>
					</label>
				</div>

				{/* Tag Filters */}
				<div>
					<label className="block text-sm font-medium mb-2">Filter by Tags:</label>
					<div className="flex flex-wrap gap-2">
						{availableTags.map(tag => (
							<label key={tag} className="inline-flex items-center">
								<input type="checkbox" checked={selectedTags[tag] || false} onChange={() => toggleTag(tag)} className="mr-1" />
								<span className={`text-sm px-2 py-1 rounded-full ${selectedTags[tag] ? 'bg-blue-200' : 'bg-gray-200'}`}>{tag}</span>
							</label>
						))}
					</div>
				</div>
			</div>

			{/* Event List */}
			<div className="space-y-2">
				{filteredData
					.filter(x => showEmptyDates || x[1].length)
					.map(([date, events]) => (
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
