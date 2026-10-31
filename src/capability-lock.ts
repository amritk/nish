// The capability lockfile (docs/wp40-dependency-capabilities.md, "The
// lockfile"): every capability each dependency reaches, recorded beside the
// root package's `package.json`, so that a dependency upgrade that reaches
// something new fails the build instead of passing in silence.
//
//     {
//       "version": 1,
//       "packages": {
//         "@acme/fastmath": ["unsafe"],
//         "pkg_http": ["clock", "net"],
//         "pkg_git": ["fs.read=vendor/repos", "process.spawn=git"]
//       }
//     }
//
// A row's entry `cap=arg` records a capability granted with that argument
// (WP40 §2a): the dependency reaches `cap` only as far as the grant's
// arguments do, and a later grant that widens it -- a new argument, or the
// capability whole -- is growth like a new capability. A bare name records
// the capability whole, so every row written before arguments stays valid.
//
// The writer is byte-stable -- packages sorted, each row in the fixed
// capability order, two-space indentation and a trailing newline -- so the
// file diffs as cleanly as the change that moved it. The reader is as strict
// as the manifest's `"nish"` field is read (`src/manifest.ts`): one object
// whose only keys are `version`, which is 1, and `packages`, each written
// once; each package named once, its row an array of capability names, each
// written once. Anything else is refused where it is written, since a
// lockfile the reader cannot vouch for cannot vouch for a dependency either.
// `Compilation.checkCapabilityLock` compares; this module only reads and
// writes.

import { argumentCapabilities, capabilityIndex, capabilityName, capabilityNames } from "./capabilities"
import { CLI } from "./branding"
import { StringBuilder, compareStrings, jsonQuote } from "./strings"

const TAB: i32 = 9
const NEWLINE: i32 = 10
const CARRIAGE_RETURN: i32 = 13
const SPACE: i32 = 32
const QUOTE: i32 = 34
const COMMA: i32 = 44
const SLASH: i32 = 47
const DIGIT_0: i32 = 48
const DIGIT_9: i32 = 57
const COLON: i32 = 58
const UPPER_A: i32 = 65
const UPPER_F: i32 = 70
const OPEN_BRACKET: i32 = 91
const BACKSLASH: i32 = 92
const CLOSE_BRACKET: i32 = 93
const LOWER_A: i32 = 97
const LOWER_B: i32 = 98
const LOWER_F: i32 = 102
const LOWER_N: i32 = 110
const LOWER_R: i32 = 114
const LOWER_T: i32 = 116
const LOWER_U: i32 = 117
const OPEN_BRACE: i32 = 123
const CLOSE_BRACE: i32 = 125

/** The one version of the format this compiler reads and writes. */
const LOCK_VERSION: string = "1"

/** The lockfile's name, in the root package's directory. */
export const capabilityLockName = (): string => `${CLI}-capabilities.lock.json`

/**
 * A lockfile read: each package it records beside the mask of its row, or the
 * opening of the NL3043 message and its span when the file is not the shape,
 * and then no row at all. `scoped` holds, per row, the capabilities it records
 * only with arguments, and `argRows` and `argTexts` each such entry, flat.
 */
export class CapabilityLock {
  text: string
  at: i32
  problem: string
  problemStart: i32
  problemEnd: i32
  names: string[]
  masks: i32[]
  scoped: i32[]
  argRows: i32[]
  argTexts: string[]

  constructor(text: string) {
    this.text = text
    this.at = 0
    this.problem = ""
    this.problemStart = 0
    this.problemEnd = 0
    this.names = []
    this.masks = []
    this.scoped = []
    this.argRows = []
    this.argTexts = []
  }

  /** Refuse the file, read no further: the first problem is the one reported. */
  fail(problem: string, start: i32, end: i32): void {
    if (this.problem.length > 0) {
      return
    }
    this.problem = problem
    this.problemStart = start
    this.problemEnd = end > start ? end : start + 1
    this.names = []
    this.masks = []
    this.scoped = []
    this.argRows = []
    this.argTexts = []
  }

  failed(): boolean {
    return this.problem.length > 0
  }

  /** The byte at the cursor, or -1 past the end. */
  peek(): i32 {
    return this.at >= 0 && this.at < this.text.length ? this.text.charCodeAt(this.at) : -1
  }

  skipBlank(): void {
    while (this.at >= 0 && this.at < this.text.length) {
      const code = this.text.charCodeAt(this.at)
      if (code !== SPACE && code !== TAB && code !== NEWLINE && code !== CARRIAGE_RETURN) {
        return
      }
      this.at = this.at + 1
    }
  }

  /** Where the text stops being JSON this reader follows. */
  broken(): void {
    this.fail("the file stops being JSON here", this.at, this.at + 1)
  }

  /** Step past `code` after any blank, or refuse the file where it is not. */
  expect(code: i32): boolean {
    this.skipBlank()
    if (this.peek() !== code) {
      this.broken()
      return false
    }
    this.at = this.at + 1
    return true
  }

  /**
   * The JSON string at the cursor, decoded as JSON.parse decodes it, with the
   * cursor left just past it; null, and the file refused, when it is not one.
   * An escape for a character outside ASCII becomes DEL (127), which no
   * capability name contains, as `manifestDecodeString` reads it.
   */
  string(): string | null {
    if (this.peek() !== QUOTE) {
      this.broken()
      return null
    }
    const out = new StringBuilder()
    this.at = this.at + 1
    while (this.at >= 0 && this.at < this.text.length) {
      const code = this.text.charCodeAt(this.at)
      if (code === QUOTE) {
        this.at = this.at + 1
        return out.toText()
      }
      if (code < SPACE) {
        this.broken()
        return null
      }
      if (code !== BACKSLASH) {
        out.addChar(code)
        this.at = this.at + 1
        continue
      }
      this.at = this.at + 1
      const escaped = this.peek()
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
          this.at = this.at + 1
          const digit = lockHexDigit(this.peek())
          if (digit < 0) {
            this.broken()
            return null
          }
          value = (value << 4) | digit
          digits = digits + 1
        }
        out.addChar(value < 128 ? value : 127)
      } else {
        this.broken()
        return null
      }
      this.at = this.at + 1
    }
    this.broken()
    return null
  }

  /** The whole file: one object of `version` and `packages`, then nothing but blank. */
  read(): void {
    this.skipBlank()
    const open = this.at
    if (this.peek() !== OPEN_BRACE) {
      this.fail("the file is not one JSON object", open, open + 1)
      return
    }
    this.at = this.at + 1
    let version = false
    let packages = false
    this.skipBlank()
    let more = this.peek() !== CLOSE_BRACE
    while (more && !this.failed()) {
      this.skipBlank()
      const keyAt = this.at
      const key = this.string()
      if (key === null) {
        return
      }
      const keyEnd = this.at
      if (!this.expect(COLON)) {
        return
      }
      if (key === "version" || key === "packages") {
        if ((key === "version" && version) || (key === "packages" && packages)) {
          this.fail(`\`${key}\` is written twice`, keyAt, keyEnd)
          return
        }
      } else {
        this.fail(`\`${key}\` is no key of the file`, keyAt, keyEnd)
        return
      }
      this.skipBlank()
      if (key === "version") {
        version = true
        this.readVersion()
      } else {
        packages = true
        this.readPackages()
      }
      more = this.separator(CLOSE_BRACE)
    }
    if (this.failed()) {
      return
    }
    this.at = this.at + 1
    this.skipBlank()
    if (this.at < this.text.length) {
      this.broken()
      return
    }
    if (!version || !packages) {
      this.fail(`\`${version ? "packages" : "version"}\` is missing`, open, open + 1)
    }
  }

  /**
   * After a member or an entry: true past a comma, with another to read; false
   * at `close`, which the cursor is left on. Anything else refuses the file,
   * a trailing comma included.
   */
  separator(close: i32): boolean {
    if (this.failed()) {
      return false
    }
    this.skipBlank()
    const code = this.peek()
    if (code === close) {
      return false
    }
    if (code !== COMMA) {
      this.broken()
      return false
    }
    this.at = this.at + 1
    this.skipBlank()
    if (this.peek() === close) {
      this.broken()
      return false
    }
    return true
  }

  /** `version`'s value, which is the number 1 written as `1`. */
  readVersion(): void {
    const start = this.at
    while (this.at < this.text.length && lockNumberByte(this.text.charCodeAt(this.at))) {
      this.at = this.at + 1
    }
    if (this.text.substring(start, this.at) !== LOCK_VERSION) {
      this.fail(`\`version\` is not ${LOCK_VERSION}`, start, this.at)
    }
  }

  /** `packages`' value: an object naming each package once, its row an array of capabilities. */
  readPackages(): void {
    if (this.peek() !== OPEN_BRACE) {
      this.fail("`packages` is not an object", this.at, this.at + 1)
      return
    }
    this.at = this.at + 1
    this.skipBlank()
    let more = this.peek() !== CLOSE_BRACE
    while (more && !this.failed()) {
      this.skipBlank()
      const nameAt = this.at
      const name = this.string()
      if (name === null) {
        return
      }
      const nameEnd = this.at
      if (!this.expect(COLON)) {
        return
      }
      if (this.names.indexOf(name) >= 0) {
        this.fail(`\`${name}\` is named twice`, nameAt, nameEnd)
        return
      }
      this.skipBlank()
      const mask = this.readRow(name, this.names.length)
      if (this.failed()) {
        return
      }
      this.names.push(name)
      this.masks.push(mask | this.scoped[this.scoped.length - 1])
      more = this.separator(CLOSE_BRACE)
    }
    if (!this.failed()) {
      this.at = this.at + 1
    }
  }

  /**
   * One package's row, at `row`, as the mask of what it records whole: an
   * array of capability names, or `cap=arg` entries for a capability that
   * takes an argument, each written once. What it records only with
   * arguments is pushed to `scoped`.
   */
  readRow(name: string, row: i32): i32 {
    if (this.peek() !== OPEN_BRACKET) {
      this.fail(`the row of \`${name}\` is not an array`, this.at, this.at + 1)
      return 0
    }
    this.at = this.at + 1
    this.skipBlank()
    let mask = 0
    let scoped = 0
    let more = this.peek() !== CLOSE_BRACKET
    while (more && !this.failed()) {
      this.skipBlank()
      const entryAt = this.at
      if (this.peek() !== QUOTE) {
        this.fail(
          `the row of \`${name}\` holds something that is not a capability's name`,
          entryAt,
          entryAt + 1
        )
        return 0
      }
      const entry = this.string()
      if (entry === null) {
        return 0
      }
      const equals = entry.indexOf("=")
      const c = capabilityIndex(equals >= 0 ? entry.slice(0, equals) : entry)
      if (
        c < 0 ||
        (equals >= 0 && ((argumentCapabilities() & (1 << c)) === 0 || equals + 1 >= entry.length))
      ) {
        this.fail(`\`${entry}\` in the row of \`${name}\` is no capability`, entryAt, this.at)
        return 0
      }
      if (
        (equals < 0 && (mask & (1 << c)) !== 0) ||
        (equals >= 0 && this.recorded(row, c).indexOf(entry) >= 0)
      ) {
        this.fail(`\`${entry}\` is written twice in the row of \`${name}\``, entryAt, this.at)
        return 0
      }
      if (equals < 0) {
        mask = mask | (1 << c)
      } else {
        scoped = scoped | (1 << c)
        this.argRows.push(row)
        this.argTexts.push(entry)
      }
      more = this.separator(CLOSE_BRACKET)
    }
    if (!this.failed()) {
      this.at = this.at + 1
    }
    this.scoped.push(scoped & ~mask)
    return mask
  }

  /** The arguments row `row` records for capability `c`, as `cap=arg` entries. */
  recorded(row: i32, c: i32): string[] {
    const out: string[] = []
    const prefix = `${capabilityName(c)}=`
    let j = 0
    while (j < this.argRows.length && j < this.argTexts.length) {
      if (this.argRows[j] === row && this.argTexts[j].startsWith(prefix)) {
        out.push(this.argTexts[j])
      }
      j = j + 1
    }
    return out
  }
}

/** A byte a JSON number can hold, so that `1.0` or `10` is read whole and refused. */
const lockNumberByte = (code: i32): boolean =>
  (code >= DIGIT_0 && code <= DIGIT_9) ||
  code === 43 ||
  code === 45 ||
  code === 46 ||
  code === 69 ||
  code === 101

/** The value of a hex digit, or -1 for any other byte (`manifestHexDigit`). */
const lockHexDigit = (code: i32): i32 => {
  if (code >= DIGIT_0 && code <= DIGIT_9) {
    return code & 15
  }
  if ((code >= LOWER_A && code <= LOWER_F) || (code >= UPPER_A && code <= UPPER_F)) {
    return (code & 7) + 9
  }
  return -1
}

/** Read a lockfile's text strictly (`CapabilityLock`). */
export const readCapabilityLock = (text: string): CapabilityLock => {
  const lock = new CapabilityLock(text)
  lock.read()
  return lock
}

/**
 * The lockfile for `names`, sorted, each beside its mask: byte-stable, so the
 * same program writes the same file. A package that reaches nothing is
 * written with `[]`, which records that it reached nothing. A capability in a
 * package's `scoped` bits is written as the `cap=arg` entries of `argTexts`
 * whose `argRows` is that package's place, sorted, in place of its name.
 */
export const capabilityLockText = (
  names: string[],
  masks: i32[],
  scoped: i32[],
  argRows: i32[],
  argTexts: string[]
): string => {
  const out = new StringBuilder()
  out.add(`{\n  "version": ${LOCK_VERSION},\n  "packages": {`)
  let p = 0
  for (const name of names) {
    out.add(p === 0 ? "\n    " : ",\n    ")
    out.add(jsonQuote(name))
    out.add(": [")
    const mask = p < masks.length ? masks[p] : 0
    const narrow = p < scoped.length ? scoped[p] & mask : 0
    const entries: string[] = []
    for (const cap of capabilityNames(mask)) {
      if ((narrow & (1 << capabilityIndex(cap))) === 0) {
        entries.push(cap)
      } else {
        const own: string[] = []
        let j = 0
        while (j < argRows.length && j < argTexts.length) {
          if (argRows[j] === p && argTexts[j].startsWith(`${cap}=`)) {
            let at = own.length
            own.push(argTexts[j])
            while (at > 0 && compareStrings(own[at - 1], own[at]) > 0) {
              const held = own[at]
              own[at] = own[at - 1]
              own[at - 1] = held
              at = at - 1
            }
          }
          j = j + 1
        }
        for (const text of own) {
          entries.push(text)
        }
      }
    }
    let c = 0
    for (const entry of entries) {
      if (c > 0) {
        out.add(", ")
      }
      out.add(jsonQuote(entry))
      c++
    }
    out.add("]")
    p++
  }
  out.add(names.length > 0 ? "\n  }\n}\n" : "}\n}\n")
  return out.toText()
}
