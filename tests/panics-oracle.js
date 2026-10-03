// The IR oracle for `--emit-panics` (docs/LANGUAGE.md, "Panic sites").
//
// The site list and the IR are two readings of one program, and the claim the
// list makes that the IR can check is one-directional: a function whose list
// holds no site that can panic — every check proven, nothing but `oom` left —
// has no panic path in its IR either. The other direction is not a property:
// a site the list keeps may still have no check in the IR, because
// `--unchecked-indexing` drops a check without proving it, and the attribute
// pass the list is recorded beside is allowed to say more than the emitter
// does, never less.
//
// A panic path is one of three shapes in unoptimised IR:
//
//   - a call to `nish_panic_index`, `nish_panic_slice` or `nish_panic_div`;
//   - the panic tail (`emitPanicTail`): the message on fd 2 with a newline,
//     then `nish_exit(1)` on the next line. `console.error(s)` followed by a
//     literal `process.exit(1)` is the same two lines and would be read as
//     one, which is the conservative reading;
//   - a call to a runtime function that exits on failure: `nish_read_file`,
//     `nish_write_file`, `nish_append_file`, `nish_random_fill`.

const PANIC_CALL = /call void @nish_panic_(?:index|slice|div)\(/
const EXITING_CALL = /@nish_(?:read_file|write_file|append_file|random_fill)\(/
const TAIL_WRITE = /call void @nish_write\(i8\* [^,]+, i32 2, i1 true\)/
const TAIL_EXIT = /^\s*call void @nish_exit\(i32 1\)/

/** The lines of `@symbol`'s definition in `ir`, from `define` to its closing brace, or null. */
const definitionOf = (lines, symbol) => {
  const plain = `@${symbol}(`
  const quoted = `@"${symbol}"(`
  const start = lines.findIndex(
    (line) => line.startsWith("define ") && (line.includes(plain) || line.includes(quoted))
  )
  if (start < 0) {
    return null
  }
  const end = lines.indexOf("}", start)
  return lines.slice(start, end < 0 ? lines.length : end)
}

/** The first line of `body` that is a panic path, or null. */
const panicPath = (body) => {
  for (let i = 0; i < body.length; i++) {
    const line = body[i]
    if (PANIC_CALL.test(line) || EXITING_CALL.test(line)) {
      return line.trim()
    }
    if (TAIL_WRITE.test(line) && i + 1 < body.length && TAIL_EXIT.test(body[i + 1])) {
      return `${line.trim()} / ${body[i + 1].trim()}`
    }
  }
  return null
}

/** Whether `site` can stop the program by itself or through its callee. */
const canPanic = (site) => site.kind !== "oom" && site.proven !== true

/**
 * Hold `report` (a parsed `--emit-panics` file) against the IR text `ir`.
 * Answers `{ checked, failures }`: how many functions with nothing left that
 * can panic were found in this IR and read, and one line per such function
 * whose IR has a panic path anyway. A function not defined in `ir` — one of
 * another module's — is the other module's to answer for.
 */
export const panicOracle = (ir, report) => {
  const lines = ir.split("\n")
  const failures = []
  let checked = 0
  for (const fn of report.functions) {
    if (fn.panics.some(canPanic)) {
      continue
    }
    const body = definitionOf(lines, fn.symbol)
    if (body === null) {
      continue
    }
    checked++
    const found = panicPath(body)
    if (found !== null) {
      failures.push(`${fn.name} (@${fn.symbol}) lists nothing that can panic, and its IR has: ${found}`)
    }
  }
  return { checked, failures }
}
