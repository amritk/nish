// `nish/net/multipart`'s `MultipartReader`. Four groups of checks:
//
// - **Node's bodies.** Each form in `vectors.ts`, as Node's FormData wrote
//   it, read with the boundary `mediaTypeParse` finds in its Content-Type:
//   names and filenames with `"`, CR and LF escaped, values with their
//   newlines made CR LF, a file of all 256 octets, an empty file, a UTF-8
//   name.
// - **The framing**: a preamble and epilogue, transport padding, a
//   boundary-like run inside data, an empty part, data that opens with `--`,
//   and every prefix of a body, which answers no part whose data differs and
//   no close until the close delimiter is whole.
// - **Every code**, one body per rule.
// - **Every cap**, at its limit and one past it.
import { Suite } from "nish/testing";
import { httpFieldBytes, MediaType, mediaTypeParam, mediaTypeParse } from "nish/net/http-fields";
import {
  MULTIPART_END,
  MULTIPART_ERR_BOUNDARY,
  MULTIPART_ERR_DISPOSITION,
  MULTIPART_ERR_HEADER,
  MULTIPART_ERR_HEADERS,
  MULTIPART_ERR_PARTS,
  MULTIPART_ERR_UNTERMINATED,
  MULTIPART_ERR_WINDOW,
  MULTIPART_PART,
  MultipartLimits,
  MultipartReader,
} from "nish/net/multipart";
import { NodeVector, nodeVectors } from "./vectors";

const DIGITS: string = "0123456789abcdef";

/** The value of one hex digit, or 0 for any other character. */
const nibble = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48;
  }
  if (c >= 97 && c <= 102) {
    return c - 87;
  }
  return 0;
};

/** The octets a string of hex digits spells. */
const unhex = (s: string): u8[] => {
  const out: u8[] = [];
  let high: i32 = -1;
  for (let i: i32 = 0; i < toI32(s.length); i += 1) {
    if (high < 0) {
      high = nibble(s.charCodeAt(i));
    } else {
      out.push(toU8(((high & 15) << 4) | (nibble(s.charCodeAt(i)) & 15)));
      high = -1;
    }
  }
  return out;
};

/** `body[from .. from + length)` in hex. */
const hexOf = (body: u8[], from: i32, length: i32): string => {
  const parts: string[] = [];
  let left: i32 = length;
  for (let i: i32 = from; i >= 0 && left > 0 && i < toI32(body.length); i += 1) {
    const c: i32 = toI32(body[i]);
    parts.push(DIGITS.substring(c >> 4, (c >> 4) + 1) + DIGITS.substring(c & 15, (c & 15) + 1));
    left -= 1;
  }
  return parts.join("");
};

/** Every part a reader answers as `name|filename|type|hex`, then its last code. */
const readParts = (body: u8[], length: i32, boundary: string, limits: MultipartLimits): string[] => {
  const r: MultipartReader = new MultipartReader(body, length, boundary, limits);
  const out: string[] = [];
  let code: i32 = r.next();
  while (code === MULTIPART_PART) {
    const f: string | null = r.filename;
    out.push(`${r.name}|${f === null ? "(none)" : f}|${r.contentType}|${hexOf(body, r.dataStart, r.dataLength)}`);
    code = r.next();
  }
  out.push(`${code}`);
  return out;
};

/** `readParts`, a line each. */
const readAll = (body: u8[], length: i32, boundary: string, limits: MultipartLimits): string =>
  readParts(body, length, boundary, limits).join("\n");

/** `text` read with boundary `XyZ` and the default limits. */
const read = (text: string): string => {
  const b: u8[] = httpFieldBytes(text);
  return readAll(b, toI32(b.length), "XyZ", new MultipartLimits());
};

/** Only the last code `read` answers. */
const codeOf = (text: string): i32 => {
  const b: u8[] = httpFieldBytes(text);
  const r: MultipartReader = new MultipartReader(b, toI32(b.length), "XyZ", new MultipartLimits());
  let code: i32 = r.next();
  while (code === MULTIPART_PART) {
    code = r.next();
  }
  return code;
};

/** The code a reader answers for a body of one part, with `boundary`. */
const boundaryCode = (boundary: string): i32 => {
  const b: u8[] = httpFieldBytes(`--${boundary}\r\nContent-Disposition: form-data; name="a"\r\n\r\nx\r\n--${boundary}--`);
  const r: MultipartReader = new MultipartReader(b, toI32(b.length), boundary, new MultipartLimits());
  return r.next();
};

/** `n` copies of `s`. */
const repeat = (s: string, n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    parts.push(s);
  }
  return parts.join("");
};

/** A part's opening: a delimiter and its disposition, before any other header. */
const DISPOSITION: string = 'Content-Disposition: form-data; name="a"';

/** A body of one part `a` holding `x`, with `extra` header lines after its disposition. */
const withHeaders = (extra: string): string => `--XyZ\r\n${DISPOSITION}\r\n${extra}\r\nx\r\n--XyZ--`;

/** The last code of `body` read with `limits`. */
const limited = (body: string, limits: MultipartLimits): i32 => {
  const b: u8[] = httpFieldBytes(body);
  const r: MultipartReader = new MultipartReader(b, toI32(b.length), "XyZ", limits);
  let code: i32 = r.next();
  while (code === MULTIPART_PART) {
    code = r.next();
  }
  return code;
};

/** Every vector read with its own boundary; answers the first that differs, or "". */
const nodeChecks = (t: Suite): void => {
  const vs: NodeVector[] = nodeVectors();
  for (let i: i32 = 0; i < toI32(vs.length); i += 1) {
    if (i < 0 || i >= toI32(vs.length)) {
      return;
    }
    const v: NodeVector = vs[i];
    const type: u8[] = httpFieldBytes(v.contentType);
    const m: MediaType | null = mediaTypeParse(type, 0, toI32(type.length));
    const boundary: string | null = m === null ? null : mediaTypeParam(m, "boundary");
    if (boundary === null) {
      t.fail(`Node vector ${i}`, `no boundary in ${v.contentType}`);
    } else {
      const body: u8[] = unhex(v.body);
      const want: string = `${v.parts.join("\n")}\n${MULTIPART_END}`;
      t.eqStr(`Node vector ${i}, parts: ${v.parts.length}`, readAll(body, toI32(body.length), boundary, new MultipartLimits()), want);
    }
  }
};

/** Every prefix of a two-part body answers unterminated until its close delimiter is whole. */
const prefixChecks = (t: Suite): void => {
  const text: string = `--XyZ\r\n${DISPOSITION}\r\n\r\nfirst\r\n--XyZ\r\nContent-Disposition: form-data; name="b"\r\n\r\nsecond\r\n--XyZ--\r\n`;
  const body: u8[] = httpFieldBytes(text);
  const n: i32 = toI32(body.length);
  const whole: string[] = readParts(body, n, "XyZ", new MultipartLimits());
  const closeEnd: i32 = n - 2;
  let wrong: i32 = 0;
  let firstWrong: string = "";
  // The whole body is `whole`; each shorter prefix is read here.
  for (let len: i32 = 0; len < n; len += 1) {
    const got: string[] = readParts(body, len, "XyZ", new MultipartLimits());
    const want: string = len >= closeEnd ? `${MULTIPART_END}` : `${MULTIPART_ERR_UNTERMINATED}`;
    const last: i32 = toI32(got.length) - 1;
    let ok: boolean = last >= 0 && got[last] === want;
    for (let k: i32 = 0; k < last; k += 1) {
      ok = ok && k < toI32(got.length) && k < toI32(whole.length) && got[k] === whole[k];
    }
    if (!ok && wrong < n) {
      wrong += 1;
      if (firstWrong === "") {
        firstWrong = `length ${len}: ${got.join(" / ")}`;
      }
    }
  }
  t.eqStr(`every prefix of a ${n}-octet body answers only whole parts and closes only when whole`, firstWrong, "");
  t.eqI32("so no prefix answers otherwise", wrong, toI32(0));
};

export const main = (): i32 => {
  const t: Suite = new Suite("net_multipart_read");
  nodeChecks(t);

  // The framing.
  t.eqStr(
    "a preamble and an epilogue are skipped",
    read(`ignored\r\n--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZ--\r\nignored too`),
    `a|(none)|text/plain|78\n${MULTIPART_END}`,
  );
  t.eqStr(
    "a body that opens with CR LF before its first delimiter",
    read(`\r\n--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZ--`),
    `a|(none)|text/plain|78\n${MULTIPART_END}`,
  );
  t.eqStr(
    "transport padding after a delimiter",
    read(`--XyZ \t \r\n${DISPOSITION}\r\n\r\nx\r\n--XyZ\t\r\n${DISPOSITION}\r\n\r\ny\r\n--XyZ--`),
    `a|(none)|text/plain|78\na|(none)|text/plain|79\n${MULTIPART_END}`,
  );
  const run: u8[] = httpFieldBytes("x\r\n--XyZx\r\n--XyZ-y\r\n--XyZ --");
  t.eqStr(
    "a boundary-like run followed by another octet is data",
    read(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZx\r\n--XyZ-y\r\n--XyZ --\r\n--XyZ--`),
    `a|(none)|text/plain|${hexOf(run, 0, toI32(run.length))}\n${MULTIPART_END}`,
  );
  t.eqStr(
    "a delimiter followed by an LF alone is data",
    read(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZa\nb\r\n--XyZ--`),
    `a|(none)|text/plain|${hexOf(httpFieldBytes("x\r\n--XyZa\nb"), 0, 11)}\n${MULTIPART_END}`,
  );
  t.eqStr(
    "a part with no data",
    read(`--XyZ\r\n${DISPOSITION}\r\n\r\n\r\n--XyZ--`),
    `a|(none)|text/plain|\n${MULTIPART_END}`,
  );
  t.eqStr(
    "data that opens with the boundary is data, its CR LF taken by the empty line",
    read(`--XyZ\r\n${DISPOSITION}\r\n\r\n--XyZ--\r\n--XyZ--`),
    `a|(none)|text/plain|${hexOf(httpFieldBytes("--XyZ--"), 0, 7)}\n${MULTIPART_END}`,
  );
  t.eqStr(
    "CR LF at the end of data is kept, the one before the delimiter is not",
    read(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n\r\n--XyZ--`),
    `a|(none)|text/plain|780d0a\n${MULTIPART_END}`,
  );
  t.eqStr(
    "a filename, a content type and a header the reader does not know",
    read(`--XyZ\r\ncontent-disposition: form-data; name="f"; filename="C:\\a\\b.txt"\r\nX-Other: 1\r\nContent-Type: text/csv; charset=utf-8\r\n\r\n1,2\r\n--XyZ--`),
    `f|C:\\a\\b.txt|text/csv; charset=utf-8|312c32\n${MULTIPART_END}`,
  );
  const all: u8[] = httpFieldBytes(`--XyZ\r\n${DISPOSITION}\r\n\r\n`);
  for (let c: i32 = 0; c < 256; c += 1) {
    all.push(toU8(c));
  }
  const allEnd: u8[] = httpFieldBytes("\r\n--XyZ--");
  for (let i: i32 = 0; i < toI32(allEnd.length); i += 1) {
    all.push(allEnd[i]);
  }
  // The delimiter line's 7 octets, the disposition's 40 and two CR LFs.
  const allStart: i32 = 51;
  t.eqStr(
    "data holding every octet value",
    readAll(all, toI32(all.length), "XyZ", new MultipartLimits()),
    `a|(none)|text/plain|${hexOf(all, allStart, 256)}\n${MULTIPART_END}`,
  );
  const window: u8[] = httpFieldBytes(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZ--trailing`);
  t.eqStr(
    "a length short of the array reads only that much",
    readAll(window, toI32(window.length) - 8, "XyZ", new MultipartLimits()),
    `a|(none)|text/plain|78\n${MULTIPART_END}`,
  );
  prefixChecks(t);

  // Every code.
  const done: u8[] = httpFieldBytes(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZ--`);
  const r: MultipartReader = new MultipartReader(done, toI32(done.length), "XyZ", new MultipartLimits());
  t.eqI32("a part", r.next(), MULTIPART_PART);
  t.eqI32("then the end", r.next(), MULTIPART_END);
  t.eqI32("and the end again", r.next(), MULTIPART_END);
  t.eqI32("with no data span left", r.dataLength, toI32(0));

  t.eqI32("a boundary of 70 octets", boundaryCode(repeat("b", 70)), MULTIPART_PART);
  t.eqI32("a boundary of every bchar", boundaryCode("09azAZ'()+_,-./:=? x"), MULTIPART_PART);
  t.eqI32("refused: an empty boundary", boundaryCode(""), MULTIPART_ERR_BOUNDARY);
  t.eqI32("refused: a boundary of 71 octets", boundaryCode(repeat("b", 71)), MULTIPART_ERR_BOUNDARY);
  t.eqI32("refused: a boundary ending in a space", boundaryCode("ab "), MULTIPART_ERR_BOUNDARY);
  t.eqI32("refused: a boundary holding a quote", boundaryCode('a"b'), MULTIPART_ERR_BOUNDARY);
  t.eqI32("refused: a boundary holding a CR", boundaryCode("a\rb"), MULTIPART_ERR_BOUNDARY);
  t.eqI32("refused: a boundary holding an @", boundaryCode("a@b"), MULTIPART_ERR_BOUNDARY);

  t.eqI32(
    "refused: a length below 0",
    new MultipartReader(done, -1, "XyZ", new MultipartLimits()).next(),
    MULTIPART_ERR_WINDOW,
  );
  t.eqI32(
    "refused: a length past the array",
    new MultipartReader(done, 1000, "XyZ", new MultipartLimits()).next(),
    MULTIPART_ERR_WINDOW,
  );

  t.eqI32("refused unterminated: an empty body", codeOf(""), MULTIPART_ERR_UNTERMINATED);
  t.eqI32("refused unterminated: no delimiter", codeOf("just text"), MULTIPART_ERR_UNTERMINATED);
  t.eqI32("refused unterminated: a delimiter with no CR LF after it", codeOf("--XyZ"), MULTIPART_ERR_UNTERMINATED);
  t.eqI32("refused unterminated: header lines to the end", codeOf(`--XyZ\r\n${DISPOSITION}\r\n`), MULTIPART_ERR_UNTERMINATED);
  t.eqI32("refused unterminated: data to the end", codeOf(`--XyZ\r\n${DISPOSITION}\r\n\r\nx`), MULTIPART_ERR_UNTERMINATED);
  t.eqI32(
    "refused unterminated: no close delimiter",
    codeOf(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZ\r\n`),
    MULTIPART_ERR_UNTERMINATED,
  );
  t.eqI32("refused unterminated: a close delimiter with one dash", codeOf(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZ-`), MULTIPART_ERR_UNTERMINATED);

  t.eqI32("refused header: a line ended by LF alone", codeOf(`--XyZ\r\n${DISPOSITION}\n\n\r\nx\r\n--XyZ--`), MULTIPART_ERR_HEADER);
  t.eqI32("refused header: a line ended by CR alone", codeOf(`--XyZ\r\n${DISPOSITION}\rX\r\n\r\nx\r\n--XyZ--`), MULTIPART_ERR_HEADER);
  t.eqI32("refused header: a folded line", codeOf(withHeaders(" X: folded\r\n")), MULTIPART_ERR_HEADER);
  t.eqI32("refused header: a line with no colon", codeOf(withHeaders("no colon\r\n")), MULTIPART_ERR_HEADER);
  t.eqI32("refused header: a name with a space", codeOf(withHeaders("a b: c\r\n")), MULTIPART_ERR_HEADER);
  t.eqI32("refused header: an empty name", codeOf(withHeaders(": c\r\n")), MULTIPART_ERR_HEADER);
  t.eqI32("refused header: a NUL in a value", codeOf(withHeaders("X: a\x00b\r\n")), MULTIPART_ERR_HEADER);
  t.eqI32("refused header: a Content-Type twice", codeOf(withHeaders("Content-Type: a/b\r\ncontent-type: a/b\r\n")), MULTIPART_ERR_HEADER);
  t.eqI32("refused header: a Content-Type that is not a media type", codeOf(withHeaders("Content-Type: text\r\n")), MULTIPART_ERR_HEADER);
  t.eqI32("an empty value is a value", codeOf(withHeaders("X:\r\n")), MULTIPART_END);
  t.eqI32("whitespace around a value is trimmed", codeOf(withHeaders("Content-Type: \t a/b \t\r\n")), MULTIPART_END);

  t.eqI32("refused disposition: none", codeOf("--XyZ\r\nX: 1\r\n\r\nx\r\n--XyZ--"), MULTIPART_ERR_DISPOSITION);
  t.eqI32("refused disposition: no header lines", codeOf("--XyZ\r\n\r\nx\r\n--XyZ--"), MULTIPART_ERR_DISPOSITION);
  t.eqI32("refused disposition: two", codeOf(withHeaders(`${DISPOSITION}\r\n`)), MULTIPART_ERR_DISPOSITION);
  t.eqI32(
    "refused disposition: not form-data",
    codeOf('--XyZ\r\nContent-Disposition: attachment; name="a"\r\n\r\nx\r\n--XyZ--'),
    MULTIPART_ERR_DISPOSITION,
  );
  t.eqI32(
    "refused disposition: no name",
    codeOf('--XyZ\r\nContent-Disposition: form-data; filename="a"\r\n\r\nx\r\n--XyZ--'),
    MULTIPART_ERR_DISPOSITION,
  );
  t.eqI32(
    "refused disposition: one that does not parse",
    codeOf('--XyZ\r\nContent-Disposition: form-data; name="a\r\n\r\nx\r\n--XyZ--'),
    MULTIPART_ERR_DISPOSITION,
  );

  const refused: u8[] = httpFieldBytes(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZ\r\nX: 1\r\n\r\ny\r\n--XyZ--`);
  const sticky: MultipartReader = new MultipartReader(refused, toI32(refused.length), "XyZ", new MultipartLimits());
  t.eqI32("a part before a refused one", sticky.next(), MULTIPART_PART);
  t.eqI32("the refused one", sticky.next(), MULTIPART_ERR_DISPOSITION);
  t.eqI32("is refused from then on", sticky.next(), MULTIPART_ERR_DISPOSITION);
  t.ok("with no data span left", sticky.dataLength === 0 && sticky.dataStart === 0);

  // Every cap.
  const three: string = `--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n--XyZ\r\n${DISPOSITION}\r\n\r\ny\r\n--XyZ\r\n${DISPOSITION}\r\n\r\nz\r\n--XyZ--`;
  const parts3: MultipartLimits = new MultipartLimits();
  parts3.maxParts = 3;
  t.eqI32("three parts with maxParts 3", limited(three, parts3), MULTIPART_END);
  const parts2: MultipartLimits = new MultipartLimits();
  parts2.maxParts = 2;
  t.eqI32("refused: three parts with maxParts 2", limited(three, parts2), MULTIPART_ERR_PARTS);
  const parts0: MultipartLimits = new MultipartLimits();
  parts0.maxParts = 0;
  t.eqI32("refused: a part with maxParts 0", limited(three, parts0), MULTIPART_ERR_PARTS);
  t.eqI32("64 parts with the default limits", codeOf(`${repeat(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n`, 64)}--XyZ--`), MULTIPART_END);
  t.eqI32(
    "refused: 65 parts with the default limits",
    codeOf(`${repeat(`--XyZ\r\n${DISPOSITION}\r\n\r\nx\r\n`, 65)}--XyZ--`),
    MULTIPART_ERR_PARTS,
  );

  const lines3: string = withHeaders("A: 1\r\nB: 2\r\n");
  const headers3: MultipartLimits = new MultipartLimits();
  headers3.maxHeaders = 3;
  t.eqI32("three header lines with maxHeaders 3", limited(lines3, headers3), MULTIPART_END);
  const headers2: MultipartLimits = new MultipartLimits();
  headers2.maxHeaders = 2;
  t.eqI32("refused: three header lines with maxHeaders 2", limited(lines3, headers2), MULTIPART_ERR_HEADERS);
  t.eqI32("16 header lines with the default limits", codeOf(withHeaders(repeat("A: 1\r\n", 15))), MULTIPART_END);
  t.eqI32("refused: 17 header lines with the default limits", codeOf(withHeaders(repeat("A: 1\r\n", 16))), MULTIPART_ERR_HEADERS);

  // The disposition line is 40 octets and its CR LF two more.
  const bytes42: MultipartLimits = new MultipartLimits();
  bytes42.maxHeaderBytes = 42;
  t.eqI32("a 42-octet header line with maxHeaderBytes 42", limited(withHeaders(""), bytes42), MULTIPART_END);
  const bytes41: MultipartLimits = new MultipartLimits();
  bytes41.maxHeaderBytes = 41;
  t.eqI32("refused: a 42-octet header line with maxHeaderBytes 41", limited(withHeaders(""), bytes41), MULTIPART_ERR_HEADERS);
  const bytes39: MultipartLimits = new MultipartLimits();
  bytes39.maxHeaderBytes = 39;
  t.eqI32("refused: the line longer than the cap, before its end", limited(withHeaders(""), bytes39), MULTIPART_ERR_HEADERS);
  // 42 octets of disposition, then a line of 8,148 octets and its CR LF: 8,192.
  t.eqI32("8,192 octets of header lines with the default limits", codeOf(withHeaders(`X: ${repeat("v", 8145)}\r\n`)), MULTIPART_END);
  t.eqI32(
    "refused: 8,193 octets of header lines with the default limits",
    codeOf(withHeaders(`X: ${repeat("v", 8146)}\r\n`)),
    MULTIPART_ERR_HEADERS,
  );
  t.eqI32(
    "refused: a header line with no end, at the cap and not at the body's end",
    codeOf(`--XyZ\r\n${repeat("a", 20000)}`),
    MULTIPART_ERR_HEADERS,
  );
  return t.done();
};
