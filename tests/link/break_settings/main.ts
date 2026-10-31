// Where `nish break` keeps its settings between runs (`src/break.ts`) and the
// file it keeps them in (`src/break-menu.ts`): the path's rules, a save into
// a directory not there yet, a round trip of every field, and the negatives —
// a missing file, a file of garbage, an unknown name and nowhere to save,
// each of which gives the defaults for what it cannot say and never panics.
// It works in a scratch directory beside its own binary and removes it.
import { Suite } from "../../../std/testing"
import { BreakSettings, formatBreakSettings, parseBreakSettings } from "../../../src/break-menu"
import { breakSettingsPath, loadBreakSettings, saveBreakSettings } from "../../../src/break"
import { dirname } from "../../../src/paths"

/** The seven lines the defaults are kept as. */
const DEFAULTS: string = "fps=0\nresolution=0\ngraphics=-1\neffects=1\nsmoothing=true\nstats=false\nsound=false\n"

/** A scratch directory under an absolute path no other program names: beside this one's binary. */
const scratchDir = (): string => {
  const exe: string | null = realpathSync("/proc/self/exe")
  const self: string | null = exe !== null ? exe : realpathSync(process.argv[0])
  const path: string = self !== null ? self : process.argv[0]
  return `${dirname(path)}/break-settings-scratch`
}

/** Remove `dir` and everything in it. */
const remove = (dir: string): void => {
  spawnSync(["rm", "-rf", dir])
}

const testPath = (t: Suite): void => {
  t.eqStr("an absolute XDG_CONFIG_HOME holds it", breakSettingsPath("/x/conf", "/home/p"), "/x/conf/nish/break")
  t.eqStr("a relative XDG_CONFIG_HOME falls back to HOME", breakSettingsPath("conf", "/home/p"), "/home/p/.config/nish/break")
  t.eqStr("an empty XDG_CONFIG_HOME falls back to HOME", breakSettingsPath("", "/home/p"), "/home/p/.config/nish/break")
  t.eqStr("neither absolute is nowhere", breakSettingsPath("conf", "home/p"), "")
  t.eqStr("neither set is nowhere", breakSettingsPath("", ""), "")
}

const testSave = (t: Suite, scratch: string): void => {
  const path: string = breakSettingsPath(`${scratch}/xdg`, "")
  t.ok("no directory before the first save", !isDirectorySync(`${scratch}/xdg`))
  t.ok("a save into a directory not there yet answers true", saveBreakSettings(path, new BreakSettings()))
  t.ok("and makes it", isDirectorySync(`${scratch}/xdg/nish`))
  const text: string | null = readFileSyncOrNull(path)
  t.eqStr("and writes exactly the seven lines", text !== null ? text : "(no file)", DEFAULTS)
  t.ok("leaving no temporary beside it", readFileSyncOrNull(`${path}.tmp`) === null)
  t.ok("nowhere to save answers false", !saveBreakSettings("", new BreakSettings()))
  t.ok("a directory where the file goes answers false", !saveBreakSettings(`${scratch}/xdg/nish`, new BreakSettings()))
}

/** Settings with every field away from its default. */
const changed = (): BreakSettings => {
  const s: BreakSettings = new BreakSettings()
  s.fps = 4
  s.resolution = 5
  s.graphics = 0
  s.effects = 0
  s.smoothing = false
  s.stats = true
  s.sound = true
  return s
}

const sameAs = (t: Suite, what: string, got: BreakSettings, want: BreakSettings): void => {
  t.eqStr(what, formatBreakSettings(got), formatBreakSettings(want))
}

const testLoad = (t: Suite, scratch: string): void => {
  // A HOME is there already; only .config and .config/nish are made.
  mkdirSync(`${scratch}/home`)
  const path: string = breakSettingsPath("", `${scratch}/home`)
  t.ok("a save under HOME answers true", saveBreakSettings(path, changed()))
  sameAs(t, "a load gives back every field saved", loadBreakSettings(path), changed())
  t.ok("a second save over it answers true", saveBreakSettings(path, new BreakSettings()))
  sameAs(t, "and the load after it gives the second", loadBreakSettings(path), new BreakSettings())
  sameAs(t, "a missing file gives the defaults", loadBreakSettings(`${scratch}/none/break`), new BreakSettings())
  sameAs(t, "nowhere gives the defaults", loadBreakSettings(""), new BreakSettings())
  sameAs(t, "a directory gives the defaults", loadBreakSettings(scratch), new BreakSettings())
  t.eqStr("the defaults format as the seven lines", formatBreakSettings(new BreakSettings()), DEFAULTS)
}

const testCorrupt = (t: Suite, scratch: string): void => {
  const garbage: string =
    "fps=99\nno equals sign\nresolution=2\r\ngraphics=\nsound=maybe\neffects=99999999999999999999\n" +
    "stats=true\n\u0000ÿ\u0001=þ\n=\nsmoothing=false\r\neffects=-0\nresolution=+3\ngraphics=4\n" +
    "fps=-1\nresolution=3\nfps=2"
  const path: string = `${scratch}/corrupt`
  writeFileSync(path, garbage)
  const s: BreakSettings = loadBreakSettings(path)
  t.eqI32("fps=99 is out of range, and the last good line, with no newline, wins", s.fps, 2)
  t.eqI32("resolution with \\r\\n is skipped, +3 too, and the plain 3 applies", s.resolution, 3)
  t.eqI32("an empty graphics, and one past ascii, give the default", s.graphics, -1)
  t.eqI32("a huge effects, and -0, give the default", s.effects, 1)
  t.eqBool("smoothing=false with \\r\\n gives the default", s.smoothing, true)
  t.eqBool("a good stats line among them applies", s.stats, true)
  t.eqBool("sound=maybe gives the default", s.sound, false)
  // Bytes that are not UTF-8 around a good line, as a file on disk holds them.
  const bytes: u8[] = []
  for (const b of [255, 254, 0, 61, 192, 10, 115, 116, 97, 116, 115, 61, 116, 114, 117, 101, 10, 128, 61, 10]) {
    bytes.push(toU8(b))
  }
  t.ok("a file of bytes that are not text is written", writeFileBytesSync(path, bytes) === bytes.length)
  const binary: BreakSettings = loadBreakSettings(path)
  t.eqBool("its one good line, stats=true, applies", binary.stats, true)
  t.eqI32("and the rest keep their defaults", binary.fps, 0)
  sameAs(t, "the empty file is the defaults", parseBreakSettings(""), new BreakSettings())
  sameAs(t, "a lone newline is the defaults", parseBreakSettings("\n"), new BreakSettings())
  sameAs(t, "a lone = is the defaults", parseBreakSettings("="), new BreakSettings())
  sameAs(t, "names are matched exactly", parseBreakSettings("FPS=1\n fps=1\nfps =1\nfps= 1\nstats=TRUE\n"), new BreakSettings())
}

const testUnknown = (t: Suite): void => {
  const s: BreakSettings = parseBreakSettings("fps=1\ncolour=red\nstats=true\n")
  t.eqI32("colour=red is ignored and fps=1 before it applies", s.fps, 1)
  t.eqBool("and stats=true after it", s.stats, true)
  t.eqI32("and the rest keep their defaults", s.graphics, -1)
}

export const main = (): number => {
  const t = new Suite("break-settings")
  const scratch: string = scratchDir()
  remove(scratch)
  t.ok("the scratch directory is made", mkdirSync(scratch))
  testPath(t)
  testSave(t, scratch)
  testLoad(t, scratch)
  testCorrupt(t, scratch)
  testUnknown(t)
  remove(scratch)
  t.ok("the scratch directory is removed", !isDirectorySync(scratch))
  return t.done()
}
