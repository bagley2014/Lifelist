// Authored mostly by Claude
/**
 * Extracts a timezone abbreviation from a string and converts it to IANA format
 * @param input - String that may contain a timezone abbreviation
 * @returns IANA timezone string or null if no recognized timezone found
 */
export function extractAndConvertTimezone(input: string): string | null {
	// Map of common US timezone abbreviations to IANA timezones
	const timezoneMap: Record<string, string> = {
		// Standard time
		ET: 'America/New_York',
		EST: 'America/New_York',
		CT: 'America/Chicago',
		CST: 'America/Chicago',
		MT: 'America/Denver',
		MST: 'America/Denver',
		PT: 'America/Los_Angeles',
		PST: 'America/Los_Angeles',
		// Daylight saving time
		EDT: 'America/New_York',
		CDT: 'America/Chicago',
		MDT: 'America/Denver',
		PDT: 'America/Los_Angeles',
		// Other common US timezones
		AKST: 'America/Anchorage',
		AKDT: 'America/Anchorage',
		HST: 'Pacific/Honolulu',
		HAST: 'Pacific/Honolulu',
		HADT: 'Pacific/Honolulu',
		CHST: 'Pacific/Guam',
	};

	// Regular expression to find timezone abbreviations
	// Looks for standalone abbreviations surrounded by word boundaries
	const timezoneRegex = /\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT|ET|CT|MT|PT|AKST|AKDT|HST|HAST|HADT|CHST)\b/i;

	const match = input.match(timezoneRegex);

	if (match && match[1]) {
		const foundTimezone = match[1].toUpperCase();
		return timezoneMap[foundTimezone];
	}

	return null;
}
