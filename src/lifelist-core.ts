// Lifelist: A combination todo list and calendar app
// Core data models and utilities

// Define the types of items that can appear in the Lifelist
export enum ItemType {
	TODO = 'todo', // Something that needs to be done
	EVENT = 'event', // Something scheduled to happen
	REMINDER = 'reminder', // A notification or reminder
}

// Status of an item
export enum ItemStatus {
	PENDING = 'pending', // Not yet started or happened
	IN_PROGRESS = 'in_progress', // Currently happening or being worked on
	COMPLETED = 'completed', // Finished
	CANCELLED = 'cancelled', // Will not happen
}

// Priority levels for items
export enum Priority {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	URGENT = 'urgent',
}

// The core data structure for all Lifelist items
export interface LifelistItem {
	id: string; // Unique identifier
	title: string; // Short description
	description?: string; // Optional longer description
	type: ItemType; // Todo, event, or reminder
	status: ItemStatus; // Current status
	priority: Priority; // How important is this item
	created: Date; // When the item was created
	modified: Date; // When the item was last modified

	// Time-related fields
	dueDate?: Date; // When a todo is due
	startTime?: Date; // When an event starts
	endTime?: Date; // When an event ends

	// Repeating items
	recurrence?: RecurrencePattern;

	// Tags for organization
	tags: string[];
}

// Pattern for recurring items
export interface RecurrencePattern {
	frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
	interval: number; // Repeat every X days/weeks/months/years
	endDate?: Date; // When to stop repeating (optional)
	maxOccurrences?: number; // Maximum number of occurrences (optional)
}

// Main data store for Lifelist
export class LifelistStore {
	private items: Map<string, LifelistItem> = new Map();

	// Generate a unique ID
	private generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	}

	// Add a new item to the list
	public addItem(itemData: Omit<LifelistItem, 'id' | 'created' | 'modified'>): LifelistItem {
		const now = new Date();
		const newItem: LifelistItem = {
			...itemData,
			id: this.generateId(),
			created: now,
			modified: now,
			tags: itemData.tags || [],
		};

		this.items.set(newItem.id, newItem);
		return newItem;
	}

	// Update an existing item
	public updateItem(id: string, updates: Partial<LifelistItem>): LifelistItem | null {
		const item = this.items.get(id);
		if (!item) return null;

		const updatedItem: LifelistItem = {
			...item,
			...updates,
			modified: new Date(),
		};

		this.items.set(id, updatedItem);
		return updatedItem;
	}

	// Delete an item
	public deleteItem(id: string): boolean {
		return this.items.delete(id);
	}

	// Get a specific item
	public getItem(id: string): LifelistItem | undefined {
		return this.items.get(id);
	}

	// Get all items
	public getAllItems(): LifelistItem[] {
		return Array.from(this.items.values());
	}

	// Get items by date range (for calendar view)
	public getItemsByDateRange(start: Date, end: Date): LifelistItem[] {
		return this.getAllItems().filter(item => {
			// Include todos with due dates in the range
			if (item.dueDate && item.dueDate >= start && item.dueDate <= end) {
				return true;
			}

			// Include events that overlap with the range
			if (item.startTime && item.endTime) {
				// Event starts during the range
				if (item.startTime >= start && item.startTime <= end) {
					return true;
				}
				// Event ends during the range
				if (item.endTime >= start && item.endTime <= end) {
					return true;
				}
				// Event spans the entire range
				if (item.startTime <= start && item.endTime >= end) {
					return true;
				}
			}

			return false;
		});
	}

	// Export data as plain text
	public exportAsPlainText(): string {
		let output = 'LIFELIST\n========\n\n';

		// Group items by type
		const todos = this.getAllItems().filter(item => item.type === ItemType.TODO);
		const events = this.getAllItems().filter(item => item.type === ItemType.EVENT);
		const reminders = this.getAllItems().filter(item => item.type === ItemType.REMINDER);

		// Format todos
		if (todos.length > 0) {
			output += 'TODO ITEMS\n----------\n';
			todos.forEach(todo => {
				output += `[${todo.status === ItemStatus.COMPLETED ? 'X' : ' '}] ${todo.title}`;
				output += todo.dueDate ? ` (Due: ${todo.dueDate.toLocaleDateString()})` : '';
				output += ` [${todo.priority}]`;
				output += '\n';

				if (todo.description) {
					output += `   ${todo.description}\n`;
				}

				if (todo.tags.length > 0) {
					output += `   Tags: ${todo.tags.join(', ')}\n`;
				}

				output += '\n';
			});
		}

		// Format events
		if (events.length > 0) {
			output += 'EVENTS\n------\n';
			events.forEach(event => {
				output += `* ${event.title}`;

				if (event.startTime) {
					output += ` (${event.startTime.toLocaleDateString()} ${event.startTime.toLocaleTimeString()}`;
					if (event.endTime) {
						output += ` - ${event.endTime.toLocaleTimeString()}`;
					}
					output += ')';
				}

				output += '\n';

				if (event.description) {
					output += `   ${event.description}\n`;
				}

				if (event.tags.length > 0) {
					output += `   Tags: ${event.tags.join(', ')}\n`;
				}

				output += '\n';
			});
		}

		// Format reminders
		if (reminders.length > 0) {
			output += 'REMINDERS\n---------\n';
			reminders.forEach(reminder => {
				output += `! ${reminder.title}`;
				output += reminder.dueDate ? ` (${reminder.dueDate.toLocaleDateString()})` : '';
				output += '\n';

				if (reminder.description) {
					output += `   ${reminder.description}\n`;
				}

				if (reminder.tags.length > 0) {
					output += `   Tags: ${reminder.tags.join(', ')}\n`;
				}

				output += '\n';
			});
		}

		return output;
	}
}

// Example usage
const lifelist = new LifelistStore();

// Add a todo item
lifelist.addItem({
	title: 'Complete Lifelist prototype',
	description: 'Finish the initial version with basic functionality',
	type: ItemType.TODO,
	status: ItemStatus.IN_PROGRESS,
	priority: Priority.HIGH,
	dueDate: new Date('2025-03-05'),
	tags: ['development', 'personal'],
});

// Add an event
lifelist.addItem({
	title: 'Weekly planning session',
	type: ItemType.EVENT,
	status: ItemStatus.PENDING,
	priority: Priority.MEDIUM,
	startTime: new Date('2025-03-03T09:00:00'),
	endTime: new Date('2025-03-03T10:00:00'),
	recurrence: {
		frequency: 'weekly',
		interval: 1,
	},
	tags: ['planning', 'recurring'],
});

// Example output to plain text
console.log(lifelist.exportAsPlainText());
