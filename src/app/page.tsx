'use client';

import 'react-range-slider-input/dist/style.css';

import React, { useEffect, useMemo, useState } from 'react';

import { EventSummary } from '@/lib/events';
import LoadingIndicator from './loadingIndicator';
import RangeSlider from 'react-range-slider-input';

type DateEntry = [string, EventSummary[]];

// Tag filter states
enum TagState {
	NEUTRAL,
	REQUIRED,
	PROHIBITED,
}

const EventCalendar = () => {
	const [fetchCount, setFetchCount] = useState(100);
	const [isLoading, setLoading] = useState(true);
	const [eventData, setEventData] = useState<DateEntry[]>([]);
	const [filteredData, setFilteredData] = useState<DateEntry[]>([]);
	const [showEmptyDates, setShowEmptyDates] = useState(false);
	const [minPriority, setMinPriority] = useState(4);
	const [maxPriority, setMaxPriority] = useState(10);
	const [availableTags, setAvailableTags] = useState<string[]>([]);
	const [tagStates, setTagStates] = useState<{ [tag: string]: TagState }>({});

	const START_DATE = useMemo(() => new Date(), []);

	// Fetch event data from API
	useEffect(() => {
		fetch(`/api/events?count=${fetchCount}&date=${START_DATE.toDateString()}`)
			.then(res => res.json())
			.then(data => {
				setEventData(data);
				setLoading(false);
			});
	}, [START_DATE, fetchCount]);

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

		// Initialize tag states object
		setTagStates(prevTagStates => {
			const tagStates: { [tag: string]: TagState } = {};
			tagArray.forEach(tag => {
				tagStates[tag] = prevTagStates[tag] || TagState.NEUTRAL;
			});
			return tagStates;
		});
	}, [eventData]);

	// Get all dates in range, including ones with no events, and filter events to respect UI settings
	useEffect(() => {
		const requiredTags = Object.entries(tagStates)
			.filter(([_, state]) => state === TagState.REQUIRED)
			.map(([tag]) => tag);

		const prohibitedTags = Object.entries(tagStates)
			.filter(([_, state]) => state === TagState.PROHIBITED)
			.map(([tag]) => tag);

		const filterEventSummary = ([date, events]: DateEntry): DateEntry => {
			const filteredEvents = events.filter(event => {
				// Check if event priority is within range
				const isPriorityInRange = event.priority >= minPriority && event.priority <= maxPriority;

				// Check if event has all required tags (if any are specified)
				const hasAllRequiredTags = requiredTags.length === 0 || requiredTags.every(tag => event.tags.includes(tag));

				// Check if event has no prohibited tags
				const hasNoProhibitedTags = prohibitedTags.every(tag => !event.tags.includes(tag));

				return isPriorityInRange && hasAllRequiredTags && hasNoProhibitedTags;
			});

			return [date, filteredEvents];
		};

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

		setFilteredData(results.filter(x => showEmptyDates || x[1].length));
	}, [START_DATE, eventData, minPriority, maxPriority, tagStates, showEmptyDates]);

	// Toggle tag state
	const cycleTagState = (tag: string) => {
		setTagStates(prev => {
			const currentState = prev[tag];
			const nextState = (currentState + 1) % 3; // Cycle through 0, 1, 2
			return { ...prev, [tag]: nextState };
		});
	};

	// Get tag button style based on state
	const getTagStyle = (state: TagState) => {
		switch (state) {
			case TagState.REQUIRED:
				return 'bg-green-200 border-green-400 border';
			case TagState.PROHIBITED:
				return 'bg-red-200 border-red-400 border';
			default: // NEUTRAL
				return 'bg-gray-200 border-gray-300 border';
		}
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

				<div className="flex w-full gap-2">
					{/* Priority Range Slider */}
					<div className="flex-grow mb-4">
						<label className="block text-sm font-medium mb-2">
							Priority Range: {minPriority} - {maxPriority}
						</label>
						<RangeSlider
							className="flex-shrink-0 items-center"
							min={0}
							max={10}
							step={0.1}
							defaultValue={[4, 10]}
							value={[minPriority, maxPriority]}
							onInput={([minValue, maxValue]) => {
								setMinPriority(minValue);
								setMaxPriority(maxValue);
							}}
						/>
					</div>

					<label className="inline-flex items-center">
						<input type="checkbox" checked={showEmptyDates} onChange={() => setShowEmptyDates(!showEmptyDates)} className="mr-1" />
						<span className={`text-sm py-1`}>Show Empty Days</span>
					</label>
				</div>

				{/* Tag Filters */}
				<div>
					<label className="block text-sm font-medium mb-2">Filter by Tags:</label>
					<div className="flex flex-wrap gap-2">
						{availableTags.map(tag => (
							<button key={tag} onClick={() => cycleTagState(tag)} className={`px-3 py-1 rounded-full text-sm ${getTagStyle(tagStates[tag])}`}>
								{tag}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Event List */}
			<div className="space-y-2">
				{filteredData.map(([date, events]) => (
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

			{/* Load More Button */}
			<div className="flex justify-center w-full my-4">
				{!isLoading ? (
					<button
						onClick={() => {
							setLoading(true);
							setFetchCount(fetchCount + 100);
						}}
						className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200"
						disabled={isLoading}
					>
						More
					</button>
				) : (
					<LoadingIndicator />
				)}
			</div>
		</div>
	);
};

export default EventCalendar;
