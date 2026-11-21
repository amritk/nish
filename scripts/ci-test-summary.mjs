#!/usr/bin/env node
/**
 * Copy a shard's results out of the Test step's log and into the job's step
 * summary, so they can still be read when the console log is not.
 *
 *   node scripts/ci-test-summary.mjs <test.log> <test.status>
 *
 * `<test.log>` is the file the `test` job's Test step tees `npm test` into, and
 * `<test.status>` the line that step writes after it: `npm=<n> tee=<n>`, the
 * exit status of each side of the pipe. The summary is appended to the file
 * `$GITHUB_STEP_SUMMARY` names, or printed when it names none (a local run).
 *
 * Why this exists (#1836). The stored console log of shard 8 sometimes stopped
 * partway through the `tests/link` programs and went straight to "Post job
 * cleanup", in a job that was green: no FAIL line and no `N passed, M failed`
 * summary to read, in the page or in the downloaded log. `test.log` on the
 * runner was whole each time, because the step that greps it passed. The step
 * summary is a file the runner uploads on its own, so it keeps what the console
 * dropped:
 *
 * - the summary line and the `Note:` or `DEGRADED:` paragraph after it,
 * - every FAIL line with the indented detail under it, and every SKIP line,
 * - the last lines of the log when it has no summary line at all (a crash, a
 *   timeout, a cancelled run),
 * - and the two exit statuses. `tee` runs with `--output-error=warn`, so a
 *   broken console pipe is `tee=1` here rather than a silent stop. A cut log
 *   with `tee=0` means the runner lost lines it had already been given.
 *
 * It reports and never gates: the Test step's own status is the result, and
 * this exits 0 whatever the log says, so a missing log (an earlier step failed
 * and the Test step never ran) adds a line to the summary and nothing else.
 */
import fs from "node:fs"

/** The `5995 passed, 0 failed, 2 skipped, 61 delegated.` line `summarise()` prints. */
const SUMMARY = /^\d+ passed, \d+ failed(?:, \d+ skipped)?(?:, \d+ delegated)?\.$/

/**
 * The detail lines kept under one FAIL line. A failure can print a whole
 * compiler dump, and the step summary holds 1 MiB at most, so a long one is
 * cut here and the rest stays in the console log and the shard's own rerun.
 */
const DETAIL_LINES = 60

/** The lines of the log's end kept when it has no summary line. */
const TAIL_LINES = 40

/** The step summary's limit is 1 MiB; this leaves room for the rest of the job. */
const MAX_BYTES = 512 * 1024

/**
 * A Markdown code block of `lines`, fenced with more backticks than any run of
 * them inside, so a line of the log can never close the block early.
 */
const block = (lines) => {
  const longest = Math.max(
    0,
    ...lines.map((l) => Math.max(0, ...(l.match(/`+/g) ?? []).map((r) => r.length)))
  )
  const fence = "`".repeat(Math.max(3, longest + 1))
  return `${fence}text\n${lines.join("\n")}\n${fence}\n`
}

/**
 * The FAIL lines of `lines`, each with the six-space-indented detail
 * `check()` prints under it, cut at `DETAIL_LINES`.
 */
const failures = (lines) => {
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("FAIL  ")) {
      continue
    }
    out.push(lines[i])
    let kept = 0
    let j = i + 1
    for (; j < lines.length && lines[j].startsWith("      "); j++) {
      if (kept < DETAIL_LINES) {
        out.push(lines[j])
        kept++
      }
    }
    if (j - i - 1 > kept) {
      out.push(`      ... ${j - i - 1 - kept} more line(s) of detail in the console log`)
    }
    i = j - 1
  }
  return out
}

/**
 * The `Note:` or `DEGRADED:` paragraph `summarise()` prints after the summary
 * line, which says why sections were skipped. The delegation list beside it is
 * left out: it is the same in every run and long.
 */
const skipNote = (lines, at) => {
  const start = lines.findIndex((l, i) => i > at && /^(?:Note|DEGRADED): /.test(l))
  if (start < 0) {
    return []
  }
  const end = lines.findIndex((l, i) => i > start && l === "")
  return lines.slice(start, end < 0 ? lines.length : end)
}

/** The step summary's Markdown for the log at `logPath` and the status line at `statusPath`. */
const render = (logPath, statusPath) => {
  const shard = process.env.SHARD ? `shard ${process.env.SHARD}/9` : "this run"
  const status = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, "utf8").trim() : ""
  const parts = [`### Test results, ${shard}\n`]
  parts.push(
    status === ""
      ? "Exit statuses: not recorded (the Test step did not finish).\n"
      : `Exit statuses: \`${status}\`` +
          (/\btee=0\b/.test(status)
            ? ""
            : ". tee could not write all of its output: read the results here.") +
          "\n"
  )
  if (!fs.existsSync(logPath)) {
    parts.push("No test log: the Test step did not run.\n")
    return parts.join("\n")
  }
  const lines = fs.readFileSync(logPath, "utf8").replace(/\r/g, "").split("\n")
  const at = lines.findLastIndex((l) => SUMMARY.test(l))
  if (at < 0) {
    parts.push(`The log has no summary line. Its last ${TAIL_LINES} lines:\n`)
    parts.push(block(lines.slice(-TAIL_LINES - 1).filter((l, i, all) => i < all.length - 1 || l !== "")))
  } else {
    const note = skipNote(lines, at)
    parts.push(block(note.length > 0 ? [lines[at], "", ...note] : [lines[at]]))
  }
  const failed = failures(lines)
  const skipped = lines.filter((l) => l.startsWith("SKIP  "))
  if (failed.length > 0) {
    parts.push(`#### ${failed.filter((l) => l.startsWith("FAIL  ")).length} FAIL line(s)\n`)
    parts.push(block(failed))
  }
  if (skipped.length > 0) {
    parts.push(`#### ${skipped.length} SKIP line(s)\n`)
    parts.push(block(skipped))
  }
  return parts.join("\n")
}

const [logArg, statusArg] = process.argv.slice(2)
if (!logArg || !statusArg) {
  console.error("usage: node scripts/ci-test-summary.mjs <test.log> <test.status>")
  process.exit(2)
}
let text = render(logArg, statusArg)
if (Buffer.byteLength(text) > MAX_BYTES) {
  // Cut on a line, then close whatever block was open: an unclosed fence
  // would swallow every summary the job's later steps write.
  text = `${Buffer.from(text)
    .subarray(0, MAX_BYTES)
    .toString("utf8")
    .replace(/\n[^\n]*$/, "")}\n`
  const fences = text.match(/^`{3,}(?:text)?$/gm) ?? []
  if (fences.length % 2 === 1) {
    text += `${fences.at(-1).replace("text", "")}\n`
  }
  text += "\n(cut at 512 KiB: the rest is in the console log)\n"
}
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
} else {
  process.stdout.write(text)
}
