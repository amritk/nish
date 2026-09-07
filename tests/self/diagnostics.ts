// The driver for `self/diagnostics.ts` (docs/wp14-selfhost.md, milestone S3),
// against `src/diagnostics.ts` through `tests/self/diagnostics_oracle.js`.
//
// What has to agree is not "an error is reported" but every byte of the text:
// the summary line the `.err` goldens match on, the source excerpt with its
// caret and its tab-mirrored padding, the order a phase's errors come out in,
// the `...and N more errors` cut, and the `--json` object. The spans are
// generated from the fixture by a rule both sides repeat, so the two cannot
// drift onto different positions, and they deliberately include the awkward
// ones: an empty span, a span at end of file, and a span that runs past the
// end of its line, which is where the caret has to stop.

import { DiagnosticSink, MAX_REPORTED_ERRORS, SourceFile } from "../../self/diagnostics";

/**
 * The spans the oracle repeats: every 13th byte, nine bytes long and clamped
 * to the end of the file. Coprime with the line lengths, so the sample walks
 * across line boundaries, tabs and the long line rather than lining up with
 * them.
 */
function spanStarts(length: i32): i32[] {
  const starts: i32[] = [];
  let i = 0;
  while (i < length) {
    starts.push(i);
    i = i + 13;
  }
  return starts;
}

export function main(): number {
  if (process.argv.length < 3) {
    console.error("usage: diagnostics <fixture> <second>");
    return 2;
  }
  const firstText = readFileSyncOrNull(process.argv[1]);
  const secondText = readFileSyncOrNull(process.argv[2]);
  if (firstText === null || secondText === null) {
    console.error("diagnostics: cannot read the fixtures");
    return 1;
  }
  const first = new SourceFile(process.argv[1], firstText);
  const second = new SourceFile(process.argv[2], secondText);
  const out: string[] = [];

  // The line index itself, over every offset: one wrong line start moves
  // every diagnostic after it.
  let offset = 0;
  while (offset <= first.text.length) {
    out.push(`pos ${offset} ${first.lineOf(offset)} ${first.columnOf(offset)}`);
    offset = offset + 1;
  }
  let line = 0;
  while (line < first.starts.length) {
    out.push(`line ${line} ${first.lineText(line)}`);
    line = line + 1;
  }

  // One diagnostic per generated span, reported out of order so the sort has
  // something to do: the second file first, then the first file backwards.
  const sink = new DiagnosticSink();
  const starts = spanStarts(first.text.length);
  for (const start of spanStarts(second.text.length)) {
    sink.report(second, start, start + 9, `second at ${start}`);
  }
  let i = starts.length - 1;
  while (i >= 0) {
    const start = starts[i];
    sink.report(first, start, start + 9, `error at ${start}`);
    i = i - 1;
  }
  // The awkward spans: empty, at end of file, and one that outruns its line.
  sink.report(first, 0, 0, "empty span");
  sink.report(first, first.text.length, first.text.length, "at end of file");
  sink.report(first, 5, first.text.length, "runs past the end of the line");
  sink.reportKind(first, 1, 3, "syntax error", "a syntax error keeps its kind");

  out.push(`count ${sink.count()} errors ${sink.hasErrors() ? 1 : 0}`);
  for (const diagnostic of sink.sorted()) {
    out.push(diagnostic.message());
    out.push(diagnostic.json());
  }
  out.push("---- report ----");
  out.push(sink.format(MAX_REPORTED_ERRORS));
  out.push("---- report of 3 ----");
  out.push(sink.format(3));

  // A single error prints exactly its message, with no count line.
  const lone = new DiagnosticSink();
  lone.report(first, 60, 66, "the only error");
  out.push("---- lone ----");
  out.push(lone.format(MAX_REPORTED_ERRORS));
  out.push(`empty ${new DiagnosticSink().hasErrors() ? 1 : 0}`);

  write(`${out.join("\n")}\n`);
  return 0;
}
