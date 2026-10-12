// JSONTestSuite's test_parsing/ corpus, as tests/json-suite/test-parsing.txt
// packs it, read back into one byte array per file.
import { splitLines } from "../../../std/text";

/** The packed corpus and the recorded verdicts of its `i_` files, from the repository root. */
export const JT_CORPUS_PATH: string = "tests/json-suite/test-parsing.txt";
export const JT_I_VERDICTS_PATH: string = "tests/json-suite/i-verdicts.txt";

/** One file of the corpus: its upstream name and its bytes. */
export class JtCase {
  name: string;
  bytes: u8[];

  constructor(name: string, bytes: u8[]) {
    this.name = name;
    this.bytes = bytes;
  }
}

/** The value of one upper-case hex digit, as `pack.js` writes them, or `-1`. */
const jtHexValue = (c: i32): i32 => {
  const zero: i32 = 48;
  const nine: i32 = 57;
  const upperA: i32 = 65;
  const upperF: i32 = 70;
  if (c >= zero && c <= nine) {
    return c - zero;
  }
  if (c >= upperA && c <= upperF) {
    return c - upperA + 10;
  }
  return -1;
};

/** One packed line's bytes, `%XX` decoded; `null` when an escape is malformed. */
const jtUnpack = (text: string): u8[] | null => {
  const percent: i32 = 37;
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  let i: i32 = 0;
  while (i < n) {
    const c: i32 = toI32(text.charCodeAt(i));
    if (c !== percent) {
      out.push(toU8(c));
      i += 1;
      continue;
    }
    if (i + 2 >= n) {
      return null;
    }
    const hi: i32 = jtHexValue(toI32(text.charCodeAt(i + 1)));
    const lo: i32 = jtHexValue(toI32(text.charCodeAt(i + 2)));
    if (hi < 0 || lo < 0) {
      return null;
    }
    out.push(toU8(hi * 16 + lo));
    i += 3;
  }
  return out;
};

/** Every file of the corpus, in name order; empty when the file is missing or a line is malformed. */
export const jtLoadCorpus = (): JtCase[] => {
  const cases: JtCase[] = [];
  const text = readFileSyncOrNull(JT_CORPUS_PATH);
  if (text === null) {
    return cases;
  }
  for (const line of splitLines(text)) {
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const space: i32 = toI32(line.indexOf(" "));
    if (space <= 0) {
      return [];
    }
    const bytes = jtUnpack(line.slice(space + 1));
    if (bytes === null) {
      return [];
    }
    cases.push(new JtCase(line.slice(0, space), bytes));
  }
  return cases;
};
