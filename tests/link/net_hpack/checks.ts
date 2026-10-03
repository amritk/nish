// `nish/net/hpack` against RFC 7541. The checks live here, one function per
// part, so that `tests/link/net_hpack_f64` runs every one of them again under
// `--number-mode f64`, and so that the Huffman and refusal programs beside this
// one can each run their own part.
//
// `rfcChecks` is Appendix C: C.1's integers, C.2's four representations, and
// C.3 to C.6's header lists, each list encoded by an `HpackEncoder` and
// compared with the RFC's hex, then the RFC's hex decoded by an `HpackDecoder`
// and compared with the list. After every step both tables are compared with
// the RFC's listing of the dynamic table, entry by entry, and with its size.
// `huffmanChecks` holds every code of Appendix B, `tableChecks` the eviction
// and size-update rules C does not reach, and `refusalChecks` every block the
// decoder must refuse.
import {
  HPACK_ERR_HUFFMAN_EOS,
  HPACK_ERR_HUFFMAN_PADDING,
  HPACK_ERR_INDEX,
  HPACK_ERR_INTEGER_OVERFLOW,
  HPACK_ERR_SIZE_UPDATE_MISSING,
  HPACK_ERR_SIZE_UPDATE_POSITION,
  HPACK_ERR_TABLE_SIZE,
  HPACK_ERR_TRUNCATED,
  HPACK_INDEX_INCREMENTAL,
  HPACK_INDEX_NEVER,
  HPACK_INDEX_WITHOUT,
  HPACK_LIST_TOO_LARGE,
  HPACK_OK,
  HpackCursor,
  HpackDecoder,
  HpackEncoder,
  HpackHuffman,
  HpackTable,
  hpackDecodeInteger,
  hpackDecodeString,
  hpackEncodeInteger,
  hpackEncodeString,
  hpackHuffmanDecode,
  hpackHuffmanEncode,
  hpackHuffmanLength,
} from "nish/net/hpack";
import { Suite } from "nish/testing";

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes` as lowercase hex, two digits a byte, as the RFC's dumps print them. */
export const hexOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

/** The value of one lowercase hex digit. */
const nibbleOf = (c: i32): i32 => (c >= 97 ? c - 87 : c - 48);

/** The bytes a lowercase hex string spells, two digits a byte. */
export const bytesOf = (hex: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(hex.length);
  for (let k: i32 = 0; k + 1 < n; k += 2) {
    out.push(toU8(nibbleOf(toI32(hex.charCodeAt(k))) * 16 + nibbleOf(toI32(hex.charCodeAt(k + 1)))));
  }
  return out;
};

/** The bytes of an ASCII string. */
export const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** `bytes` as a string, one character a byte; every byte here is ASCII. */
const textOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    parts.push(String.fromCharCode(toI32(b)));
  }
  return parts.join("");
};

/**
 * A dynamic table as the RFC lists one: `[i] (s = size) name: value`, newest
 * first, then the table's size.
 */
const tableDump = (table: HpackTable): string => {
  const lines: string[] = [];
  const n: i32 = table.count();
  for (let i: i32 = 1; i <= n; i += 1) {
    const name: u8[] = table.name(i);
    const value: u8[] = table.value(i);
    const size: i32 = toI32(name.length) + toI32(value.length) + 32;
    lines.push(`[${i}] (s = ${size}) ${textOf(name)}: ${textOf(value)}`);
  }
  lines.push(`size ${table.size}`);
  return lines.join("\n");
};

/** The fields the last decode answered, one `name: value` a line. */
const decodedDump = (dec: HpackDecoder): string => {
  const lines: string[] = [];
  const n: i32 = toI32(dec.names.length);
  for (let i: i32 = 0; i < n; i += 1) {
    lines.push(`${textOf(dec.names[i])}: ${textOf(dec.values[i])}`);
  }
  return lines.join("\n");
};

/** `fields`, alternating names and values, one `name: value` a line. */
const fieldsDump = (fields: string[]): string => {
  const lines: string[] = [];
  const n: i32 = toI32(fields.length);
  for (let i: i32 = 0; i + 1 < n; i += 2) {
    lines.push(`${fields[i]}: ${fields[i + 1]}`);
  }
  return lines.join("\n");
};

/** Decodes `hex` as one whole block and answers the decoder's verdict. */
export const decodeHex = (dec: HpackDecoder, hex: string): i32 => {
  const block: u8[] = bytesOf(hex);
  const start: i32 = 0;
  return dec.decode(block, start, toI32(block.length));
};

/**
 * One header list of Appendix C, both ways: `fields` encoded must be `hex`,
 * `hex` decoded must be `fields`, and both tables must then be `table`.
 */
const rfcStep = (
  t: Suite,
  label: string,
  enc: HpackEncoder,
  dec: HpackDecoder,
  fields: string[],
  indexing: i32,
  huffman: boolean,
  hex: string,
  table: string[]
): void => {
  const block: u8[] = [];
  const n: i32 = toI32(fields.length);
  for (let i: i32 = 0; i + 1 < n; i += 2) {
    enc.encodeField(block, ascii(fields[i]), ascii(fields[i + 1]), indexing, huffman);
  }
  t.eqStr(`${label} encoded`, hexOf(block), hex);
  t.eqStr(`${label} encoder's table`, tableDump(enc.table), table.join("\n"));
  t.eqI32(`${label} decodes`, decodeHex(dec, hex), HPACK_OK);
  t.eqStr(`${label} decoded`, decodedDump(dec), fieldsDump(fields));
  t.eqStr(`${label} decoder's table`, tableDump(dec.table), table.join("\n"));
};

/** One §5.1 integer, both ways: encoded with `flags` must be `hex`, and read back whole. */
const integerStep = (t: Suite, label: string, flags: i32, prefixBits: i32, value: i32, hex: string): void => {
  const out: u8[] = [];
  hpackEncodeInteger(out, flags, prefixBits, value);
  t.eqStr(`${label} encoded`, hexOf(out), hex);
  const wire: u8[] = bytesOf(hex);
  const c = new HpackCursor(wire, 0, toI32(wire.length));
  t.eqI32(`${label} decoded`, hpackDecodeInteger(c, prefixBits), value);
  t.eqI32(`${label} read every byte`, c.pos, toI32(wire.length));
};

/** Appendix C, every example. */
export const rfcChecks = (t: Suite): void => {
  // Typed locals rather than bare literals: a literal can be an `f64` under
  // `--number-mode f64`.
  const l0: i32 = 0;
  const l5: i32 = 5;
  const l8: i32 = 8;
  const l256: i32 = 256;
  const l4096: i32 = 4096;
  const l65536: i32 = 65536;

  // RFC 7541 C.1: the flag bits outside the prefix are the RFC's `X`s, zero here.
  integerStep(t, "RFC 7541 C.1.1 10 in a 5-bit prefix", l0, l5, 10, "0a");
  integerStep(t, "RFC 7541 C.1.2 1337 in a 5-bit prefix", l0, l5, 1337, "1f9a0a");
  integerStep(t, "RFC 7541 C.1.3 42 at an octet boundary", l0, l8, 42, "2a");

  // A string literal both ways, raw and Huffman-coded, as C.3.1 and C.4.1
  // spell `www.example.com`.
  const huffman = new HpackHuffman();
  const authority: u8[] = ascii("www.example.com");
  const raw: u8[] = [];
  hpackEncodeString(huffman, raw, authority, false);
  t.eqStr("RFC 7541 C.3.1 string literal", hexOf(raw), "0f7777772e6578616d706c652e636f6d");
  const coded: u8[] = [];
  hpackEncodeString(huffman, coded, authority, true);
  t.eqStr("RFC 7541 C.4.1 Huffman string literal", hexOf(coded), "8cf1e3c2e5f23a6ba0ab90f4ff");
  const back: u8[] = [];
  const c = new HpackCursor(coded, 0, toI32(coded.length));
  t.eqI32("RFC 7541 C.4.1 Huffman string decodes", hpackDecodeString(huffman, c, back), HPACK_OK);
  t.eqStr("RFC 7541 C.4.1 Huffman string decoded", textOf(back), "www.example.com");

  // RFC 7541 C.2.1, Literal Header Field with Indexing: a table of its own.
  const enc21 = new HpackEncoder(l4096);
  const dec21 = new HpackDecoder(l4096, l65536);
  rfcStep(
    t,
    "RFC 7541 C.2.1",
    enc21,
    dec21,
    [
      "custom-key",
      "custom-header",
    ],
    HPACK_INDEX_INCREMENTAL,
    false,
    "400a637573746f6d2d6b65790d637573746f6d2d686561646572",
    [
      "[1] (s = 55) custom-key: custom-header",
      "size 55",
    ]
  );
  t.eqBool("RFC 7541 C.2.1 not never indexed", dec21.neverIndexed[0], false);
  // RFC 7541 C.2.2, Literal Header Field without Indexing: a table of its own.
  const enc22 = new HpackEncoder(l4096);
  const dec22 = new HpackDecoder(l4096, l65536);
  rfcStep(
    t,
    "RFC 7541 C.2.2",
    enc22,
    dec22,
    [
      ":path",
      "/sample/path",
    ],
    HPACK_INDEX_WITHOUT,
    false,
    "040c2f73616d706c652f70617468",
    [
      "size 0",
    ]
  );
  t.eqBool("RFC 7541 C.2.2 not never indexed", dec22.neverIndexed[0], false);
  // RFC 7541 C.2.3, Literal Header Field Never Indexed: a table of its own.
  const enc23 = new HpackEncoder(l4096);
  const dec23 = new HpackDecoder(l4096, l65536);
  rfcStep(
    t,
    "RFC 7541 C.2.3",
    enc23,
    dec23,
    [
      "password",
      "secret",
    ],
    HPACK_INDEX_NEVER,
    false,
    "100870617373776f726406736563726574",
    [
      "size 0",
    ]
  );
  t.eqBool("RFC 7541 C.2.3 never indexed", dec23.neverIndexed[0], true);
  // RFC 7541 C.2.4, Indexed Header Field: a table of its own.
  const enc24 = new HpackEncoder(l4096);
  const dec24 = new HpackDecoder(l4096, l65536);
  rfcStep(
    t,
    "RFC 7541 C.2.4",
    enc24,
    dec24,
    [
      ":method",
      "GET",
    ],
    HPACK_INDEX_INCREMENTAL,
    false,
    "82",
    [
      "size 0",
    ]
  );
  t.eqBool("RFC 7541 C.2.4 not never indexed", dec24.neverIndexed[0], false);
  // RFC 7541 C.3: three header lists on one connection.
  const enc3 = new HpackEncoder(l4096);
  const dec3 = new HpackDecoder(l4096, l65536);
  rfcStep(
    t,
    "RFC 7541 C.3.1",
    enc3,
    dec3,
    [
      ":method",
      "GET",
      ":scheme",
      "http",
      ":path",
      "/",
      ":authority",
      "www.example.com",
    ],
    HPACK_INDEX_INCREMENTAL,
    false,
    "828684410f7777772e6578616d706c652e636f6d",
    [
      "[1] (s = 57) :authority: www.example.com",
      "size 57",
    ]
  );
  rfcStep(
    t,
    "RFC 7541 C.3.2",
    enc3,
    dec3,
    [
      ":method",
      "GET",
      ":scheme",
      "http",
      ":path",
      "/",
      ":authority",
      "www.example.com",
      "cache-control",
      "no-cache",
    ],
    HPACK_INDEX_INCREMENTAL,
    false,
    "828684be58086e6f2d6361636865",
    [
      "[1] (s = 53) cache-control: no-cache",
      "[2] (s = 57) :authority: www.example.com",
      "size 110",
    ]
  );
  rfcStep(
    t,
    "RFC 7541 C.3.3",
    enc3,
    dec3,
    [
      ":method",
      "GET",
      ":scheme",
      "https",
      ":path",
      "/index.html",
      ":authority",
      "www.example.com",
      "custom-key",
      "custom-value",
    ],
    HPACK_INDEX_INCREMENTAL,
    false,
    "828785bf400a637573746f6d2d6b65790c637573746f6d2d76616c7565",
    [
      "[1] (s = 54) custom-key: custom-value",
      "[2] (s = 53) cache-control: no-cache",
      "[3] (s = 57) :authority: www.example.com",
      "size 164",
    ]
  );
  // RFC 7541 C.4: three header lists on one connection, Huffman-coded.
  const enc4 = new HpackEncoder(l4096);
  const dec4 = new HpackDecoder(l4096, l65536);
  rfcStep(
    t,
    "RFC 7541 C.4.1",
    enc4,
    dec4,
    [
      ":method",
      "GET",
      ":scheme",
      "http",
      ":path",
      "/",
      ":authority",
      "www.example.com",
    ],
    HPACK_INDEX_INCREMENTAL,
    true,
    "828684418cf1e3c2e5f23a6ba0ab90f4ff",
    [
      "[1] (s = 57) :authority: www.example.com",
      "size 57",
    ]
  );
  rfcStep(
    t,
    "RFC 7541 C.4.2",
    enc4,
    dec4,
    [
      ":method",
      "GET",
      ":scheme",
      "http",
      ":path",
      "/",
      ":authority",
      "www.example.com",
      "cache-control",
      "no-cache",
    ],
    HPACK_INDEX_INCREMENTAL,
    true,
    "828684be5886a8eb10649cbf",
    [
      "[1] (s = 53) cache-control: no-cache",
      "[2] (s = 57) :authority: www.example.com",
      "size 110",
    ]
  );
  rfcStep(
    t,
    "RFC 7541 C.4.3",
    enc4,
    dec4,
    [
      ":method",
      "GET",
      ":scheme",
      "https",
      ":path",
      "/index.html",
      ":authority",
      "www.example.com",
      "custom-key",
      "custom-value",
    ],
    HPACK_INDEX_INCREMENTAL,
    true,
    "828785bf408825a849e95ba97d7f8925a849e95bb8e8b4bf",
    [
      "[1] (s = 54) custom-key: custom-value",
      "[2] (s = 53) cache-control: no-cache",
      "[3] (s = 57) :authority: www.example.com",
      "size 164",
    ]
  );
  // RFC 7541 C.5: three header lists on one connection, with a 256-byte table.
  const enc5 = new HpackEncoder(l256);
  const dec5 = new HpackDecoder(l256, l65536);
  rfcStep(
    t,
    "RFC 7541 C.5.1",
    enc5,
    dec5,
    [
      ":status",
      "302",
      "cache-control",
      "private",
      "date",
      "Mon, 21 Oct 2013 20:13:21 GMT",
      "location",
      "https://www.example.com",
    ],
    HPACK_INDEX_INCREMENTAL,
    false,
    "4803333032580770726976617465611d4d6f6e2c203231204f637420323031332032303a31333a323120474d546e1768747470733a2f2f7777772e6578616d706c652e636f6d",
    [
      "[1] (s = 63) location: https://www.example.com",
      "[2] (s = 65) date: Mon, 21 Oct 2013 20:13:21 GMT",
      "[3] (s = 52) cache-control: private",
      "[4] (s = 42) :status: 302",
      "size 222",
    ]
  );
  rfcStep(
    t,
    "RFC 7541 C.5.2",
    enc5,
    dec5,
    [
      ":status",
      "307",
      "cache-control",
      "private",
      "date",
      "Mon, 21 Oct 2013 20:13:21 GMT",
      "location",
      "https://www.example.com",
    ],
    HPACK_INDEX_INCREMENTAL,
    false,
    "4803333037c1c0bf",
    [
      "[1] (s = 42) :status: 307",
      "[2] (s = 63) location: https://www.example.com",
      "[3] (s = 65) date: Mon, 21 Oct 2013 20:13:21 GMT",
      "[4] (s = 52) cache-control: private",
      "size 222",
    ]
  );
  rfcStep(
    t,
    "RFC 7541 C.5.3",
    enc5,
    dec5,
    [
      ":status",
      "200",
      "cache-control",
      "private",
      "date",
      "Mon, 21 Oct 2013 20:13:22 GMT",
      "location",
      "https://www.example.com",
      "content-encoding",
      "gzip",
      "set-cookie",
      "foo=ASDJKHQKBZXOQWEOPIUAXQWEOIU; max-age=3600; version=1",
    ],
    HPACK_INDEX_INCREMENTAL,
    false,
    "88c1611d4d6f6e2c203231204f637420323031332032303a31333a323220474d54c05a04677a69707738666f6f3d4153444a4b48514b425a584f5157454f50495541585157454f49553b206d61782d6167653d333630303b2076657273696f6e3d31",
    [
      "[1] (s = 98) set-cookie: foo=ASDJKHQKBZXOQWEOPIUAXQWEOIU; max-age=3600; version=1",
      "[2] (s = 52) content-encoding: gzip",
      "[3] (s = 65) date: Mon, 21 Oct 2013 20:13:22 GMT",
      "size 215",
    ]
  );
  // RFC 7541 C.6: three header lists on one connection, Huffman-coded, with a 256-byte table.
  const enc6 = new HpackEncoder(l256);
  const dec6 = new HpackDecoder(l256, l65536);
  rfcStep(
    t,
    "RFC 7541 C.6.1",
    enc6,
    dec6,
    [
      ":status",
      "302",
      "cache-control",
      "private",
      "date",
      "Mon, 21 Oct 2013 20:13:21 GMT",
      "location",
      "https://www.example.com",
    ],
    HPACK_INDEX_INCREMENTAL,
    true,
    "488264025885aec3771a4b6196d07abe941054d444a8200595040b8166e082a62d1bff6e919d29ad171863c78f0b97c8e9ae82ae43d3",
    [
      "[1] (s = 63) location: https://www.example.com",
      "[2] (s = 65) date: Mon, 21 Oct 2013 20:13:21 GMT",
      "[3] (s = 52) cache-control: private",
      "[4] (s = 42) :status: 302",
      "size 222",
    ]
  );
  rfcStep(
    t,
    "RFC 7541 C.6.2",
    enc6,
    dec6,
    [
      ":status",
      "307",
      "cache-control",
      "private",
      "date",
      "Mon, 21 Oct 2013 20:13:21 GMT",
      "location",
      "https://www.example.com",
    ],
    HPACK_INDEX_INCREMENTAL,
    true,
    "4883640effc1c0bf",
    [
      "[1] (s = 42) :status: 307",
      "[2] (s = 63) location: https://www.example.com",
      "[3] (s = 65) date: Mon, 21 Oct 2013 20:13:21 GMT",
      "[4] (s = 52) cache-control: private",
      "size 222",
    ]
  );
  rfcStep(
    t,
    "RFC 7541 C.6.3",
    enc6,
    dec6,
    [
      ":status",
      "200",
      "cache-control",
      "private",
      "date",
      "Mon, 21 Oct 2013 20:13:22 GMT",
      "location",
      "https://www.example.com",
      "content-encoding",
      "gzip",
      "set-cookie",
      "foo=ASDJKHQKBZXOQWEOPIUAXQWEOIU; max-age=3600; version=1",
    ],
    HPACK_INDEX_INCREMENTAL,
    true,
    "88c16196d07abe941054d444a8200595040b8166e084a62d1bffc05a839bd9ab77ad94e7821dd7f2e6c7b335dfdfcd5b3960d5af27087f3672c1ab270fb5291f9587316065c003ed4ee5b1063d5007",
    [
      "[1] (s = 98) set-cookie: foo=ASDJKHQKBZXOQWEOPIUAXQWEOIU; max-age=3600; version=1",
      "[2] (s = 52) content-encoding: gzip",
      "[3] (s = 65) date: Mon, 21 Oct 2013 20:13:22 GMT",
      "size 215",
    ]
  );

};

/** Appendix B's code for every symbol, LSB-aligned, eight hex digits each. */
const appendixBCodes = (): string =>
  [
    "00001ff8007fffd80fffffe20fffffe30fffffe40fffffe50fffffe60fffffe70fffffe800ffffea3ffffffc0fffffe90fffffea3ffffffd0fffffeb0fffffec",
    "0fffffed0fffffee0fffffef0ffffff00ffffff10ffffff23ffffffe0ffffff30ffffff40ffffff50ffffff60ffffff70ffffff80ffffff90ffffffa0ffffffb",
    "00000014000003f8000003f900000ffa00001ff900000015000000f8000007fa000003fa000003fb000000f9000007fb000000fa000000160000001700000018",
    "000000000000000100000002000000190000001a0000001b0000001c0000001d0000001e0000001f0000005c000000fb00007ffc0000002000000ffb000003fc",
    "00001ffa000000210000005d0000005e0000005f000000600000006100000062000000630000006400000065000000660000006700000068000000690000006a",
    "0000006b0000006c0000006d0000006e0000006f000000700000007100000072000000fc00000073000000fd00001ffb0007fff000001ffc00003ffc00000022",
    "00007ffd000000030000002300000004000000240000000500000025000000260000002700000006000000740000007500000028000000290000002a00000007",
    "0000002b000000760000002c00000008000000090000002d0000007700000078000000790000007a0000007b00007ffe000007fc00003ffd00001ffd0ffffffc",
    "000fffe6003fffd2000fffe7000fffe8003fffd3003fffd4003fffd5007fffd9003fffd6007fffda007fffdb007fffdc007fffdd007fffde00ffffeb007fffdf",
    "00ffffec00ffffed003fffd7007fffe000ffffee007fffe1007fffe2007fffe3007fffe4001fffdc003fffd8007fffe5003fffd9007fffe6007fffe700ffffef",
    "003fffda001fffdd000fffe9003fffdb003fffdc007fffe8007fffe9001fffde007fffea003fffdd003fffde00fffff0001fffdf003fffdf007fffeb007fffec",
    "001fffe0001fffe1003fffe0001fffe2007fffed003fffe1007fffee007fffef000fffea003fffe2003fffe3003fffe4007ffff0003fffe5003fffe6007ffff1",
    "03ffffe003ffffe1000fffeb0007fff1003fffe7007ffff2003fffe801ffffec03ffffe203ffffe303ffffe407ffffde07ffffdf03ffffe500fffff101ffffed",
    "0007fff2001fffe303ffffe607ffffe007ffffe103ffffe707ffffe200fffff2001fffe4001fffe503ffffe803ffffe90ffffffd07ffffe307ffffe407ffffe5",
    "000fffec00fffff3000fffed001fffe6003fffe9001fffe7001fffe8007ffff3003fffea003fffeb01ffffee01ffffef00fffff400fffff503ffffea007ffff4",
    "03ffffeb07ffffe603ffffec03ffffed07ffffe707ffffe807ffffe907ffffea07ffffeb0ffffffe07ffffec07ffffed07ffffee07ffffef07fffff003ffffee",
    "3fffffff",
  ].join("");

/** Appendix B's code length for every symbol, two decimal digits each. */
const appendixBLengths = (): string =>
  [
    "13232828282828282824302828302828",
    "28282828282830282828282828282828",
    "06101012130608111010081108060606",
    "05050506060606060606070815061210",
    "13060707070707070707070707070707",
    "07070707070707070807081319131406",
    "15050605060506060605070706060605",
    "06070605050607070707071511141328",
    "20222020222222232223232323232423",
    "24242223242323232321222322232324",
    "22212022222323212322222421222323",
    "21212221232223232022222223222223",
    "26262019222322252626262727262425",
    "19212627272627242121262628272727",
    "20242021222121232222252524242623",
    "26272626272727272728272727272726",
    "30",
  ].join("");

/** The `i`th of `n`-digit numbers in `text`, in base `radix`. */
const digitsAt = (text: string, i: i32, n: i32, radix: i32): i64 => {
  let v: i64 = 0;
  for (let k: i32 = i * n; k < i * n + n; k += 1) {
    v = v * toI64(radix) + toI64(nibbleOf(toI32(text.charCodeAt(k))));
  }
  return v;
};

/**
 * Appendix B, symbol by symbol. Each byte alone is Huffman-coded and must be
 * its code followed by all-ones padding to the byte, and those bytes must
 * decode to it. EOS cannot be encoded; its code padded must be refused. Every
 * byte value in one string is then taken both ways.
 */
export const huffmanChecks = (t: Suite): void => {
  const h = new HpackHuffman();
  const codes: string = appendixBCodes();
  const lengths: string = appendixBLengths();
  const l0: i32 = 0;
  const l1: i32 = 1;
  const l8: i32 = 8;
  let encodeMismatches: i32 = 0;
  let decodeMismatches: i32 = 0;
  for (let sym: i32 = 0; sym <= 256; sym += 1) {
    const code: i64 = digitsAt(codes, sym, 8, 16);
    const len: i32 = toI32(digitsAt(lengths, sym, 2, 10));
    const pad: i32 = (l8 - (len % l8)) % l8;
    const padded: i64 = (code << toI64(pad)) | ((toI64(1) << toI64(pad)) - toI64(1));
    const expected: u8[] = [];
    for (let k: i32 = (len + pad) / 8 - 1; k >= 0; k -= 1) {
      expected.push(toU8((padded >> toI64(k * 8)) & toI64(255)));
    }
    const decoded: u8[] = [];
    const verdict: i32 = hpackHuffmanDecode(h, expected, l0, toI32(expected.length), decoded);
    if (sym === 256) {
      t.eqI32("Appendix B EOS is refused inside a string", verdict, HPACK_ERR_HUFFMAN_EOS);
      continue;
    }
    const single: u8[] = [toU8(sym)];
    const encoded: u8[] = [];
    hpackHuffmanEncode(h, single, l0, l1, encoded);
    if (hexOf(encoded) !== hexOf(expected)) {
      t.eqStr(`Appendix B symbol ${sym} encodes`, hexOf(encoded), hexOf(expected));
      encodeMismatches += 1;
    }
    if (verdict !== HPACK_OK || hexOf(decoded) !== hexOf(single)) {
      t.eqStr(`Appendix B symbol ${sym} decodes`, hexOf(decoded), hexOf(single));
      decodeMismatches += 1;
    }
    if (hpackHuffmanLength(h, single, l0, l1) !== toI32(expected.length)) {
      t.eqI32(`Appendix B symbol ${sym} length`, hpackHuffmanLength(h, single, l0, l1), toI32(expected.length));
      encodeMismatches += 1;
    }
  }
  t.eqI32("Appendix B every byte encodes to its code", encodeMismatches, l0);
  t.eqI32("Appendix B every code decodes to its byte", decodeMismatches, l0);

  const all: u8[] = [];
  for (let v: i32 = 0; v < 256; v += 1) {
    all.push(toU8(v));
    all.push(toU8(255 - v));
  }
  const allCoded: u8[] = [];
  hpackHuffmanEncode(h, all, l0, toI32(all.length), allCoded);
  t.eqI32("Huffman length matches the coding", hpackHuffmanLength(h, all, l0, toI32(all.length)), toI32(allCoded.length));
  const allBack: u8[] = [];
  t.eqI32("every byte value decodes", hpackHuffmanDecode(h, allCoded, l0, toI32(allCoded.length), allBack), HPACK_OK);
  t.eqStr("every byte value round-trips", hexOf(allBack), hexOf(all));
  const empty: u8[] = [];
  const emptyCoded: u8[] = [];
  hpackHuffmanEncode(h, empty, l0, l0, emptyCoded);
  t.eqI32("the empty string codes to nothing", toI32(emptyCoded.length), l0);

  // A window in the middle of a buffer reads only the window.
  const framed: u8[] = bytesOf("ff1fff");
  const mid: u8[] = [];
  t.eqI32("a window decodes alone", hpackHuffmanDecode(h, framed, l1, l1, mid), HPACK_OK);
  t.eqStr("a window's symbols", textOf(mid), "a");
};

/**
 * What Appendix C does not reach: an entry larger than the table, eviction
 * long enough to compact the table's arrays, size updates both ways, and the
 * encoder's choice of representation when a table already holds the field.
 */
export const tableChecks = (t: Suite): void => {
  const l0: i32 = 0;
  const l60: i32 = 60;
  const l100: i32 = 100;
  const l4096: i32 = 4096;
  const l65536: i32 = 65536;

  // §4.4: an entry larger than the table empties it and is not added.
  const small = new HpackTable(l60);
  small.add(ascii("a"), ascii("b"));
  t.eqStr("a 34-byte entry fits a 60-byte table", tableDump(small), "[1] (s = 34) a: b\nsize 34");
  small.add(ascii("name"), ascii("a value of 25 bytes......"));
  t.eqStr("a 61-byte entry empties a 60-byte table", tableDump(small), "size 0");

  // Forty 50-byte entries through a 100-byte table: two fit at a time, and the
  // evicted prefix is dropped from the arrays along the way.
  const ring = new HpackTable(l100);
  for (let i: i32 = 0; i < 40; i += 1) {
    ring.add(ascii(`k${i % 10}`), ascii(`value-${i % 10}-01234567`));
  }
  t.eqStr(
    "two newest of forty survive eviction",
    tableDump(ring),
    "[1] (s = 50) k9: value-9-01234567\n[2] (s = 50) k8: value-8-01234567\nsize 100"
  );
  ring.resize(l60);
  t.eqStr("a smaller maximum evicts the oldest", tableDump(ring), "[1] (s = 50) k9: value-9-01234567\nsize 50");
  ring.resize(l0);
  t.eqStr("a maximum of zero empties the table", tableDump(ring), "size 0");

  // The encoder: a full match by index unless never indexed, a name from the
  // dynamic table, and size updates at the start of the next block.
  const enc = new HpackEncoder(l4096);
  const dec = new HpackDecoder(l4096, l65536);
  const first: u8[] = [];
  enc.encodeField(first, ascii(":method"), ascii("GET"), HPACK_INDEX_NEVER, false);
  t.eqStr("never indexed stays a literal even for a static match", hexOf(first), "1203474554");
  enc.encodeField(first, ascii(":method"), ascii("GET"), HPACK_INDEX_WITHOUT, false);
  enc.encodeField(first, ascii("x-key"), ascii("one"), HPACK_INDEX_INCREMENTAL, false);
  enc.encodeField(first, ascii("x-key"), ascii("two"), HPACK_INDEX_WITHOUT, false);
  enc.encodeField(first, ascii("x-key"), ascii("one"), HPACK_INDEX_WITHOUT, false);
  t.eqStr(
    "a full match by index, and a name from the dynamic table",
    hexOf(first),
    "1203474554824005782d6b6579036f6e650f2f0374776fbe"
  );
  t.eqI32("that block decodes", decodeHex(dec, hexOf(first)), HPACK_OK);
  t.eqStr("its fields", decodedDump(dec), ":method: GET\n:method: GET\nx-key: one\nx-key: two\nx-key: one");
  t.eqBool("the first is never indexed", dec.neverIndexed[0], true);
  t.eqBool("the second is not", dec.neverIndexed[1], false);

  // Down to 0 and back up to 100 between blocks: two updates, smallest first.
  enc.setMaxTableSize(l0);
  enc.setMaxTableSize(l100);
  const second: u8[] = [];
  enc.encodeField(second, ascii(":method"), ascii("GET"), HPACK_INDEX_INCREMENTAL, false);
  t.eqStr("a lowered then raised size sends both updates", hexOf(second), "203f4582");
  t.eqI32("the decoder takes both", decodeHex(dec, hexOf(second)), HPACK_OK);
  t.eqStr("and the table emptied", tableDump(dec.table), "size 0");
  t.eqI32("the decoder's maximum follows", dec.table.maxSize, l100);
  enc.setMaxTableSize(l60);
  const third: u8[] = [];
  enc.encodeField(third, ascii(":method"), ascii("GET"), HPACK_INDEX_INCREMENTAL, false);
  t.eqStr("one update when the size only went down", hexOf(third), "3f1d82");
  t.eqI32("decodes", decodeHex(dec, hexOf(third)), HPACK_OK);

  // A lowered SETTINGS limit, answered with the update it requires.
  dec.setSettingsLimit(l0);
  t.eqI32("an update to the lowered limit is accepted", decodeHex(dec, "2082"), HPACK_OK);
  t.eqI32("the next block owes nothing", decodeHex(dec, "82"), HPACK_OK);
  dec.setSettingsLimit(l4096);
  t.eqI32("a limit above the table's maximum owes nothing", decodeHex(dec, "82"), HPACK_OK);

  // A header list over the caller's limit: decoded to the end so the table
  // stays in step, its fields dropped, and the decoder still usable. C.3.1's
  // fields are 42, 43, 38 and 57 bytes; the limit admits the first two.
  const capped = new HpackDecoder(l4096, l100);
  t.eqI32(
    "a list over the limit is not fatal",
    decodeHex(capped, "828684410f7777772e6578616d706c652e636f6d"),
    HPACK_LIST_TOO_LARGE
  );
  t.eqStr("the fields within the limit are kept", decodedDump(capped), ":method: GET\n:scheme: http");
  t.eqStr("the table still took its entry", tableDump(capped.table), "[1] (s = 57) :authority: www.example.com\nsize 57");
  t.eqI32("the next block decodes", decodeHex(capped, "be"), HPACK_OK);
  t.eqStr("against the same table", decodedDump(capped), ":authority: www.example.com");

  // Indexes past the limit are counted, not copied: a 100-byte entry, then
  // four indexes naming it, against a 200-byte limit keeps the first two.
  const l2: i32 = 2;
  const l200: i32 = 200;
  const bomb = new HpackDecoder(l4096, l200);
  const bombBlock: u8[] = [];
  const bombEnc = new HpackEncoder(l4096);
  const longValue: string[] = [];
  for (let i: i32 = 0; i < 67; i += 1) {
    longValue.push("v");
  }
  for (let i: i32 = 0; i < 5; i += 1) {
    bombEnc.encodeField(bombBlock, ascii("k"), ascii(longValue.join("")), HPACK_INDEX_INCREMENTAL, false);
  }
  t.eqStr("a literal then four indexes", hexOf(bombBlock).substring(134 + 8), "bebebebe");
  t.eqI32("a list of repeated indexes over the limit", bomb.decode(bombBlock, l0, toI32(bombBlock.length)), HPACK_LIST_TOO_LARGE);
  t.eqI32("keeps the fields within it", toI32(bomb.names.length), l2);
};

/** One block the decoder must refuse, with the code it must answer. */
const refuse = (t: Suite, label: string, hex: string, code: i32): void => {
  const l4096: i32 = 4096;
  const l65536: i32 = 65536;
  const l0: i32 = 0;
  const dec = new HpackDecoder(l4096, l65536);
  t.eqI32(label, decodeHex(dec, hex), code);
  t.eqI32(`${label}, and no fields`, toI32(dec.names.length), l0);
};

/** Every refusal the module comment lists, each reached by a block of its own. */
export const refusalChecks = (t: Suite): void => {
  const l0: i32 = 0;
  const l100: i32 = 100;
  const l4096: i32 = 4096;
  const l65536: i32 = 65536;

  refuse(t, "an index cut short", "ff", HPACK_ERR_TRUNCATED);
  refuse(t, "an integer cut short after a continuation byte", "ff80", HPACK_ERR_TRUNCATED);
  refuse(t, "a literal with no value", "41", HPACK_ERR_TRUNCATED);
  refuse(t, "a literal with no name", "40", HPACK_ERR_TRUNCATED);
  refuse(t, "a string longer than the block", "4105abcd", HPACK_ERR_TRUNCATED);
  refuse(t, "a name string longer than the block", "0005ab", HPACK_ERR_TRUNCATED);
  refuse(t, "an index past 2^31 - 1", "ffffffffff7f", HPACK_ERR_INTEGER_OVERFLOW);
  refuse(t, "an index padded past five continuation bytes", "ff808080808000", HPACK_ERR_INTEGER_OVERFLOW);
  refuse(t, "a string length past 2^31 - 1", "007fffffffff7f", HPACK_ERR_INTEGER_OVERFLOW);
  refuse(t, "index 0", "80", HPACK_ERR_INDEX);
  refuse(t, "an index past the static table, with no dynamic entries", "be", HPACK_ERR_INDEX);
  refuse(t, "a literal's name index past the tables", "7e0161", HPACK_ERR_INDEX);
  refuse(t, "a never-indexed name index past the tables", "1f2f0161", HPACK_ERR_INDEX);
  refuse(t, "Huffman padding of eleven bits", "41821fff", HPACK_ERR_HUFFMAN_PADDING);
  refuse(t, "Huffman padding that is not all ones", "418118", HPACK_ERR_HUFFMAN_PADDING);
  refuse(t, "a Huffman name with bad padding", "0081180161", HPACK_ERR_HUFFMAN_PADDING);
  refuse(t, "EOS inside a Huffman string", "4184ffffffff", HPACK_ERR_HUFFMAN_EOS);
  refuse(t, "a size update above the SETTINGS limit", "3fe21f", HPACK_ERR_TABLE_SIZE);
  refuse(t, "a size update after a field", "8220", HPACK_ERR_SIZE_UPDATE_POSITION);
  refuse(t, "a size update cut short", "3f", HPACK_ERR_TRUNCATED);

  const ok = new HpackDecoder(l4096, l65536);
  t.eqI32("a size update to the SETTINGS limit is accepted", decodeHex(ok, "3fe11f82"), HPACK_OK);

  // §4.2: a lowered limit must be answered at the start of the next block,
  // by an update to at most the smallest limit set since.
  const owed = new HpackDecoder(l4096, l65536);
  owed.setSettingsLimit(l100);
  t.eqI32("a block without the owed update", decodeHex(owed, "82"), HPACK_ERR_SIZE_UPDATE_MISSING);
  t.eqI32("is fatal: the next block answers the same", decodeHex(owed, "3f4582"), HPACK_ERR_SIZE_UPDATE_MISSING);
  const empty = new HpackDecoder(l4096, l65536);
  empty.setSettingsLimit(l100);
  t.eqI32("an empty block without the owed update", decodeHex(empty, ""), HPACK_ERR_SIZE_UPDATE_MISSING);
  const raised = new HpackDecoder(l4096, l65536);
  raised.setSettingsLimit(l0);
  raised.setSettingsLimit(l4096);
  t.eqI32("an update above the smallest limit since", decodeHex(raised, "3f4582"), HPACK_ERR_TABLE_SIZE);
  const raisedOk = new HpackDecoder(l4096, l65536);
  raisedOk.setSettingsLimit(l0);
  raisedOk.setSettingsLimit(l4096);
  t.eqI32("an update to the smallest, then to the final", decodeHex(raisedOk, "203fe11f82"), HPACK_OK);

  // The primitives answer the same refusals when called directly.
  const h = new HpackHuffman();
  const cut: u8[] = bytesOf("8a61");
  const cutCursor = new HpackCursor(cut, l0, toI32(cut.length));
  const cutOut: u8[] = [];
  t.eqI32("a string cut short, read directly", hpackDecodeString(h, cutCursor, cutOut), HPACK_ERR_TRUNCATED);
  const none: u8[] = [];
  const noneCursor = new HpackCursor(none, l0, l0);
  t.eqI32("a string from an empty block", hpackDecodeString(h, noneCursor, cutOut), HPACK_ERR_TRUNCATED);
  t.eqI32("an integer from an empty block", hpackDecodeInteger(noneCursor, 7), HPACK_ERR_TRUNCATED);
};

/** Every check, for `main` and for the f64 twin. */
export const hpackChecks = (): i32 => {
  const t = new Suite("hpack");
  rfcChecks(t);
  huffmanChecks(t);
  tableChecks(t);
  refusalChecks(t);
  return t.done();
};
