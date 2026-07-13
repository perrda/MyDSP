/** Day/night theme from the device local clock (no geolocation). */

export type Theme = 'light' | 'dark'
export type ThemePreference = 'auto' | 'light' | 'dark'

/**
 * Approximate local sunrise/sunset in minutes since midnight.
 * Uses a simple seasonal sinusoid (works well for mid-latitudes and tropics
 * such as Bangkok) — no network or location permission required.
 */
export function approximateSunriseSunsetMinutes(date: Date = new Date()): {
  sunrise: number
  sunset: number
} {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  // Phase so ~day 81 (21 Mar) is equinox-ish
  const rad = ((dayOfYear - 81) / 365) * 2 * Math.PI
  // Mean ~06:30 / 18:30 with ±~45 minutes seasonal swing
  const sunriseH = 6.5 - 0.75 * Math.sin(rad)
  const sunsetH = 18.5 + 0.75 * Math.sin(rad)
  return {
    sunrise: Math.round(sunriseH * 60),
    sunset: Math.round(sunsetH * 60),
  }
}

/** Light during daytime (sunrise…sunset), dark at night — local computer clock. */
export function themeFromLocalClock(now: Date = new Date()): Theme {
  const minutes = now.getHours() * 60 + now.getMinutes()
  const { sunrise, sunset } = approximateSunriseSunsetMinutes(now)
  return minutes >= sunrise && minutes < sunset ? 'light' : 'dark'
}

/** Resolve stored preference to an applied theme. */
export function resolveTheme(preference: ThemePreference, now: Date = new Date()): Theme {
  if (preference === 'light' || preference === 'dark') return preference
  return themeFromLocalClock(now)
}

/** Milliseconds until the next sunrise or sunset boundary (local clock). */
export function msUntilNextDayNightSwitch(now: Date = new Date()): number {
  const { sunrise, sunset } = approximateSunriseSunsetMinutes(now)
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const seconds = now.getSeconds()
  const ms = now.getMilliseconds()

  let targetMinutes: number
  if (minutesNow < sunrise) {
    targetMinutes = sunrise
  } else if (minutesNow < sunset) {
    targetMinutes = sunset
  } else {
    // Next sunrise tomorrow
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const { sunrise: nextSunrise } = approximateSunriseSunsetMinutes(tomorrow)
    const msToMidnight = tomorrow.getTime() - now.getTime()
    return msToMidnight + nextSunrise * 60_000
  }

  const msIntoDay = minutesNow * 60_000 + seconds * 1000 + ms
  const targetMs = targetMinutes * 60_000
  return Math.max(1_000, targetMs - msIntoDay)
}

export function parseThemePreference(raw: string | null): ThemePreference | null {
  if (raw === 'auto' || raw === 'light' || raw === 'dark') return raw
  return null
}
