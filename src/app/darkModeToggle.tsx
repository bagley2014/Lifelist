import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DarkModeToggleProps {
	className: string;
}

const DarkModeToggle = ({ className }: DarkModeToggleProps) => {
	const [darkMode, setDarkMode] = useState(false);

	// Check if user had a preference set previously
	useEffect(() => {
		if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
			setDarkMode(true);
			document.documentElement.classList.add('dark');
		} else {
			setDarkMode(false);
			document.documentElement.classList.remove('dark');
		}
	}, []);

	const toggleDarkMode = () => {
		if (darkMode) {
			// Switch to light mode
			document.documentElement.classList.remove('dark');
			localStorage.theme = 'light';
			setDarkMode(false);
		} else {
			// Switch to dark mode
			document.documentElement.classList.add('dark');
			localStorage.theme = 'dark';
			setDarkMode(true);
		}
	};

	return (
		<button
			onClick={toggleDarkMode}
			className={className + ' p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}
			aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{darkMode ? <Sun size={20} /> : <Moon size={20} />}
		</button>
	);
};

export default DarkModeToggle;
