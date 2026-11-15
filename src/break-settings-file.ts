// Where `nish break` keeps its settings between runs, for the terminal's host
// (`break.ts`): a file of `formatBreakSettings` under the config directory.
// The settings themselves and their format are `break-menu.ts`'s, which is
// pure; this module is the one that touches the file.

import { CLI } from "./branding"
import { dirname } from "./paths"
import { BreakSettings, formatBreakSettings, parseBreakSettings } from "./break-menu"

/**
 * Where `nish break` keeps its settings: `${xdg}/nish/break` when `xdg` is
 * absolute, else `${home}/.config/nish/break` when `home` is, else "" for
 * nowhere — `runCacheRoot`'s rules, given the two variables' values.
 */
export const breakSettingsPath = (xdg: string, home: string): string => {
  if (xdg.startsWith("/")) {
    return `${xdg}/${CLI}/break`
  }
  return home.startsWith("/") ? `${home}/.config/${CLI}/break` : ""
}

/** The settings kept at `path`; the defaults when `path` is "" or cannot be read as a file. */
export const loadBreakSettings = (path: string): BreakSettings => {
  const text: string | null = path === "" ? null : readFileSyncOrNull(path)
  if (text === null) {
    return new BreakSettings()
  }
  return parseBreakSettings(text)
}

/**
 * Keep `s` at `path`, making its directory and that directory's parent when
 * they are missing. It is written beside `path` and renamed over it, so a
 * failed write leaves the old file. Answers whether it was kept; a failure
 * anywhere answers false and says nothing.
 */
export const saveBreakSettings = (path: string, s: BreakSettings): boolean => {
  if (path === "") {
    return false
  }
  const dir: string = dirname(path)
  if (!mkdirSync(dirname(dir)) || !mkdirSync(dir)) {
    return false
  }
  const temp: string = `${path}.tmp`
  if (writeFileSyncMode(temp, formatBreakSettings(s), 0o644) < 0 || renameSync(temp, path) < 0) {
    unlinkSync(temp)
    return false
  }
  return true
}
