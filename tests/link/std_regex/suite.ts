// `std/regex` checked with `std/testing`. The table rows were generated from
// JavaScript's own `RegExp` with the `u` flag, offsets converted to UTF-8
// bytes, so each row is what a JavaScript engine answers for the same pattern
// and input: `"start-end|group1|…"`, `-` for a group that took no part, `none`
// for no match, and the error text for a pattern this engine refuses. Each row
// also checks that `test` and `findAll` agree with `exec`, because the three
// run the VM with different numbers of slots. The pathological patterns at the
// end are the ones a backtracking engine takes exponential time on; here they
// finish in time linear in the input.
import { Suite } from "../../../std/testing";
import { Regex, RegexMatch, regexCompile, regexEscape } from "../../../std/regex";

const describe = (m: RegexMatch): string => {
  const parts: string[] = [`${m.start()}-${m.end()}`]
  let k: i32 = 1
  while (k < m.groupCount()) {
    parts.push(m.matched(k) ? m.group(k) : "-")
    k += 1
  }
  return parts.join("|")
}

const row = (t: Suite, pattern: string, flags: string, text: string, expected: string): void => {
  const name = `/${pattern}/${flags}`
  const c = regexCompile(pattern, flags)
  if (c.isErr()) {
    t.eqStr(name, c.error, expected)
    return
  }
  const re: Regex = c.value
  const m: RegexMatch = new RegexMatch()
  const found: boolean = re.exec(text, toI32(0), m)
  const actual: string = found ? describe(m) : "none"
  if (!t.eqStr(name, actual, expected)) {
    return
  }
  if (re.test(text) !== found) {
    t.fail(name, "test disagrees with exec")
    return
  }
  const all: string[] = re.findAll(text)
  if (found && (all.length === 0 || all[0] !== m.text())) {
    t.fail(name, "findAll disagrees with exec")
  }
}

const compile = (pattern: string, flags: string): Regex => {
  const c = regexCompile(pattern, flags)
  if (c.isErr()) {
    panic(c.error)
  }
  return c.value
}

export const runSuite = (): i32 => {
  const t = new Suite("regex")

  row(t, "abc", "", "xxabcxx", "2-5")
  row(t, "abc", "", "ab", "none")
  row(t, "foo\\d", "", "foo foo1", "4-8")
  row(t, "needle", "", "haystack", "none")
  row(t, "[xy]z", "", "aaaayz", "4-6")
  row(t, "(?:q|r)s+", "", "..rss", "2-5")
  row(t, "cat|dog", "", "hotdog", "3-6")
  row(t, "a|ab", "", "ab", "0-1")
  row(t, "(a|ab)(c|bcd)", "", "abcd", "0-4|a|bcd")
  row(t, "|a", "", "a", "0-0")
  row(t, "a+", "", "baaa", "1-4")
  row(t, "a+?", "", "aaa", "0-1")
  row(t, "a*?b", "", "aaab", "0-4")
  row(t, "<.+>", "", "<a><b>", "0-6")
  row(t, "<.+?>", "", "<a><b>", "0-3")
  row(t, "a??b", "", "ab", "0-2")
  row(t, "(a+)(a*)", "", "aaaa", "0-4|aaaa|")
  row(t, "(a+?)(a*)", "", "aaaa", "0-4|a|aaa")
  row(t, "a{2,3}", "", "aaaa", "0-3")
  row(t, "a{2}", "", "aaaa", "0-2")
  row(t, "a{2,}", "", "aaaaa", "0-5")
  row(t, "ba{0}c", "", "bc", "0-2")
  row(t, "x{1,2}?", "", "xxx", "0-1")
  row(t, "(ab){2}", "", "abababx", "0-4|ab")
  row(t, "(?:a|b){3,}?c", "", "ababc", "0-5")
  row(t, "(a)(b)?", "", "a", "0-1|a|-")
  row(t, "(?<y>\\d+)-(?<m>\\d+)", "", "on 2026-10", "3-10|2026|10")
  row(t, "(?:ab)+", "", "ababx", "0-4")
  row(t, "(a|b)*", "", "abab", "0-4|b")
  row(t, "(a)|b", "", "b", "0-1|-")
  row(t, "((a)|b)+", "", "ab", "0-2|b|-")
  row(t, "(a*)*", "", "b", "0-0|-")
  row(t, "(a*)+", "", "b", "0-0|")
  row(t, "(z)((a+)?(b+)?(c))*", "", "zaacbbbcac", "0-10|z|ac|a|-|c")
  row(t, "(.*?)x(\\d*)", "", "abx12y", "0-5|ab|12")
  row(t, "^abc", "", "xabc", "none")
  row(t, "^abc$", "", "abc", "0-3")
  row(t, "^b", "m", "a\nb", "2-3")
  row(t, "^b", "", "a\nb", "none")
  row(t, "a$", "m", "a\nb", "0-1")
  row(t, "a$", "", "a\nb", "none")
  row(t, "$", "", "ab", "2-2")
  row(t, "^$", "m", "a\n\nb", "2-2")
  row(t, "x$", "m", "x\r\n", "0-1")
  row(t, "^y", "m", "x y", "4-5")
  row(t, "a.c", "", "a\nc", "none")
  row(t, "a.c", "s", "a\nc", "0-3")
  row(t, "a.c", "", "a\rc", "none")
  row(t, ".+", "", "ab\ncd", "0-2")
  row(t, "[a-c]+", "", "xxabcabd", "2-7")
  row(t, "[^a-c]+", "", "abcxyz", "3-6")
  row(t, "[\\d.]+", "", "v1.25x", "1-5")
  row(t, "[-a]+", "", "x-a-", "1-4")
  row(t, "[a-]+", "", "x-a-", "1-4")
  row(t, "[\\w-]+", "", "  my-name ", "2-9")
  row(t, "[]", "", "a", "none")
  row(t, "[^]", "", "\n", "0-1")
  row(t, "[\\]\\\\]+", "", "a]\\b", "1-3")
  row(t, "[\\b]", "", "a\bb", "1-2")
  row(t, "\\D+", "", "12ab34", "2-4")
  row(t, "\\W+", "", "ab, cd", "2-4")
  row(t, "\\S+", "", "  xy ", "2-4")
  row(t, "[^\\d\\s]+", "", "1 2ab 3", "3-5")
  row(t, "[\\s\\S]+", "", "a\nb", "0-3")
  row(t, "\\bfoo\\b", "", "afoo foo", "5-8")
  row(t, "\\Bo", "", "foo", "1-2")
  row(t, "\\b", "", "  ", "none")
  row(t, "\\B", "", "ab", "1-1")
  row(t, "HELLO", "i", "say hello", "4-9")
  row(t, "[a-z]+", "i", "123ABC", "3-6")
  row(t, "[^a-z]", "i", "Az1", "2-3")
  row(t, "[A-Z]x", "i", "ax", "0-2")
  row(t, "k", "i", "K", "0-1")
  row(t, "\\x41\\u0042\\u{43}", "", "_ABC", "1-4")
  row(t, "\\t", "", "a\tb", "1-2")
  row(t, "\\cJ", "", "a\nb", "1-2")
  row(t, "a\\.b", "", "axb a.b", "4-7")
  row(t, "\\/\\*\\+\\?\\(\\)\\{\\}\\|\\^\\$", "", "/*+?(){}|^$", "0-11")
  row(t, "\\ud83d\\ude00", "", "x😀", "1-5")
  row(t, "\\0", "", "a\u0000", "1-2")
  row(t, "\\f\\v", "", "\f\u000b", "0-2")
  row(t, "\\s+", "", "a \t 　﻿b", "1-11")
  row(t, "é+", "", "caféé!", "3-7")
  row(t, ".", "", "€", "0-3")
  row(t, "[à-ÿ]+", "", "naïve", "2-4")
  row(t, "\\u{1F600}", "", "x😀", "1-5")
  row(t, "^.$", "", "😀", "0-4")
  row(t, "[^a]", "", "😀", "0-4")
  row(t, "\\s", "", "a　b", "1-4")
  row(t, "[😀-😂]", "", "x😁", "1-5")
  row(t, "a.b", "", "a€b", "0-5")
  row(t, "[^€]+", "", "€€xy€", "6-8")
  row(t, "\\w+", "", "日本go", "6-8")
  row(t, "\\bgo\\b", "", "日本go", "6-8")
  row(t, "", "", "abc", "0-0")
  row(t, "x*", "", "abc", "0-0")
  row(t, "(|a)+", "", "a", "0-1|a")
  row(t, "(|a){1,2}", "", "a", "0-1|a")
  row(t, "(|a){0,2}", "", "a", "0-1|a")
  row(t, "(a|)*", "", "aab", "0-2|a")
  row(t, "(|a)*?b", "", "aab", "0-3|a")
  row(t, "(?:(a)|b?)+", "", "ab", "0-2|-")
  row(t, "(a?b?)*", "", "abba", "0-4|a")
  row(t, "(\\b|a)+", "", "a", "0-1|a")
  row(t, "((a*)*)+", "", "aa", "0-2|aa|aa")
  row(t, "(a|b|)+c", "", "abc", "0-3|b")
  row(t, "(a?)*?b", "", "ab", "0-2|a")

  row(t, "(a", "", "", "regex: missing ) at byte 0")
  row(t, "a)", "", "", "regex: unmatched ) at byte 1")
  row(t, "*a", "", "", "regex: nothing to repeat at byte 0")
  row(t, "a**", "", "", "regex: nothing to repeat at byte 2")
  row(t, "a{1}{2}", "", "", "regex: nothing to repeat at byte 4")
  row(t, "(?=a)", "", "", "regex: lookahead is not supported at byte 0")
  row(t, "(?!a)", "", "", "regex: lookahead is not supported at byte 0")
  row(t, "(?<=a)b", "", "", "regex: lookbehind is not supported at byte 0")
  row(t, "(?<!a)b", "", "", "regex: lookbehind is not supported at byte 0")
  row(t, "(a)\\1", "", "", "regex: backreferences are not supported at byte 3")
  row(t, "(?<n>a)\\k<n>", "", "", "regex: backreferences are not supported at byte 7")
  row(t, "[b-a]", "", "", "regex: class range out of order at byte 1")
  row(t, "a{3,2}", "", "", "regex: numbers out of order in {} quantifier at byte 1")
  row(t, "a{1001}", "", "", "regex: a repeat count is over 1000 at byte 1")
  row(t, "\\q", "", "", "regex: invalid escape at byte 0")
  row(t, "(?<n>a)(?<n>b)", "", "", "regex: duplicate group name at byte 10")
  row(t, "[\\d-z]", "", "", "regex: invalid class range at byte 1")
  row(t, "a{", "", "", "regex: lone quantifier bracket at byte 1")
  row(t, "}", "", "", "regex: lone quantifier bracket at byte 0")
  row(t, "]", "", "", "regex: lone ] at byte 0")
  row(t, "^*", "", "", "regex: nothing to repeat at byte 0")
  row(t, "\\b+", "", "", "regex: nothing to repeat at byte 0")
  row(t, "[a", "", "", "regex: missing ] at byte 0")
  row(t, "\\", "", "", "regex: \\ at end of pattern at byte 0")
  row(t, "(?x)", "", "", "regex: unsupported group syntax at byte 0")
  row(t, "(?<1a>x)", "", "", "regex: invalid group name at byte 3")
  row(t, "\\x4", "", "", "regex: invalid \\x escape at byte 0")
  row(t, "\\u{110000}", "", "", "regex: invalid \\u escape at byte 0")
  row(t, "\\01", "", "", "regex: octal escapes are not supported at byte 0")
  row(t, "a", "g", "", "regex: invalid flags \"g\"")
  row(t, "a", "ii", "", "regex: invalid flags \"ii\"")
  row(t, "a", "u", "", "regex: invalid flags \"u\"")

  // --- the API around a match ----------------------------------------------
  const words = compile("\\w+", "")
  t.eqLines("findAll", words.findAll("one, two  three"), ["one", "two", "three"])
  t.eqI32("count", words.count("one, two  three"), toI32(3))
  t.eqLines("findAll: empty matches step past a character", compile("a*", "").findAll("baa"), ["", "aa", ""])
  t.eqI32("count: empty matches", compile("", "").count("abc"), toI32(4))
  t.eqLines("findAll: empty matches step a whole UTF-8 character", compile("", "").findAll("é"), ["", ""])

  const date = compile("(?<y>\\d{4})-(?<m>\\d\\d)-(?<d>\\d\\d)", "")
  t.eqI32("groupCount", date.groupCount(), toI32(4))
  t.eqI32("groupIndex", date.groupIndex("m"), toI32(2))
  t.eqI32("groupIndex: no such name", date.groupIndex("x"), toI32(-1))
  const dm = date.find("due 2024-03-09.", toI32(0))
  if (dm === null) {
    t.fail("find", "no match")
  } else {
    t.eqStr("named", dm.named("d"), "09")
    t.eqStr("named: no such name", dm.named("x"), "")
    t.eqI32("groupStart", dm.groupStart(toI32(1)), toI32(4))
    t.eqI32("groupEnd", dm.groupEnd(toI32(3)), toI32(14))
  }
  t.ok("find: no match is null", date.find("no dates", toI32(0)) === null)
  const from = new RegexMatch()
  t.ok("exec from an offset", words.exec("ab cd", toI32(2), from))
  t.eqStr("exec from an offset: text", from.text(), "cd")
  t.ok("exec past the last match", !words.exec("ab cd", toI32(5), from))
  t.eqStr("exec past the last match leaves the match alone", from.text(), "cd")

  // --- replace ---------------------------------------------------------------
  t.eqStr("replace: the first match", words.replace("a b c", "<$&>"), "<a> b c")
  t.eqStr("replaceAll", words.replaceAll("a b c", "<$&>"), "<a> <b> <c>")
  t.eqStr("replaceAll: numbered groups", compile("(\\w+)@(\\w+)", "").replaceAll("x@y a@b", "$2@$1"), "y@x b@a")
  t.eqStr("replaceAll: named groups", date.replaceAll("2024-03-09", "$<d>/$<m>/$<y>"), "09/03/2024")
  t.eqStr("replace: $$ and the text around", compile("b", "").replace("abc", "[$`|$$|$']"), "a[a|$|c]c")
  t.eqStr("replace: an unknown name is empty", date.replace("2024-03-09", "$<x>!"), "!")
  t.eqStr("replace: a group that took no part is empty", compile("(a)|b", "").replaceAll("ab", "[$1]"), "[a][]")
  t.eqStr("replace: a $ that names nothing stays", compile("x", "").replace("x", "$9$z$"), "$9$z$")
  t.eqStr("replaceAll: empty matches", compile("", "").replaceAll("ab", "-"), "-a-b-")
  t.eqStr("replaceAll: no match leaves the text", words.replaceAll("  ", "x"), "  ")

  // --- split -----------------------------------------------------------------
  t.eqLines("split", compile(",\\s*", "").split("a, b,c"), ["a", "b", "c"])
  t.eqLines("split: groups follow their piece", compile("(-)|(\\+)", "").split("a-b+c"), ["a", "-", "", "b", "", "+", "c"])
  t.eqLines("split: an empty pattern splits characters", compile("", "").split("héj"), ["h", "é", "j"])
  t.eqLines("split: the empty string, no match", compile("x", "").split(""), [""])
  const none: string[] = []
  t.eqLines("split: the empty string, a match", compile("x*", "").split(""), none)
  t.eqLines("split: separators at both ends", compile(",", "").split(",a,"), ["", "a", ""])

  // --- regexEscape -----------------------------------------------------------
  const special = "a.b*c(d)[e]{f}|g^h$i\\j?k+l/m"
  t.eqStr("regexEscape", regexEscape("1+1=2?"), "1\\+1=2\\?")
  t.eqStr("regexEscape: nothing to escape", regexEscape("plain"), "plain")
  const escaped = compile(regexEscape(special), "")
  t.eqStr("regexEscape: matches its text exactly", escaped.findAll(`x${special}y`).join(""), special)

  // The one documented difference from JavaScript, which captures "a" here:
  // the VM keeps one thread per instruction and position, and the thread for
  // a third iteration loses that slot to the second iteration's own.
  row(t, "(a*?)+?$", "", "aa", "0-2|aa")

  // --- flags -----------------------------------------------------------------
  row(t, "a", "g", "a", "regex: invalid flags \"g\"")
  row(t, "a", "ii", "a", "regex: invalid flags \"ii\"")
  row(t, "a", "u", "a", "regex: invalid flags \"u\"")
  row(t, "A", "ims", "a", "0-1")

  // --- linear time -------------------------------------------------------------
  // Each of these is exponential in a backtracking engine: 30 bytes of input
  // would already take minutes there. Here each byte costs at most one step of
  // every instruction, so 20000 bytes finish in milliseconds.
  const as: string[] = []
  const xs: string[] = []
  let i: i32 = 0
  while (i < 20000) {
    as.push("a")
    xs.push("x")
    i += 1
  }
  const long = as.join("")
  t.ok("(a+)+$ on a's and a b", !compile("(a+)+$", "").test(`${long}b`))
  t.ok("(a|a)*c on a's", !compile("(a|a)*c", "").test(long))
  t.ok("(x+x+)+y on x's", !compile("(x+x+)+y", "").test(xs.join("")))
  t.eqI32("(a*)*b counts no matches", compile("(a*)*b", "").count(long), toI32(0))
  t.eqI32("a{1000} counts 20 matches", compile("a{1000}", "").count(long), toI32(20))
  t.eqStr("(a+)+ matches everything", compile("(a+)+", "").replace(long, "x"), "x")

  return t.done()
}
