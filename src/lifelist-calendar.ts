// Lifelist Calendar View
// A simple calendar visualization of Lifelist items

import { ItemType, LifelistItem, LifelistStore } from './lifelist-core';

export enum CalendarViewType {
	DAY = 'day',
	WEEK = 'week',
	MONTH = 'month',
}

export class CalendarView {
	private store: LifelistStore;

	constructor(store: LifelistStore) {
		this.store = store;
	}

	// Generate a text-based calendar view
	public renderTextCalendar(viewType: CalendarViewType, date: Date = new Date()): string {
		switch (viewType) {
			case CalendarViewType.DAY:
				return this.renderDayView(date);
			case CalendarViewType.WEEK:
				return this.renderWeekView(date);
			case CalendarViewType.MONTH:
				return this.renderMonthView(date);
			default:
				return 'Unsupported view type';
		}
	}

	// Render a single day view
	private renderDayView(date: Date): string {
		const start = new Date(date);
		start.setHours(0, 0, 0, 0);

		const end = new Date(date);
		end.setHours(23, 59, 59, 999);

		const items = this.store.getItemsByDateRange(start, end);

		let output = `LIFELIST: ${date.toLocaleDateString()}\n`;
		output += '='.repeat(output.length - 1) + '\n\n';

		// Group items by hour
		const hourlyItems: Record<number, LifelistItem[]> = {};
		const allDayItems: LifelistItem[] = [];

		items.forEach(item => {
			if (item.type === ItemType.TODO || !item.startTime) {
				allDayItems.push(item);
			} else {
				const hour = item.startTime.getHours();
				if (!hourlyItems[hour]) {
					hourlyItems[hour] = [];
				}
				hourlyItems[hour].push(item);
			}
		});

		// Display all-day items
		if (allDayItems.length > 0) {
			output += 'ALL DAY\n-------\n';
			allDayItems.forEach(item => {
				output += this.formatCalendarItem(item) + '\n';
			});
			output += '\n';
		}

		// Display hourly items
		output += 'SCHEDULE\n--------\n';
		for (let hour = 0; hour < 24; hour++) {
			const hourLabel = `${hour.toString().padStart(2, '0')}:00`;

			if (hourlyItems[hour] && hourlyItems[hour].length > 0) {
				output += `${hourLabel} `;
				output += hourlyItems[hour].map(item => this.formatCalendarItem(item)).join(', ') + '\n';
			} else {
				// Only show empty hours during normal waking hours to save space
				if (hour >= 6 && hour <= 22) {
					output += `${hourLabel}\n`;
				}
			}
		}

		return output;
	}

	// Render a week view
	private renderWeekView(date: Date): string {
		const dayOfWeek = date.getDay();
		const startDate = new Date(date);
		startDate.setDate(date.getDate() - dayOfWeek);
		startDate.setHours(0, 0, 0, 0);

		let output = 'LIFELIST: WEEK VIEW\n';
		output += '===================\n\n';

		for (let day = 0; day < 7; day++) {
			const currentDate = new Date(startDate);
			currentDate.setDate(startDate.getDate() + day);

			const dayEnd = new Date(currentDate);
			dayEnd.setHours(23, 59, 59, 999);

			const items = this.store.getItemsByDateRange(currentDate, dayEnd);

			const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
			const dateStr = currentDate.toLocaleDateString();

			output += `${dayName} (${dateStr})\n`;
			output += '-'.repeat(dayName.length + dateStr.length + 3) + '\n';

			if (items.length === 0) {
				output += 'No items scheduled\n';
			} else {
				items.forEach(item => {
					const timePrefix = item.startTime ? item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' : '';
					output += `${timePrefix}${this.formatCalendarItem(item)}\n`;
				});
			}

			output += '\n';
		}

		return output;
	}

	// Render a month view (simplified)
	private renderMonthView(date: Date): string {
		const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
		const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

		const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
		let output = `LIFELIST: ${monthName}\n`;
		output += '='.repeat(output.length - 1) + '\n\n';

		// Header row with days of week
		output += 'SUN   MON   TUE   WED   THU   FRI   SAT\n';
		output += '---   ---   ---   ---   ---   ---   ---\n';

		// Calculate padding for first week
		let currentDay = 1;
		const daysInMonth = lastDay.getDate();
		let weekOutput = '';

		// Add padding for the first week
		for (let i = 0; i < firstDay.getDay(); i++) {
			weekOutput += '      ';
		}

		// Generate the calendar
		while (currentDay <= daysInMonth) {
			// Format the day number (padded for alignment)
			const dayLabel = currentDay.toString().padStart(2, ' ');

			// Check if there are items for this day
			const dayDate = new Date(date.getFullYear(), date.getMonth(), currentDay);
			const nextDay = new Date(date.getFullYear(), date.getMonth(), currentDay + 1);
			const items = this.store.getItemsByDateRange(dayDate, nextDay);

			// Add a marker if there are items (* for 1-2 items, ! for 3+ items)
			let marker = ' ';
			if (items.length > 0) {
				marker = items.length > 2 ? '!' : '*';
			}

			weekOutput += `${dayLabel}${marker}   `;

			// Start a new row for the next week
			if ((firstDay.getDay() + currentDay - 1) % 7 === 6) {
				output += weekOutput + '\n';
				weekOutput = '';
			}

			currentDay++;
		}

		// Add the last row if not complete
		if (weekOutput !== '') {
			output += weekOutput + '\n';
		}

		// Add a legend
		output += '\nLEGEND: * = 1-2 items, ! = 3+ items\n\n';

		// List items for selected date
		output += `ITEMS FOR ${date.toLocaleDateString()}\n`;
		output += '-'.repeat(output.length - 1) + '\n';

		const selectedDate = new Date(date);
		selectedDate.setHours(0, 0, 0, 0);

		const nextDate = new Date(date);
		nextDate.setDate(date.getDate() + 1);
		nextDate.setHours(0, 0, 0, 0);

		const selectedItems = this.store.getItemsByDateRange(selectedDate, nextDate);

		if (selectedItems.length === 0) {
			output += 'No items scheduled for this day\n';
		} else {
			selectedItems.forEach(item => {
				const timePrefix = item.startTime ? item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' : '';
				output += `${timePrefix}${this.formatCalendarItem(item)}\n`;
			});
		}

		return output;
	}

	// Helper to format a calendar item concisely
	private formatCalendarItem(item: LifelistItem): string {
		let prefix = '';

		switch (item.type) {
			case ItemType.TODO:
				prefix = '[ ] ';
				break;
			case ItemType.EVENT:
				prefix = '● ';
				break;
			case ItemType.REMINDER:
				prefix = '! ';
				break;
		}

		return `${prefix}${item.title}`;
	}
}
