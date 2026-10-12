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

/** The bytes of `s`, one per `charCodeAt`: natively a string's own bytes. */
const bytesOf = (s: string): u8[] => {
  const n: i32 = toI32(s.length);
  const out = new Array<u8>(n);
  for (let i: i32 = 0; i < n && i < toI32(out.length); i += 1) {
    out[i] = toU8(toI32(s.charCodeAt(i)));
  }
  return out;
};

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
  const b = bytesOf(s);
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

  const out = new Array<u8>(256);
  const w = new JsonWriter(out, 0);
  const b = bytesOf('xx"é"yy');
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
  const tb = bytesOf(text);
  let mismatches: i32 = 0;
  for (let room: i32 = 0; room < 24; room += 1) {
    for (let indent: i32 = 0; indent < 3; indent += 2) {
      const small = new Array<u8>(room);
      const sw = new JsonWriter(small, 0);
      sw.setIndent(indent);
      sw.reset(small, 0);
      sw.beginObject();
      sw.key(text);
      sw.string(text);
      sw.endObject();
      const viaString = `${sw.failed} ${sw.written()} ${sw.failed === JSON_WRITE_OK || sw.failed === JSON_WRITE_FULL ? sw.text() : ""}`;
      sw.reset(small, 0);
      sw.beginObject();
      sw.keyBytes(tb, 0, toI32(tb.length));
      sw.stringBytes(tb, 0, toI32(tb.length));
      sw.endObject();
      const viaBytes = `${sw.failed} ${sw.written()} ${sw.failed === JSON_WRITE_OK || sw.failed === JSON_WRITE_FULL ? sw.text() : ""}`;
      if (viaString !== viaBytes) {
        mismatches += 1;
      }
    }
  }
  t.eqI32("bytes: a full buffer at every length from 0 to 23 stops where string and key stop", mismatches, 0);

  // No allocation: 10,000 writes from a reused buffer of bytes.
  const body = bytesOf("message\tHello, World! é");
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
