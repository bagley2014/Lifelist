export function debounce(callback: () => void, delay: number) {
	let timer: NodeJS.Timeout;
	return function () {
		clearTimeout(timer);
		timer = setTimeout(() => {
			callback();
		}, delay);
	};
}
