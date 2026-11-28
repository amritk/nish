#!/usr/bin/env node
// Whether a change to bench/instructions.json raises a count it does not
// record. Every count above its base by more than the tolerance needs an entry
// in the head file's `raises` naming the row and both counts, with the reason
// and the pull request; a fall, a count within the tolerance, a new row and a
// removed row pass, and the table lists them. bench/README.md, "Raising a
// baseline".
//
//   node scripts/instruction-raises.mjs <base.json> <head.json>
//
// Prints a per-row base, head and change table to stdout, and appends it to
// $GITHUB_STEP_SUMMARY when that is set. Exits 0 when every raise is recorded,
// 1 when one is not, and 2 when a file cannot be read or its `raises` is
// malformed.

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
 * Compares two baseline files row by row.
 * @param {{tolerance: number, programs: Record<string, {instructions?: number}>}} base the file the change starts from
 * @param {{tolerance: number, programs: Record<string, {instructions?: number}>, raises?: object[]}} head the file the change leaves
 * @returns {{tolerance: number, rows: {name: string, base?: number, head?: number, change?: number, status: string}[]}}
 *   each row's counts and status: `new`, `removed`, `raised`, `recorded`, `fell` or `ok`
 */
const compare = (base, head) => {
  // The smaller tolerance, so a change cannot widen its own band.
  const tolerance = Math.min(base.tolerance, head.tolerance)
  const recorded = (name, from, to) =>
    (head.raises ?? []).some((e) => e.row === name && e.from === from && e.to === to)
  const names = [
    ...Object.keys(head.programs),
    ...Object.keys(base.programs).filter((n) => !(n in head.programs)),
  ]
  const rows = names.map((name) => {
    const b = base.programs[name]?.instructions
    const h = head.programs[name]?.instructions
    if (h === undefined) {
      return { name, base: b, status: b === undefined ? "ok" : "removed" }
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
  return { tolerance, rows }
}

const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(3)}%`
const num = (x) => (x === undefined ? "-" : x.toLocaleString("en-US"))

/**
 * The comparison as a Markdown table and a closing line.
 * @param {ReturnType<typeof compare>} result what `compare` answered
 * @returns {string} the report, ending in a newline
 */
const report = ({ tolerance, rows }) => {
  const lines = [
    "| program | base | head | change | status |",
    "| --- | ---: | ---: | ---: | --- |",
    ...rows.map(
      (r) =>
        `| ${r.name} | ${num(r.base)} | ${num(r.head)} | ${r.change === undefined ? "-" : pct(r.change)} | ${r.status} |`
    ),
    "",
  ]
  const raised = rows.filter((r) => r.status === "raised")
  if (raised.length > 0) {
    lines.push(
      `instruction-raises: ${raised.length} of ${rows.length} rose more than ${pct(tolerance)} with no \`raises\` entry: ${raised.map((r) => `${r.name} (${r.base} to ${r.head})`).join(", ")}`
    )
  } else {
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
    if (typeof data?.tolerance !== "number" || typeof data.programs !== "object" || data.programs === null) {
      console.error(`instruction-raises: ${file} has no numeric \`tolerance\` and \`programs\` object`)
      return 2
    }
    const problems = raisesProblems(data.raises)
    if (problems.length > 0) {
      console.error(`instruction-raises: ${file}: ${problems.join("; ")}`)
      return 2
    }
    files.push(data)
  }
  const result = compare(files[0], files[1])
  const text = report(result)
  process.stdout.write(text)
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Instruction counts against the base\n\n${text}`)
  }
  return result.rows.some((r) => r.status === "raised") ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
}
