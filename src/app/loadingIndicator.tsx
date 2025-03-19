import { useEffect } from 'react';

export default function LoadingIndicator() {
	useEffect(() => {
		async function getLoader() {
			const { dotPulse } = await import('ldrs');
			dotPulse.register();
		}
		getLoader();
	}, []);
	// @ts-expect-error - Custom element from ldrs library; couldn't figure out the fix
	return <l-dot-pulse size="50" speed="1.3" color="blue"></l-dot-pulse>;
}
