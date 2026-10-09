// `jsonFields` from `nish/json`: three fields of a compiler `--json` line in
// one scan of it. Slot `k` is what `jsonField(line, names[k])` would answer, so
// an absent field is `null` in its slot and the others still answer.
import { jsonFields } from "nish/json"

export const summary = (line: string): string => {
  const fields = jsonFields(line, ["code", "line", "message"])
  if (toI32(fields.length) !== 3) {
    return ""
  }
  const code = fields[0]
  const at = fields[1]
  const message = fields[2]
  if (code === null || at === null || message === null) {
    return "not a diagnostic"
  }
  return `${code} at line ${at}: ${message}`
}
