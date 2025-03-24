import React, { useState } from 'react';

interface NewButtonModalProps {
	classNames: string;
}

const NewButtonModal = ({ classNames }: NewButtonModalProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [content, setContent] = useState('');

	const handleSubmit = async () => {
		try {
			await fetch('/api/new', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ content }),
			});
			setContent('');
			setIsOpen(false);
		} catch (error) {
			console.error('Error submitting content:', error);
		}
	};

	return (
		<div className={classNames}>
			<button
				onClick={() => setIsOpen(true)}
				className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium py-2 px-4 rounded text-sm"
			>
				New
			</button>

			{isOpen && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-6 w-full max-w-md">
						<h3 className="text-lg font-medium mb-4">Create New</h3>

						<textarea
							value={content}
							onChange={e => setContent(e.target.value)}
							className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded p-2 min-h-32 mb-4"
							placeholder="Enter content here..."
						/>

						<div className="flex justify-end gap-2">
							<button
								onClick={() => setIsOpen(false)}
								className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
							>
								Cancel
							</button>
							<button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700">
								Submit
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default NewButtonModal;
