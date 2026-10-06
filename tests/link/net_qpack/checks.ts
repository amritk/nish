// `nish/net/qpack` against RFC 9204 with a dynamic table of capacity 0. The
// checks live here, one function per part, so that `tests/link/net_qpack_f64`
// runs every one of them again under `--number-mode f64`.
//
// `rfcChecks` is Appendix B.1, the one example that uses the static table
// alone, both ways. `staticChecks` holds every entry of Appendix A to its
// index: each field the table holds whole must encode as the one Indexed Field
// Line Figure 13 spells for its index, and decode back. `roundTripChecks`
// sends a request through the encoder and the decoder with Huffman and
// without, and compares the Huffman section with what pylsqpack 0.3 (the
// ls-qpack bindings aioquic uses) wrote for the same fields when this case was
// made. `integerChecks` reaches the 62-bit edge, `limitChecks` the field
// section limit, and the three `*RefusalChecks` every instruction capacity 0
// forbids, by the RFC's own bytes from B.2 to B.5 where it prints them.
import {
  QPACK_DECODER_STREAM,
  QPACK_DECODER_STREAM_ERROR,
  QPACK_DECOMPRESSION_FAILED,
  QPACK_ENCODER_STREAM,
  QPACK_ENCODER_STREAM_ERROR,
  QPACK_FIELD_OVERHEAD,
  QPACK_OK,
  QPACK_REASON_ACKNOWLEDGMENT,
  QPACK_REASON_BASE,
  QPACK_REASON_CAPACITY,
  QPACK_REASON_DUPLICATE,
  QPACK_REASON_DYNAMIC,
  QPACK_REASON_HUFFMAN,
  QPACK_REASON_INCREMENT,
  QPACK_REASON_INSERT,
  QPACK_REASON_INSERT_COUNT,
  QPACK_REASON_INTEGER,
  QPACK_REASON_NONE,
  QPACK_REASON_STATIC_INDEX,
  QPACK_REASON_TRUNCATED,
  QPACK_SECTION_TOO_LARGE,
  QPACK_SETTINGS_BLOCKED_STREAMS,
  QPACK_SETTINGS_MAX_TABLE_CAPACITY,
  QPACK_STATIC_LENGTH,
  QpackDecoder,
  QpackEncoder,
  qpackPushStreamCancellation,
} from "nish/net/qpack";
import { Suite } from "nish/testing";
import { bytesOf, fromHex, toHex } from "../crypto_x509/hex";

/** `bytes[start, start + length)` as a string, one character a byte; every byte here is ASCII. */
const windowText = (bytes: u8[], start: i32, length: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = start; i < start + length; i += 1) {
    parts.push(String.fromCharCode(toI32(bytes[i])));
  }
  return parts.join("");
};

/** The fields the last decode answered, one `name: value` a line, never-indexed ones marked. */
const decodedDump = (dec: QpackDecoder): string => {
  const lines: string[] = [];
  for (let i: i32 = 0; i < dec.count; i += 1) {
    const name: string = windowText(dec.bytes, dec.nameStart[i], dec.nameLength[i]);
    const value: string = windowText(dec.bytes, dec.valueStart[i], dec.valueLength[i]);
    lines.push(dec.neverIndexed[i] ? `${name}: ${value} (never indexed)` : `${name}: ${value}`);
  }
  return lines.join("\n");
};

/** `fields`, alternating names and values, as `decodedDump` prints them, none never-indexed. */
const fieldsDump = (fields: string[]): string => {
  const lines: string[] = [];
  const n: i32 = toI32(fields.length);
  for (let i: i32 = 0; i + 1 < n; i += 2) {
    lines.push(`${fields[i]}: ${fields[i + 1]}`);
  }
  return lines.join("\n");
};

/** Decodes `hex` as one whole field section and answers the decoder's verdict. */
const decodeHex = (dec: QpackDecoder, hex: string): i64 => {
  const section: u8[] = fromHex(hex);
  const start: i32 = 0;
  return dec.decode(section, start, toI32(section.length));
};

/** Feeds `hex` to the decoder's encoder-stream reader in one call. */
const encoderStreamHex = (dec: QpackDecoder, hex: string): i64 => {
  const bytes: u8[] = fromHex(hex);
  const start: i32 = 0;
  return dec.receiveEncoderStream(bytes, start, toI32(bytes.length));
};

/** Feeds `hex` to the encoder's decoder-stream reader in one call. */
const decoderStreamHex = (enc: QpackEncoder, hex: string): i64 => {
  const bytes: u8[] = fromHex(hex);
  const start: i32 = 0;
  return enc.receiveDecoderStream(bytes, start, toI32(bytes.length));
};

/** A field section holding `fields` (alternating names and values), as one encoder writes it. */
const encodeFields = (enc: QpackEncoder, fields: string[], neverIndexed: boolean, huffman: boolean): u8[] => {
  const out: u8[] = [];
  enc.beginSection(out);
  const n: i32 = toI32(fields.length);
  const start: i32 = 0;
  for (let i: i32 = 0; i + 1 < n; i += 2) {
    const name: u8[] = bytesOf(fields[i]);
    const value: u8[] = bytesOf(fields[i + 1]);
    enc.encodeField(out, name, start, toI32(name.length), value, start, toI32(value.length), neverIndexed, huffman);
  }
  return out;
};

/**
 * Appendix A, typed again from the RFC rather than read from the module, so
 * that the two are checked against each other: name and value by index.
 */
const staticTable = (): string[] => [
  ":authority", "",
  ":path", "/",
  "age", "0",
  "content-disposition", "",
  "content-length", "0",
  "cookie", "",
  "date", "",
  "etag", "",
  "if-modified-since", "",
  "if-none-match", "",
  "last-modified", "",
  "link", "",
  "location", "",
  "referer", "",
  "set-cookie", "",
  ":method", "CONNECT",
  ":method", "DELETE",
  ":method", "GET",
  ":method", "HEAD",
  ":method", "OPTIONS",
  ":method", "POST",
  ":method", "PUT",
  ":scheme", "http",
  ":scheme", "https",
  ":status", "103",
  ":status", "200",
  ":status", "304",
  ":status", "404",
  ":status", "503",
  "accept", "*/*",
  "accept", "application/dns-message",
  "accept-encoding", "gzip, deflate, br",
  "accept-ranges", "bytes",
  "access-control-allow-headers", "cache-control",
  "access-control-allow-headers", "content-type",
  "access-control-allow-origin", "*",
  "cache-control", "max-age=0",
  "cache-control", "max-age=2592000",
  "cache-control", "max-age=604800",
  "cache-control", "no-cache",
  "cache-control", "no-store",
  "cache-control", "public, max-age=31536000",
  "content-encoding", "br",
  "content-encoding", "gzip",
  "content-type", "application/dns-message",
  "content-type", "application/javascript",
  "content-type", "application/json",
  "content-type", "application/x-www-form-urlencoded",
  "content-type", "image/gif",
  "content-type", "image/jpeg",
  "content-type", "image/png",
  "content-type", "text/css",
  "content-type", "text/html; charset=utf-8",
  "content-type", "text/plain",
  "content-type", "text/plain;charset=utf-8",
  "range", "bytes=0-",
  "strict-transport-security", "max-age=31536000",
  "strict-transport-security", "max-age=31536000; includesubdomains",
  "strict-transport-security", "max-age=31536000; includesubdomains; preload",
  "vary", "accept-encoding",
  "vary", "origin",
  "x-content-type-options", "nosniff",
  "x-xss-protection", "1; mode=block",
  ":status", "100",
  ":status", "204",
  ":status", "206",
  ":status", "302",
  ":status", "400",
  ":status", "403",
  ":status", "421",
  ":status", "425",
  ":status", "500",
  "accept-language", "",
  "access-control-allow-credentials", "FALSE",
  "access-control-allow-credentials", "TRUE",
  "access-control-allow-headers", "*",
  "access-control-allow-methods", "get",
  "access-control-allow-methods", "get, post, options",
  "access-control-allow-methods", "options",
  "access-control-expose-headers", "content-length",
  "access-control-request-headers", "content-type",
  "access-control-request-method", "get",
  "access-control-request-method", "post",
  "alt-svc", "clear",
  "authorization", "",
  "content-security-policy", "script-src 'none'; object-src 'none'; base-uri 'none'",
  "early-data", "1",
  "expect-ct", "",
  "forwarded", "",
  "if-range", "",
  "origin", "",
  "purpose", "prefetch",
  "server", "",
  "timing-allow-origin", "*",
  "upgrade-insecure-requests", "1",
  "user-agent", "",
  "x-forwarded-for", "",
  "x-frame-options", "deny",
  "x-frame-options", "sameorigin",
];
/** Appendix B.1, both ways: the RFC's bytes from the encoder, and the field from the RFC's bytes. */
const rfcChecks = (t: Suite): void => {
  const enc = new QpackEncoder();
  const fields: string[] = [":path", "/index.html"];
  t.eqStr("RFC 9204 B.1 encoded", toHex(encodeFields(enc, fields, false, false)), "0000510b2f696e6465782e68746d6c");
  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  t.eqI64("RFC 9204 B.1 decodes", decodeHex(dec, "0000510b2f696e6465782e68746d6c"), QPACK_OK);
  t.eqStr("RFC 9204 B.1 decoded", decodedDump(dec), ":path: /index.html");
  t.eqI32("RFC 9204 B.1 one field", dec.count, toI32(1));
  t.eqI32("RFC 9204 B.1 its name is a window of the decoder's bytes", dec.nameLength[0], toI32(5));
  t.eqI32("RFC 9204 B.1 its value starts after the name", dec.valueStart[0], dec.nameStart[0] + 5);
  t.eqI64("RFC 9204 B.1 a section with no field lines decodes", decodeHex(dec, "0000"), QPACK_OK);
  t.eqI32("RFC 9204 B.1 and answers no field", dec.count, toI32(0));
};

/**
 * Figure 13's Indexed Field Line for a static index, after the `00 00` prefix:
 * `11` and the index in six bits, `ff` and the rest in a second byte past 62.
 */
const indexedHex = (index: i32): string => {
  const line: u8[] = [];
  if (index < 63) {
    line.push(toU8(192 + index));
  } else {
    line.push(toU8(255));
    line.push(toU8(index - 63));
  }
  return `0000${toHex(line)}`;
};

/** Every entry of Appendix A, by its index and as a never-indexed literal. */
const staticChecks = (t: Suite): void => {
  const enc = new QpackEncoder();
  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  let indexed: i32 = 0;
  let decoded: i32 = 0;
  let literal: i32 = 0;
  const table: string[] = staticTable();
  const n: i32 = toI32(table.length) / 2;
  for (let i: i32 = 0; i < n; i += 1) {
    const field: string[] = [table[2 * i], table[2 * i + 1]];
    const hex: string = toHex(encodeFields(enc, field, false, true));
    if (t.eqStr(`static ${i} (${field[0]}: ${field[1]}) is Indexed Field Line ${i}`, hex, indexedHex(i))) {
      indexed += 1;
    }
    if (decodeHex(dec, indexedHex(i)) === QPACK_OK && decodedDump(dec) === fieldsDump(field)) {
      decoded += 1;
    } else {
      t.fail(`static ${i} decodes`, decodedDump(dec));
    }
    // Never indexed: a literal with the N bit, whose name is the lowest index
    // holding it, and which decodes with its N bit.
    const never: u8[] = encodeFields(enc, field, true, false);
    const neverStart: i32 = 0;
    if (
      dec.decode(never, neverStart, toI32(never.length)) === QPACK_OK &&
      decodedDump(dec) === `${fieldsDump(field)} (never indexed)` &&
      (toI32(never[2]) & 240) === 112
    ) {
      literal += 1;
    } else {
      t.fail(`static ${i} as a never-indexed literal`, `${toHex(never)} -> ${decodedDump(dec)}`);
    }
  }
  t.eqI32("Appendix A has 99 entries, and the module says so", n, QPACK_STATIC_LENGTH);
  t.eqI32("every static entry encodes as its own Indexed Field Line", indexed, n);
  t.eqI32("every static index decodes to its entry", decoded, n);
  t.eqI32("every static entry marked never indexed is a literal with the N bit, and decodes as one", literal, n);
  t.eqStr(
    "a never-indexed :path / is a literal with name reference 1, not index 1",
    toHex(encodeFields(enc, [":path", "/"], true, false)),
    "000071012f"
  );
  t.eqStr(
    "a field whose name the table holds twice names the lowest index",
    toHex(encodeFields(enc, [":method", "PATCH", ":status", "418"], false, true)),
    "00005f000550415443485f0903343138"
  );
  t.eqStr(
    "the last entries, past 62, take a second byte",
    toHex(
      encodeFields(
        enc,
        [
          "content-type",
          "text/html; charset=utf-8",
          "x-frame-options",
          "sameorigin",
          "strict-transport-security",
          "max-age=31536000; includesubdomains; preload",
        ],
        false,
        true
      )
    ),
    "0000f4ff23fa"
  );
};

/** `text` `count` times over. */
const repeated = (text: string, count: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < count; i += 1) {
    parts.push(text);
  }
  return parts.join("");
};

/** A request, both ways, raw and Huffman-coded; and the encodings pylsqpack wrote for it. */
const roundTripChecks = (t: Suite): void => {
  const request: string[] = [
    ":method",
    "GET",
    ":scheme",
    "https",
    ":authority",
    "example.com",
    ":path",
    "/index.html",
    "user-agent",
    "nish/0.16",
    "custom-key",
    "custom-value",
    "x-empty",
    "",
    "content-length",
    "0",
    "cache-control",
    "private",
  ];
  const enc = new QpackEncoder();
  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  const coded: u8[] = encodeFields(enc, request, false, true);
  t.eqStr(
    "a request Huffman-coded is pylsqpack's section, byte for byte",
    toHex(coded),
    "0000d1d750882f91d35d055c87a7518860d5485f2bce9a685f5087a8c89d802e173f2f0125a849e95ba97d7f8925a849e95bb8e8b4bf2ef2b169ad3ebf00c45f1585aec3771a4b"
  );
  const start: i32 = 0;
  t.eqI64("the Huffman-coded request decodes", dec.decode(coded, start, toI32(coded.length)), QPACK_OK);
  t.eqStr("the Huffman-coded request decoded", decodedDump(dec), fieldsDump(request));
  const raw: u8[] = encodeFields(enc, request, false, false);
  t.eqI32("the raw request is longer", toI32(raw.length), toI32(88));
  t.eqI64("the raw request decodes", dec.decode(raw, start, toI32(raw.length)), QPACK_OK);
  t.eqStr("the raw request decoded", decodedDump(dec), fieldsDump(request));

  // The literal name of B.3's speculative insert, this time as a field line
  // (Figure 17): `001 N H` and a 3-bit length, which ten bytes overflow.
  t.eqStr(
    "a literal name, raw, with its length past the 3-bit prefix",
    toHex(encodeFields(enc, ["custom-key", "custom-value"], false, false)),
    "00002703637573746f6d2d6b65790c637573746f6d2d76616c7565"
  );
  t.eqStr(
    "a literal name, never indexed, sets the N bit and not the name's H bit",
    toHex(encodeFields(enc, ["custom-key", "custom-value"], true, true)),
    "00003f0125a849e95ba97d7f8925a849e95bb8e8b4bf"
  );
  t.eqI64(
    "the never-indexed literal name decodes",
    decodeHex(dec, "00003f0125a849e95ba97d7f8925a849e95bb8e8b4bf"),
    QPACK_OK
  );
  t.eqStr("the never-indexed literal name decoded", decodedDump(dec), "custom-key: custom-value (never indexed)");
  t.eqI64("RFC 7541 C.4.1's Huffman www.example.com as :authority decodes", decodeHex(dec, "0000508cf1e3c2e5f23a6ba0ab90f4ff"), QPACK_OK);
  t.eqStr("RFC 7541 C.4.1's Huffman www.example.com decoded", decodedDump(dec), ":authority: www.example.com");

  // A value whose length needs a second byte raw, `7f 49` for 200, and not
  // once Huffman-coded: `a` is five bits, so 125 bytes, which the 7-bit
  // prefix holds whole as `fd`.
  const long: string[] = ["x-long", repeated("a", 200)];
  const longRaw: u8[] = encodeFields(enc, long, false, false);
  t.eqStr("a 200-byte value's length takes a continuation byte", toHex(longRaw).substring(0, 22), "000026782d6c6f6e677f49");
  t.eqI64("the 200-byte value decodes", dec.decode(longRaw, start, toI32(longRaw.length)), QPACK_OK);
  t.eqStr("the 200-byte value decoded", decodedDump(dec), fieldsDump(long));
  const longCoded: u8[] = encodeFields(enc, long, false, true);
  t.eqStr("the 200-byte value Huffman-coded is pylsqpack's prefix", toHex(longCoded).substring(0, 20), "00002df2b507aa6ffd18");
  t.eqI64("the Huffman-coded 200-byte value decodes", dec.decode(longCoded, start, toI32(longCoded.length)), QPACK_OK);
  t.eqStr("the Huffman-coded 200-byte value decoded", decodedDump(dec), fieldsDump(long));

  // The decoder reads a window, not the whole array.
  const framed: u8[] = fromHex("ffff0000d1ffff");
  const two: i32 = 2;
  const three: i32 = 3;
  t.eqI64("a section in the middle of a buffer decodes", dec.decode(framed, two, three), QPACK_OK);
  t.eqStr("a section in the middle of a buffer decoded", decodedDump(dec), ":method: GET");
  // The encoder reads windows too.
  const out: u8[] = [];
  enc.beginSection(out);
  const name: u8[] = bytesOf("xx:pathxx");
  const value: u8[] = bytesOf("/");
  const one: i32 = 1;
  const zero: i32 = 0;
  const five: i32 = 5;
  enc.encodeField(out, name, two, five, value, zero, one, false, false);
  t.eqStr("a field given as windows is encoded from the windows", toHex(out), "0000c1");
};

/** The 62-bit integers of §4.1.1, at the edge and one past it. */
const integerChecks = (t: Suite): void => {
  const limit: i32 = 4096;
  const max: i64 = toI64(1073741824) * toI64(1073741824) * toI64(4) - toI64(1);
  const atEdge = new QpackDecoder(limit);
  t.eqI64("a Delta Base of 2^62 - 1 is read, and allowed: nothing uses it", decodeHex(atEdge, "007f80ffffffffffffff3fc1"), QPACK_OK);
  t.eqStr("and the field after it is read", decodedDump(atEdge), ":path: /");
  t.eqI64(
    "nine continuation bytes are read, even all zero",
    decodeHex(atEdge, "007f808080808080808000c1"),
    QPACK_OK
  );
  const pastEdge = new QpackDecoder(limit);
  t.eqI64("a Delta Base of 2^62 is refused", decodeHex(pastEdge, "007f81ffffffffffffff3f"), QPACK_DECOMPRESSION_FAILED);
  t.eqI32("as an integer past 62 bits", pastEdge.reason, QPACK_REASON_INTEGER);
  const padded = new QpackDecoder(limit);
  t.eqI64("a tenth continuation byte is refused", decodeHex(padded, "007f80808080808080808000"), QPACK_DECOMPRESSION_FAILED);
  t.eqI32("as an integer past 62 bits, though its value is 127", padded.reason, QPACK_REASON_INTEGER);
  const insertCount = new QpackDecoder(limit);
  t.eqI64("a Required Insert Count of 2^62 is refused", decodeHex(insertCount, "ff81feffffffffffff3f00"), QPACK_DECOMPRESSION_FAILED);
  t.eqI32("as an integer, before it is a non-zero count", insertCount.reason, QPACK_REASON_INTEGER);
  const index = new QpackDecoder(limit);
  t.eqI64("a static index past 62 bits is refused", decodeHex(index, "0000ffc1ffffffffffffff3f"), QPACK_DECOMPRESSION_FAILED);
  t.eqI32("as an integer", index.reason, QPACK_REASON_INTEGER);
  const lastIndex = new QpackDecoder(limit);
  t.eqI64("a static index of 2^62 - 1 is read whole", decodeHex(lastIndex, "0000ffc0ffffffffffffff3f"), QPACK_DECOMPRESSION_FAILED);
  t.eqI32("and refused as past the table", lastIndex.reason, QPACK_REASON_STATIC_INDEX);
  const nameIndex = new QpackDecoder(limit);
  t.eqI64("a name index past 62 bits is refused", decodeHex(nameIndex, "00005ff1ffffffffffffff3f"), QPACK_DECOMPRESSION_FAILED);
  t.eqI32("as an integer", nameIndex.reason, QPACK_REASON_INTEGER);
  const length = new QpackDecoder(limit);
  t.eqI64("a value length past 62 bits is refused", decodeHex(length, "0000517f81ffffffffffffff3f"), QPACK_DECOMPRESSION_FAILED);
  t.eqI32("as an integer, not as a string cut short", length.reason, QPACK_REASON_INTEGER);

  const out: u8[] = [];
  qpackPushStreamCancellation(out, 8);
  t.eqStr("RFC 9204 B.4's Stream Cancellation for stream 8", toHex(out), "48");
  const wide: u8[] = [];
  qpackPushStreamCancellation(wide, 100);
  t.eqStr("a Stream Cancellation past the 6-bit prefix", toHex(wide), "7f25");
  const widest: u8[] = [];
  qpackPushStreamCancellation(widest, max);
  t.eqStr("a Stream Cancellation for stream 2^62 - 1", toHex(widest), "7fc0ffffffffffffff3f");
  const enc = new QpackEncoder();
  t.eqI64("which the encoder side reads back", decoderStreamHex(enc, "7fc0ffffffffffffff3f"), QPACK_OK);
  t.eqI64("as stream 2^62 - 1", enc.lastCancelled, max);
};

/** The field section limit, as RFC 9114 §4.2.2 counts it, and that it is not sticky. */
const limitChecks = (t: Suite): void => {
  // `:path: /` costs 5 + 1 + 32 = 38 bytes and `:method: GET` 7 + 3 + 32 = 42.
  const limit: i32 = 80;
  const dec = new QpackDecoder(limit);
  t.eqI32("a field costs its name, its value and this much", QPACK_FIELD_OVERHEAD, toI32(32));
  t.eqI64("two indexed fields at 80 bytes fit a limit of 80", decodeHex(dec, "0000c1d1"), QPACK_OK);
  t.eqI32("both are answered", dec.count, toI32(2));
  t.eqI64("a third indexed field is past the limit", decodeHex(dec, "0000c1d1c1"), QPACK_SECTION_TOO_LARGE);
  t.eqI32("and nothing is answered", dec.count, toI32(0));
  t.eqI64("which is not sticky: the next section decodes", decodeHex(dec, "0000c1"), QPACK_OK);
  t.eqI32("its field answered", dec.count, toI32(1));
  // `:path: /index.html`, a literal with name reference, costs 48.
  t.eqI64(
    "a literal past the limit is refused too",
    decodeHex(dec, "0000510b2f696e6465782e68746d6cd1"),
    QPACK_SECTION_TOO_LARGE
  );
  t.eqI32("with nothing answered", dec.count, toI32(0));
  t.eqI32("and no reason, since it is not a refusal", dec.reason, QPACK_REASON_NONE);
  // Huffman strings are held to the limit before they are decoded. RFC 7541
  // C.4.1's `www.example.com` is 12 coded bytes, which could decode to 19, so
  // at the edge the decoder counts its 15 symbols rather than trusting 8/5.
  // As `:authority` the field costs 10 + 15 + 32 = 57.
  const exact: i32 = 57;
  const fits = new QpackDecoder(exact);
  t.eqI64("a Huffman value that fits the limit exactly decodes", decodeHex(fits, "0000508cf1e3c2e5f23a6ba0ab90f4ff"), QPACK_OK);
  t.eqStr("and is answered whole", decodedDump(fits), ":authority: www.example.com");
  const short: i32 = 56;
  const over = new QpackDecoder(short);
  t.eqI64("a byte less and it is past the limit", decodeHex(over, "0000508cf1e3c2e5f23a6ba0ab90f4ff"), QPACK_SECTION_TOO_LARGE);
  t.eqI32("with nothing kept in its bytes", toI32(over.bytes.length), toI32(0));
  // B.3's custom-key: custom-value with both strings Huffman-coded costs
  // 10 + 12 + 32 = 54; a limit of 41 refuses the name, 53 the value.
  const both: i32 = 54;
  t.eqI64("a Huffman literal name and value at the limit decode", decodeHex(new QpackDecoder(both), "00002f0125a849e95ba97d7f8925a849e95bb8e8b4bf"), QPACK_OK);
  const nameShort: i32 = 41;
  t.eqI64("a Huffman literal name past the limit is refused", decodeHex(new QpackDecoder(nameShort), "00002f0125a849e95ba97d7f8925a849e95bb8e8b4bf"), QPACK_SECTION_TOO_LARGE);
  const valueShort: i32 = 53;
  t.eqI64("a Huffman value past the limit after its name is refused", decodeHex(new QpackDecoder(valueShort), "00002f0125a849e95ba97d7f8925a849e95bb8e8b4bf"), QPACK_SECTION_TOO_LARGE);

  // What a hostile section can make the decoder keep: 1,600 `a`s coded in
  // 1,000 bytes, against a limit of 64. Refused before decoding, it leaves
  // `Arena.used()` where a small section left it: the decoder's arrays do not
  // grow to hold a string they then drop.
  const small: i32 = 64;
  const guarded = new QpackDecoder(small);
  const value: u8[] = bytesOf(repeated("a", 1600));
  const hostile: u8[] = [];
  const enc = new QpackEncoder();
  const start: i32 = 0;
  const path: u8[] = bytesOf(":path");
  enc.beginSection(hostile);
  enc.encodeField(hostile, path, start, toI32(path.length), value, start, toI32(value.length), false, true);
  t.eqStr("the hostile section names :path and codes its value in 1,000 bytes", toHex(hostile).substring(0, 12), "000051ffe906");
  t.eqI64("a small section warms the decoder", decodeHex(guarded, "0000c1"), QPACK_OK);
  const before: i64 = Arena.used();
  t.eqI64("a 1,600-byte Huffman value is past a limit of 64", guarded.decode(hostile, start, toI32(hostile.length)), QPACK_SECTION_TOO_LARGE);
  t.eqI64("and the decoder kept none of it: the arena did not move", Arena.used() - before, toI64(0));
  t.eqI64("the next section still decodes", decodeHex(guarded, "0000c1"), QPACK_OK);

  const none: i32 = 0;
  const empty = new QpackDecoder(none);
  t.eqI64("a limit of 0 still takes a section with no fields", decodeHex(empty, "0000"), QPACK_OK);
  t.eqI64("and refuses one field", decodeHex(empty, "0000c1"), QPACK_SECTION_TOO_LARGE);
};

/** `hex` as a field section to a fresh decoder must be refused with `reason`. */
const refusesSection = (t: Suite, label: string, hex: string, reason: i32): void => {
  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  t.eqI64(`${label}: QPACK_DECOMPRESSION_FAILED`, decodeHex(dec, hex), QPACK_DECOMPRESSION_FAILED);
  t.eqI32(`${label}: the reason`, dec.reason, reason);
  t.eqI32(`${label}: no fields`, dec.count, toI32(0));
};

/** Every field section capacity 0 forbids, and every malformed one. */
const sectionRefusalChecks = (t: Suite): void => {
  refusesSection(t, "an empty section", "", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a section with no Base", "00", QPACK_REASON_TRUNCATED);
  refusesSection(t, "RFC 9204 B.2's section, Required Insert Count 2", "03811011", QPACK_REASON_INSERT_COUNT);
  refusesSection(t, "RFC 9204 B.4's section, Required Insert Count 4", "050080c181", QPACK_REASON_INSERT_COUNT);
  refusesSection(t, "a Required Insert Count of 1", "0100", QPACK_REASON_INSERT_COUNT);
  refusesSection(t, "a negative Base", "0080", QPACK_REASON_BASE);
  refusesSection(t, "a negative Base with a Delta Base", "0085c1", QPACK_REASON_BASE);
  refusesSection(t, "an Indexed Field Line into the dynamic table", "000080", QPACK_REASON_DYNAMIC);
  refusesSection(t, "an Indexed Field Line with Post-Base Index", "000010", QPACK_REASON_DYNAMIC);
  refusesSection(t, "a Literal Field Line with dynamic Name Reference", "000040012f", QPACK_REASON_DYNAMIC);
  refusesSection(t, "a never-indexed one", "000060012f", QPACK_REASON_DYNAMIC);
  refusesSection(t, "a Literal Field Line with Post-Base Name Reference", "000000012f", QPACK_REASON_DYNAMIC);
  refusesSection(t, "a never-indexed one", "000008012f", QPACK_REASON_DYNAMIC);
  refusesSection(t, "a dynamic reference after a good field", "0000c180", QPACK_REASON_DYNAMIC);
  refusesSection(t, "static index 99", "0000ff24", QPACK_REASON_STATIC_INDEX);
  refusesSection(t, "static name index 99", "00005f54012f", QPACK_REASON_STATIC_INDEX);
  refusesSection(t, "an index cut short", "0000ff", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a name index cut short", "00005f", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a name reference with no value", "000051", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a value cut short", "000051052f", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a value length cut short", "0000517f", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a literal name cut short", "00002703637573", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a literal name length cut short", "000027", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a literal name with no value", "000021", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a Delta Base cut short", "007f", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a Required Insert Count cut short", "ff", QPACK_REASON_TRUNCATED);
  refusesSection(t, "a Huffman value padded with zeros", "0000518100", QPACK_REASON_HUFFMAN);
  refusesSection(t, "a Huffman value holding EOS", "00005184ffffffff", QPACK_REASON_HUFFMAN);
  refusesSection(t, "a Huffman name padded with zeros", "0000290000", QPACK_REASON_HUFFMAN);

  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  t.eqI64("a refused section", decodeHex(dec, "0000ff24"), QPACK_DECOMPRESSION_FAILED);
  t.eqI64("leaves the decoder spent: a good section is refused too", decodeHex(dec, "0000c1"), QPACK_DECOMPRESSION_FAILED);
  t.eqI32("with the first reason kept", dec.reason, QPACK_REASON_STATIC_INDEX);
  t.eqI32("and no fields", dec.count, toI32(0));
  t.eqI64("and so is its encoder stream", encoderStreamHex(dec, "20"), QPACK_DECOMPRESSION_FAILED);
};

/** `hex` on the encoder stream of a fresh decoder must be refused with `reason`. */
const refusesEncoderStream = (t: Suite, label: string, hex: string, reason: i32): void => {
  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  t.eqI64(`${label}: QPACK_ENCODER_STREAM_ERROR`, encoderStreamHex(dec, hex), QPACK_ENCODER_STREAM_ERROR);
  t.eqI32(`${label}: the reason`, dec.reason, reason);
};

/** The encoder stream a decoder of capacity 0 reads: Set Dynamic Table Capacity 0 and nothing else. */
const encoderStreamChecks = (t: Suite): void => {
  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  t.eqI64("Set Dynamic Table Capacity 0 is accepted", encoderStreamHex(dec, "20"), QPACK_OK);
  t.eqI64("as often as it is sent", encoderStreamHex(dec, "2020"), QPACK_OK);
  t.eqI64("and nothing at all is nothing", encoderStreamHex(dec, ""), QPACK_OK);
  t.eqI32("each one counted", dec.capacityInstructions, toI32(3));
  t.eqI64("a section still decodes after them", decodeHex(dec, "0000c1"), QPACK_OK);
  const window: u8[] = fromHex("ff20ff");
  const one: i32 = 1;
  t.eqI64("the stream is read as a window", dec.receiveEncoderStream(window, one, one), QPACK_OK);
  t.eqI32("of one byte here", dec.capacityInstructions, toI32(4));

  // A peer may send Set Dynamic Table Capacity 0 without end, so the count
  // stops at 2^31 - 1 rather than overflowing, which would panic.
  const most: i32 = 2147483647;
  const counted = new QpackDecoder(limit);
  counted.capacityInstructions = most - 1;
  t.eqI64("Set Dynamic Table Capacity 0 at the counter's edge is accepted", encoderStreamHex(counted, "202020"), QPACK_OK);
  t.eqI32("and the count saturates at 2^31 - 1", counted.capacityInstructions, most);

  refusesEncoderStream(t, "RFC 9204 B.2's Set Dynamic Table Capacity 220", "3fbd01", QPACK_REASON_CAPACITY);
  refusesEncoderStream(t, "Set Dynamic Table Capacity 1", "21", QPACK_REASON_CAPACITY);
  refusesEncoderStream(
    t,
    "RFC 9204 B.2's Insert With Name Reference, static",
    "c00f7777772e6578616d706c652e636f6d",
    QPACK_REASON_INSERT
  );
  refusesEncoderStream(
    t,
    "RFC 9204 B.3's Insert With Literal Name",
    "4a637573746f6d2d6b65790c637573746f6d2d76616c7565",
    QPACK_REASON_INSERT
  );
  refusesEncoderStream(
    t,
    "RFC 9204 B.5's Insert With Name Reference, dynamic",
    "810d637573746f6d2d76616c756532",
    QPACK_REASON_INSERT
  );
  refusesEncoderStream(t, "RFC 9204 B.4's Duplicate", "02", QPACK_REASON_DUPLICATE);
  refusesEncoderStream(t, "a Duplicate of relative index 0", "00", QPACK_REASON_DUPLICATE);
  refusesEncoderStream(t, "an insert after a good capacity", "2020c0", QPACK_REASON_INSERT);

  const spent = new QpackDecoder(limit);
  t.eqI64("a refused instruction", encoderStreamHex(spent, "21"), QPACK_ENCODER_STREAM_ERROR);
  t.eqI64("leaves the encoder stream spent", encoderStreamHex(spent, "20"), QPACK_ENCODER_STREAM_ERROR);
  t.eqI64("and the decoder too", decodeHex(spent, "0000c1"), QPACK_ENCODER_STREAM_ERROR);
  t.eqI32("with the first reason kept", spent.reason, QPACK_REASON_CAPACITY);
  t.eqI32("and only the good instructions counted", spent.capacityInstructions, toI32(0));
};

/** `hex` on the decoder stream of a fresh encoder must be refused with `reason`. */
const refusesDecoderStream = (t: Suite, label: string, hex: string, reason: i32): void => {
  const enc = new QpackEncoder();
  t.eqI64(`${label}: QPACK_DECODER_STREAM_ERROR`, decoderStreamHex(enc, hex), QPACK_DECODER_STREAM_ERROR);
  t.eqI32(`${label}: the reason`, enc.reason, reason);
};

/** The decoder stream an encoder that never inserts reads: Stream Cancellations and nothing else. */
const decoderStreamChecks = (t: Suite): void => {
  const enc = new QpackEncoder();
  t.eqI32("no cancellation yet", enc.cancellations, toI32(0));
  t.eqI64("RFC 9204 B.4's Stream Cancellation is accepted", decoderStreamHex(enc, "48"), QPACK_OK);
  t.eqI64("for stream 8", enc.lastCancelled, toI64(8));
  // Stream 100 is `7f 25`; fed a byte at a time, the first call ends inside
  // the integer and the second finishes it.
  t.eqI64("a Stream Cancellation split after its first byte", decoderStreamHex(enc, "7f"), QPACK_OK);
  t.eqI64("is not counted until it is whole", enc.lastCancelled, toI64(8));
  t.eqI64("and is finished by the next bytes", decoderStreamHex(enc, "2540"), QPACK_OK);
  t.eqI32("three cancellations", enc.cancellations, toI32(3));
  t.eqI64("the last for stream 0", enc.lastCancelled, toI64(0));
  const window: u8[] = fromHex("ff44ff");
  const one: i32 = 1;
  t.eqI64("the stream is read as a window", enc.receiveDecoderStream(window, one, one), QPACK_OK);
  t.eqI64("of one byte here, stream 4", enc.lastCancelled, toI64(4));

  // Stream Cancellations are counted the same way: the count saturates.
  const most: i32 = 2147483647;
  const counted = new QpackEncoder();
  counted.cancellations = most - 1;
  t.eqI64("Stream Cancellations at the counter's edge are accepted", decoderStreamHex(counted, "484c"), QPACK_OK);
  t.eqI32("and the count saturates at 2^31 - 1", counted.cancellations, most);
  t.eqI64("with the last stream still recorded", counted.lastCancelled, toI64(12));

  refusesDecoderStream(t, "RFC 9204 B.2's Section Acknowledgment for stream 4", "84", QPACK_REASON_ACKNOWLEDGMENT);
  refusesDecoderStream(t, "a Section Acknowledgment for stream 0", "80", QPACK_REASON_ACKNOWLEDGMENT);
  refusesDecoderStream(t, "RFC 9204 B.3's Insert Count Increment of 1", "01", QPACK_REASON_INCREMENT);
  refusesDecoderStream(t, "an Insert Count Increment of 0", "00", QPACK_REASON_INCREMENT);
  refusesDecoderStream(t, "a stream ID of 2^62", "7fc1ffffffffffffff3f", QPACK_REASON_INTEGER);
  refusesDecoderStream(t, "a tenth continuation byte", "7f80808080808080808000", QPACK_REASON_INTEGER);
  refusesDecoderStream(t, "an acknowledgment after a good cancellation", "4884", QPACK_REASON_ACKNOWLEDGMENT);

  const spent = new QpackEncoder();
  t.eqI64("a refused instruction", decoderStreamHex(spent, "01"), QPACK_DECODER_STREAM_ERROR);
  t.eqI64("leaves the decoder stream spent", decoderStreamHex(spent, "48"), QPACK_DECODER_STREAM_ERROR);
  t.eqI32("with the first reason kept", spent.reason, QPACK_REASON_INCREMENT);
  t.eqI32("and nothing counted", spent.cancellations, toI32(0));
  t.eqStr("the encoder still writes sections", toHex(encodeFields(spent, [":path", "/"], false, false)), "0000c1");
};

/** The numbers RFC 9204 gives each constant (§4.2, §5, §6, Appendix A). */
const constantChecks = (t: Suite): void => {
  t.eqI64("QPACK_DECOMPRESSION_FAILED is 0x0200", QPACK_DECOMPRESSION_FAILED, toI64(512));
  t.eqI64("QPACK_ENCODER_STREAM_ERROR is 0x0201", QPACK_ENCODER_STREAM_ERROR, toI64(513));
  t.eqI64("QPACK_DECODER_STREAM_ERROR is 0x0202", QPACK_DECODER_STREAM_ERROR, toI64(514));
  t.eqI64("an encoder stream is type 0x02", QPACK_ENCODER_STREAM, toI64(2));
  t.eqI64("a decoder stream is type 0x03", QPACK_DECODER_STREAM, toI64(3));
  t.eqI64("SETTINGS_QPACK_MAX_TABLE_CAPACITY is 0x01", QPACK_SETTINGS_MAX_TABLE_CAPACITY, toI64(1));
  t.eqI64("SETTINGS_QPACK_BLOCKED_STREAMS is 0x07", QPACK_SETTINGS_BLOCKED_STREAMS, toI64(7));
  const enc = new QpackEncoder();
  const out: u8[] = [];
  enc.beginSection(out);
  t.eqStr("every section begins with Required Insert Count 0 and Base 0", toHex(out), "0000");
};

/**
 * WP34 N9: once a connection has seen its largest section, neither side
 * allocates. A section decoded or encoded a thousand times after a first
 * pass leaves `Arena.used()` where it was, to the byte. The decoder's arrays
 * are emptied with `pop` and the encoder writes into an array the caller
 * empties the same way, so both reuse the storage the first pass grew.
 */
const arenaChecks = (t: Suite): void => {
  const enc = new QpackEncoder();
  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  const request: string[] = [
    ":method",
    "GET",
    ":path",
    "/index.html",
    "custom-key",
    "custom-value",
    "authorization",
    "secret",
  ];
  const coded: u8[] = encodeFields(enc, request, false, true);
  const raw: u8[] = encodeFields(enc, request, true, false);
  const name: u8[] = bytesOf("custom-key");
  const value: u8[] = bytesOf("custom-value");
  const out: u8[] = [];
  const start: i32 = 0;
  const codedLength: i32 = toI32(coded.length);
  const rawLength: i32 = toI32(raw.length);
  const nameLength: i32 = toI32(name.length);
  const valueLength: i32 = toI32(value.length);
  let decoded: i32 = 0;
  if (dec.decode(coded, start, codedLength) === QPACK_OK && dec.decode(raw, start, rawLength) === QPACK_OK) {
    decoded += dec.count;
  }
  enc.beginSection(out);
  enc.encodeField(out, name, start, nameLength, value, start, valueLength, false, true);
  const before: i64 = Arena.used();
  for (let pass: i32 = 0; pass < 1000; pass += 1) {
    if (dec.decode(coded, start, codedLength) === QPACK_OK && dec.decode(raw, start, rawLength) === QPACK_OK) {
      decoded += dec.count;
    }
    while (out.length > 0) {
      out.pop();
    }
    enc.beginSection(out);
    enc.encodeField(out, name, start, nameLength, value, start, valueLength, false, true);
  }
  const grew: i64 = Arena.used() - before;
  t.eqI32("a thousand and one pairs of sections decoded, four fields each", decoded, toI32(4004));
  t.eqStr(
    "the last section decoded",
    decodedDump(dec),
    ":method: GET (never indexed)\n:path: /index.html (never indexed)\ncustom-key: custom-value (never indexed)\nauthorization: secret (never indexed)"
  );
  t.eqI64("a thousand passes of both sides after the first allocate nothing", grew, toI64(0));
};

/** Every part, in one suite. */
export const qpackChecks = (): i32 => {
  const t = new Suite("qpack");
  constantChecks(t);
  rfcChecks(t);
  staticChecks(t);
  roundTripChecks(t);
  integerChecks(t);
  limitChecks(t);
  sectionRefusalChecks(t);
  encoderStreamChecks(t);
  decoderStreamChecks(t);
  arenaChecks(t);
  return t.done();
};
