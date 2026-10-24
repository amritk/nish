// What `nish/term-io` found out about this terminal, and how its frame loop
// settled: attach the output to a bug report about a terminal that draws
// wrong. It opens the terminal, presents a moving picture for five seconds,
// closes it, and prints every `TermCaps` field and one stats line per second.
//   nish run examples/term-probe.ts
import { monotonicNanos } from "nish:process"
import { TermCaps } from "nish/term-probe"
import { Frame, TermInput, defaultTerminalOptions, runTerminal } from "nish/term-io"

/** The name of a `GRAPHICS_*` backend. */
const backendName = (backend: i32): string => ["ascii", "halfblock", "sixel", "kitty"][backend]

/** `x` to two decimal places. */
const round2 = (x: f64): f64 => Math.round(x * 100.0) / 100.0

/** What the run keeps: the terminal's capabilities and a stats line a second. */
class Probe {
  start: i64 = 0
  second: i32 = 1
  frames: i32 = 0
  caps: TermCaps | null = null
  lines: string[]

  constructor() {
    this.lines = []
  }
}

/** Run until the fifth stats line is kept. */
const update = (p: Probe, input: TermInput): boolean => p.second <= 5

/** A band that moves, and a stats line once each second has passed. */
const render = (p: Probe, frame: Frame): void => {
  p.caps = frame.caps
  p.frames = p.frames + 1
  const fb = frame.framebuffer
  fb.fill(0x203040)
  const x0: i32 = (p.frames * 3) % (fb.width - 20)
  for (let y: i32 = fb.height / 3; y < (fb.height * 2) / 3; y++) {
    for (let x: i32 = x0; x < x0 + 20; x++) {
      fb.set(x, y, 0xffcc00)
    }
  }
  if (monotonicNanos() - p.start >= toI64(p.second) * 1000000000) {
    const s = frame.stats
    p.lines.push(
      `${p.second}s frames ${p.frames} tier ${s.tier} backend ${backendName(s.backend)} rtt ${round2(s.rttMs)}ms ` +
        `${Math.round(s.bytesPerSec)}B/s cost ${round2(s.frameCostMs)}ms dropped ${s.dropped} unacked ${s.unacked} lost ${s.lost}`
    )
    p.second = p.second + 1
  }
}

export const main = (): i32 => {
  const options = defaultTerminalOptions()
  options.framebufferWidth = 320
  options.framebufferHeight = 180
  const p = new Probe()
  p.start = monotonicNanos()
  const ran = runTerminal(options, p, update, render)
  if (ran.isErr()) {
    writeError(`${ran.error}\n`)
    return 1
  }
  const c = p.caps
  if (c === null) {
    return 0
  }
  console.log(`name ${c.name}`)
  console.log(`answered ${c.answered}`)
  console.log(`probeRttMs ${c.probeRttMs}`)
  console.log(`graphics ${c.graphics}`)
  console.log(`colors ${c.colors}`)
  console.log(`trueColor ${c.trueColor}`)
  console.log(`sync ${c.sync}`)
  console.log(`kittyKeyboard ${c.kittyKeyboard}`)
  console.log(`kittyGraphics ${c.kittyGraphics}`)
  console.log(`sixel ${c.sixel}`)
  console.log(`sixelRegisters ${c.sixelRegisters}`)
  console.log(`cellWidthPx ${c.cellWidthPx}`)
  console.log(`cellHeightPx ${c.cellHeightPx}`)
  console.log(`pixelMouse ${c.pixelMouse}`)
  console.log(`multiplexer ${c.multiplexer}`)
  console.log(`linuxConsole ${c.linuxConsole}`)
  console.log(`remoteHint ${c.remoteHint}`)
  console.log(`overrides ${c.overrides}`)
  for (const line of p.lines) {
    console.log(line)
  }
  return 0
}
