---
name: Keep nish break's settings between runs
overview: The Settings screen of `nish break` forgets everything when the game quits. Save `BreakSettings` to `$XDG_CONFIG_HOME/nish/break` (or `$HOME/.config/nish/break`), one `name=value` per line, load it at startup, write it when Settings is left and when the game quits, keep `NISH_BREAK_SOUND=1` as an override, and fall back to the default of any field whose line is missing or bad without ever failing the game.
stages:
  - id: break-settings-file
    title: "feat(cli): keep nish break's settings between runs"
    goal: A player's Settings choices survive quitting `nish break`, and no content of the settings file, or its absence, can make the game fail
    verification: npm run check && npm run lint && node tests/run.js break && node tests/run.js wasi && node tests/run.js performance
    status: pending
    todos:
      - id: format-parse
        content: Add pure `formatBreakSettings(s)` and `parseBreakSettings(text)` beside `BreakSettings` in src/break-menu.ts. See The file format
        status: pending
      - id: path-load-save
        content: Add `breakSettingsPath(xdg, home)`, `loadBreakSettings(path)` and `saveBreakSettings(path, s)` to src/break.ts. See Where it lives and how it is written
        status: pending
      - id: wire-director
        content: Load at startup in `playBreak`, apply NISH_BREAK_SOUND=1 after the load, save on leaving Settings and once when `playBreak` ends. See The director
        status: pending
      - id: link-test
        content: Add tests/link/break_settings (main.ts, expected.code, expected.out) covering save, load, a corrupt file, an unknown key, and the path rules. See Tests
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff
        status: pending
---

# Keep nish break's settings between runs

## Context

`BreakSettings` (`src/break-menu.ts`) holds seven fields the Settings screen
and the F3–F9 hotkeys edit: `fps`, `resolution`, `graphics`, `effects`,
`smoothing`, `stats`, `sound`. `WallRun` in `src/break.ts` builds a fresh one
on every start, so each run begins at the defaults. `src/run-cache.ts`'s
`runCacheRoot` already resolves an XDG directory with the rules wanted here
(an absolute `$XDG_*_HOME`, else an absolute `$HOME`, else nothing).

`nish break` is undocumented on purpose (`.claude/orientation.md`): no
`docs/guide` page, no `llms.txt` or `docs/AI.md` entry. This change keeps it
that way; the header comment of `src/break.ts` is the only prose it updates.

## Keep nish break's settings between runs

**Owns:** `src/break-menu.ts`, `src/break.ts`, `tests/link/break_settings/**`,
`tests/self/goldens/checked/src/break-menu.ts.txt`,
`tests/self/goldens/checked/src/break.ts.txt` (generated)

### The file format

One `name=value` per line, in the field order of `BreakSettings`, with `\n`
line ends and a trailing newline:

```
fps=0
resolution=0
graphics=-1
effects=1
smoothing=true
stats=false
sound=false
```

- Integers are decimal (`graphics` may be `-1`); booleans are `true`/`false`.
- `parseBreakSettings(text)` starts from `new BreakSettings()` and applies each
  line it accepts. A line is accepted only when its name is one of the seven
  and its value is valid for that field: `fps` in `0..FPS_CHOICE_COUNT-1`,
  `resolution` in `0..RESOLUTION_CHOICE_COUNT-1`, `graphics` in `-1..3`,
  `effects` `0` or `1`, the booleans exactly `true` or `false`.
- Everything else is skipped, never an error: a blank line, a line with no
  `=`, an unknown name, an empty or out-of-range or non-numeric value, a
  trailing `\r`, bytes that are not text. A field whose line is missing or
  skipped keeps its default. When a name repeats, the last accepted line wins.
- No panic on any input: integer parsing is bounded (no overflow), and the
  parser never indexes past the text.

### Where it lives and how it is written

- `breakSettingsPath(xdg, home)`: `${xdg}/nish/break` when `xdg` starts with
  `/`, else `${home}/.config/nish/break` when `home` does, else `""` — the
  `runCacheRoot` rules, with `CLI` from `src/branding.ts` for the directory
  name. Taking the two values as arguments is what lets the link test pin the
  rules without an environment; `playBreak` passes `getenv` of each.
- `loadBreakSettings(path)`: `""` or an unreadable/missing file gives the
  defaults; otherwise `parseBreakSettings` of the text.
- `saveBreakSettings(path, s)`: answers whether it wrote. `""` writes nothing.
  It makes the directory (and its parent) when missing, then writes
  `formatBreakSettings(s)`. A failure anywhere answers false and changes
  nothing else: no message, no exit code, no panic.
- The I/O lives in `src/break.ts`, the director, because the scenes
  (`break-menu.ts` and the rest) are pure and never touch the system; the
  format and parse are pure and sit beside the struct they describe.

### The director

- `playBreak` resolves the path once, loads before the terminal is opened (so
  the saved frame rate is the one the terminal opens with), and copies the
  loaded values into `run.settings` in place — the menu holds the same
  object, so it must not be replaced.
- `NISH_BREAK_SOUND=1` is applied after the load, as today, and wins. It is an
  override, not a choice: what is saved for `sound` is the loaded value unless
  the player changed sound during the run (Settings or F9).
- Save when the menu leaves the Settings screen (the step on which
  `menu.screen` goes from `SCREEN_SETTINGS` to another screen), and once at the
  end of `playBreak`, which every quit reaches (menu Quit, `q`, Ctrl-C, the
  intro's quit, a terminal that could not be opened). The end-of-run save is
  what keeps a hotkey change made outside Settings.
- The header comment of `src/break.ts` says where the settings are kept.

### Tests

`tests/link/break_settings/main.ts`, a `Suite` like `break_menu`, with
`expected.code` `0` and `expected.out` its PASS lines. It works in a scratch
directory of its own under an absolute path and removes what it wrote.

- **Path rules**: absolute XDG; relative XDG falls back to HOME; empty XDG
  falls back to HOME; neither absolute gives `""`.
- **Save**: into a directory that does not exist yet creates it and writes
  exactly the seven lines; `""` writes nothing and answers false.
- **Load**: a round trip of settings with every field away from its default
  gives them back; a missing file gives the defaults.
- **Corrupt file**: a file of mixed garbage (no `=`, out-of-range `fps=99`,
  `sound=maybe`, `graphics=`, a huge number, `\r\n` ends, non-text bytes) gives
  the default for each bad line and still applies the good ones, and does not
  panic.
- **Unknown key**: `colour=red` among valid lines is ignored and the valid
  lines are applied.

Per CLAUDE.md, the PR shows the LLVM IR for the TypeScript the test adds.

## Out of scope

Applying the graphics setting (`wallGraphicsToast` says it is not handed to
the terminal yet), any guide or CLI documentation for `nish break`, and
migrating the file format: there is one version.
