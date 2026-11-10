// The native replay of examples/wasm-arena: the same sim.ts, compiled with
// `--deterministic`, steps the input a page recorded and prints the state's
// hash, which the page's own hash must equal bit for bit.
//
//     replay <seed> <ticks> [<count>x<word> ...]
//
// The input is run-length coded, because a held key is the same word for
// many ticks: `40x17` is the word 17 for 40 ticks. Ticks past the last run
// step with the word 0. It prints `ticks <n> hash <16 hex digits>`.
//
// smoke: args --deterministic
// smoke: argv 1 120 44x1 36x5 39x1
import { simHash, simReset, simStep, simTicks } from "./sim"

const hex = (h: u64): string => {
  const digits = "0123456789abcdef"
  const out: string[] = []
  for (let shift = 60; shift >= 0; shift = shift - 4) {
    const d: i32 = toI32(toU32((h >> toU64(shift)) & toU64(15)))
    out.push(digits.slice(d, d + 1))
  }
  return out.join("")
}

export const main = (): i32 => {
  const args = process.argv
  if (args.length < 3) {
    console.log("usage: replay <seed> <ticks> [<count>x<word> ...]")
    return 2
  }
  simReset(toU32(parseInt(args[1])))
  const ticks: i32 = parseInt(args[2])
  let stepped: i32 = 0
  for (let a = 3; a < args.length; a++) {
    const run = args[a]
    const x: i32 = toI32(run.indexOf("x"))
    if (x <= 0) {
      console.log(`replay: bad run ${run}`)
      return 2
    }
    const count: i32 = parseInt(run.slice(0, x))
    const word: i32 = parseInt(run.slice(x + 1))
    for (let k = 0; k < count && stepped < ticks; k++) {
      simStep(word)
      stepped++
    }
  }
  while (stepped < ticks) {
    simStep(0)
    stepped++
  }
  console.log(`ticks ${simTicks()} hash ${hex(simHash())}`)
  return 0
}
