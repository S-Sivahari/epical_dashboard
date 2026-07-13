/** Major world cities for the Ctrl+Left world-clock picker (alarm-clock style). */

export type WorldCity = {
  /** Unique key stored in preferredTimezones (IANA zone, or zone#city if shared). */
  id: string
  city: string
  country: string
  timeZone: string
  /** Extra search terms (country aliases, common spellings). */
  aliases?: string[]
}

/**
 * Curated major cities — one entry per familiar place people pick on a phone world clock.
 * `id` is what we persist; `timeZone` is used for clock formatting.
 */
export const MAJOR_WORLD_CITIES: WorldCity[] = [
  // Americas
  { id: 'America/New_York', city: 'New York', country: 'United States', timeZone: 'America/New_York', aliases: ['USA', 'NYC', 'US'] },
  { id: 'America/Chicago', city: 'Chicago', country: 'United States', timeZone: 'America/Chicago', aliases: ['USA', 'US'] },
  { id: 'America/Denver', city: 'Denver', country: 'United States', timeZone: 'America/Denver', aliases: ['USA', 'US'] },
  { id: 'America/Los_Angeles', city: 'Los Angeles', country: 'United States', timeZone: 'America/Los_Angeles', aliases: ['USA', 'LA', 'US', 'California'] },
  { id: 'America/Phoenix', city: 'Phoenix', country: 'United States', timeZone: 'America/Phoenix', aliases: ['USA', 'US', 'Arizona'] },
  { id: 'America/Anchorage', city: 'Anchorage', country: 'United States', timeZone: 'America/Anchorage', aliases: ['USA', 'Alaska', 'US'] },
  { id: 'Pacific/Honolulu', city: 'Honolulu', country: 'United States', timeZone: 'Pacific/Honolulu', aliases: ['USA', 'Hawaii', 'US'] },
  { id: 'America/Toronto', city: 'Toronto', country: 'Canada', timeZone: 'America/Toronto', aliases: ['Canada'] },
  { id: 'America/Vancouver', city: 'Vancouver', country: 'Canada', timeZone: 'America/Vancouver', aliases: ['Canada'] },
  { id: 'America/Mexico_City', city: 'Mexico City', country: 'Mexico', timeZone: 'America/Mexico_City', aliases: ['Mexico'] },
  { id: 'America/Sao_Paulo', city: 'São Paulo', country: 'Brazil', timeZone: 'America/Sao_Paulo', aliases: ['Brazil', 'Sao Paulo'] },
  { id: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires', country: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires', aliases: ['Argentina'] },
  { id: 'America/Lima', city: 'Lima', country: 'Peru', timeZone: 'America/Lima', aliases: ['Peru'] },
  { id: 'America/Bogota', city: 'Bogotá', country: 'Colombia', timeZone: 'America/Bogota', aliases: ['Colombia', 'Bogota'] },
  { id: 'America/Santiago', city: 'Santiago', country: 'Chile', timeZone: 'America/Santiago', aliases: ['Chile'] },

  // Europe
  { id: 'Europe/London', city: 'London', country: 'United Kingdom', timeZone: 'Europe/London', aliases: ['UK', 'England', 'Britain'] },
  { id: 'Europe/Dublin', city: 'Dublin', country: 'Ireland', timeZone: 'Europe/Dublin', aliases: ['Ireland'] },
  { id: 'Europe/Paris', city: 'Paris', country: 'France', timeZone: 'Europe/Paris', aliases: ['France'] },
  { id: 'Europe/Berlin', city: 'Berlin', country: 'Germany', timeZone: 'Europe/Berlin', aliases: ['Germany', 'Deutschland'] },
  { id: 'Europe/Berlin::Munich', city: 'Munich', country: 'Germany', timeZone: 'Europe/Berlin', aliases: ['Germany', 'München', 'Munchen', 'Deutschland'] },
  { id: 'Europe/Berlin::Frankfurt', city: 'Frankfurt', country: 'Germany', timeZone: 'Europe/Berlin', aliases: ['Germany', 'Deutschland'] },
  { id: 'Europe/Amsterdam', city: 'Amsterdam', country: 'Netherlands', timeZone: 'Europe/Amsterdam', aliases: ['Netherlands', 'Holland'] },
  { id: 'Europe/Brussels', city: 'Brussels', country: 'Belgium', timeZone: 'Europe/Brussels', aliases: ['Belgium'] },
  { id: 'Europe/Zurich', city: 'Zurich', country: 'Switzerland', timeZone: 'Europe/Zurich', aliases: ['Switzerland', 'Zürich'] },
  { id: 'Europe/Vienna', city: 'Vienna', country: 'Austria', timeZone: 'Europe/Vienna', aliases: ['Austria', 'Wien'] },
  { id: 'Europe/Rome', city: 'Rome', country: 'Italy', timeZone: 'Europe/Rome', aliases: ['Italy', 'Roma'] },
  { id: 'Europe/Madrid', city: 'Madrid', country: 'Spain', timeZone: 'Europe/Madrid', aliases: ['Spain'] },
  { id: 'Europe/Lisbon', city: 'Lisbon', country: 'Portugal', timeZone: 'Europe/Lisbon', aliases: ['Portugal'] },
  { id: 'Europe/Stockholm', city: 'Stockholm', country: 'Sweden', timeZone: 'Europe/Stockholm', aliases: ['Sweden'] },
  { id: 'Europe/Oslo', city: 'Oslo', country: 'Norway', timeZone: 'Europe/Oslo', aliases: ['Norway'] },
  { id: 'Europe/Copenhagen', city: 'Copenhagen', country: 'Denmark', timeZone: 'Europe/Copenhagen', aliases: ['Denmark'] },
  { id: 'Europe/Helsinki', city: 'Helsinki', country: 'Finland', timeZone: 'Europe/Helsinki', aliases: ['Finland'] },
  { id: 'Europe/Warsaw', city: 'Warsaw', country: 'Poland', timeZone: 'Europe/Warsaw', aliases: ['Poland'] },
  { id: 'Europe/Prague', city: 'Prague', country: 'Czechia', timeZone: 'Europe/Prague', aliases: ['Czech Republic', 'Czechia'] },
  { id: 'Europe/Athens', city: 'Athens', country: 'Greece', timeZone: 'Europe/Athens', aliases: ['Greece'] },
  { id: 'Europe/Istanbul', city: 'Istanbul', country: 'Turkey', timeZone: 'Europe/Istanbul', aliases: ['Turkey', 'Türkiye'] },
  { id: 'Europe/Moscow', city: 'Moscow', country: 'Russia', timeZone: 'Europe/Moscow', aliases: ['Russia'] },
  { id: 'Europe/Kyiv', city: 'Kyiv', country: 'Ukraine', timeZone: 'Europe/Kyiv', aliases: ['Ukraine', 'Kiev'] },

  // Middle East & Africa
  { id: 'Asia/Dubai', city: 'Dubai', country: 'United Arab Emirates', timeZone: 'Asia/Dubai', aliases: ['UAE', 'Emirates'] },
  { id: 'Asia/Riyadh', city: 'Riyadh', country: 'Saudi Arabia', timeZone: 'Asia/Riyadh', aliases: ['Saudi', 'KSA'] },
  { id: 'Asia/Jerusalem', city: 'Jerusalem', country: 'Israel', timeZone: 'Asia/Jerusalem', aliases: ['Israel'] },
  { id: 'Asia/Tehran', city: 'Tehran', country: 'Iran', timeZone: 'Asia/Tehran', aliases: ['Iran'] },
  { id: 'Africa/Cairo', city: 'Cairo', country: 'Egypt', timeZone: 'Africa/Cairo', aliases: ['Egypt'] },
  { id: 'Africa/Johannesburg', city: 'Johannesburg', country: 'South Africa', timeZone: 'Africa/Johannesburg', aliases: ['South Africa', 'SA'] },
  { id: 'Africa/Nairobi', city: 'Nairobi', country: 'Kenya', timeZone: 'Africa/Nairobi', aliases: ['Kenya'] },
  { id: 'Africa/Lagos', city: 'Lagos', country: 'Nigeria', timeZone: 'Africa/Lagos', aliases: ['Nigeria'] },
  { id: 'Africa/Casablanca', city: 'Casablanca', country: 'Morocco', timeZone: 'Africa/Casablanca', aliases: ['Morocco'] },

  // Asia
  { id: 'Asia/Kolkata', city: 'Kolkata', country: 'India', timeZone: 'Asia/Kolkata', aliases: ['India', 'Calcutta'] },
  { id: 'Asia/Kolkata::Mumbai', city: 'Mumbai', country: 'India', timeZone: 'Asia/Kolkata', aliases: ['India', 'Bombay'] },
  { id: 'Asia/Kolkata::Delhi', city: 'New Delhi', country: 'India', timeZone: 'Asia/Kolkata', aliases: ['India', 'Delhi'] },
  { id: 'Asia/Kolkata::Bengaluru', city: 'Bengaluru', country: 'India', timeZone: 'Asia/Kolkata', aliases: ['India', 'Bangalore'] },
  { id: 'Asia/Kolkata::Hyderabad', city: 'Hyderabad', country: 'India', timeZone: 'Asia/Kolkata', aliases: ['India'] },
  { id: 'Asia/Kolkata::Chennai', city: 'Chennai', country: 'India', timeZone: 'Asia/Kolkata', aliases: ['India', 'Madras'] },
  { id: 'Asia/Karachi', city: 'Karachi', country: 'Pakistan', timeZone: 'Asia/Karachi', aliases: ['Pakistan'] },
  { id: 'Asia/Dhaka', city: 'Dhaka', country: 'Bangladesh', timeZone: 'Asia/Dhaka', aliases: ['Bangladesh'] },
  { id: 'Asia/Colombo', city: 'Colombo', country: 'Sri Lanka', timeZone: 'Asia/Colombo', aliases: ['Sri Lanka'] },
  { id: 'Asia/Kathmandu', city: 'Kathmandu', country: 'Nepal', timeZone: 'Asia/Kathmandu', aliases: ['Nepal'] },
  { id: 'Asia/Bangkok', city: 'Bangkok', country: 'Thailand', timeZone: 'Asia/Bangkok', aliases: ['Thailand'] },
  { id: 'Asia/Jakarta', city: 'Jakarta', country: 'Indonesia', timeZone: 'Asia/Jakarta', aliases: ['Indonesia'] },
  { id: 'Asia/Singapore', city: 'Singapore', country: 'Singapore', timeZone: 'Asia/Singapore', aliases: ['SG'] },
  { id: 'Asia/Kuala_Lumpur', city: 'Kuala Lumpur', country: 'Malaysia', timeZone: 'Asia/Kuala_Lumpur', aliases: ['Malaysia', 'KL'] },
  { id: 'Asia/Manila', city: 'Manila', country: 'Philippines', timeZone: 'Asia/Manila', aliases: ['Philippines'] },
  { id: 'Asia/Hong_Kong', city: 'Hong Kong', country: 'China', timeZone: 'Asia/Hong_Kong', aliases: ['HK', 'China'] },
  { id: 'Asia/Shanghai', city: 'Shanghai', country: 'China', timeZone: 'Asia/Shanghai', aliases: ['China'] },
  { id: 'Asia/Shanghai::Beijing', city: 'Beijing', country: 'China', timeZone: 'Asia/Shanghai', aliases: ['China', 'Peking'] },
  { id: 'Asia/Taipei', city: 'Taipei', country: 'Taiwan', timeZone: 'Asia/Taipei', aliases: ['Taiwan'] },
  { id: 'Asia/Seoul', city: 'Seoul', country: 'South Korea', timeZone: 'Asia/Seoul', aliases: ['Korea', 'South Korea'] },
  { id: 'Asia/Tokyo', city: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo', aliases: ['Japan'] },
  { id: 'Asia/Ho_Chi_Minh', city: 'Ho Chi Minh City', country: 'Vietnam', timeZone: 'Asia/Ho_Chi_Minh', aliases: ['Vietnam', 'Saigon'] },

  // Oceania
  { id: 'Australia/Sydney', city: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney', aliases: ['Australia'] },
  { id: 'Australia/Melbourne', city: 'Melbourne', country: 'Australia', timeZone: 'Australia/Melbourne', aliases: ['Australia'] },
  { id: 'Australia/Brisbane', city: 'Brisbane', country: 'Australia', timeZone: 'Australia/Brisbane', aliases: ['Australia'] },
  { id: 'Australia/Perth', city: 'Perth', country: 'Australia', timeZone: 'Australia/Perth', aliases: ['Australia'] },
  { id: 'Pacific/Auckland', city: 'Auckland', country: 'New Zealand', timeZone: 'Pacific/Auckland', aliases: ['New Zealand', 'NZ'] },
  { id: 'Pacific/Fiji', city: 'Suva', country: 'Fiji', timeZone: 'Pacific/Fiji', aliases: ['Fiji'] },

  // UTC
  { id: 'UTC', city: 'UTC', country: 'Coordinated Universal Time', timeZone: 'UTC', aliases: ['GMT', 'Universal'] },
]

const CITY_BY_ID = new Map(MAJOR_WORLD_CITIES.map((c) => [c.id, c]))
const CITY_BY_ZONE = new Map<string, WorldCity>()
for (const city of MAJOR_WORLD_CITIES) {
  if (!CITY_BY_ZONE.has(city.timeZone)) CITY_BY_ZONE.set(city.timeZone, city)
}

export function formatCityLabel(city: WorldCity): string {
  if (city.id === 'UTC') return 'UTC'
  return `${city.city}, ${city.country}`
}

/** IANA zone used for Intl formatting from a stored preference id. */
export function timeZoneFromStoredId(storedId: string): string {
  if (storedId.includes('::')) return storedId.split('::')[0]!.trim()
  const city = CITY_BY_ID.get(storedId)
  if (city) return city.timeZone
  return storedId
}

/** Resolve a stored preference id (city id or legacy IANA zone) to a display city. */
export function resolveWorldCity(storedId: string): WorldCity {
  const direct = CITY_BY_ID.get(storedId)
  if (direct) return direct

  const iana = timeZoneFromStoredId(storedId)
  const byZone = CITY_BY_ZONE.get(iana)
  if (byZone && !storedId.includes('::')) return byZone

  const cityPart = storedId.includes('::')
    ? storedId.split('::')[1]!.replace(/_/g, ' ')
    : storedId.includes('/')
      ? storedId.split('/').pop()!.replace(/_/g, ' ')
      : storedId.replace(/_/g, ' ')

  return {
    id: storedId,
    city: cityPart,
    country: '',
    timeZone: iana,
  }
}

export function cityMatches(city: WorldCity, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true
  const haystack = [
    city.city,
    city.country,
    city.timeZone,
    formatCityLabel(city),
    ...(city.aliases || []),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(trimmed)
}

export function filterMajorCities(query: string, excludeIds: string[] = []): WorldCity[] {
  const excluded = new Set(excludeIds)
  return MAJOR_WORLD_CITIES.filter(
    (city) => !excluded.has(city.id) && cityMatches(city, query),
  )
}
