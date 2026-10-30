// JSON-Schema-Test-Suite's draft 2020-12 format cases, read from
// tests/json-schema-suite-format/cases.txt (its README has the format): a key,
// whether the instance is valid, whether it is a string, the instance and the
// description, each `%XX` decoded.
import { splitLines } from "nish/text";

export const JFT_CASES_PATH: string = "tests/json-schema-suite-format/cases.txt";

/** One case; `format` is the key's part before the `/`. */
export class JftCase {
  key: string;
  format: string;
  valid: boolean;
  isString: boolean;
  data: string;
  description: string;

  constructor(key: string, format: string, valid: boolean, isString: boolean, data: string, description: string) {
    this.key = key;
    this.format = format;
    this.valid = valid;
    this.isString = isString;
    this.data = data;
    this.description = description;
  }
}

/** The value of one upper-case hex digit, as `pack.js` writes them, or `-1`. */
const jftHexValue = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48;
  }
  if (c >= 65 && c <= 70) {
    return c - 65 + 10;
  }
  return -1;
};

/** One packed field's text, `%XX` decoded; `null` when an escape is malformed. */
const jftUnpack = (text: string): string | null => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  let i: i32 = 0;
  while (i < n) {
    const c: i32 = toI32(text.charCodeAt(i));
    if (c !== 37) {
      out.push(toU8(c));
      i += 1;
      continue;
    }
    if (i + 2 >= n) {
      return null;
    }
    const hi: i32 = jftHexValue(toI32(text.charCodeAt(i + 1)));
    const lo: i32 = jftHexValue(toI32(text.charCodeAt(i + 2)));
    if (hi < 0 || lo < 0) {
      return null;
    }
    out.push(toU8(hi * 16 + lo));
    i += 3;
  }
  return String.fromBytes(out, 0, toI32(out.length));
};

/** `line` split at each space. */
const jftFields = (line: string): string[] => {
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
export const jftLoadCases = (): JftCase[] => {
  const cases: JftCase[] = [];
  const text = readFileSyncOrNull(JFT_CASES_PATH);
  if (text === null) {
    return cases;
  }
  for (const line of splitLines(text)) {
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const fields = jftFields(line);
    if (toI32(fields.length) !== 5) {
      return [];
    }
    const data = jftUnpack(fields[3]);
    const description = jftUnpack(fields[4]);
    const slash: i32 = toI32(fields[0].indexOf("/"));
    if (data === null || description === null || slash < 0) {
      return [];
    }
    cases.push(
      new JftCase(fields[0], fields[0].slice(0, slash), fields[1] === "1", fields[2] === "s", data, description),
    );
  }
  return cases;
};
