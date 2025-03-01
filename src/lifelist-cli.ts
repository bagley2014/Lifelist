// Lifelist CLI Interface
// A simple command-line interface for interacting with Lifelist

import * as readline from 'readline';

import { CalendarView, CalendarViewType } from './lifelist-calendar';
import { ItemStatus, ItemType, LifelistStore, Priority } from './lifelist-core';

export class LifelistCLI {
	private store: LifelistStore;
	private calendarView: CalendarView;
	private rl: readline.Interface;

	constructor() {
		this.store = new LifelistStore();
		this.calendarView = new CalendarView(this.store);

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
	}

	public start(): void {
		console.log('Welcome to Lifelist - Your combined todo list and calendar');
		console.log('==========================================================');
		console.log('');

		this.showMainMenu();
	}

	private showMainMenu(): void {
		console.log('MAIN MENU');
		console.log('1. Add new item');
		console.log('2. View list');
		console.log('3. View calendar');
		console.log('4. Export to plain text');
		console.log('5. Exit');
		console.log('');

		this.rl.question('Enter your choice: ', choice => {
			console.log('');

			switch (choice) {
				case '1':
					this.addItemFlow();
					break;
				case '2':
					this.viewList();
					break;
				case '3':
					this.showCalendarMenu();
					break;
				case '4':
					this.exportToText();
					break;
				case '5':
					this.exit();
					break;
				default:
					console.log('Invalid choice, please try again.');
					this.showMainMenu();
					break;
			}
		});
	}

	private addItemFlow(): void {
		console.log('ADD NEW ITEM');
		console.log('1. Todo');
		console.log('2. Event');
		console.log('3. Reminder');
		console.log('4. Back to main menu');
		console.log('');

		this.rl.question('Enter item type: ', typeChoice => {
			console.log('');

			if (typeChoice === '4') {
				this.showMainMenu();
				return;
			}

			let itemType: ItemType;
			switch (typeChoice) {
				case '1':
					itemType = ItemType.TODO;
					break;
				case '2':
					itemType = ItemType.EVENT;
					break;
				case '3':
					itemType = ItemType.REMINDER;
					break;
				default:
					console.log('Invalid choice, please try again.');
					this.addItemFlow();
					return;
			}

			this.rl.question('Title: ', title => {
				this.rl.question('Description (optional): ', description => {
					let datePrompt = 'Due date (YYYY-MM-DD): ';
					if (itemType === ItemType.EVENT) {
						datePrompt = 'Start date and time (YYYY-MM-DD HH:MM): ';
					}

					this.rl.question(datePrompt, dateStr => {
						let dueDate: Date | undefined;
						let startTime: Date | undefined;
						let endTime: Date | undefined;

						if (dateStr.trim()) {
							if (itemType === ItemType.EVENT) {
								startTime = new Date(dateStr);

								this.rl.question('End date and time (YYYY-MM-DD HH:MM): ', endDateStr => {
									if (endDateStr.trim()) {
										endTime = new Date(endDateStr);
									}

									this.completeItemCreation(itemType, title, description, undefined, startTime, endTime);
								});
							} else {
								dueDate = new Date(dateStr);
								this.completeItemCreation(itemType, title, description, dueDate);
							}
						} else {
							this.completeItemCreation(itemType, title, description);
						}
					});
				});
			});
		});
	}

	private completeItemCreation(type: ItemType, title: string, description: string, dueDate?: Date, startTime?: Date, endTime?: Date): void {
		this.rl.question('Tags (comma separated): ', tagsStr => {
			const tags = tagsStr
				.split(',')
				.map(tag => tag.trim())
				.filter(tag => tag);

			this.rl.question('Priority (1=Low, 2=Medium, 3=High, 4=Urgent): ', priorityStr => {
				let priority: Priority;
				switch (priorityStr) {
					case '1':
						priority = Priority.LOW;
						break;
					case '2':
						priority = Priority.MEDIUM;
						break;
					case '3':
						priority = Priority.HIGH;
						break;
					case '4':
						priority = Priority.URGENT;
						break;
					default:
						priority = Priority.MEDIUM;
				}

				this.store.addItem({
					title,
					description: description || undefined,
					type,
					status: ItemStatus.PENDING,
					priority,
					dueDate,
					startTime,
					endTime,
					tags,
				});

				console.log('\nItem added successfully!\n');
				this.showMainMenu();
			});
		});
	}

	private viewList(): void {
		const plainText = this.store.exportAsPlainText();
		console.log(plainText);

		this.rl.question('\nPress Enter to return to the main menu...', () => {
			console.log('');
			this.showMainMenu();
		});
	}

	private showCalendarMenu(): void {
		console.log('CALENDAR VIEW');
		console.log('1. Day view');
		console.log('2. Week view');
		console.log('3. Month view');
		console.log('4. Back to main menu');
		console.log('');

		this.rl.question('Enter your choice: ', choice => {
			console.log('');

			let viewType: CalendarViewType;
			switch (choice) {
				case '1':
					viewType = CalendarViewType.DAY;
					break;
				case '2':
					viewType = CalendarViewType.WEEK;
					break;
				case '3':
					viewType = CalendarViewType.MONTH;
					break;
				case '4':
					this.showMainMenu();
					return;
				default:
					console.log('Invalid choice, please try again.');
					this.showCalendarMenu();
					return;
			}

			this.rl.question('Enter date (YYYY-MM-DD, or leave blank for today): ', dateStr => {
				console.log('');

				const date = dateStr.trim() ? new Date(dateStr) : new Date();
				const calendarText = this.calendarView.renderTextCalendar(viewType, date);
				console.log(calendarText);

				this.rl.question('\nPress Enter to return to the main menu...', () => {
					console.log('');
					this.showMainMenu();
				});
			});
		});
	}

	private exportToText(): void {
		const plainText = this.store.exportAsPlainText();
		console.log(plainText);

		this.rl.question('\nWould you like to save this to a file? (y/n): ', answer => {
			if (answer.toLowerCase() === 'y') {
				// In a real implementation, you would save to a file here
				console.log('Export to file functionality would go here');
			}

			console.log('');
			this.showMainMenu();
		});
	}

	private exit(): void {
		console.log('Thank you for using Lifelist!');
		this.rl.close();
		process.exit(0);
	}
}
