# Security record: static files

The record of `nish/net/static`, which serves the files under one directory
through `nish/net/http-server` (HTTP/1.1, HTTP/2 over TLS and cleartext,
HTTP/3) and through `nish/net/handler` (HTTP/1.1). It says which request
paths it refuses and how, what it reads from the request's fields and what
a malformed one gets, what its cache holds and when that goes stale, and the
test that pins each property. It is written with the code rather than after
an audit, so that the audit of the HTTP application layer starts from
evidence.

Anchors are function names in `std/net/static.ts` at `481f58c6`, the last
commit to change it on the head that merges this record.

**Result.** A request path is served only when it decodes cleanly, has no
empty, dot-led, backslash or control-byte segment, and resolves, symbolic
links followed, to the root's real path or under it; anything else answers
`STATIC_NOT_FOUND` with `refused` set and sends nothing (STATIC-1 to
STATIC-3). Under `--sandbox --allow fs.read=<root>` the kernel holds the
reads to the root as well (STATIC-4). A `Range`, `If-None-Match`,
`If-Modified-Since`, `If-Range` or `Accept-Encoding` value of any bytes and
length is read inside its span and answers 200, 206, 304 or 416, never more
than the file (STATIC-5, STATIC-6). The cache's memory is bounded by limits
the program sets, and a file whose size or modification time moved is read
again (STATIC-7, STATIC-8). One Low finding was fixed: a cache limit past
2^30 could overflow the slot's size (STATIC-13). Four Low findings are left
open: a file that shrinks, or whose read fails, while it is sent, its
missing bytes sent as zeros (STATIC-9), a link swapped
between the check and the open (STATIC-10), a change of the same size within
the same millisecond (STATIC-11), and the module not being proven free of
panics (STATIC-12).

## Scope

| File | Functions |
| --- | --- |
| `std/net/static.ts` | `StaticLimits`; `StaticFiles` (`serve`, `serveHandler`, `staticPlan`, `staticResolve`, `staticAccept`, `staticSecond`, `staticTag`, `staticSameTag`, `staticNoneMatch`, `staticIfRange`, `staticRange`, `staticLoad`, `staticFill`, `staticClose`, `staticBodyLength`, `staticFields`); `staticContentType`; the helpers `staticLower`, `staticIs`, `staticSpace`, `staticDigits`, `staticTwo`, `staticDate`, `staticNumber`, `staticQ`, `staticCut` |

Out of scope: the carriers that parse the request and frame the answer
(`docs/security/http-server.md`, `handler.md`, `http1-codec.md`, `http2.md`,
`http3.md`), the router that hands the program its `*` span (`router.md`),
`percentDecode` (`url.md`), and the runtime's `realpathSync`, `fileOpen` and
`fileReadAt` (`runtime.md`).

## Threat model

The attacker is the client: the path span and every request field are
theirs, any bytes of any length, as many requests as the carrier lets them
send. A win is a byte served from outside the root, a panic, a read outside
a span or an array, time or memory a request can make the module spend
beyond its own length and the program's limits, or a stale or wrong body
sent under a validator that says it is current.

The directory and its contents are the operator's and are trusted to hold
what should be served; someone who can write into it is outside this model
except where STATIC-10 and STATIC-11 say what such a writer can do. The
limits are the program's: out of range, they fail closed.

## Findings

STATIC-1 to STATIC-8 are the shapes an attacker's request can take, each
checked and found to hold; they are recorded so that the audit can see what
was tried, and are not counted in the index. STATIC-9 to STATIC-12 are open;
STATIC-13 to STATIC-15 are fixed.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| STATIC-1 | High if it failed | `staticResolve` | A path must not climb out of the root by `..`, in any spelling: raw, percent-encoded in either case, behind an encoded `/` or `\`, or after a NUL. | **Holds.** The span is decoded once, strictly (`percentDecode` refuses `%00` and a bad escape), then split on `/`; a segment that is empty, starts with `.` (so `.`, `..` and every dotfile), or holds a byte below 32, 127 or `\` refuses the whole path. An encoded `/` decodes to a separator before the split, so it is checked like a raw one. |
| STATIC-2 | High if it failed | `staticResolve` | A symbolic link inside the root that points out of it must not be followed out, nor a precompressed sibling that is one. | **Holds.** The joined path is resolved by `realpathSync` and served only when the result starts with the root's own real path and a `/`; so is each `.br` and `.gz` sibling before it replaces the file. A link out answers `STATIC_NOT_FOUND` with `refused` set. |
| STATIC-3 | Medium if it failed | `staticResolve`, `fileOpen` | A path that names a directory, a FIFO or a device must not hang or serve it. | **Holds.** `fileOpen` hands out only a regular file (a directory is -21, anything else -22, and `O_NONBLOCK` stops a FIFO from hanging the open), which is a 404. A path that ends in `/` serves that directory's `index.html` when `index` is on, and is a 404 otherwise. |
| STATIC-4 | High if it failed | the sandbox, `fs.read=<root>` | A program built with `--sandbox --allow fs.read=<root>` must not read beside its root even when told to serve there. | **Holds** where the kernel has Landlock: the same binary pointed at a directory beside its grant answers 404 for a file there. Without Landlock the sandbox cannot hold reads to a path (`sandbox.md`), and STATIC-1 and STATIC-2 are what remain. |
| STATIC-5 | Medium if it failed | `staticRange`, `staticNumber`, `staticIfRange` | A `Range` must not make the module read or send past the file, nor overflow: a start past the end, a last before the first, an empty suffix, a number of 19 digits, not a number, another unit, several ranges. | **Holds.** One `bytes=` range answers 206 with `from` and `to` clamped inside the file; a number longer than 18 digits, not a number, a start at or past the size, a last before the first, an empty suffix or a range of an empty file answers 416 with `bytes */<size>`. A list or another unit is answered 200 whole. `If-Range` keeps the range only for an equal strong ETag, or for a date that parses to the file's `Last-Modified` second when the file has been unchanged for a second or more (RFC 9110 §13.1.5); STATIC-14 is the finding that added the second. |
| STATIC-6 | Medium if it failed | `staticAccept`, `staticQ`, `staticNoneMatch`, `staticDate` | A malformed `Accept-Encoding`, `If-None-Match` or `If-Modified-Since` must not panic, read past its span, or choose a coding the client refused. | **Holds.** Each is read inside the `[start, end)` span its carrier gave. An `Accept-Encoding` element whose `q=` value is not a q-value, or with bytes after its token and no `;`, is skipped; a parameter other than `q=` is not read, so `gzip;foo=bar` counts as `gzip` at q=1; `q=0` refuses a coding and `*` stands for one not named. The file as it is is sent when no sibling is acceptable, even under `identity;q=0` or `*;q=0`: RFC 9110 §12.5.3 lets a server disregard the field rather than answer 406, and a 406 would leave the client with nothing. `If-Modified-Since` is read only in the IMF-fixdate form; any other text is ignored and the file is sent. |
| STATIC-7 | Medium if it failed | `StaticFiles` (constructor), `staticLoad` | Requests must not grow the cache's memory without bound. | **Holds.** The cache has `maxEntries` slots (1 to 4096), each holding a file of at most `maxCachedBytes` (0 to 2^30) in a buffer rounded up to a power of two, so the doubling cannot overflow; keys are at most `maxPath` + 16 bytes. The constructor keeps its own copy of the limits (STATIC-15). Limits out of range leave `root` empty, so every `GET` or `HEAD` is a 404 (another method a 405) rather than a panic or an allocation the program did not ask for. A larger file is streamed a 64 KiB chunk at a time. A request adds no slot that the limits do not already count: the hand replaces the oldest. |
| STATIC-8 | Medium if it failed | `staticLoad`, `staticTag` | A cached file must not be served after it changed on disk, under its old ETag. | **Holds** for a change of size or modification time: each request opens and stats the file again, and a slot whose size or time differs is read again before it is sent, with an ETag made from the new pair. A removed file is a 404. STATIC-11 is the change this does not see. |
| STATIC-9 | Low | `staticFill` | A file streamed from disk that shrinks after its size was read, or whose read fails (a negative errno such as EIO), is sent with the declared length, the bytes it could not read as zeros, because the head has gone out and no carrier offers an abort. | **Open.** A file larger than `maxCachedBytes` streams; so does a cacheable one whose read into its slot comes up short or fails (`staticLoad` leaves `slot` at -1), and its chunks are read again, each one short or failed sent as zeros. A file read whole into its slot is served from memory. A writer of the served directory, or a failing disk, can do this; a client cannot. |
| STATIC-10 | Low | `staticResolve` | The path is checked by `realpathSync` and then opened by name, so a link swapped in between could be followed out of the root. | **Open.** Only someone who can write into the served directory can swap it. `--sandbox --allow fs.read=<root>` still holds the open to the root where the kernel has Landlock (STATIC-4). |
| STATIC-11 | Low | `staticResolve`, `staticLoad`, `staticTag` | A file rewritten with the same size within the same millisecond keeps its slot and its ETag, so the old bytes are served as current. | **Open.** The size and the modification time are what the module has to compare; reading the file to hash it on each request would undo the cache. A writer that changes a file in place can rename a new one over it instead. The time is read before the file is opened, so a rename between the two pairs the new bytes with the older time: that request is served under a tag no later request repeats, and the next one reads the file again. Read after the open, the older bytes could have been cached under the newer time for good. |
| STATIC-12 | Low | `std/net/static.ts` | The module is not proven free of panics: some indexes are sites the prover cannot discharge, and the carriers' `header` it calls is not proven either; `examples/http-app` is built with `--allow-panics` for this and the modules it already named. | **Open.** No request in the tests reaches a panic, and every span and range the module indexes with is checked first. |
| STATIC-13 | Low | `StaticFiles` (constructor), `staticLoad` | A program that set `maxCachedBytes` past 2^30 and served a file that large overflowed the `i32` doubling that sizes the slot, a panic. A program's limit, not a client's choice, but the client picks the file. | **Fixed.** The constructor takes `maxCachedBytes` from 0 to 2^30 only; past it the root is empty and nothing is served. Before: the limits were accepted. After: `limits out of range: a cache past 2^30, nothing served`. |
| STATIC-14 | Low | `staticIfRange` | `If-Range` with the `Last-Modified` text kept the range for a file changed within the same second as that date, so a client resuming a download could join the bytes of two versions. | **Fixed.** A date is a validator only when it parses to the file's `Last-Modified` second and that second ended a second or more ago (RFC 9110 §13.1.5); otherwise the whole file is sent. Before: the range was sent. After: `If-Range with the date of a file changed this second: the whole file`. |
| STATIC-15 | Low | `StaticFiles` (constructor) | The files kept the program's `StaticLimits` by reference, so raising `maxEntries` or `maxPath` after construction walked the cache past the arrays sized for the old values, a panic, and changing `precompressed` changed what was served. A program's change, not a client's. | **Fixed.** The constructor keeps a copy, within its ranges. Before: the cache indexed past its slots. After: `main` changes `maxEntries`, `maxPath` and `precompressed` after the files are made, and every check after it, `a tie goes to br` among them, still passes. |

Recorded as decisions, not findings: a file of 2 GiB or more is a 404, since
a carrier's body length is an `i32`; dotfiles are refused, `.well-known`
among them, so a program that serves one routes it itself; and a multipart
range is answered 200 whole, as RFC 9110 §14.2 allows.

## Properties verified

The module's own checks are lines of `tests/link/net_static/expected.out`,
which `link/net_static: exits with 0 and stdout matches expected.out`
compares byte for byte. The example is driven by curl in `tests/run.js`.

- **Traversal refused** (STATIC-1): `traversal refused: /static/../outside.txt is 404 and refused`,
  and the same for `/static/sub/../../outside.txt`, `/static/%2e%2e/outside.txt`,
  `/static/%2E%2E%2Foutside.txt`, `/static/sub%2f..%2f..%2foutside.txt`,
  `/static/.secret`, `/static/%2esecret`, `/static/sub%5c..%5c..%5coutside.txt`,
  `/static/site.css%00.js`, `/static/sub//index.html` and `/static/%ZZ`;
  `a missing file is 404, not refused`. On each carrier: `HTTP/2 over TLS: a traversal, 404`,
  `h2c: a traversal, 404`, `HTTP/3: a traversal, 404`, `handler: a traversal, 404 and refused`.
  Through curl, which sends `..` as it is: ``net_static app: a `..` sent as it is is 404``.
- **Links out** (STATIC-2): `net_static app: a symbolic link out of the directory is 404`.
- **Index** (STATIC-3): `a directory serves its index.html`,
  `a subdirectory's trailing slash serves its index.html`.
- **The sandbox** (STATIC-4): `net_static app: examples/http-app links under --sandbox --allow net,signal,clock,fs.read=<www>`,
  `net_static app: beside fs.read=<www>, Landlock refuses the directory and its file is 404`.
- **Ranges** (STATIC-5): `Range bytes=5-9: 206 with its Content-Range`, `Range bytes=11-: to the end`,
  `Range bytes=-2: the last two`, `Range past the end is clamped`, `a multipart Range is answered whole`,
  `a Range in another unit is ignored`, `If-Range with the ETag: the range`, `If-Range with the date: the range`,
  `If-Range with the date of a file changed this second: the whole file` (STATIC-14),
  `If-Range with another tag: the whole file`, `bad Range: a start past the end is 416 with bytes */size`,
  `bad Range: not a number is 416`, `bad Range: a last before the first is 416`,
  `bad Range: an empty suffix is 416`, `bad Range: a number of 19 digits is 416`,
  `bad Range: any range of an empty file is 416 with bytes */0`, `handler: bad Range, 416`, `and by range across a read`,
  `net_static app: curl -r 5-9, 206 with Content-Range bytes 5-9/20`.
- **Fields** (STATIC-6): `If-None-Match in a list, weak: still 304`, `If-None-Match: * is 304`,
  `If-None-Match with another tag: 200`, `If-Modified-Since not a date: ignored, 200`,
  `the higher q wins: gzip;q=0.8 over br;q=0.5`, `a tie goes to br`, `br;q=0 refuses br`,
  `identity preferred over a coding`, `* covers br`, `x-gzip counts as gzip`.
- **Limits** (STATIC-7, STATIC-13, STATIC-15): `limits out of range: no entries, nothing served`,
  `limits out of range: a path past 4096, nothing served`, `limits out of range: a negative cache, nothing served`,
  `limits out of range: a cache past 2^30, nothing served`; STATIC-15 by the checks that run after `main` changes its limits.
- **The cache** (STATIC-7, STATIC-8): `a file past the cache streams whole`, `data.json served, and cached`,
  `again from the cache`, `changed file: rewritten, the new bytes are served`, `changed file: with a new ETag`,
  `changed file: the old ETag no longer matches`, `changed file: removed, it is not found`.
