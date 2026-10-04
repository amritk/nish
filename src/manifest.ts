// The one part of a `package.json` stage1 reads: which file a package offers an
// Nish consumer (WP21 S2, stage0's `src/manifest.ts` is the stage0 twin,
// `docs/wp21-packages.md` §2 and §6).
//
// A package says it is Nish by declaring the `nish` condition in its `exports`
// map, and its value is the **source** the consumer compiles:
//
//     { "exports": { ".": { "nish": "./src/index.ts", "import": "./dist/index.js" } } }
//
// Presence is the claim, which is what lets a bare import of an ordinary npm
// package fail saying the package has no Nish entry point rather than with a
// module-not-found that reads like the consumer's own mistake. Nothing else in
// the manifest is read: §6 talked the `--emit-manifest` sidecar out of
// existence on the rule that a fact the compiler can recompute is not metadata,
// and the mode is the one fact resolution has to know before the compiler can
// look, because it selects the file.
//
// **This is a reader, not a parser**, the same distinction `std/json` opens
// with, and the reason the stage0 twin is the same narrow scan rather than a
// `JSON.parse`: the two compilers have to select the same file for the same
// manifest, and a program that resolved under one and not the other would be a
// program that compiles with one compiler and not the other. What the narrowing
// costs is written down rather than left to be discovered:
//
//   - Only the `nish` conditions are honoured. `default`, `import`, `node` and
//     the rest are skipped, not matched — a package with `"default"` but no
//     `"nish"` has no Nish entry point, because a `default` target is
//     JavaScript and compiling it is not a thing this compiler can do.
//   - Subpath patterns (`"./*"`) are not matched; a subpath is an exact key.
//   - The mode-qualified condition wins over the plain one whatever order the
//     manifest declares them in, which is the one place this reader answers a
//     different file from the one Node's declaration-order matching would. The
//     reason is in `docs/wp21-packages.md` §6: `nish-f64` is not a rival of
//     `nish`, it is `nish` refined by the mode, and honouring the order would
//     mean that a package writing `nish` above `nish-f64` had mode-specific
//     source that is never compiled and no diagnostic saying so — the silent
//     ABI mismatch the condition exists to turn into a loud one.
//   - A target is a string beginning with `./`, with no `..` segment and no
//     backslash escape. Anything else — a nested condition object, an array of
//     targets, an escaped path — is treated as no target at all.
//   - The scan stops at the first thing it cannot read past — a missing comma,
//     a key that is not a string — and answers with what it found before it,
//     where Node refuses the whole manifest as malformed JSON. A mode-qualified
//     condition after such a break is therefore not seen, and the plain one
//     before it wins. Both compilers do the identical thing, which is what this
//     reader is for. When the scan finds nothing, `manifestMalformedAt` walks
//     the whole text and the failure names the break rather than the entry
//     point it hid (WP21 S3).
//
// `nishExportEntry` answers why a package has no file for a consumer as well as
// which file it has, so that each cause is its own diagnostic in `Compilation`
// (`docs/wp21-packages.md` §5c, §6): the package offers Nish only in the other
// number mode, it offers no Nish condition at all, or its manifest is not
// well-formed. What is left over — no `exports`, no such subpath, a shape this
// reader does not follow — is the one message S2 answered everything with. The
// `engines.nish` floor is read here too, and compared by `manifestEngineCheck`.
//
// Every helper below is `manifest`-prefixed, the way `std/json`'s are
// `json`-prefixed and for the same reason: a function name in `src/` shares one
// namespace with the rest of the compiler, so a helper called `stringValue` here
// is a name no other module can use — which the bootstrap found the moment this
// file arrived. The stage0 twin keeps the same names so the two stay diffable.

import { isDigit } from "./lexer"
import { splitByte, StringBuilder } from "./strings"

const TAB: i32 = 9
const NEWLINE: i32 = 10
const CARRIAGE_RETURN: i32 = 13
const SPACE: i32 = 32
const QUOTE: i32 = 34
const PLUS: i32 = 43
const COMMA: i32 = 44
const MINUS: i32 = 45
const DOT: i32 = 46
const SLASH: i32 = 47
const DIGIT_ZERO: i32 = 48
const COLON: i32 = 58
const UPPER_E: i32 = 69
const LOWER_A: i32 = 97
const LOWER_B: i32 = 98
const LOWER_F: i32 = 102
const LOWER_N: i32 = 110
const LOWER_R: i32 = 114
const LOWER_T: i32 = 116
const UPPER_A: i32 = 65
const UPPER_F: i32 = 70
const LOWER_U: i32 = 117
/** Above any position a manifest reaches, so a span end `+ 1` past one is provably in range. */
const MANIFEST_SPAN_LIMIT: i32 = 1073741824
const LOWER_Z: i32 = 122
const BACKSLASH: i32 = 92
const OPEN_BRACE: i32 = 123
const CLOSE_BRACE: i32 = 125
const OPEN_BRACKET: i32 = 91
const CLOSE_BRACKET: i32 = 93

/** The first index at or after `at` that is not JSON whitespace. */
const manifestSkipBlank = (text: string, at: i32): i32 => {
  let i = at
  while (i < text.length) {
    const code = text.charCodeAt(i)
    if (code !== SPACE && code !== TAB && code !== NEWLINE && code !== CARRIAGE_RETURN) {
      return i
    }
    i = i + 1
  }
  return i
}

/**
 * The index just past the string that starts at `at`, or -1 when it is not
 * closed. `\"` is stepped over so that a quote inside a string does not end it;
 * the escape is not decoded, which is why `manifestTarget` below refuses a target
 * that contains one.
 */
const manifestEndOfString = (text: string, at: i32): i32 => {
  let i = at + 1
  while (i < text.length) {
    const code = text.charCodeAt(i)
    if (code === BACKSLASH) {
      i = i + 2
    } else if (code === QUOTE) {
      return i + 1
    } else {
      i = i + 1
    }
  }
  return -1
}

/**
 * The index just past the value that starts at `at`, or -1 when the text runs
 * out first. A nested object or array is stepped over rather than searched, so
 * the fields after it stay reachable.
 */
const manifestEndOfValue = (text: string, at: i32): i32 => {
  if (at >= text.length) {
    return -1
  }
  const first = text.charCodeAt(at)
  if (first === QUOTE) {
    return manifestEndOfString(text, at)
  }
  if (first !== OPEN_BRACE && first !== OPEN_BRACKET) {
    let i = at
    while (i < text.length) {
      const code = text.charCodeAt(i)
      if (code === COMMA || code === CLOSE_BRACE || code === CLOSE_BRACKET) {
        return i
      }
      if (code === SPACE || code === TAB || code === NEWLINE || code === CARRIAGE_RETURN) {
        return i
      }
      i = i + 1
    }
    return i
  }
  let depth = 0
  let i = at
  while (i < text.length) {
    const code = text.charCodeAt(i)
    if (code === QUOTE) {
      const end = manifestEndOfString(text, i)
      if (end < 0) {
        return -1
      }
      i = end
    } else {
      if (code === OPEN_BRACE || code === OPEN_BRACKET) {
        depth = depth + 1
      } else if (code === CLOSE_BRACE || code === CLOSE_BRACKET) {
        depth = depth - 1
        if (depth === 0) {
          return i + 1
        }
      }
      i = i + 1
    }
  }
  return -1
}

/**
 * The raw text of `object`'s `name` field, or `""` when it has none.
 *
 * A key that carries a backslash escape is compared as written and so matches
 * nothing, which is the narrowing the module header states.
 */
const manifestField = (object: string, name: string): string => {
  const at = manifestFieldAt(object, name)
  return at < 0 ? "" : object.substring(at, manifestEndOfValue(object, at))
}

/** Where `object`'s `name` field's value starts, or -1 when it has none (`manifestField`). */
const manifestFieldAt = (object: string, name: string): i32 => {
  let i = manifestSkipBlank(object, 0)
  if (i >= object.length || object.charCodeAt(i) !== OPEN_BRACE) {
    return -1
  }
  i = manifestSkipBlank(object, i + 1)
  while (i < object.length && object.charCodeAt(i) === QUOTE) {
    const keyEnd = manifestEndOfString(object, i)
    if (keyEnd < 0) {
      return -1
    }
    const key = object.substring(i + 1, keyEnd - 1)
    i = manifestSkipBlank(object, keyEnd)
    if (i >= object.length || object.charCodeAt(i) !== COLON) {
      return -1
    }
    const valueAt = manifestSkipBlank(object, i + 1)
    const valueEnd = manifestEndOfValue(object, valueAt)
    if (valueEnd < 0) {
      return -1
    }
    if (key === name) {
      return valueAt
    }
    i = manifestSkipBlank(object, valueEnd)
    if (i >= object.length || object.charCodeAt(i) !== COMMA) {
      return -1
    }
    i = manifestSkipBlank(object, i + 1)
  }
  return -1
}

/**
 * The entries of a list in a root package's `"nish"` field -- `noPanic`, or a
 * capability policy's `allow` and `deny` -- each as written between its quotes
 * and beside the offset of its opening quote in the manifest, so that an entry
 * the compiler cannot honour is reported where it is written. An entry that
 * is not a string is kept as written, and so names nothing and is reported,
 * rather than dropped: a list the reader cannot follow must not quietly shrink
 * what it promises. Empty when there is no list.
 */
export class ManifestList {
  entries: string[]
  offsets: i32[]
  /** Just past each entry as written, its quotes included, so a report spans exactly what is there. */
  ends: i32[]

  constructor() {
    this.entries = []
    this.offsets = []
    this.ends = []
  }
}

/** Read the array that opens at `manifest[at]` into `out`, stopping at the first value it cannot step past. */
const manifestReadList = (manifest: string, at: i32, out: ManifestList): void => {
  let i = manifestSkipBlank(manifest, at + 1)
  while (i >= 0 && i < manifest.length && manifest.charCodeAt(i) !== CLOSE_BRACKET) {
    const end = manifestEndOfValue(manifest, i)
    if (end <= i) {
      return
    }
    // A string is decoded, escapes and all, as JSON.parse reads it; anything
    // else is kept as written, and so names nothing and is reported.
    const decoded: string | null = manifest.charCodeAt(i) === QUOTE ? manifestDecodeString(manifest, i) : null
    out.entries.push(decoded !== null ? decoded : manifest.substring(i, end))
    out.offsets.push(i)
    out.ends.push(end)
    i = manifestSkipBlank(manifest, end)
    if (i >= 0 && i < manifest.length && manifest.charCodeAt(i) === COMMA) {
      i = manifestSkipBlank(manifest, i + 1)
    }
  }
}

/**
 * A JSON string at `text[at]` (its opening quote) decoded as JSON.parse
 * decodes it, or null when it is not a well-formed string. An escape that
 * stands for a character outside ASCII becomes DEL (127), which no name this
 * reader compares against contains, so it can never match one by accident.
 * Every position is tested against the length before it is stepped past, and
 * the hex digits are combined by shifts, so nothing here carries an overflow
 * check.
 */
const manifestDecodeString = (text: string, at: i32): string | null => {
  if (at < 0 || at >= text.length || text.charCodeAt(at) !== QUOTE) {
    return null
  }
  const out = new StringBuilder()
  let i = at + 1
  while (i >= 0 && i < text.length) {
    const code = text.charCodeAt(i)
    if (code === QUOTE) {
      return out.toText()
    }
    if (code !== BACKSLASH) {
      out.addChar(code)
      i = i + 1
      continue
    }
    i = i + 1
    if (i >= text.length) {
      return null
    }
    const escaped = text.charCodeAt(i)
    if (escaped === QUOTE || escaped === BACKSLASH || escaped === SLASH) {
      out.addChar(escaped)
    } else if (escaped === LOWER_B) {
      out.addChar(8)
    } else if (escaped === LOWER_F) {
      out.addChar(12)
    } else if (escaped === LOWER_N) {
      out.addChar(NEWLINE)
    } else if (escaped === LOWER_R) {
      out.addChar(CARRIAGE_RETURN)
    } else if (escaped === LOWER_T) {
      out.addChar(TAB)
    } else if (escaped === LOWER_U) {
      let value = 0
      let digits = 0
      while (digits < 4) {
        if (i < 0 || i >= text.length) {
          return null
        }
        i = i + 1
        if (i >= text.length) {
          return null
        }
        const digit = manifestHexDigit(text.charCodeAt(i))
        if (digit < 0) {
          return null
        }
        value = (value << 4) | digit
        digits = digits + 1
      }
      out.addChar(value < 128 ? value : 127)
    } else {
      return null
    }
    if (i < 0 || i >= text.length) {
      return null
    }
    i = i + 1
  }
  return null
}

/**
 * The value of a hex digit, or -1 for any other byte. The low nibble of a
 * digit is its value and that of a letter is its value less nine, so it is
 * masked rather than subtracted, which keeps an overflow check out of it.
 */
const manifestHexDigit = (code: i32): i32 => {
  if (isDigit(code)) {
    return code & 15
  }
  if ((code >= LOWER_A && code <= LOWER_F) || (code >= UPPER_A && code <= UPPER_F)) {
    return (code & 7) + 9
  }
  return -1
}

/**
 * The members of the JSON object that opens at `text[at]`, in order: each
 * key decoded (`manifestDecodeString`) beside where it and its value start and
 * end. `broken` is where the walk could not read on, or -1 when it reached the
 * closing brace; the members before it are kept. Every position is tested
 * against the length before it is stepped past.
 */
class ManifestMembers {
  keys: string[]
  keyAt: i32[]
  keyEnd: i32[]
  valueAt: i32[]
  valueEnd: i32[]
  broken: i32

  constructor() {
    this.keys = []
    this.keyAt = []
    this.keyEnd = []
    this.valueAt = []
    this.valueEnd = []
    this.broken = -1
  }
}

const manifestMembers = (text: string, at: i32): ManifestMembers => {
  const out = new ManifestMembers()
  if (at < 0 || at >= text.length || text.charCodeAt(at) !== OPEN_BRACE) {
    out.broken = at
    return out
  }
  let i = manifestSkipBlank(text, at + 1)
  if (i >= 0 && i < text.length && text.charCodeAt(i) === CLOSE_BRACE) {
    return out
  }
  while (i >= 0 && i < text.length) {
    const key = manifestDecodeString(text, i)
    const keyEnd = manifestEndOfString(text, i)
    if (key === null || keyEnd <= i) {
      out.broken = i
      return out
    }
    const colon = manifestSkipBlank(text, keyEnd)
    if (colon < 0 || colon >= text.length || text.charCodeAt(colon) !== COLON) {
      out.broken = colon
      return out
    }
    const valueAt = manifestSkipBlank(text, colon + 1)
    const valueEnd = manifestEndOfValue(text, valueAt)
    if (valueEnd <= valueAt) {
      out.broken = valueAt
      return out
    }
    out.keys.push(key)
    out.keyAt.push(i)
    out.keyEnd.push(keyEnd)
    out.valueAt.push(valueAt)
    out.valueEnd.push(valueEnd)
    i = manifestSkipBlank(text, valueEnd)
    if (i >= 0 && i < text.length && text.charCodeAt(i) === CLOSE_BRACE) {
      return out
    }
    if (i < 0 || i >= text.length || text.charCodeAt(i) !== COMMA) {
      out.broken = i
      return out
    }
    i = manifestSkipBlank(text, i + 1)
  }
  out.broken = i
  return out
}

/** The index of the first member whose key an earlier member already has, or -1. */
const manifestRepeatedMember = (members: ManifestMembers): i32 => {
  let k = 1
  while (k < members.keys.length) {
    let j = 0
    while (j < k) {
      if (members.keys[j] === members.keys[k]) {
        return k
      }
      j = j + 1
    }
    k = k + 1
  }
  return -1
}

/**
 * The root package's `"nish"` field, read strictly (docs/wp36-capability-policy.md
 * §3): where its `noPanic` and `capabilities` values start, or -1 for one it
 * does not write. `problem` is the opening of the NL3036 message when the
 * field is not one object, written once, whose only keys are `noPanic` and
 * `capabilities`, each written once, with the span it is reported at; both
 * positions are then -1, so nothing in a field the reader cannot vouch for is
 * honoured. Keys are decoded as JSON.parse decodes them, so an escaped
 * spelling is the key it spells.
 */
export class NishManifest {
  problem: string
  problemStart: i32
  problemEnd: i32
  noPanicAt: i32
  capabilitiesAt: i32

  constructor() {
    this.problem = ""
    this.problemStart = 0
    this.problemEnd = 0
    this.noPanicAt = -1
    this.capabilitiesAt = -1
  }
}

/** A problem's span end: `end`, or one past `start` when `end` does not pass it. */
const manifestSpanEnd = (start: i32, end: i32): i32 => {
  if (end > start) {
    return end
  }
  if (start >= 0 && start < MANIFEST_SPAN_LIMIT) {
    return start + 1
  }
  return start
}

/** A `"nish"` field refused, read no further: NL3036's opening and the span of what broke it. */
const manifestNishProblem = (problem: string, start: i32, end: i32): NishManifest => {
  const out = new NishManifest()
  out.problem = problem
  out.problemStart = start
  out.problemEnd = manifestSpanEnd(start, end)
  return out
}

export const manifestNish = (manifest: string, condition: string): NishManifest => {
  const out = new NishManifest()
  // A manifest that is not JSON cannot be read strictly. One that could hold
  // the field -- it spells the name, or carries an escape that might -- is
  // refused where it breaks; any other is no business of this reader's.
  const broken = manifestMalformedAt(manifest)
  if (broken >= 0) {
    if (manifest.indexOf(condition) >= 0 || manifest.indexOf("\\u") >= 0) {
      return manifestNishProblem("`package.json` stops being JSON here", broken, broken)
    }
    return out
  }
  const top = manifestMembers(manifest, manifestSkipBlank(manifest, 0))
  let nish = -1
  let k = 0
  while (k < top.keys.length && k < top.keyAt.length && k < top.keyEnd.length) {
    if (top.keys[k] === condition) {
      if (nish >= 0) {
        return manifestNishProblem(`\`${condition}\` is written twice`, top.keyAt[k], top.keyEnd[k])
      }
      nish = k
    }
    k = k + 1
  }
  if (nish < 0 || nish >= top.valueAt.length || nish >= top.valueEnd.length) {
    return out
  }
  const fields = manifestMembers(manifest, top.valueAt[nish])
  if (fields.broken >= 0) {
    return manifestNishProblem(`\`${condition}\` is not an object`, top.valueAt[nish], top.valueEnd[nish])
  }
  const repeated = manifestRepeatedMember(fields)
  if (repeated >= 0 && repeated < fields.keyAt.length && repeated < fields.keyEnd.length) {
    return manifestNishProblem(
      `\`${fields.keys[repeated]}\` is written twice`,
      fields.keyAt[repeated],
      fields.keyEnd[repeated]
    )
  }
  let f = 0
  while (
    f < fields.keys.length &&
    f < fields.keyAt.length &&
    f < fields.keyEnd.length &&
    f < fields.valueAt.length &&
    f < fields.valueEnd.length
  ) {
    const key = fields.keys[f]
    const valueAt = fields.valueAt[f]
    if (key === "noPanic") {
      if (valueAt < 0 || valueAt >= manifest.length || manifest.charCodeAt(valueAt) !== OPEN_BRACKET) {
        return manifestNishProblem("`noPanic` is not an array", valueAt, fields.valueEnd[f])
      }
      out.noPanicAt = valueAt
    } else if (key === "capabilities") {
      out.capabilitiesAt = valueAt
    } else {
      return manifestNishProblem(
        `\`${key}\` is no key of \`${condition}\``,
        fields.keyAt[f],
        fields.keyEnd[f]
      )
    }
    f = f + 1
  }
  return out
}

/** The root package's `noPanic` list, from the position `manifestNish` found it at (`ManifestList`). */
export const manifestNoPanic = (manifest: string, at: i32): ManifestList => {
  const out = new ManifestList()
  if (at >= 0 && at < manifest.length && manifest.charCodeAt(at) === OPEN_BRACKET) {
    manifestReadList(manifest, at, out)
  }
  return out
}

/**
 * The root package's `"nish": { "capabilities": { "allow": [...], "deny": [...] } }`
 * (docs/wp36-capability-policy.md §3), read but not judged: the names are
 * resolved, and refused, by `Compilation.readCapabilityPolicy`. `problem` is
 * the opening of the NL3032 message when the field is not that shape, with the
 * span it is reported at, and the lists are then empty: a policy the reader
 * cannot follow is refused rather than half applied.
 */
export class CapabilityManifest {
  problem: string
  problemStart: i32
  problemEnd: i32
  /** Whether `allow` is written at all: an empty list allows nothing, and no list allows everything. */
  allowGiven: boolean
  allow: ManifestList
  deny: ManifestList

  constructor() {
    this.problem = ""
    this.problemStart = 0
    this.problemEnd = 0
    this.allowGiven = false
    this.allow = new ManifestList()
    this.deny = new ManifestList()
  }
}

/** A policy refused for its shape, read no further: NL3032's opening and the span of what broke it. */
const manifestPolicyProblem = (problem: string, start: i32, end: i32): CapabilityManifest => {
  const out = new CapabilityManifest()
  out.problem = problem
  out.problemStart = start
  out.problemEnd = manifestSpanEnd(start, end)
  return out
}

/**
 * The root package's capability policy, from the position `manifestNish`
 * found `capabilities` at (-1 for none): an object whose only keys are `allow`
 * and `deny`, each written once and each an array. Keys are decoded, as
 * `manifestNish` decodes them.
 */
export const manifestCapabilities = (manifest: string, at: i32): CapabilityManifest => {
  const out = new CapabilityManifest()
  if (at < 0) {
    return out
  }
  const members = manifestMembers(manifest, at)
  if (members.broken >= 0) {
    return manifestPolicyProblem("`capabilities` is not an object", at, manifestEndOfValue(manifest, at))
  }
  const repeated = manifestRepeatedMember(members)
  if (repeated >= 0 && repeated < members.keyAt.length && repeated < members.keyEnd.length) {
    return manifestPolicyProblem(
      `\`${members.keys[repeated]}\` is written twice`,
      members.keyAt[repeated],
      members.keyEnd[repeated]
    )
  }
  let k = 0
  while (
    k < members.keys.length &&
    k < members.keyAt.length &&
    k < members.keyEnd.length &&
    k < members.valueAt.length &&
    k < members.valueEnd.length
  ) {
    const key = members.keys[k]
    const valueAt = members.valueAt[k]
    if (key !== "allow" && key !== "deny") {
      return manifestPolicyProblem(
        `\`${key}\` is no key of \`capabilities\``,
        members.keyAt[k],
        members.keyEnd[k]
      )
    }
    if (valueAt < 0 || valueAt >= manifest.length || manifest.charCodeAt(valueAt) !== OPEN_BRACKET) {
      return manifestPolicyProblem(`\`${key}\` is not an array`, valueAt, members.valueEnd[k])
    }
    if (key === "allow") {
      out.allowGiven = true
      manifestReadList(manifest, valueAt, out.allow)
    } else {
      manifestReadList(manifest, valueAt, out.deny)
    }
    k = k + 1
  }
  return out
}

/**
 * `raw` as an export target, or null when it is not one.
 *
 * The three refusals are the module header's list, and each is a resolution
 * failure rather than a silent fallback: a value that is not a quoted string is
 * a shape this reader does not understand (a nested condition object, or an
 * array of targets); a `\` is an escape it does not decode; and a target that
 * does not begin with `./`, or that climbs with `..`, is one Node itself
 * refuses, because an export must name a file inside the package.
 */
const manifestTarget = (raw: string): string | null => {
  if (raw.length < 2 || raw.charCodeAt(0) !== QUOTE) {
    return null
  }
  const text = raw.substring(1, raw.length - 1)
  if (text.indexOf("\\") >= 0 || !text.startsWith("./")) {
    return null
  }
  for (const segment of splitByte(text, SLASH)) {
    if (segment === "..") {
      return null
    }
  }
  return text
}

/** `nishExportEntry` found a file: `target` names it. */
export const MANIFEST_FOUND: i32 = 0

/**
 * No file, for a reason none of the codes below names: no `exports`, no key
 * for the subpath, or a value this reader does not follow (an array of
 * targets, a nested condition object, an escaped or climbing path).
 */
const MANIFEST_NO_FILE: i32 = 1

/** The subpath's conditions offer only the *other* number mode's condition. */
export const MANIFEST_OTHER_MODE: i32 = 2

/**
 * The subpath's entry offers no Nish condition in any spelling: a JavaScript
 * package, which is §6's `lodash` case.
 */
export const MANIFEST_NOT_NISH: i32 = 3

/**
 * What `nishExportEntry` came away with: a status above, and the target when
 * the status is `MANIFEST_FOUND` (`""` otherwise). A class rather than a
 * nullable string because the failure has four shapes and each is its own
 * diagnostic.
 */
export class ManifestEntry {
  status: i32 = 0
  target: string = ""

  constructor(status: i32, target: string) {
    this.status = status
    this.target = target
  }
}

/** `manifestHasKeyOrValue` asks for a key that begins with `.`. */
const SCAN_SUBPATH_KEY: i32 = 0

/** `manifestHasKeyOrValue` asks for a value that is an object or an array. */
const SCAN_NESTED_VALUE: i32 = 1

/**
 * Whether `object` has a key or a value of the kind `scan` names. A `.` key
 * makes it a subpath map rather than a condition map; a nested value is a
 * condition this reader does not follow, so a map that has one cannot be said
 * to declare no Nish condition — the `nish` row may be inside it.
 */
const manifestHasKeyOrValue = (object: string, scan: i32): boolean => {
  let i = manifestSkipBlank(object, 0)
  if (i < 0 || i >= object.length || object.charCodeAt(i) !== OPEN_BRACE) {
    return false
  }
  i = manifestSkipBlank(object, i + 1)
  while (i >= 0 && i < object.length && object.charCodeAt(i) === QUOTE) {
    const keyEnd = manifestEndOfString(object, i)
    if (keyEnd < 0) {
      return false
    }
    if (scan === SCAN_SUBPATH_KEY && object.substring(i + 1, keyEnd - 1).startsWith(".")) {
      return true
    }
    i = manifestSkipBlank(object, keyEnd)
    if (i < 0 || i >= object.length || object.charCodeAt(i) !== COLON) {
      return false
    }
    const valueAt = manifestSkipBlank(object, i + 1)
    if (scan === SCAN_NESTED_VALUE && valueAt >= 0 && valueAt < object.length) {
      const first = object.charCodeAt(valueAt)
      if (first === OPEN_BRACE || first === OPEN_BRACKET) {
        return true
      }
    }
    const valueEnd = manifestEndOfValue(object, valueAt)
    if (valueEnd < 0) {
      return false
    }
    i = manifestSkipBlank(object, valueEnd)
    if (i < 0 || i >= object.length || object.charCodeAt(i) !== COMMA) {
      return false
    }
    i = manifestSkipBlank(object, i + 1)
  }
  return false
}

/**
 * The file `manifest` offers for `subpath` under the Nish conditions, relative
 * to the package directory — or, when it offers none, which of the reasons
 * above it is.
 *
 * `primary` is the mode-qualified condition (`nish-f64`) and `fallback` the
 * plain one (`nish`), so a both-modes package matches either and a single-mode
 * package matches one — which is what makes a mode mismatch a resolution
 * failure at the boundary instead of a wrong answer at run time
 * (`docs/wp21-packages.md` §6, and the `bench/strbuild.ts` demonstration in it).
 * `other` is the mode-qualified condition of the mode this program is *not*
 * compiled in, and is only ever asked about to name the failure: a package
 * that offers it and neither of the other two supports the other mode only.
 *
 * The whole object is asked for `primary` before it is asked for `fallback`,
 * rather than both being asked for in one walk: the mode-qualified condition is
 * the plain one refined, so a manifest that declares `nish` above `nish-f64`
 * must not thereby make its own f64 source unreachable. That is the reader's
 * one deliberate departure from Node's declaration-order matching and the
 * module header says why. A `primary` key whose value is not a target — an
 * array, a nested object, an escaped path — answers no file here rather than
 * falling back to `fallback`, for the same reason: the package named a file for
 * this mode, and quietly compiling the other one is what this is avoiding.
 */
export const nishExportEntry = (
  manifest: string,
  subpath: string,
  primary: string,
  fallback: string,
  other: string
): ManifestEntry => {
  const exports = manifestField(manifest, "exports")
  if (exports.length === 0) {
    return new ManifestEntry(MANIFEST_NO_FILE, "")
  }
  const forSubpath = manifestField(exports, subpath)
  // Node reads an `exports` object with no `.`-prefixed key as the condition
  // map for `.` itself, so `{"exports": {"nish": "./x.ts"}}` is the one-entry
  // shorthand for the example in the module header. Reaching it by "the subpath
  // was not a key" rather than by scanning for `.`-prefixed keys is one walk
  // instead of two, and differs from Node only for a manifest that mixes the
  // two forms, which Node refuses outright. The scan is paid only on the way
  // to a failure below, where a subpath map without `.` must not be reported
  // as a condition map that forgot its condition.
  let conditions = forSubpath
  if (conditions.length === 0 && subpath === ".") {
    conditions = exports
  }
  if (conditions.length === 0) {
    return new ManifestEntry(MANIFEST_NO_FILE, "")
  }
  let selected = manifestField(conditions, primary)
  if (selected.length === 0) {
    selected = manifestField(conditions, fallback)
  }
  if (selected.length > 0) {
    const target = manifestTarget(selected)
    return target === null
      ? new ManifestEntry(MANIFEST_NO_FILE, "")
      : new ManifestEntry(MANIFEST_FOUND, target)
  }
  if (forSubpath.length === 0 && manifestHasKeyOrValue(exports, SCAN_SUBPATH_KEY)) {
    return new ManifestEntry(MANIFEST_NO_FILE, "")
  }
  // A string where the conditions would be is a target with no condition on
  // it at all — `".": "./index.js"` — which is as JavaScript as a map of
  // `import` and `require` rows. An array is a fallback list this reader does
  // not follow, and stays the general answer.
  const first = conditions.charCodeAt(manifestSkipBlank(conditions, 0))
  if (first === QUOTE) {
    return new ManifestEntry(MANIFEST_NOT_NISH, "")
  }
  if (first !== OPEN_BRACE) {
    return new ManifestEntry(MANIFEST_NO_FILE, "")
  }
  if (manifestField(conditions, other).length > 0) {
    return new ManifestEntry(MANIFEST_OTHER_MODE, "")
  }
  // `{"node": {"nish": "./x.ts"}}` may well declare the condition, one level
  // down where this reader does not look, so it is not a claim that the
  // package has none.
  if (manifestHasKeyOrValue(conditions, SCAN_NESTED_VALUE)) {
    return new ManifestEntry(MANIFEST_NO_FILE, "")
  }
  return new ManifestEntry(MANIFEST_NOT_NISH, "")
}

/**
 * `nishExportEntry`'s file alone, or null when there is none: the question
 * `tests/self/support.ts` asks, whose answers are frozen from the S2 reader.
 */
export const nishExportTarget = (
  manifest: string,
  subpath: string,
  primary: string,
  fallback: string
): string | null => {
  const entry = nishExportEntry(manifest, subpath, primary, fallback, "")
  return entry.status === MANIFEST_FOUND ? entry.target : null
}

/** Nesting deeper than this is refused as unreadable, so a hostile manifest cannot exhaust the stack. */
const MANIFEST_DEPTH_LIMIT: i32 = 256

/** Whether `code` may appear in a JSON number or in `true` / `false` / `null`. */
const manifestIsScalarByte = (code: i32): boolean =>
  isDigit(code) ||
  (code >= LOWER_A && code <= LOWER_Z) ||
  code === MINUS ||
  code === PLUS ||
  code === DOT ||
  code === UPPER_E

/**
 * The index just past the JSON value at `at`, or `-1 - i` where `i` is the
 * byte this walk could not read past.
 *
 * Unlike `manifestEndOfValue`, which steps over a nested value to reach the
 * fields after it, this reads every byte, because its question is the one the
 * narrow scan never asks: whether the whole text is JSON. It is still a reader
 * rather than a parser — a scalar is any run of number and letter bytes that is
 * `true`, `false`, `null` or begins like a number — and it is asked only once
 * resolution has already failed.
 */
const manifestCheckValue = (text: string, at: i32, depth: i32): i32 => {
  const i = manifestSkipBlank(text, at)
  if (i >= text.length || depth > MANIFEST_DEPTH_LIMIT) {
    return -1 - i
  }
  const first = text.charCodeAt(i)
  if (first === QUOTE) {
    const end = manifestEndOfString(text, i)
    return end < 0 ? -1 - i : end
  }
  if (first === OPEN_BRACE || first === OPEN_BRACKET) {
    const close = first === OPEN_BRACE ? CLOSE_BRACE : CLOSE_BRACKET
    let j = manifestSkipBlank(text, i + 1)
    if (j < text.length && text.charCodeAt(j) === close) {
      return j + 1
    }
    while (j >= 0 && j < text.length) {
      if (first === OPEN_BRACE) {
        if (text.charCodeAt(j) !== QUOTE) {
          return -1 - j
        }
        const keyEnd = manifestEndOfString(text, j)
        if (keyEnd < 0) {
          return -1 - j
        }
        j = manifestSkipBlank(text, keyEnd)
        if (j < 0 || j >= text.length || text.charCodeAt(j) !== COLON) {
          return -1 - j
        }
        j = j + 1
      }
      const end = manifestCheckValue(text, j, depth + 1)
      if (end < 0) {
        return end
      }
      j = manifestSkipBlank(text, end)
      if (j < 0 || j >= text.length) {
        return -1 - j
      }
      const next = text.charCodeAt(j)
      if (next === close) {
        return j + 1
      }
      if (next !== COMMA) {
        return -1 - j
      }
      j = manifestSkipBlank(text, j + 1)
    }
    return -1 - j
  }
  let j = i
  while (j >= 0 && j < text.length && manifestIsScalarByte(text.charCodeAt(j))) {
    j = j + 1
  }
  const word = text.substring(i, j)
  const numeric = first === MINUS || isDigit(first)
  if (j === i || (!numeric && word !== "true" && word !== "false" && word !== "null")) {
    return -1 - i
  }
  return j
}

/**
 * The byte offset at which `manifest` stops being JSON, or -1 when all of it
 * is. Whitespace after the top-level value is allowed and anything else is
 * not, so a second object pasted below the first is a break at its brace.
 */
export const manifestMalformedAt = (manifest: string): i32 => {
  const end = manifestCheckValue(manifest, 0, 0)
  if (end < 0) {
    return -1 - end
  }
  const rest = manifestSkipBlank(manifest, end)
  return rest < manifest.length ? rest : -1
}

/** `engines.<condition>` is absent, or a floor this compiler meets. */
const ENGINE_OK: i32 = 0

/** `engines.<condition>` is a floor above this compiler's version. */
export const ENGINE_TOO_OLD: i32 = 1

/** `engines.<condition>` is present and is not a range this reader accepts. */
export const ENGINE_UNREADABLE: i32 = 2

/**
 * The text of `engines.<condition>`, unquoted when it is a string and as
 * written when it is not, or `""` when the manifest declares none. This is
 * what a diagnostic quotes back to the package's author.
 */
export const manifestEngineRange = (manifest: string, condition: string): string =>
  manifestUnquoted(manifestField(manifestField(manifest, "engines"), condition))

/**
 * The manifest's `version`, unquoted when it is a string and as written when
 * it is not, or `""` when it declares none. A diagnostic that names two copies
 * of one package tells them apart by it.
 */
export const manifestVersion = (manifest: string): string =>
  manifestUnquoted(manifestField(manifest, "version"))

/** A raw field value unquoted when it is a string, and as written when it is not. */
const manifestUnquoted = (raw: string): string =>
  raw.length >= 2 && raw.charCodeAt(0) === QUOTE ? raw.substring(1, raw.length - 1) : raw

/**
 * The run of digits of `text` at `at` as a number, and the index after it
 * through `next`, a one-element array because the language has no tuple. -1
 * when there is no digit, or more than nine: a version component that does not
 * fit an `i32` is not one anybody has published.
 */
const manifestReadNumber = (text: string, at: i32, next: i32[]): i32 => {
  let i = at
  let value = 0
  while (i >= 0 && i < text.length) {
    const code = text.charCodeAt(i)
    if (!isDigit(code)) {
      break
    }
    if (i - at >= 9) {
      return -1
    }
    value = value * 10 + (code - DIGIT_ZERO)
    i = i + 1
  }
  next[0] = i
  return i === at ? -1 : value
}

/**
 * The `X.Y` or `X.Y.Z` at `at` in `text` as `[major, minor, patch]`, a missing
 * patch read as 0, with the index after it through `next`; empty when there is
 * no such version there. What follows it is the caller's to judge.
 */
const manifestVersionParts = (text: string, at: i32, next: i32[]): i32[] => {
  const parts: i32[] = []
  let i = at
  while (parts.length < 3) {
    const value = manifestReadNumber(text, i, next)
    if (value < 0) {
      const none: i32[] = []
      return none
    }
    parts.push(value)
    i = next[0]
    if (parts.length === 3 || i < 0 || i >= text.length || i + 1 >= text.length) {
      break
    }
    if (text.charCodeAt(i) !== DOT) {
      break
    }
    i = i + 1
  }
  if (parts.length < 2) {
    const none: i32[] = []
    return none
  }
  if (parts.length === 2) {
    parts.push(0)
  }
  next[0] = i
  return parts
}

/**
 * Whether `version` meets the floor `manifest` declares in
 * `engines.<condition>` (`docs/wp21-packages.md` §6, the slot npm already has
 * for exactly this).
 *
 * The one range accepted is a floor, `>=X.Y.Z` or `>=X.Y`, with blanks allowed
 * around the version; every other shape — a caret, a tilde, an upper bound, a
 * `||`, a bare version, a value that is not a string — is `ENGINE_UNREADABLE`
 * and never treated as satisfied, because a floor this compiler cannot read is
 * a floor it cannot claim to meet.
 */
export const manifestEngineCheck = (manifest: string, condition: string, version: string): i32 => {
  const raw = manifestField(manifestField(manifest, "engines"), condition)
  if (raw.length === 0) {
    return ENGINE_OK
  }
  if (raw.charCodeAt(0) !== QUOTE) {
    return ENGINE_UNREADABLE
  }
  const range = raw.substring(1, raw.length - 1)
  const next: i32[] = [0]
  const opAt = manifestSkipBlank(range, 0)
  if (!range.substring(opAt, range.length).startsWith(">=")) {
    return ENGINE_UNREADABLE
  }
  const floor = manifestVersionParts(range, manifestSkipBlank(range, opAt + 2), next)
  if (floor.length === 0 || manifestSkipBlank(range, next[0]) < range.length) {
    return ENGINE_UNREADABLE
  }
  // This compiler's own version may carry a prerelease tag after its third
  // number, which is ignored: `0.9.0-rc.1` meets a floor of `>=0.9`.
  const running = manifestVersionParts(version, 0, next)
  if (running.length === 0) {
    return ENGINE_UNREADABLE
  }
  let i = 0
  while (i < 3 && i < running.length && i < floor.length) {
    if (running[i] > floor[i]) {
      return ENGINE_OK
    }
    if (running[i] < floor[i]) {
      return ENGINE_TOO_OLD
    }
    i = i + 1
  }
  return ENGINE_OK
}
