#!/usr/bin/env node
// Whether a change to bench/instructions.json raises a count it does not
// record. Every count above its base by more than the tolerance needs an entry
// in the head file's `raises` naming the row and both counts, with the reason
// and the pull request, beyond those the base file already carries; a fall, a
// count within the tolerance, a new row and a removed row pass, and the table
// lists them. A row the head keeps but whose count it drops fails, so a count
// cannot leave and come back as new. bench/README.md, "Raising a baseline".
//
//   node scripts/instruction-raises.mjs <base.json> <head.json>
//
// Prints a per-row base, head and change table to stdout, and appends it to
// $GITHUB_STEP_SUMMARY when that is set. Exits 0 when every raise is recorded,
// 1 when one is not, and 2 when a file cannot be read or its `tolerance`,
// `programs` or `raises` is malformed.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const isCount = (x) => Number.isSafeInteger(x) && x > 0

/**
 * The problems with a baseline file's `raises`: an array of
 * `{ row, from, to, why, pr }`, where `row` names a program, `from` and `to`
 * are counts with `to` above `from`, `why` is a reason and `pr` is the pull
 * request's number, or null until that pull request fills it in. A file
 * without `raises` reads as none, so a base from before the field still
 * compares.
 * @param {unknown} raises the file's `raises` field
 * @returns {string[]} one line per malformed entry; empty when all are well formed
 */
export const raisesProblems = (raises) => {
  if (raises === undefined) {
    return []
  }
  if (!Array.isArray(raises)) {
    return ["`raises` is not an array"]
  }
  const keys = ["row", "from", "to", "why", "pr"]
  const problems = []
  raises.forEach((e, i) => {
    const at = `raises[${i}]`
    if (e === null || typeof e !== "object" || Array.isArray(e)) {
      problems.push(`${at} is not an object`)
      return
    }
    const extra = Object.keys(e).filter((k) => !keys.includes(k))
    if (extra.length > 0) {
      problems.push(`${at} has unknown field(s) ${extra.join(", ")}`)
    }
    if (typeof e.row !== "string" || e.row === "") {
      problems.push(`${at}.row is not a program name`)
    }
    if (!isCount(e.from) || !isCount(e.to)) {
      problems.push(`${at}.from and .to are not both positive integer counts`)
    } else if (e.to <= e.from) {
      problems.push(`${at} records ${e.from} to ${e.to}, which is not a raise`)
    }
    if (typeof e.why !== "string" || e.why.trim() === "") {
      problems.push(`${at}.why gives no reason`)
    }
    if (e.pr !== null && !isCount(e.pr)) {
      problems.push(`${at}.pr is neither a pull request number nor null`)
    }
  })
  return problems
}

/**
 * The problems with a baseline file's `programs`: an object of program name to
 * an object whose `instructions`, when it has one, is a positive integer count.
 * A row without `instructions` has no stored count yet, which is how
 * bench/run.mjs takes a new program.
 * @param {unknown} programs the file's `programs` field
 * @returns {string[]} one line per malformed row; empty when all are well formed
 */
export const programsProblems = (programs) => {
  if (programs === null || typeof programs !== "object" || Array.isArray(programs)) {
    return ["`programs` is not an object"]
  }
  const problems = []
  for (const [name, p] of Object.entries(programs)) {
    if (p === null || typeof p !== "object" || Array.isArray(p)) {
      problems.push(`programs.${name} is not an object`)
    } else if ("instructions" in p && !isCount(p.instructions)) {
      problems.push(
        `programs.${name}.instructions is ${JSON.stringify(p.instructions)}, not a positive integer count`
      )
    }
  }
  return problems
}

/**
 * Compares two baseline files row by row.
 * @param {{tolerance: number, programs: Record<string, {instructions?: number}>}} base the file the change starts from
 * @param {{tolerance: number, programs: Record<string, {instructions?: number}>, raises?: object[]}} head the file the change leaves
 * @returns {{tolerance: number, widened: boolean, rows: {name: string, base?: number, head?: number, change?: number, status: string}[]}}
 *   each row's counts and status: `new`, `removed`, `dropped`, `raised`, `recorded`, `fell` or `ok`
 */
const compare = (base, head) => {
  // The smaller tolerance, so a change cannot widen its own band.
  const tolerance = Math.min(base.tolerance, head.tolerance)
  const entries = (raises, name, from, to) =>
    (raises ?? []).filter((e) => e.row === name && e.from === from && e.to === to).length
  // An entry the base already carries recorded an earlier raise, so a count
  // that fell back and rises to the same figure again needs one more.
  const recorded = (name, from, to) =>
    entries(head.raises, name, from, to) > entries(base.raises, name, from, to)
  const names = [
    ...Object.keys(head.programs),
    ...Object.keys(base.programs).filter((n) => !(n in head.programs)),
  ]
  const rows = names.map((name) => {
    const b = base.programs[name]?.instructions
    const h = head.programs[name]?.instructions
    if (h === undefined) {
      if (b === undefined) {
        return { name, status: "ok" }
      }
      // A row the head drops whole is removed; one it keeps without its count
      // would come back later as new, past this check.
      return { name, base: b, status: name in head.programs ? "dropped" : "removed" }
    }
    if (b === undefined) {
      return { name, head: h, status: "new" }
    }
    const change = (h - b) / b
    if (change > tolerance) {
      return { name, base: b, head: h, change, status: recorded(name, b, h) ? "recorded" : "raised" }
    }
    return { name, base: b, head: h, change, status: change < -tolerance ? "fell" : "ok" }
  })
  return { tolerance, widened: head.tolerance > base.tolerance, rows }
}

const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(3)}%`
const num = (x) => (x === undefined ? "-" : x.toLocaleString("en-US"))

/**
 * The comparison as a Markdown table and a closing line.
 * @param {ReturnType<typeof compare>} result what `compare` answered
 * @param {{tolerance: number}} base the base file, for its tolerance
 * @param {{tolerance: number}} head the head file, for its tolerance
 * @returns {string} the report, ending in a newline
 */
const report = ({ tolerance, widened, rows }, base, head) => {
  const lines = [
    "| program | base | head | change | status |",
    "| --- | ---: | ---: | ---: | --- |",
    ...rows.map(
      (r) =>
        `| ${r.name} | ${num(r.base)} | ${num(r.head)} | ${r.change === undefined ? "-" : pct(r.change)} | ${r.status} |`
    ),
    "",
  ]
  if (widened) {
    lines.push(
      `instruction-raises: the head widens the tolerance from ${pct(base.tolerance)} to ${pct(head.tolerance)}; this comparison holds it to ${pct(tolerance)}`
    )
  }
  const raised = rows.filter((r) => r.status === "raised")
  const dropped = rows.filter((r) => r.status === "dropped")
  if (raised.length > 0) {
    lines.push(
      `instruction-raises: ${raised.length} of ${rows.length} rose more than ${pct(tolerance)} with no \`raises\` entry: ${raised.map((r) => `${r.name} (${r.base} to ${r.head})`).join(", ")}`
    )
  }
  if (dropped.length > 0) {
    lines.push(
      `instruction-raises: ${dropped.length} of ${rows.length} keep their row with no count: ${dropped.map((r) => `${r.name} (was ${r.base})`).join(", ")}`
    )
  }
  if (raised.length === 0 && dropped.length === 0) {
    lines.push(
      `instruction-raises: no unrecorded raise in ${rows.length} row(s) at tolerance ${pct(tolerance)}`
    )
  }
  return `${lines.join("\n")}\n`
}

const main = (argv) => {
  if (argv.length !== 2) {
    console.error("usage: node scripts/instruction-raises.mjs <base.json> <head.json>")
    return 2
  }
  const files = []
  for (const file of argv) {
    let data
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"))
    } catch (e) {
      console.error(`instruction-raises: cannot read ${file}: ${e.message}`)
      return 2
    }
    if (data === null || typeof data !== "object" || !Number.isFinite(data.tolerance) || data.tolerance < 0) {
      console.error(`instruction-raises: ${file} has no \`tolerance\` that is a fraction of zero or more`)
      return 2
    }
    const problems = [...programsProblems(data.programs), ...raisesProblems(data.raises)]
    if (problems.length > 0) {
      console.error(`instruction-raises: ${file}: ${problems.join("; ")}`)
      return 2
    }
    files.push(data)
  }
  const result = compare(files[0], files[1])
  const text = report(result, files[0], files[1])
  process.stdout.write(text)
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Instruction counts against the base\n\n${text}`)
  }
  return result.rows.some((r) => r.status === "raised" || r.status === "dropped") ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
}
