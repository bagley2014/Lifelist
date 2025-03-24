// Written in collaboration with Claude
declare module '@themaximalist/llm.js' {
	import { EventEmitter } from 'eventemitter3';

	import { EventEmitter } from 'eventemitter3';

	declare class LLM {
		/**
		 * Creates a new LLM instance
		 * @param input A string or array of message objects
		 * @param options Configuration options for the LLM
		 */
		constructor(input?: string | Array<Message>, options?: LLMOptions);

		/**
		 * Current conversation messages
		 */
		messages: Array<Message>;

		/**
		 * Configuration options
		 */
		options: LLMOptions;

		/**
		 * Event emitter for communication with services
		 */
		eventEmitter: EventEmitter;

		/**
		 * Send the current messages to the LLM service and get a response
		 * @param opts Additional options to override the defaults
		 */
		send(opts?: LLMOptions): Promise<string>;

		/**
		 * Process a streaming response with a handler function
		 * @param response The streaming response
		 * @param handler Function to process each chunk
		 */
		handleStream(response: AsyncIterable<string>, handler: (chunk: string) => void): Promise<string>;

		/**
		 * Convert a streaming response to an async generator
		 * @param response The streaming response
		 */
		streamResponse(response: AsyncIterable<string>): AsyncGenerator<string, void, unknown>;

		/**
		 * Abort the current request
		 */
		abort(): void;

		/**
		 * Add a user message and get a response
		 * @param content The user message content
		 * @param options Additional options to override the defaults
		 */
		chat(content: string, options?: LLMOptions | null): Promise<string>;

		/**
		 * Add a user message to the conversation
		 * @param content The message content
		 */
		user(content: string): void;

		/**
		 * Add a system message to the conversation
		 * @param content The message content
		 */
		system(content: string): void;

		/**
		 * Add an assistant message to the conversation
		 * @param content The message content
		 */
		assistant(content: string): void;

		/**
		 * Add a message with the specified role to the conversation
		 * @param role The message role (user, system, or assistant)
		 * @param content The message content
		 */
		history(role: string, content: string): void;

		/**
		 * Get the appropriate service for a model
		 * @param model The model name
		 */
		static serviceForModel(model: string): string;

		/**
		 * Get the default model for a service
		 * @param service The service name
		 */
		static modelForService(service: string): string | null;

		/**
		 * LlamaFile service identifier
		 */
		static readonly LLAMAFILE: string;

		/**
		 * OpenAI service identifier
		 */
		static readonly OPENAI: string;

		/**
		 * Anthropic service identifier
		 */
		static readonly ANTHROPIC: string;

		/**
		 * Mistral service identifier
		 */
		static readonly MISTRAL: string;

		/**
		 * Google service identifier
		 */
		static readonly GOOGLE: string;

		/**
		 * Ollama service identifier
		 */
		static readonly OLLAMA: string;

		/**
		 * Groq service identifier
		 */
		static readonly GROQ: string;

		/**
		 * Together service identifier
		 */
		static readonly TOGETHER: string;

		/**
		 * Perplexity service identifier
		 */
		static readonly PERPLEXITY: string;

		/**
		 * DeepSeek service identifier
		 */
		static readonly DEEPSEEK: string;

		/**
		 * Parser utilities
		 */
		static readonly parsers: typeof import('./parsers');
	}

	/**
	 * Function overload for calling LLM without 'new'
	 */
	declare function LLM(input: string | Array<Message>, options?: LLMOptions): Promise<string>;

	interface Message {
		role: 'user' | 'assistant' | 'system';
		content: string;
	}

	interface LLMOptions {
		model?: string;
		service?: string;
		max_tokens?: number | string;
		temperature?: number | string;
		seed?: number | string;
		stream?: boolean | string;
		stream_handler?: (chunk: string) => void;
		tools?: Array<Tool>;
		parser?: (content: string) => string | object | Promise<string | object>;
		eventEmitter?: EventEmitter;
	}

	export declare class Tool {
		/**
		 * Returns the class name in lowercase
		 */
		static get name(): string;

		/**
		 * Returns the JSON Schema for the tool
		 */
		static get schema(): {
			type: 'function';
			function: {
				name: string;
				description: string;
				parameters: {
					type: 'object';
					properties: Record<string, unknown>;
					required: string[];
				};
			};
		};

		/**
		 * Base parameters definition to be overridden by subclasses
		 */
		static parameters: Record<string, unknown>;

		/**
		 * Base description to be overridden by subclasses
		 */
		static description: string;
	}

	export declare class Calculator extends Tool {
		/**
		 * Description for the Calculator tool
		 */
		static description: string;

		/**
		 * Parameter definitions for the Calculator tool
		 */
		static parameters: {
			expression: { type: string };
		};

		/**
		 * Evaluates a mathematical expression
		 * @param options - Object containing the expression to evaluate
		 * @param options.expression - The expression to evaluate
		 * @returns The result of evaluating the expression
		 */
		static run({ expression }: { expression: string }): number;
	}

	export = LLM;
}
