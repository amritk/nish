/**
 * Fuzz target: the regular-expression compiler and matcher (std/regex.ts).
 *
 * Byte 0 picks the flags: bit 0 `i`, bit 1 `m`, bit 2 `s`. The bytes after it
 * up to the first 0x00 are the pattern, and the rest is the subject. The
 * pattern is compiled; one that compiles is run over the subject by `test`,
 * `exec`, `find`, `findAll`, `count`, `replace`, `replaceAll` and `split`,
 * whose answers are checked against each other: `test` is whether `exec`
 * finds a match, `find` answers the same match, `count` is how many
 * `findAll` returns, and every match lies inside the subject. The pattern is
 * also escaped with `regexEscape`, which must compile and match the pattern
 * itself unless it is not UTF-8, which `regexCompile` refuses. A refusal is an error result; a panic, or answers that disagree, is
 * a crash.
 */
import { Regex, RegexMatch, regexCompile, regexEscape } from "nish/regex"

const flagsOf = (mode: u8): string => {
  let flags: string = ""
  if ((mode & 1) !== 0) {
    flags = flags + "i"
  }
  if ((mode & 2) !== 0) {
    flags = flags + "m"
  }
  if ((mode & 4) !== 0) {
    flags = flags + "s"
  }
  return flags
}

const checkMatch = (m: RegexMatch, subject: string): void => {
  const n: i32 = toI32(subject.length)
  if (m.start() < 0 || m.start() > m.end() || m.end() > n) {
    panic(`regex: a match [${m.start()}, ${m.end()}) is outside the subject`)
  }
  let k: i32 = 1
  while (k < m.groupCount()) {
    if (m.matched(k) && (m.groupStart(k) < 0 || m.groupStart(k) > m.groupEnd(k) || m.groupEnd(k) > n)) {
      panic(`regex: group ${k} is outside the subject`)
    }
    k += 1
  }
}

const exercise = (re: Regex, subject: string): void => {
  const m: RegexMatch = new RegexMatch()
  const found: boolean = re.exec(subject, 0, m)
  if (re.test(subject) !== found) {
    panic("regex: test disagrees with exec")
  }
  const first: RegexMatch | null = re.find(subject, 0)
  if ((first !== null) !== found) {
    panic("regex: find disagrees with exec")
  }
  if (first !== null) {
    checkMatch(m, subject)
    checkMatch(first, subject)
    if (first.start() !== m.start() || first.end() !== m.end()) {
      panic("regex: find answered another match than exec")
    }
    // From the end of the match, as a caller walking every match does.
    const next: RegexMatch | null = re.find(subject, m.end())
    if (next !== null) {
      checkMatch(next, subject)
      if (next.start() < m.end()) {
        panic("regex: a match from an offset starts before it")
      }
    }
  }
  const all: string[] = re.findAll(subject)
  if (toI32(all.length) !== re.count(subject)) {
    panic("regex: count disagrees with findAll")
  }
  if ((all.length > 0) !== found) {
    panic("regex: findAll disagrees with exec")
  }
  re.replace(subject, "<$&|$`|$'>")
  re.replaceAll(subject, "[$1$<n>$$]")
  re.split(subject)
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n === 0) {
    return
  }
  let cut: i32 = 1
  while (cut < n && data[cut] !== 0) {
    cut += 1
  }
  const pattern: string = String.fromBytes(data, 1, cut)
  const subject: string = String.fromBytes(data, cut < n ? cut + 1 : n, n)
  const flags: string = flagsOf(data[0])
  const compiled = regexCompile(pattern, flags)
  if (compiled.isOk()) {
    exercise(compiled.value, subject)
  }
  const literal = regexCompile(regexEscape(pattern), flags)
  if (literal.isErr() && literal.error.indexOf("not valid UTF-8") >= 0) {
    return
  }
  if (literal.isErr()) {
    panic(`regex: an escaped pattern does not compile: ${literal.error}`)
  }
  const exact: Regex = literal.value
  if (!exact.test(pattern)) {
    panic("regex: an escaped pattern does not match itself")
  }
  exercise(exact, subject)
}
