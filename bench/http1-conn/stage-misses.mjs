// Cache misses per request per stage of the stages shape, from two callgrind
// profiles of one `-g` build: 0 timed requests and N, so the warm pass and
// setup cancel and the difference is N requests' worth.
//
//   node bench/http1-conn/stage-misses.mjs <0.cg> <N.cg> <N> <source root>
//
// The profiles must be written with --compress-strings=no --compress-pos=no.
// Every cost of the function holding the timed loop is given to a stage: a
// line of the loop itself goes to the stage whose stamps bracket it, and a
// line inlined from elsewhere (an IdlePool method, an Http1Connection method)
// to the stage its enclosing method belongs to. A call's inclusive cost goes
// with the line it is made from. The loop's three `next()` calls all reach
// IdlePool.next, inlined to the same lines, so callgrind cannot part parse
// from dispatch: the row `next (parse + dispatch)` is the two together.
// `settle` goes to recv, as main.ts's stage comment has it; the `settle`
// that `flush` makes is inlined to the same lines, so its cost lands in recv
// too. `other` is the rest: the bench's own drain and sums, the clock reads,
// and runtime C inlined where the line does not say whose it is. Run the
// stages-loop shape, so no calibration loop is counted in it.
import fs from "node:fs"
import path from "node:path"

const [zeroFile, fullFile, requestsArg, sourceRoot] = process.argv.slice(2)
const requests = Number(requestsArg)
if (!fullFile || !(requests > 0) || !sourceRoot) {
  console.error("usage: node stage-misses.mjs <0.cg> <N.cg> <N> <source root>")
  process.exit(2)
}

// Which stage an enclosing method's lines belong to; the loop's own lines
// go by stamp instead.
const methodStage = {
  readable: "recv",
  feed: "recv",
  inputRoom: "recv",
  next: "next",
  http1Next: "next",
  respond: "respond",
  sendBody: "sendBody",
  end: "sendBody",
  write: "sendBody",
  bodyRoom: "sendBody",
  flush: "park",
  settle: "recv",
  send: "park",
  park: "park",
  release: "park",
  isDone: "park",
}
// The stage between stamp tK and tK+1.
const stampStage = ["recv", "next", "next", "respond", "sendBody", "next", "park"]

// The method or function each line of a source file sits in.
const enclosing = new Map()
const methodsOf = (file) => {
  if (!enclosing.has(file)) {
    const names = []
    let current = ""
    const text = fs.statSync(file, { throwIfNoEntry: false })?.isFile()
      ? fs.readFileSync(file, "utf8").split("\n")
      : []
    const definition =
      /^\s*(?:export\s+)?(?:(?:const|let)\s+(\w+)\s*=.*=>|function\s+(\w+)|(?:(?:private|static|public)\s+)*(\w+)\s*\([^)]*\)\s*(?::\s*[^={]+)?\{\s*$)/
    for (const line of text) {
      const m = definition.exec(line)
      if (m && !["if", "while", "for", "switch"].includes(m[1] ?? m[2] ?? m[3])) {
        current = m[1] ?? m[2] ?? m[3]
      }
      names.push(current)
    }
    enclosing.set(file, names)
  }
  return enclosing.get(file)
}

// The bench's main.ts: the stamp lines and the timed loop's extent.
const benchFile = (file) => file.endsWith("main.ts") && !file.includes("std/")
let stamps = null
const stampsOf = (file) => {
  if (!stamps) {
    const text = fs.readFileSync(file, "utf8").split("\n")
    stamps = []
    text.forEach((line, i) => {
      const m = /const t(\d): i64 = monotonicNanos\(\)/.exec(line)
      if (m) {
        stamps[Number(m[1])] = i + 1
      }
    })
    if (stamps.length !== 8 || stamps.some((x) => x === undefined)) {
      throw new Error(`stage-misses: ${file} does not hold stamps t0..t7`)
    }
  }
  return stamps
}

// The debug info names a file as the compiler was given it, "./" first:
// "./std/net/x.ts" under the source root, ".//tmp/main.ts" absolute.
const resolve = (file) => {
  const bare = file.startsWith("./") ? file.slice(2) : file
  return path.isAbsolute(bare) ? bare : path.join(sourceRoot, bare)
}
const stageOf = (file, line) => {
  const full = resolve(file)
  if (benchFile(full)) {
    const s = stampsOf(full)
    if (line >= s[0] && line < s[7]) {
      let k = 0
      while (line >= s[k + 1]) {
        k += 1
      }
      return stampStage[k]
    }
  }
  const method = methodsOf(full)[line - 1] ?? ""
  return methodStage[method] ?? "other"
}

// Sums the costs of the function that calls IdlePool.readable, by stage.
const profile = (file) => {
  const lines = fs.readFileSync(file, "utf8").split("\n")
  const events = lines
    .find((l) => l.startsWith("events: "))
    .slice(8)
    .trim()
    .split(" ")
  // First pass: the function the timed loop lives in.
  let fn = ""
  let loopFn = ""
  for (const l of lines) {
    if (l.startsWith("fn=")) {
      fn = l.slice(3)
    } else if (l === "cfn=IdlePool.readable") {
      loopFn = fn
    }
  }
  if (!loopFn) {
    throw new Error(`stage-misses: nothing calls IdlePool.readable in ${file}`)
  }
  const stages = new Map()
  let source = ""
  fn = ""
  for (const l of lines) {
    if (l.startsWith("fn=")) {
      fn = l.slice(3)
      source = ""
    } else if (l.startsWith("fl=") || l.startsWith("fi=") || l.startsWith("fe=")) {
      source = l.slice(3)
    } else if (/^\d/.test(l)) {
      if (fn !== loopFn) {
        continue
      }
      const [line, ...costs] = l.split(" ").map(Number)
      const stage = stageOf(source, line)
      const sum = stages.get(stage) ?? new Array(events.length).fill(0)
      costs.forEach((c, i) => {
        sum[i] += c
      })
      stages.set(stage, sum)
    }
  }
  return { events, stages }
}

const zero = profile(zeroFile)
const full = profile(fullFile)
const shown = ["Ir", "D1mr", "D1mw", "DLmr", "DLmw"]
const order = ["recv", "next", "respond", "sendBody", "park", "other"]
const names = order.filter((name) => full.stages.has(name))
console.log(`| stage | ${shown.join(" | ")} |`)
console.log(`| --- |${shown.map(() => " ---: |").join("")}`)
const total = new Array(shown.length).fill(0)
for (const name of names) {
  const cells = shown.map((e, j) => {
    const i = full.events.indexOf(e)
    const v = ((full.stages.get(name)?.[i] ?? 0) - (zero.stages.get(name)?.[i] ?? 0)) / requests
    total[j] += v
    // A rounding residue of -0.004 prints as 0.00, not -0.00.
    return (Math.round(v * 100) / 100 || 0).toFixed(2)
  })
  const label = name === "next" ? "next (parse + dispatch)" : name
  console.log(`| ${label} | ${cells.join(" | ")} |`)
}
console.log(`| total | ${total.map((v) => v.toFixed(2)).join(" | ")} |`)
