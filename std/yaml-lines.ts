/**
 * `nish/yaml-lines` — byte offsets turned into the `line:column` a person reads.
 *
 * Every range `nish/yaml` reports — a node's `start` and `end`, a diagnostic's
 * — is a byte offset into the text it parsed, because a byte offset is what a
 * program slices with and what costs nothing to keep. A message for a person
 * wants a line and a column instead, and this module turns one into the other:
 *
 *     import { YamlLineIndex } from "nish/yaml-lines"
 *
 *     const lines = new YamlLineIndex(text)
 *     lines.line(offset)     // 1-based
 *     lines.column(offset)   // 1-based, in characters
 *
 * The index scans the text once, with `indexOf`, to record where each line
 * starts; every lookup after that is a binary search. A line break is LF, CR
 * LF or a lone CR (YAML 1.2 §5.4, `b-break`), and CR LF is one break, not two,
 * so a Windows file has as many lines as a Unix one.
 *
 * An offset is clamped to `[0, text.length]` first, so a range's `end`, one
 * past its last byte, has a position too, and a slip below zero reads as the
 * start rather than panicking. `column` counts characters: every byte that is
 * not a UTF-8 continuation byte, so `é` is one column natively. `byteColumn`
 * counts bytes, which is what an editor that indexes lines by byte wants.
 * Under Node a string is UTF-16 and each unit counts, which is the same answer
 * for ASCII and the JavaScript answer otherwise.
 */

const YAML_LINES_LF: i32 = 10
/** A UTF-8 continuation byte is `10xxxxxx`: at least this and below `0xC0`. */
const YAML_LINES_CONTINUATION: i32 = 128
const YAML_LINES_LEAD: i32 = 192

/**
 * Where each line of one text starts, for turning byte offsets into lines and
 * columns. Do not change `text`: the line starts were worked out from it.
 */
export class YamlLineIndex {
  /** The text the index was built from. */
  text: string
  /** `starts[n]` is the byte at which line `n + 1` begins; line 1 begins at 0. */
  private starts: i32[]

  /**
   * Records where each line of `text` starts, in one scan.
   *
   * @param text The text the offsets index, such as the source `parseYaml` read.
   */
  constructor(text: string) {
    this.text = text
    this.starts = [0]
    const length: i32 = toI32(text.length)
    let nl: i32 = toI32(text.indexOf("\n"))
    let cr: i32 = toI32(text.indexOf("\r"))
    while (nl >= 0 || cr >= 0) {
      if (cr >= 0 && (nl < 0 || cr < nl)) {
        // CR LF is one break: step over both, and move the LF search past it.
        if (cr + 1 < length && toI32(text.charCodeAt(cr + 1)) === YAML_LINES_LF) {
          this.starts.push(cr + 2)
          nl = toI32(text.indexOf("\n", cr + 2))
        } else {
          this.starts.push(cr + 1)
        }
        cr = toI32(text.indexOf("\r", cr + 1))
      } else {
        this.starts.push(nl + 1)
        nl = toI32(text.indexOf("\n", nl + 1))
      }
    }
  }

  /**
   * How many lines the text has.
   *
   * @returns One more than its line breaks, so `""` has one and a text ending in a break has an empty last line.
   */
  lineCount(): i32 {
    return toI32(this.starts.length)
  }

  /**
   * Where a line begins.
   *
   * @param line The 1-based line; one outside the text clamps to the first or last line.
   * @returns The byte offset of the line's first byte.
   */
  lineStart(line: i32): i32 {
    const count: i32 = toI32(this.starts.length)
    let index: i32 = line - 1
    if (index >= count) {
      index = count - 1
    }
    if (index < 0) {
      index = 0
    }
    return index < count ? this.starts[index] : 0
  }

  /**
   * Which line an offset is on.
   *
   * @param offset A byte offset into the text; clamped to `[0, text.length]`.
   * @returns The 1-based line; a break belongs to the line it ends.
   */
  line(offset: i32): i32 {
    return this.lineIndexOf(this.clamp(offset)) + 1
  }

  /**
   * Where an offset is on its line, in characters.
   *
   * @param offset A byte offset into the text; clamped to `[0, text.length]`.
   * @returns The 1-based column: one more than the characters between the line's start and
   *   `offset`, a UTF-8 continuation byte not counting.
   */
  column(offset: i32): i32 {
    const at: i32 = this.clamp(offset)
    const index: i32 = this.lineIndexOf(at)
    const starts: i32[] = this.starts
    let i: i32 = index >= 0 && index < toI32(starts.length) ? starts[index] : 0
    const text: string = this.text
    const length: i32 = toI32(text.length)
    let column: i32 = 1
    while (i >= 0 && i < at && i < length) {
      const code: i32 = toI32(text.charCodeAt(i))
      if (code < YAML_LINES_CONTINUATION || code >= YAML_LINES_LEAD) {
        column += 1
      }
      i += 1
    }
    return column
  }

  /**
   * Where an offset is on its line, in bytes.
   *
   * @param offset A byte offset into the text; clamped to `[0, text.length]`.
   * @returns The 1-based column: one more than the bytes between the line's start and `offset`.
   */
  byteColumn(offset: i32): i32 {
    const at: i32 = this.clamp(offset)
    return at - this.lineStart(this.lineIndexOf(at) + 1) + 1
  }

  /** `offset` clamped to `[0, text.length]`. */
  private clamp(offset: i32): i32 {
    const length: i32 = toI32(this.text.length)
    if (offset < 0) {
      return 0
    }
    return offset > length ? length : offset
  }

  /** The 0-based line holding byte `at`, by binary search over `starts`. */
  private lineIndexOf(at: i32): i32 {
    const starts: i32[] = this.starts
    let low: i32 = 0
    let high: i32 = toI32(starts.length) - 1
    while (low < high) {
      const mid: i32 = (low + high + 1) >> 1
      const start: i32 = mid >= 0 && mid < toI32(starts.length) ? starts[mid] : 0
      if (start <= at) {
        low = mid
      } else {
        high = mid - 1
      }
    }
    return low
  }
}
