// `src/lexer.ts` over one file, many times: the measurement WP38 S4 was
// declined on (docs/wp38-simd.md §7).
//
//   npm run build
//   build/nish bench/lexer.ts -o build/bench/lexer/ --link build/bench/lexer/app
//   cat src/*.ts > build/bench/lexer/src.ts
//   build/bench/lexer/app build/bench/lexer/src.ts
//
// Each pass lexes the file with the pass number appended as a trailing line
// comment, so every pass reads a different text and the optimiser cannot lex
// it once for all of them. That text is built before the pass's clock starts.
// Every token's kind, start and end is folded into one checksum, which the
// program prints: two builds of the lexer that print different checksums did
// not produce the same token stream, and their times are not comparable.
//
// The checksum is FNV-1a over a `u32`, which wraps rather than being checked:
// a fold that could panic on overflow, or that paid for a `%` per token, would
// add its own cost to every token it is there to observe. The token count is
// printed too, and a lexical error stops the program with exit 1, so that a
// pass cut short by an error is never timed as if it had read the whole file.
import { monotonicNanos } from "nish:process"
import { Lexer } from "../src/lexer"
import { TOK_END, TOK_ERROR } from "../src/tokens"

const PASSES: i32 = 25

/**
 * What one pass saw: the running checksum, the tokens before `TOK_END`, and
 * the first error, which is empty when the pass reached the end.
 */
class Tally {
  sum: u32 = 0
  tokens: i32 = 0
  error: string = ""
  constructor(sum: u32) {
    this.sum = sum
  }
}

/**
 * Lex `text` to its end, or to its first error, folding every token into
 * `tally.sum`. The lexer's own fields are read after each `next()`, as the
 * parser reads them, so the work timed is the work the compiler does.
 */
const lexPass = (text: string, tally: Tally): void => {
  const lexer = new Lexer(text)
  let folded: u32 = tally.sum
  let tokens: i32 = 0
  while (true) {
    lexer.next()
    folded = (folded ^ toU32(lexer.kind)) * 16777619
    folded = (folded ^ toU32(lexer.start)) * 16777619
    folded = (folded ^ toU32(lexer.end)) * 16777619
    if (lexer.kind === TOK_END) {
      break
    }
    if (lexer.kind === TOK_ERROR) {
      tally.error = `${lexer.start}: ${lexer.value}`
      break
    }
    tokens += 1
  }
  tally.sum = folded
  tally.tokens = tokens
}

/** Sort `times` ascending in place: an insertion sort, as there are only `PASSES` of them. */
const sortTimes = (times: f64[]): void => {
  let i: i32 = 1
  while (i < times.length) {
    const time = times[i]
    let j: i32 = i - 1
    while (j >= 0 && times[j] > time) {
      times[j + 1] = times[j]
      j -= 1
    }
    times[j + 1] = time
    i += 1
  }
}

export const main = (): number => {
  if (process.argv.length < 2) {
    console.error("usage: lexer <file.ts>")
    return 2
  }
  const path = process.argv[1]
  const source = readFileSyncOrNull(path)
  if (source === null) {
    console.error(`lexer: cannot read ${path}`)
    console.error("usage: lexer <file.ts>")
    return 2
  }

  const times: f64[] = []
  const tally = new Tally(2166136261)
  let pass: i32 = 0
  while (pass < PASSES) {
    const text = `${source}// ${pass}\n`
    const start = monotonicNanos()
    lexPass(text, tally)
    times.push(toF64(monotonicNanos() - start) / 1000000.0)
    if (tally.error !== "") {
      console.error(`lexer: lexical error in pass ${pass} at byte ${tally.error}`)
      return 1
    }
    pass += 1
  }

  sortTimes(times)
  const min: f64 = times[0]
  const median: f64 = times[PASSES / 2]
  const megabytes: f64 = toF64(source.length) / 1000000.0
  console.log(`checksum: ${tally.sum}`)
  console.log(`bytes:    ${source.length}, ${PASSES} passes`)
  console.log(`tokens:   ${tally.tokens} per pass`)
  console.log(`min:      ${min} ms, ${megabytes / (min / 1000.0)} MB/s`)
  console.log(`median:   ${median} ms`)
  return 0
}
