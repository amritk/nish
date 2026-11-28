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
 * Under Node a string is UTF-16 and `column` still skips every unit from
 * `0x80` to `0xBF`, so `©` or `µ` does not count: the column is exact for
 * ASCII everywhere and for any text only natively.
 */

const YAML_LINES_LF: i32 = 10
/** A UTF-8 continuation byte is `10xxxxxx`: at least this and below `0xC0`. */
const YAML_LINES_CONTINUATION: i32 = 128
const YAML_LINES_LEAD: i32 = 192
/** The largest column an `i32` holds; one past a line this long has none. */
const YAML_LINES_MAX_COLUMN: i32 = 2147483647

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
    // A search's answer is a break only from 0 to below `length`; anything
    // else is none left, and the scan stops when neither search has one.
    while (true) {
      if (cr >= 0 && cr < length && (nl < 0 || cr < nl)) {
        // CR LF is one break: step over both, and move the LF search past it.
        if (cr < length - 1 && toI32(text.charCodeAt(cr + 1)) === YAML_LINES_LF) {
          this.starts.push(cr + 2)
          nl = toI32(text.indexOf("\n", cr + 2))
        } else {
          this.starts.push(cr + 1)
        }
        cr = toI32(text.indexOf("\r", cr + 1))
      } else if (nl >= 0 && nl < length) {
        this.starts.push(nl + 1)
        nl = toI32(text.indexOf("\n", nl + 1))
      } else {
        break
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
    const starts: i32[] = this.starts
    const count: i32 = toI32(starts.length)
    if (line > count) {
      return count > 0 ? starts[count - 1] : 0
    }
    if (line > 1) {
      const at: i32 = line - 1
      if (at < count) {
        return starts[at]
      }
    }
    return 0
  }

  /**
   * Which line an offset is on.
   *
   * @param offset A byte offset into the text; clamped to `[0, text.length]`.
   * @returns The 1-based line; a break belongs to the line it ends.
   */
  line(offset: i32): i32 {
    return this.linesFrom(this.clamp(offset))
  }

  /**
   * Where an offset is on its line, in characters.
   *
   * @param offset A byte offset into the text; clamped to `[0, text.length]`.
   * @returns The 1-based column: one more than the characters between the line's start and
   *   `offset`, a UTF-8 continuation byte not counting (under Node, a UTF-16 unit from `0x80` to `0xBF`
   *   not counting either, so `©` is not a column); `-1` past a line of 2^31 - 1 characters, whose
   *   next column no `i32` holds.
   */
  column(offset: i32): i32 {
    const at: i32 = this.clamp(offset)
    const text: string = this.text
    const length: i32 = toI32(text.length)
    let i: i32 = this.lineStart(this.linesFrom(at))
    let column: i32 = 1
    while (i >= 0 && i < at && i < length) {
      const code: i32 = toI32(text.charCodeAt(i))
      if (code < YAML_LINES_CONTINUATION || code >= YAML_LINES_LEAD) {
        if (column >= YAML_LINES_MAX_COLUMN) {
          return -1
        }
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
   * @returns The 1-based column: one more than the bytes between the line's start and `offset`
   *   (under Node, UTF-16 units); `-1` past a line of 2^31 - 1 bytes, whose next column no `i32`
   *   holds.
   */
  byteColumn(offset: i32): i32 {
    const at: i32 = this.clamp(offset)
    const start: i32 = this.lineStart(this.linesFrom(at))
    if (start < 0 || start > at) {
      return -1
    }
    const span: i32 = at - start
    return span < YAML_LINES_MAX_COLUMN ? span + 1 : -1
  }

  /** `offset` clamped to `[0, text.length]`. */
  private clamp(offset: i32): i32 {
    const length: i32 = toI32(this.text.length)
    if (offset < 0) {
      return 0
    }
    return offset > length ? length : offset
  }

  /**
   * How many lines start at or before byte `at`, by binary search over
   * `starts`: the 1-based line holding `at`, since line 1 starts at 0.
   */
  private linesFrom(at: i32): i32 {
    const starts: i32[] = this.starts
    const count: i32 = toI32(starts.length)
    let low: i32 = 0
    let high: i32 = count
    while (low >= 0 && low < high && high <= count) {
      const mid: i32 = toI32((toI64(low) + toI64(high)) >> toI64(1))
      if (mid >= 0 && mid < count && starts[mid] <= at) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return low
  }
}
