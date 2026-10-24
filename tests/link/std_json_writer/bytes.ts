// `stringBytes` and `keyBytes`: a string or a key written from a window of a
// byte array. Each is held to `string` and `key` on a string of the same
// bytes, byte for byte, over every byte value, non-ASCII text and both
// indented modes; each refuses a window outside its array before writing
// anything; and neither allocates. tests/link/std_json_value holds the two to
// each other on every string of JSONTestSuite's y_ files too.
import {
  JSON_WRITE_BAD_WINDOW,
  JSON_WRITE_DONE,
  JSON_WRITE_FULL,
  JSON_WRITE_KEY_EXPECTED,
  JSON_WRITE_OK,
  JSON_WRITE_VALUE_EXPECTED,
  JsonWriter,
} from "nish/json";
import { Suite } from "nish/testing";
import { jvBytes, jvHex } from "../std_json_value/common";

/** What `w` wrote, or `failed <code> after <written>`; then `w` starts over on `out`. */
const took = (w: JsonWriter, out: u8[]): string => {
  const text = w.failed === JSON_WRITE_OK ? w.text() : `failed ${w.failed} after ${w.written()}`;
  w.reset(out, 0);
  return text;
};

/** `{s: s}` and `[s]` written with `key` and `string`, then with `keyBytes` and `stringBytes`, at `indent` (-1 for a tab). */
const bothWays = (s: string, indent: i32): string => {
  const out = new Array<u8>(4096);
  const w = new JsonWriter(out, 0);
  if (indent < 0) {
    w.setIndentTab();
  } else {
    w.setIndent(indent);
  }
  w.reset(out, 0);
  const b = jvBytes(s);
  const n: i32 = toI32(b.length);
  w.beginObject();
  w.key(s);
  w.string(s);
  w.key("next");
  w.beginArray();
  w.string(s);
  w.string(s);
  w.endArray();
  w.endObject();
  const viaString = took(w, out);
  w.beginObject();
  w.keyBytes(b, 0, n);
  w.stringBytes(b, 0, n);
  w.key("next");
  w.beginArray();
  w.stringBytes(b, 0, n);
  w.stringBytes(b, 0, n);
  w.endArray();
  w.endObject();
  const viaBytes = took(w, out);
  return viaString === viaBytes ? "same" : `string ${viaString}\nbytes  ${viaBytes}`;
};

/**
 * Every byte 0x00 to 0xFF, in order, quoted as JSON: the seven short escapes,
 * `\u00xx` for the rest below 0x20, and every other byte as itself, 0x80 to
 * 0xFF raw. Written down from the rule, not from a run of the writer.
 */
const ALL_BYTES_QUOTED: string =
  "225c75303030305c75303030315c75303030325c75303030335c75303030345c75303030355c75303030365c75303030375c625c745c6e5c75303030625c665c725c75303030655c75303030665c75303031305c75303031315c75303031325c75303031335c75303031345c75303031355c75303031365c75303031375c75303031385c75303031395c75303031615c75303031625c75303031635c75303031645c75303031655c753030316620215c22232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff22";

/**
 * `src[off, off + len)` quoted by the rule, as hex: `"` and `\` and the five
 * letters escaped short, the rest below 0x20 as `\u00xx`, every other byte —
 * 0x80 to 0xFF too, unvalidated — as itself. Written from the rule, not from
 * the writer, for the sweep below to hold both of the writer's paths to.
 */
const quotedByRule = (src: u8[], off: i32, len: i32): string => {
  const out = new Array<u8>(len * 6 + 2);
  let at: i32 = 0;
  out[at] = toU8(34);
  at += 1;
  for (let i: i32 = off; i >= 0 && i < off + len && i < toI32(src.length); i += 1) {
    const c: i32 = toI32(src[i]);
    const short: i32 = c === 34 || c === 92 ? c : c === 8 ? 98 : c === 12 ? 102 : c === 10 ? 110 : c === 13 ? 114 : c === 9 ? 116 : 0;
    if (c >= 32 && c !== 34 && c !== 92) {
      out[at] = toU8(c);
      at += 1;
    } else if (short !== 0) {
      out[at] = toU8(92);
      out[at + 1] = toU8(short);
      at += 2;
    } else {
      out[at] = toU8(92);
      out[at + 1] = toU8(117);
      out[at + 2] = toU8(48);
      out[at + 3] = toU8(48);
      out[at + 4] = toU8((c >> 4) < 10 ? 48 + (c >> 4) : 87 + (c >> 4));
      out[at + 5] = toU8((c & 15) < 10 ? 48 + (c & 15) : 87 + (c & 15));
      at += 6;
    }
  }
  out[at] = toU8(34);
  return jvHex(out, at + 1);
};

export const writerBytesChecks = (t: Suite): void => {
  // Every byte value once, 0x00 to 0xFF: the short escapes, \u00xx, `/`, 0x7f and the raw high bytes.
  const every: string[] = [];
  for (let c: i32 = 0; c < 256; c += 1) {
    every.push(String.fromCharCode(c));
  }
  const all = every.join("");
  t.eqStr("bytes: every byte value, minified, as string and key write it", bothWays(all, 0), "same");
  t.eqStr("bytes: every byte value, indented by 2", bothWays(all, 2), "same");
  t.eqStr("bytes: every byte value, indented by a tab", bothWays(all, -1), "same");
  t.eqStr("bytes: 2-, 3- and 4-byte UTF-8, as string and key write it", bothWays("é日本😀€", 0), "same");
  t.eqStr("bytes: the escape set", bothWays('"\\/\b\f\n\r\t\u0001\u001f\u007f', 4), "same");
  t.eqStr("bytes: an empty text", bothWays("", 0), "same");

  // The raw bytes 0x00 to 0xFF, made as bytes rather than from a string, so
  // nothing but the writer decides what comes out.
  const raw = new Array<u8>(256);
  for (let c: i32 = 0; c < 256 && c < toI32(raw.length); c += 1) {
    raw[c] = toU8(c);
  }
  const wide = new Array<u8>(2048);
  const ww = new JsonWriter(wide, 0);
  ww.stringBytes(raw, 0, 256);
  t.eqStr("bytes: stringBytes over every raw byte 0x00 to 0xFF is the pinned text, byte for byte", jvHex(wide, ww.end), ALL_BYTES_QUOTED);
  ww.reset(wide, 0);
  ww.beginObject();
  ww.keyBytes(raw, 0, 256);
  ww.stringBytes(raw, 0, 256);
  ww.endObject();
  t.eqStr("bytes: keyBytes and stringBytes over every raw byte, as one member", jvHex(wide, ww.end), `7b${ALL_BYTES_QUOTED}3a${ALL_BYTES_QUOTED}7d`);

  const out = new Array<u8>(256);
  const w = new JsonWriter(out, 0);
  const b = jvBytes('xx"é"yy');
  w.stringBytes(b, 2, 4);
  t.eqStr("bytes: a window in the middle, ending on a 2-byte character's last byte", took(w, out), '"\\"é\\""');
  w.stringBytes(b, 8, 0);
  t.eqStr("bytes: an empty window at the end", took(w, out), '""');
  w.beginObject();
  w.keyBytes(b, 0, 2);
  w.stringBytes(b, 5, 2);
  w.endObject();
  t.eqStr("bytes: a key and a value from windows", took(w, out), '{"xx":"\\"y"}');

  // A window outside its array is refused before anything is written. `b` is 8
  // bytes natively, `é` being two.
  w.stringBytes(b, -1, 2);
  t.eqStr("bytes: a negative offset", took(w, out), `failed ${JSON_WRITE_BAD_WINDOW} after 0`);
  w.stringBytes(b, 0, -1);
  t.eqStr("bytes: a negative length, a window reversed", took(w, out), `failed ${JSON_WRITE_BAD_WINDOW} after 0`);
  w.stringBytes(b, 7, 2);
  t.eqStr("bytes: a window one past the end", took(w, out), `failed ${JSON_WRITE_BAD_WINDOW} after 0`);
  w.stringBytes(b, 9, 0);
  t.eqStr("bytes: an empty window past the end", took(w, out), `failed ${JSON_WRITE_BAD_WINDOW} after 0`);
  w.stringBytes(b, 2147483647, 2147483647);
  t.eqStr("bytes: an offset and a length of 2^31 - 1, refused without overflow", took(w, out), `failed ${JSON_WRITE_BAD_WINDOW} after 0`);
  w.beginArray();
  w.i32(1);
  w.stringBytes(b, 3, 9);
  t.eqStr("bytes: inside an array, nothing of a refused window is written, not even its comma", took(w, out), `failed ${JSON_WRITE_BAD_WINDOW} after 2`);
  w.beginObject();
  w.keyBytes(b, 1, 8);
  t.eqStr("bytes: keyBytes refuses a window past the end", took(w, out), `failed ${JSON_WRITE_BAD_WINDOW} after 1`);
  w.beginObject();
  w.keyBytes(b, -2, 1);
  t.eqStr("bytes: keyBytes refuses a negative offset", took(w, out), `failed ${JSON_WRITE_BAD_WINDOW} after 1`);

  // The writer's own codes, as `key` and `string` answer them.
  w.keyBytes(b, 0, 1);
  t.eqStr("bytes: keyBytes at the top level", took(w, out), `failed ${JSON_WRITE_VALUE_EXPECTED} after 0`);
  w.beginObject();
  w.keyBytes(b, 0, 1);
  w.keyBytes(b, 0, 1);
  t.eqStr("bytes: keyBytes straight after a key", took(w, out), `failed ${JSON_WRITE_VALUE_EXPECTED} after 5`);
  w.beginArray();
  w.keyBytes(b, 0, 1);
  t.eqStr("bytes: keyBytes in an array", took(w, out), `failed ${JSON_WRITE_VALUE_EXPECTED} after 1`);
  w.beginObject();
  w.stringBytes(b, 0, 1);
  t.eqStr("bytes: stringBytes where a key is due", took(w, out), `failed ${JSON_WRITE_KEY_EXPECTED} after 1`);
  w.stringBytes(b, 0, 1);
  w.stringBytes(b, 0, 1);
  t.eqStr("bytes: a second top-level stringBytes", took(w, out), `failed ${JSON_WRITE_DONE} after 3`);
  w.beginObject();
  w.endObject();
  w.keyBytes(b, 0, 1);
  t.eqStr("bytes: keyBytes after the top-level value", took(w, out), `failed ${JSON_WRITE_DONE} after 2`);
  w.stringBytes(b, 0, 1);
  w.stringBytes(b, 0, 1);
  w.stringBytes(b, -1, 1);
  t.eqStr("bytes: a failed writer ignores a bad window too", took(w, out), `failed ${JSON_WRITE_DONE} after 3`);

  // A full buffer at every length: the same code and the same prefix as `string` and `key`.
  const text = 'a"\u0001é';
  const tb = jvBytes(text);
  let mismatches: i32 = 0;
  let fulls: i32 = 0;
  for (let room: i32 = 0; room < 40; room += 1) {
    for (let indent: i32 = 0; indent < 3; indent += 2) {
      const small = new Array<u8>(room);
      const sw = new JsonWriter(small, 0);
      sw.setIndent(indent);
      sw.reset(small, 0);
      sw.beginObject();
      sw.key("first");
      sw.i32(1);
      sw.key(text);
      sw.string(text);
      sw.endObject();
      const viaString = `${sw.failed} ${sw.written()} ${sw.failed === JSON_WRITE_OK || sw.failed === JSON_WRITE_FULL ? sw.text() : ""}`;
      sw.reset(small, 0);
      sw.beginObject();
      sw.key("first");
      sw.i32(1);
      sw.keyBytes(tb, 0, toI32(tb.length));
      sw.stringBytes(tb, 0, toI32(tb.length));
      sw.endObject();
      const viaBytes = `${sw.failed} ${sw.written()} ${sw.failed === JSON_WRITE_OK || sw.failed === JSON_WRITE_FULL ? sw.text() : ""}`;
      if (viaString !== viaBytes || (sw.failed !== JSON_WRITE_OK && sw.failed !== JSON_WRITE_FULL)) {
        mismatches += 1;
      }
      if (sw.failed === JSON_WRITE_FULL) {
        fulls += 1;
      }
    }
  }
  t.eqI32("bytes: after an earlier member, a full buffer at every length from 0 to 39 stops where string and key stop, with JSON_WRITE_FULL", mismatches, 0);
  t.ok("bytes: and the lengths that are too short are JSON_WRITE_FULL", fulls > 20);

  // Both paths of the writer, held to the rule: a window shorter than 16 bytes
  // takes the byte loop, a longer one plain runs copied whole with escapes
  // between them. Every length from 1 to 80, from an offset inside a wider
  // array, with an escape — `"`, `\`, newline, 0x01, 0x1f — or a high byte
  // (0x80, 0xff, passed through unvalidated) at the start, either side of the
  // 16-byte guard and of the run kernel's 16- and 32-byte blocks, and at the
  // end; alone, and next to a second escape.
  const marks: i32[] = [34, 92, 10, 1, 31, 128, 255];
  const places: i32[] = [0, 1, 14, 15, 16, 17, 31, 32, 33, 47, 48, 63, 64, 79];
  const field = new Array<u8>(96);
  const sweepOut = new Array<u8>(1024);
  const sw0 = new JsonWriter(sweepOut, 0);
  let sweepOff: i32 = 0;
  let sweeps: i32 = 0;
  for (let len: i32 = 1; len <= 80; len += 1) {
    for (let m: i32 = 0; m < toI32(marks.length); m += 1) {
      for (let p: i32 = 0; p <= toI32(places.length); p += 1) {
        const at: i32 = p < toI32(places.length) ? places[p] : len - 1;
        if (at >= len) {
          continue;
        }
        for (let pair: i32 = 0; pair < 2; pair += 1) {
          for (let k: i32 = 0; k < toI32(field.length); k += 1) {
            field[k] = toU8(97 + ((k * 5) % 26));
          }
          field[3 + at] = toU8(marks[m]);
          if (pair === 1 && at + 1 < len) {
            field[4 + at] = toU8(marks[(m + 1) % toI32(marks.length)]);
          }
          const rule = quotedByRule(field, 3, len);
          sw0.reset(sweepOut, 0);
          sw0.stringBytes(field, 3, len);
          if (sw0.failed !== JSON_WRITE_OK || jvHex(sweepOut, sw0.end) !== rule) {
            sweepOff += 1;
          }
          sw0.reset(sweepOut, 0);
          sw0.beginObject();
          sw0.keyBytes(field, 3, len);
          sw0.i32(0);
          sw0.endObject();
          if (sw0.failed !== JSON_WRITE_OK || jvHex(sweepOut, sw0.end) !== `7b${rule}3a307d`) {
            sweepOff += 1;
          }
          sweeps += 1;
        }
      }
    }
  }
  t.eqI32("bytes: stringBytes and keyBytes at every length from 1 to 80, escapes and high bytes either side of the 16-byte guard and at the run boundaries, are the rule", sweepOff, 0);
  t.ok("bytes: and the sweep wrote thousands of windows", sweeps > 5000);

  // A full buffer on the run path: windows of 41 to 70 bytes with escapes and
  // a high byte at the run boundaries, at every room up to ten past their
  // quoted length, stop where `string` and `key` stop.
  const longTexts: string[] = [
    "abcdefghijklmnopqrst\nuvwxyzABCDEFGHIJKLMN",
    'abcdefghijklmno"pqrstuvwxyzABCDE\\FGHIJKLMNOPQRSTUVWXYZ0123456789-é',
    "0123456789abcdefghijklmnopqrstu\u0001vwxyz",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/\t",
  ];
  let longOff: i32 = 0;
  let longRooms: i32 = 0;
  for (let k: i32 = 0; k < toI32(longTexts.length); k += 1) {
    const longText = longTexts[k];
    const lb = jvBytes(longText);
    const n: i32 = toI32(lb.length);
    for (let room: i32 = 0; room < n * 2 + 12; room += 1) {
      const small = new Array<u8>(room);
      const lw = new JsonWriter(small, 0);
      lw.string(longText);
      const viaString = `${lw.failed} ${lw.written()} ${lw.text()}`;
      lw.reset(small, 0);
      lw.stringBytes(lb, 0, n);
      const viaBytes = `${lw.failed} ${lw.written()} ${lw.text()}`;
      lw.reset(small, 0);
      lw.beginObject();
      lw.key(longText);
      lw.i32(0);
      lw.endObject();
      const viaKey = `${lw.failed} ${lw.written()} ${lw.text()}`;
      lw.reset(small, 0);
      lw.beginObject();
      lw.keyBytes(lb, 0, n);
      lw.i32(0);
      lw.endObject();
      const viaKeyBytes = `${lw.failed} ${lw.written()} ${lw.text()}`;
      if (viaString !== viaBytes || viaKey !== viaKeyBytes) {
        longOff += 1;
      }
      longRooms += 1;
    }
  }
  t.eqI32("bytes: a full buffer at every room on four windows of 41 to 70 bytes stops where string and key stop", longOff, 0);
  t.ok("bytes: and the full-buffer sweep tried hundreds of rooms", longRooms > 400);

  // No allocation: 10,000 writes from a reused buffer of bytes.
  const body = jvBytes("message\tHello, World! é");
  let kept: i64 = 0;
  let done: i32 = 0;
  for (let round: i32 = 0; round < 10000; round += 1) {
    const before: i64 = Arena.used();
    w.reset(out, 0);
    w.beginObject();
    w.keyBytes(body, 0, 7);
    w.stringBytes(body, 8, toI32(body.length) - 8);
    w.endObject();
    kept = kept + (Arena.used() - before);
    if (w.complete()) {
      done += 1;
    }
  }
  t.eqI32("bytes: 10,000 writes of a key and a string from bytes complete", done, 10000);
  t.eqI64("bytes: and keep nothing in the arena", kept, toI64(0));
};
