// The yaml-test-suite's cases, read from tests/yaml-suite/cases.txt (its
// README has the format): a key, whether the case is an error, the YAML and
// the expected JSON stream, each `%XX` decoded.
import { splitLines } from "nish/text";

export const YC_CASES_PATH: string = "tests/yaml-suite/cases.txt";

/** One case: `json` is `null` when upstream has no expected JSON for it. */
export class YcCase {
  key: string;
  error: boolean;
  yaml: string;
  json: string | null;

  constructor(key: string, error: boolean, yaml: string, json: string | null) {
    this.key = key;
    this.error = error;
    this.yaml = yaml;
    this.json = json;
  }
}

/** The value of one upper-case hex digit, as `pack.js` writes them, or `-1`. */
const ycHexValue = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48;
  }
  if (c >= 65 && c <= 70) {
    return c - 65 + 10;
  }
  return -1;
};

/** One packed field's text, `%XX` decoded; `null` when an escape is malformed. */
const ycUnpack = (text: string): string | null => {
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
    const hi: i32 = ycHexValue(toI32(text.charCodeAt(i + 1)));
    const lo: i32 = ycHexValue(toI32(text.charCodeAt(i + 2)));
    if (hi < 0 || lo < 0) {
      return null;
    }
    out.push(toU8(hi * 16 + lo));
    i += 3;
  }
  return String.fromBytes(out, 0, toI32(out.length));
};

/** `line` split at each space, an empty field kept. */
const ycFields = (line: string): string[] => {
  const fields: string[] = [];
  let from: i32 = 0;
  for (let i: i32 = 0; i < toI32(line.length); i += 1) {
    if (toI32(line.charCodeAt(i)) === 32) {
      fields.push(line.slice(from, i));
      from = i + 1;
    }
  }
  fields.push(line.slice(from, toI32(line.length)));
  return fields;
};

/** Every case, in key order; empty when the file is missing or a record is malformed. */
export const ycLoadCases = (): YcCase[] => {
  const cases: YcCase[] = [];
  const text = readFileSyncOrNull(YC_CASES_PATH);
  if (text === null) {
    return cases;
  }
  for (const line of splitLines(text)) {
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const fields = ycFields(line);
    if (toI32(fields.length) !== 4) {
      return [];
    }
    const yaml = ycUnpack(fields[2]);
    const json: string | null = fields[3] === "-" ? null : ycUnpack(fields[3]);
    if (yaml === null || (fields[3] !== "-" && json === null)) {
      return [];
    }
    cases.push(new YcCase(fields[0], fields[1] === "1", yaml, json));
  }
  return cases;
};
