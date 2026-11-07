# Compression

`nish/compress/gzip`, `nish/compress/zlib` and `nish/compress/deflate`
compress and decompress the three formats the web and most file formats use:
gzip (RFC 1952), zlib (RFC 1950) and the raw DEFLATE stream (RFC 1951) inside
both. `nish/compress/checksum` holds their checksums, CRC-32 and Adler-32.
`nish/net/http-compress` puts gzip on an HTTP response. They are written in
Nish and imported like any other library module
([`export` and `import`](../../LANGUAGE.md#export-and-import)); what they
write, Node's `zlib`, browsers and `gunzip` read, and what those write, they
read.

## Compressing a buffer

Every call works on buffers you own: the input is a window `src[off .. off +
len)`, the output goes into `out` from `at`, and the answer is where the output
ends. Build the compressor once and keep it — it holds its tables, about
330 KB — and a call allocates nothing:

```ts nish:ok
import { DEFLATE_FAST, compressBound } from "nish/compress/deflate";
import { GzipCompressor, GzipDecompressor } from "nish/compress/gzip";

export const main = (): number => {
  const text: string = '{"items":[{"id":1,"title":"one"},{"id":2,"title":"two"},{"id":3,"title":"three"}]}';
  const body: u8[] = [];
  for (let k: i32 = 0; k < 40; k++) {
    for (let i: i32 = 0; i < toI32(text.length); i++) {
      body.push(toU8(text.charCodeAt(i)));
    }
  }
  const n: i32 = toI32(body.length);

  const gz = new GzipCompressor(DEFLATE_FAST); // once
  const out: u8[] = new Array<u8>(compressBound(n)); // once, for the largest body
  const end: i32 = gz.compress(body, 0, n, out, 0);
  console.log(`${n} bytes -> ${end}`);

  const gunzip = new GzipDecompressor();
  const back: u8[] = new Array<u8>(n);
  const got: i32 = gunzip.decompress(out, 0, end, back, 0, n);
  console.log(`back: ${got}`);
  return 0;
};
```

`compressBound(n)` is the most any level writes for `n` bytes in any of the
three formats, so an output that big never runs out; a smaller one may, and
then `compress` answers `-1` (`DEFLATE_NO_ROOM`) and you can retry with more
room or send the body as it is.

The level is a number from 0 to 9. `DEFLATE_FAST` (1) is the one for a server:
it matches greedily, within about 1.3 times libdeflate's level-1 time at the
same size, and faster than zlib, Go, Java, Node and Python
(`bench/gzip/compare/`). `DEFLATE_DEFAULT` (6) matches lazily for a few
percent smaller output in about twice the time, and `DEFLATE_BEST` (9) tries
hardest. Decompression is second only to libdeflate's among those libraries.
`DEFLATE_STORE` (0) only frames the bytes. Whatever the level, a block that
compression would make larger is stored instead.

For a one-off there are free functions — `gzipCompress(src, off, len, out,
at, level)`, `gzipDecompress(src, off, len, out, at, limit)` and their zlib
and raw twins — which build the compressor for that call, so do not use them
in a loop.

## Decompressing what someone else sent

Decompression takes a `limit`: the most bytes it will write. A stream that
would produce more answers `DEFLATE_ERR_OUTPUT_LIMIT` instead, so a client
cannot send you 1 KB that expands to a gigabyte. A stream that is malformed in
any way — cut short, a corrupted Huffman table, a match that reaches back
before the start, a wrong CRC-32 or length, bytes after the end — answers a
negative error code and never panics:

| Code | Means |
| --- | --- |
| `DEFLATE_ERR_TRUNCATED` | the input ends inside the stream |
| `DEFLATE_ERR_OUTPUT_LIMIT` | the output would pass `limit` or the end of `out` |
| `DEFLATE_ERR_HUFFMAN`, `DEFLATE_ERR_SYMBOL`, `DEFLATE_ERR_BLOCK_TYPE`, `DEFLATE_ERR_STORED_LENGTH`, `DEFLATE_ERR_DISTANCE` | the DEFLATE stream is malformed |
| `DEFLATE_ERR_TRAILING` | bytes follow a zlib or raw stream |
| `GZIP_ERR_HEADER`, `GZIP_ERR_CRC`, `GZIP_ERR_SIZE` | gzip's header, CRC-32 or length is wrong, or something other than another gzip member follows one |
| `ZLIB_ERR_HEADER`, `ZLIB_ERR_ADLER`, `ZLIB_ERR_DICTIONARY` | zlib's header or Adler-32 is wrong, or the stream needs a preset dictionary |

```ts nish:ok
import { DEFLATE_ERR_OUTPUT_LIMIT, DEFLATE_FAST } from "nish/compress/deflate";
import { GzipCompressor, GzipDecompressor } from "nish/compress/gzip";

export const main = (): number => {
  const zeros: u8[] = new Array<u8>(1000000);
  zeros.fill(0);
  const packed: u8[] = new Array<u8>(1100000);
  const end: i32 = new GzipCompressor(DEFLATE_FAST).compress(zeros, 0, 1000000, packed, 0);
  console.log(`a megabyte of zeros is ${end} bytes of gzip`);

  const into: u8[] = new Array<u8>(65536);
  const r: i32 = new GzipDecompressor().decompress(packed, 0, end, into, 0, 65536);
  console.log(r === DEFLATE_ERR_OUTPUT_LIMIT ? "refused: more than 64 KB" : `${r}`);
  return 0;
};
```

Several gzip members one after another (what `cat a.gz b.gz` makes) are
decompressed one after another into the same output.

## Streaming

For a body that does not fit in one buffer, `GzipWriter` compresses it in
pieces and `GzipReader` decompresses it in pieces. A writer takes `write(src,
off, len, out, at)` calls and answers where the output it produced ends — often
nothing yet, since it compresses 64 KB at a time — then `flush` (everything so
far becomes decodable) and `finish` (the last block and the trailer). Give each
call at least `bound(len)` bytes of output room.

```ts nish:ok
import { GzipReader, GzipWriter, GZIP_END, GZIP_NEED_INPUT } from "nish/compress/gzip";

export const main = (): number => {
  const w = new GzipWriter(6);
  const stream: u8[] = [];
  const piece: u8[] = new Array<u8>(w.bound(1000));
  const line: u8[] = [];
  for (let i: i32 = 0; i < 1000; i++) {
    line.push(toU8(97 + (i % 26)));
  }
  for (let k: i32 = 0; k < 300; k++) {
    const end: i32 = w.write(line, 0, 1000, piece, 0);
    for (let i: i32 = 0; i < end; i++) {
      stream.push(piece[i]);
    }
  }
  const last: i32 = w.finish(piece, 0);
  for (let i: i32 = 0; i < last; i++) {
    stream.push(piece[i]);
  }

  // Read it back 500 bytes of input at a time.
  const r = new GzipReader(toI64(1000000));
  const out: u8[] = new Array<u8>(4096);
  let fed: i32 = 0;
  let total: i32 = 0;
  while (true) {
    const n: i32 = r.read(out, 0, 4096);
    if (n > 0) {
      total += n;
    } else if (n === GZIP_NEED_INPUT && fed < toI32(stream.length)) {
      fed += r.feed(stream, fed, Math.min(500, toI32(stream.length) - fed));
    } else if (n === GZIP_NEED_INPUT) {
      r.endInput();
    } else {
      console.log(n === GZIP_END ? `read ${total} bytes` : `error ${n}`);
      break;
    }
  }
  return 0;
};
```

The reader holds its own input and output buffers, about 100 KB, and never
grows them: `inputBuffer()` / `inputEnd()` / `commit(n)` let you read from a
socket straight into it, and `feed` copies a window in. `read` answers bytes
decoded, `GZIP_NEED_INPUT`, `GZIP_END`, or an error code, which it answers
again from then on.

## Compressing HTTP responses

`nish/net/http-compress` reads a request's `Accept-Encoding` and gzips a
response body. It is opt-in: nothing is compressed unless your program asks,
and an `HttpCompressor` declines a body shorter than its `minLength`, longer
than its `maxLength`, or that gzip would not make smaller. On HTTP/1.1 one call
does all of it — `Content-Encoding: gzip`, the compressed `Content-Length`,
and `Vary: Accept-Encoding` on every response whose form depended on the
request, so that caches keep the two forms apart:

```ts
const enc = new HttpCompressor(DEFLATE_FAST, 1024, 65536); // once per thread
// when a request arrives on `conn`:
conn.respondEncoded(200, names, values, body, 0, n, enc, conn.acceptEncoding());
```

`acceptEncoding()` and the rest of the request's head (`targetIs`, its fields)
read as this request's from `H1_REQUEST` through its `H1_END`, so you can
answer at `H1_END` even when the client has pipelined the next request behind
it; the next request's head replaces it only when you ask for that request.

`respondEncoded` writes the whole response or nothing: `H1_AGAIN` when the
output has no room for it yet (`H1_WRITE` says when to call again) and
`H1_INVALID` for one larger than the connection's `outputSize` could ever
hold. On HTTP/2 and HTTP/3, read the field yourself and add the fields the
compressor builds:

```ts nish:ok
import { DEFLATE_FAST } from "nish/compress/deflate";
import { HTTP_CODING_GZIP, HTTP_OFFER_GZIP, HttpCompressor, httpAcceptEncoding } from "nish/net/http-compress";

const ascii = (s: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    out.push(toU8(s.charCodeAt(i)));
  }
  return out;
};

export const main = (): number => {
  const accept: u8[] = ascii("gzip, deflate, br, zstd");
  const coding: i32 = httpAcceptEncoding(accept, 0, toI32(accept.length), HTTP_OFFER_GZIP);
  console.log(coding === HTTP_CODING_GZIP ? "gzip" : "identity");

  const enc = new HttpCompressor(DEFLATE_FAST, 256, 65536);
  const body: u8[] = ascii('{"feed":"home","items":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90]}');
  const m: i32 = enc.compress(coding, body, 0, toI32(body.length));
  if (m >= 0) {
    enc.addFields([ascii("content-type")], [ascii("application/json")]);
    // h2.respond(id, 200, enc.names, enc.values, false); h2.write(id, enc.output, 0, m);
    console.log(`${toI32(body.length)} bytes -> ${m}, ${toI32(enc.names.length)} fields`);
  }
  return 0;
};
```

### Compressing only when it pays

Compressing costs CPU on every response, and a body that already fits in one
TCP segment arrives no sooner gzipped. An `HttpCompressor` sends the
compressed form only when it is worth it:

- `minLength`: shorter bodies are sent as they are, uncompressed.
- `minSaving` and `minSavingPercent`: the compressed body must be at least
  that many bytes, and that percentage, smaller. By default any saving counts.
- `segmentMode`: `respondEncoded` sends the compressed response only when,
  head included, it takes fewer TCP segments than the plain one. Segments
  are this many bytes, the first of these that is set: the connection's own
  `mss`, if you set it after accepting it; the compressor's `mss`, if you
  set it to other than its default `HTTP_DEFAULT_MSS`; the MSS
  `Http1Server` read from the connection's socket when it accepted it,
  where the platform reports one (`TCP_INFO` on Linux, `TCP_MAXSEG` on
  macOS; `Http1TlsServer` reads none); otherwise `HTTP_DEFAULT_MSS` (1448,
  an Ethernet path's). `segmentMss(enc)` on the connection answers which.
  Each accept starts a connection with neither of its own set, so one
  peer's MSS never reaches the next. A response that already fits in one
  segment as it is, head and body, is sent as it is without running the
  encoder at all, and carries no `Vary`: gzip could not make it arrive any
  sooner. Larger responses are compressed first and then compared.

When a body does not pay, it goes out as it is and the compressed bytes are
dropped. After each call, `decision` says what happened and why:
`HTTP_COMPRESS_SENT`, `HTTP_COMPRESS_NOT_ACCEPTED`, `HTTP_COMPRESS_TOO_SMALL`,
`HTTP_COMPRESS_TOO_LARGE`, `HTTP_COMPRESS_TOO_LITTLE_SAVED` or
`HTTP_COMPRESS_NO_FEWER_SEGMENTS`. Count these to see what compression
does for your traffic.

Bodies up to `fixedLimit` (16 KB) go through a small-body encoder: one
fixed-Huffman block, no state kept between calls. On 0.5 to 16 KB of JSON
it runs two to four times faster than `DEFLATE_FAST`, and its output is
about a third larger. Larger bodies use the level you gave. To force one
encoder for every size, set `encoder` to `HTTP_ENCODER_FIXED` or
`HTTP_ENCODER_LEVEL`.

```ts nish:ok
import { DEFLATE_FAST } from "nish/compress/deflate";
import {
  HTTP_CODING_GZIP,
  HTTP_COMPRESS_SENT,
  HTTP_COMPRESS_TOO_LITTLE_SAVED,
  HttpCompressor,
} from "nish/net/http-compress";

export const main = (): number => {
  const enc = new HttpCompressor(DEFLATE_FAST, 0, 65536);
  enc.minSavingPercent = 20;
  const item = '{"id":1,"ok":true},';
  const json: u8[] = [];
  for (let i: i32 = 0; i < 100; i++) {
    for (let k: i32 = 0; k < toI32(item.length); k++) {
      json.push(toU8(item.charCodeAt(k)));
    }
  }
  const noise: u8[] = [];
  let x: u32 = toU32(1);
  for (let i: i32 = 0; i < 1000; i++) {
    x = x * toU32(1103515245) + toU32(12345);
    noise.push(toU8(x >> toU32(24)));
  }
  const m: i32 = enc.compress(HTTP_CODING_GZIP, json, 0, toI32(json.length));
  console.log(enc.decision === HTTP_COMPRESS_SENT ? `json: ${toI32(json.length)} -> ${m}` : "json: as it is");
  enc.compress(HTTP_CODING_GZIP, noise, 0, toI32(noise.length));
  console.log(enc.decision === HTTP_COMPRESS_TOO_LITTLE_SAVED ? "noise: as it is" : "noise: gzip");
  return 0;
};
```

`Vary: Accept-Encoding` goes on a response that was compressed, and on one
sent as it is because the request did not accept gzip. A body that is too
small, too large or did not pay is sent the same to every client, so it
carries no `Vary`. A request that refuses identity (`identity;q=0`) but
accepts gzip is sent gzip whatever the policy says.

The negotiation follows RFC 9110: q-values (`gzip;q=0` refuses gzip), `*`,
`x-gzip`, and `identity`, which is acceptable unless the field gives it q=0. A
request with no `Accept-Encoding` gets identity. `HTTP_CODING_NONE` means the
client accepts nothing you offer and refuses identity too; answer 406 or send
the body as it is.

**Do not compress a secret beside what an attacker chooses.** A response that
holds a CSRF token or a session id and also echoes text from the request lets
an attacker who can make requests learn the secret from the compressed length,
a byte at a time (the BREACH attack). Compress responses that carry no secret,
or none that sits beside attacker-controlled text; the record is
[docs/security/compress.md](../../security/compress.md).

## Checksums

`nish/compress/checksum` gives CRC-32 (`Crc32`, whose eight lookup tables you
build once, and `crc32` for a one-off) and Adler-32 (`adler32`,
`adler32Update`). Both continue a running value, so a stream can be summed in
pieces: start CRC-32 from 0 and Adler-32 from 1. Neither is a cryptographic
hash; use [`nish/crypto`](standard-library.md#nishcrypto) for that.

A native build on a CPU with the instructions for it computes CRC-32 there:
PCLMULQDQ on x86-64, the ARMv8 CRC32 instructions on AArch64. The binary
still runs on any CPU of its target, because the choice is made when the
program first checksums, not when it is compiled. The answer is the same
either way, gzip's trailers included. Set `NISH_CRC32=soft` to make a process
use the lookup tables instead, to compare timings or rule the kernel out. Only
the exact value `soft` is read; any other value is ignored:

```bash
NISH_CRC32=soft ./my-program
```

Under Node, in wasm, on 32-bit targets, on big-endian AArch64, and on
AArch64 under an OS other than Linux and macOS, the tables always run.

These modules read and write arrays through `nish:unsafe`'s unchecked access
in their inner loops (each site is justified in the record), so a program
built with `--deny unsafe` cannot import them.
