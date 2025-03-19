import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTheme } from 'next-themes';

interface DarkModeToggleProps {
	className: string;
}

const DarkModeToggle = ({ className }: DarkModeToggleProps) => {
	const [mounted, setMounted] = useState(false);
	const { theme, setTheme } = useTheme();

	// This useEffect only runs on the client, preventing a potential hydration mismatch if the client theme and server theme don't match
	useEffect(() => {
		setMounted(true);
	}, []);

	const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

	return !mounted ? null : (
		<button
			onClick={toggleTheme}
			className={className + ' p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}
			aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
		</button>
	);
};

export default DarkModeToggle;
