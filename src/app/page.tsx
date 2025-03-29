'use client';

import 'react-range-slider-input/dist/style.css';

import React, { useEffect, useMemo, useState } from 'react';

import DarkModeToggle from './darkModeToggle';
import { EventSummary } from '@/lib/eventManager';
import { IoLogoGithub } from 'react-icons/io';
import LoadingIndicator from './loadingIndicator';
import NewButtonModal from './newButtonModal';
import RangeSlider from 'react-range-slider-input';
import classNames from 'classnames';
import useLocalStorageState from 'use-local-storage-state';

type DateEntry = [string, EventSummary[]];

// Tag filter states
enum TagState {
	NEUTRAL,
	REQUIRED,
	PROHIBITED,
}

enum TagOperatorKind {
	AND,
	OR,
}

const EventCalendar = () => {
	const [fetchCount, setFetchCount] = useState(100);
	const [isLoading, setLoading] = useState(true);
	const [eventData, setEventData] = useState<DateEntry[]>([]);
	const [filteredData, setFilteredData] = useState<DateEntry[]>([]);
	const [showEmptyDates, setShowEmptyDates] = useLocalStorageState('showEmptyDates', { defaultValue: false });
	const [minPriority, setMinPriority] = useLocalStorageState('minPriority', { defaultValue: 4 });
	const [maxPriority, setMaxPriority] = useLocalStorageState('maxPriority', { defaultValue: 10 });
	const [availableTags, setAvailableTags] = useState<string[]>([]);
	const [tagStates, setTagStates] = useState<{ [tag: string]: TagState }>({});
	const [requiredTagOperator, setRequiredTagOperator] = useLocalStorageState('requiredTagOperator', { defaultValue: TagOperatorKind.AND });
	const [prohibitedTagOperator, setProhibitedTagOperator] = useLocalStorageState('prohibitedTagOperator', { defaultValue: TagOperatorKind.OR });

	const START_DATE = useMemo(() => new Date(), []);

	// Fetch event data from API
	useEffect(() => {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		fetch(`/api/events?count=${fetchCount}&date=${START_DATE.toDateString()}&timezone=${timezone}`)
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

				// Check if event has required tags (if any are specified)
				const hasRequiredTags =
					requiredTags.length === 0 || requiredTagOperator == TagOperatorKind.AND
						? requiredTags.every(tag => event.tags.includes(tag))
						: requiredTags.some(tag => event.tags.includes(tag));

				// Check if event has prohibited tags
				const hasProhibitedTags =
					prohibitedTags.length !== 0 && prohibitedTagOperator == TagOperatorKind.AND
						? prohibitedTags.every(tag => event.tags.includes(tag))
						: prohibitedTags.some(tag => event.tags.includes(tag));

				return isPriorityInRange && hasRequiredTags && !hasProhibitedTags;
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
	}, [START_DATE, eventData, minPriority, maxPriority, tagStates, showEmptyDates, requiredTagOperator, prohibitedTagOperator]);

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
				return 'bg-green-200 dark:bg-green-900 border-green-400 dark:border-green-700 border';
			case TagState.PROHIBITED:
				return 'bg-red-200 dark:bg-red-900 border-red-400 dark:border-red-700 border';
			default: // NEUTRAL
				return 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 border';
		}
	};

	// Calculate font size based on priority (0-10)
	const getFontSize = (priority: number, maxFontSize: number = 18) => {
		const baseFontSize = 8;
		const maxIncrease = maxFontSize - baseFontSize;
		return baseFontSize + (priority / 10) * maxIncrease;
	};

	const getStyle = (priority: number, maxFontSize: number = 18) => {
		const fontSize = getFontSize(priority, maxFontSize);
		const margin = (getFontSize(priority) - fontSize) * 1.5;
		return {
			fontSize: `${fontSize}px`,
			margin: `${margin / 2}px 0`,
		};
	};

	// Format time function
	const formatTimeRange = (startTime: string | undefined, endTime: string | undefined) => {
		if (!startTime) return '';
		if (!endTime) return startTime;
		return `${startTime} - ${endTime}`;
	};

	const whiteBg = 'bg-white dark:bg-gray-800';
	const tagButtonStyle = 'rounded-full text-sm dark:text-gray-300';

	return (
		<div className={classNames('max-w-4xl mx-auto bg-gray-200 dark:bg-gray-900 min-h-screen')}>
			{/* Sticky Header with Filters */}
			<div className={classNames(whiteBg, 'sticky top-0 shadow-md p-4 z-10 mb-1')}>
				<NewButtonModal classNames="absolute right-4" />
				<IoLogoGithub className={classNames('absolute left-4')} size={28} cursor={'pointer'} onClick={() => window.open('https://github.com/bagley2014/Lifelist')} />
				<DarkModeToggle className={classNames('absolute left-12 cursor-pointer')} />

				<h1 className={classNames('text-2xl font-bold mb-4 text-center dark:text-white')}>Lifelist</h1>

				<div className={classNames('flex w-full gap-2')}>
					{/* Priority Range Slider */}
					<div className={classNames('flex-grow mb-4')}>
						<label className={classNames('block text-sm font-medium mb-2 dark:text-gray-300')}>
							Priority Range: {minPriority} - {maxPriority}
						</label>
						<RangeSlider
							className={classNames('flex-shrink-0 items-center')}
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

					<label className={classNames('inline-flex items-center self-start')}>
						<input type="checkbox" checked={showEmptyDates} onChange={() => setShowEmptyDates(!showEmptyDates)} className={classNames('mr-1')} />
						<span className={classNames('text-sm py-1 dark:text-gray-300')}>Show Empty Days</span>
					</label>
				</div>

				{/* Tag Filters */}
				<div>
					<div className={classNames('flex items-center justify-items-start gap-2 mb-2')}>
						<label className={classNames('text-sm font-medium dark:text-gray-300')}>Filter by Tags:</label>
						<button
							onClick={() => setRequiredTagOperator(x => (x == TagOperatorKind.AND ? TagOperatorKind.OR : TagOperatorKind.AND))}
							className={classNames('px-1', tagButtonStyle, getTagStyle(TagState.REQUIRED))}
						>
							{requiredTagOperator == TagOperatorKind.AND ? 'EVERY' : 'ANY'}
						</button>
						<button
							onClick={() => setProhibitedTagOperator(x => (x == TagOperatorKind.AND ? TagOperatorKind.OR : TagOperatorKind.AND))}
							className={classNames('px-1', tagButtonStyle, getTagStyle(TagState.PROHIBITED))}
						>
							{prohibitedTagOperator == TagOperatorKind.AND ? 'EVERY' : 'ANY'}
						</button>
					</div>
					<div className={classNames('flex flex-wrap gap-2')}>
						{availableTags.map(tag => (
							<button key={tag} onClick={() => cycleTagState(tag)} className={classNames('px-3 py-1', tagButtonStyle, getTagStyle(tagStates[tag]))}>
								{tag}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Event List */}
			<div className={classNames('space-y-1')}>
				{filteredData.map(([date, events]) => (
					<div key={date} className={classNames(whiteBg, 'px-4 dark:text-gray-200 rounded')}>
						<h2 className={classNames('text-lg font-semibold border-b border-gray-300 dark:border-gray-700 dark:text-white')}>{date}</h2>

						{events.length === 0 ? (
							<p className={classNames('text-gray-500 dark:text-gray-400 italic text-xs')}>No events</p>
						) : (
							<ul className={classNames('divide-y divide-gray-300 dark:divide-gray-700')}>
								{events.map((event, index) => (
									<li key={index} className={classNames('flex flex-wrap items-center gap-x-2', { 'py-0.5': event.priority <= 5 })}>
										<span style={{ fontSize: `${getFontSize(event.priority)}px` }} className={classNames('font-medium flex-grow')}>
											{event.name}
										</span>

										{(event.startTime || event.endTime) && (
											<span
												style={{ fontSize: `${getFontSize(event.priority, 14)}px` }}
												className={classNames('text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/30 px-2 rounded')}
											>
												{formatTimeRange(event.startTime, event.endTime)}
											</span>
										)}

										{event.location && (
											<span style={getStyle(event.priority, 14)} className={classNames('text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 rounded')}>
												{event.location}
											</span>
										)}

										{event.tags.length > 0 && (
											<div className={classNames('flex flex-wrap gap-1')}>
												{event.tags.map((tag, tagIndex) => (
													<span
														key={tagIndex}
														style={getStyle(event.priority, 12)}
														className={classNames('bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 rounded-full')}
													>
														{tag}
													</span>
												))}
											</div>
										)}
									</li>
								))}
							</ul>
						)}
					</div>
				))}
			</div>

			{/* Load More Button */}
			<div className={classNames('flex justify-center w-full my-4')}>
				{!isLoading ? (
					<button
						onClick={() => {
							setLoading(true);
							setFetchCount(fetchCount + 100);
						}}
						className={classNames(
							'px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200',
						)}
						disabled={isLoading}
					>
						More
					</button>
				) : (
					<div className={classNames('px-6 py-2')}>
						<LoadingIndicator />
					</div>
				)}
			</div>
		</div>
	);
};

export default EventCalendar;
