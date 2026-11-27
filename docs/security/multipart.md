# Security record: `nish/net/multipart` and media types

This record covers `nish/net/multipart` (#2344) and the media-type readers it
stands on in `nish/net/http-fields`.

- `nish/net/multipart` reads a `multipart/form-data` body part by part, as an
  HTML form with a file input sends it (RFC 7578, framed by RFC 2046 §5.1.1).
- The media-type readers parse a `Content-Type` value (RFC 9110 §8.3.1) and a
  part's `Content-Disposition`.

The record says what the reader refuses and with which code, and what each
cap bounds. It names the check that fails when each guard is removed. It was
written with the code, on top of `main` at `31ea52d`, and it cites functions
rather than lines.

**Result.** Each guard was tested by deleting it and building the tests
with `--allow-panics`. Every deletion turned at least one named check red.

- Nothing a sender writes panics: the module and its tests build under the
  default `--deny-panics`.
- A refused body answers a negative code, and every later `next()` answers
  the same code.
- A body cut anywhere answers only whole parts. It never reaches the end
  until the close delimiter.
- A run of the boundary inside a part's data frames nothing unless the full
  delimiter syntax follows it.
- No header line can be split or joined by a bare CR, a bare LF or a fold.
- A part whose name or type two readers could take differently is refused:
  a second `Content-Disposition`, a second `Content-Type`, or a parameter
  named twice.

Two findings were fixed by the stage that added the code:

- MP-11 (Medium): the repeated-parameter check was quadratic.
- MP-12 (Low): a body cut just after a CR was refused as malformed.

One finding is open, MP-13 (Low): the cost bound is read from the code, and
no check fails when it is broken.

## Scope

| File | Functions |
| --- | --- |
| `std/net/multipart.ts` | `MultipartLimits`; `MultipartReader` (`constructor`, `next`, `fail`, `delimiterAt`, `find`, `readHeaders`, `readHeader`); the helpers `multipartBchar`, `multipartString`, `multipartCopy` |
| `std/net/http-fields.ts` | The media types alone: `MediaType`, `mediaTypeParse`, `formDataDispositionParse`, `mediaTypeParam`, and the helpers `httpFieldsTchar`, `httpFieldsOws`, `httpFieldsQdtext`, `httpFieldsString`, `httpFieldsTokenEnd`, `httpFieldsOwsEnd`, `httpFieldsParams`. The header model is [`http2.md`](http2.md)'s and the date is [`http1-codec.md`](http1-codec.md)'s. |

Out of scope:

- How the body arrives and how large it may be. The server's carrier
  (`docs/security/http-server.md`) reads the body into memory, and its body
  limit sets the size. The reader reads only a body that is already in
  memory.
- What the program does with a part's data.
- What the program does with a part's `filename` (MP-9).
- `filename*` (RFC 7578 §4.2 forbids it in form-data).
- A part's `Content-Transfer-Encoding`, which is not applied (§4.7).
- Nested `multipart/mixed` parts, which are not read.

## Threat model

The attacker writes the request: the `Content-Type` value whose `boundary`
the program hands the reader, and every octet of the body, up to the body
limit the server enforces.

The attacker wins with any of these:

- a panic, or memory or work the program spends past a bound it set;
- a part framed somewhere the sender's other readers would not frame it, for
  example a boundary-like run in a file's bytes that ends the part early, or a
  delimiter missed so that two parts merge;
- a header line split or joined by a bare CR, a bare LF or a fold, so that a
  proxy and the program see different fields;
- a part whose `name`, `filename` or type the program reads differently from
  another reader of the same body: two dispositions, two types, a parameter
  named twice, or a quoted string's escape read two ways;
- a truncated body that the reader answers as complete.

The program calling the module is trusted. It sets the caps and decides what
a `filename` means.

## Findings

MP-1 to MP-8 are shapes an attacker's body can take. Each was checked and
found to hold. They are recorded so an audit can see what was tried, and they
are not counted in the index. MP-9 and MP-10 are decisions, accepted with
their reasons, and are not counted. MP-11 and MP-12 are fixed. MP-13 is open.

Every check named below is a line of the case's `expected.out`. A case passes
as `link/<case>: exits with 0 and stdout matches expected.out`, so a check
that turns red fails that line.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| MP-1 | High if it failed | `delimiterAt`, `find` | Data that holds the boundary must not end a part early, and two parts must not merge. | **Holds.** A delimiter is CR LF, `--` and the boundary, followed by one of two things: `--`, which closes the body, or optional spaces and tabs and then CR LF. Anything else after the boundary is data. Without the two-dash test, `net_multipart_read` "a boundary-like run followed by another octet is data" fails. With an LF alone taken in place of CR LF, "a delimiter followed by an LF alone is data" fails. The 1,024 octets of "data holding every octet value" and six bodies Node's `FormData` wrote ("Node vector 0, parts: 2" to "Node vector 5, parts: 1") frame as their sender framed them. |
| MP-2 | High if it failed | `readHeaders`, `readHeader` | A header line must not be split or joined so that two readers see different fields: by a bare CR or LF, an obsolete fold, a NUL or a name that is not a token. | **Holds.** A line ends only at CR LF. A line ended by LF alone or by CR alone answers `MULTIPART_ERR_HEADER`: without the LF guard "refused header: a line ended by LF alone" fails, and without the CR guard "refused header: a line ended by CR alone" fails. A folded line starts with a space, so its name is not a token and `httpFieldNameValid` refuses it. Without that check, "refused header: a folded line", "refused header: a name with a space" and "refused header: an empty name" fail. Without `httpFieldValueValid`, "refused header: a NUL in a value" fails. |
| MP-3 | Medium if it failed | `readHeader`, `httpFieldsParams` | A part's name, filename or type must not have two readings: a second `Content-Disposition`, a second `Content-Type`, or a parameter given twice in any case. | **Holds.** Each is refused. Without the disposition guard, "refused disposition: two" fails. Without the type guard, "refused header: a Content-Type twice" fails. Without the repeat check, `net_media_type` "refused: a parameter named twice", "refused: named twice in two cases" and "refused: a disposition named twice" fail. |
| MP-4 | Medium if it failed | `next`, `readHeaders` | One body must not make the reader read more parts, header lines or header octets than `MultipartLimits` allows. | **Holds.** Each cap is counted down, so no sum wraps, and one past each cap is refused. Parts (`maxParts`, 64): without the guard, "refused: three parts with maxParts 2", "refused: a part with maxParts 0" and "refused: 65 parts with the default limits" fail. Header lines (`maxHeaders`, 16): "refused: three header lines with maxHeaders 2" and "refused: 17 header lines with the default limits" fail. Header octets (`maxHeaderBytes`, 8,192, each line's CR LF counted): without the per-octet guard, "refused: a header line with no end, at the cap and not at the body's end" fails. Without the two octets of CR LF counted, "refused: a 42-octet header line with maxHeaderBytes 41" and "refused: 8,193 octets of header lines with the default limits" fail. The check at each cap's limit passes ("64 parts with the default limits", "16 header lines with the default limits", "8,192 octets of header lines with the default limits"). |
| MP-5 | Medium if it failed | `next`, `readHeaders` | A truncated body must not be answered as whole parts or as a closed body. | **Holds.** Each prefix of a 126-octet, two-part body is read. A prefix answers a part only when that part's data is followed by a delimiter, and `MULTIPART_END` only for the whole body; every other prefix answers `MULTIPART_ERR_UNTERMINATED`. Without the guard that answers a body cut after a header line's CR as unterminated (MP-12), "every prefix of a 126-octet body answers only whole parts and closes only when whole" and "so no prefix answers otherwise" fail. |
| MP-6 | Medium if it failed | `MultipartReader` (constructor) | A boundary the delimiter search cannot take must be refused before any search: an empty one, one longer than RFC 2046's 70 octets, one ending in a space, or one with an octet outside `bchars`. | **Holds.** The first `next()` answers `MULTIPART_ERR_BOUNDARY`. Without the length guard, "refused: a boundary of 71 octets" fails. "refused: an empty boundary", "refused: a boundary ending in a space", "refused: a boundary holding a quote", "refused: a boundary holding a CR" and "refused: a boundary holding an @" pin the other shapes. A boundary of 70 octets and one holding every `bchar` are read. |
| MP-7 | Medium if it failed | `MultipartReader` (constructor), `delimiterAt`, `find`, `readHeaders` | A body length the program passes must not let the reader read past the array or past the message. | **Holds.** A length below 0 or past the array answers `MULTIPART_ERR_WINDOW` ("refused: a length below 0", "refused: a length past the array"). Every read checks the index against both the length and the array's own length, which the prover discharges (no panic site in `tests/std-panics.json`). A length short of the array reads only that much ("a length short of the array reads only that much"). |
| MP-8 | Medium if it failed | `next`, `fail` | Once a part is refused, the program must not read a later part from the same body or a stale data span. | **Holds.** `fail` records the code, and every later `next()` answers it with `dataStart` and `dataLength` zeroed. Without the disposition guard the reader answers the refused part ("refused disposition: none", "refused disposition: no header lines" and "the refused one" fail), and the later checks "is refused from then on" and "with no data span left" pin that the refusal sticks. |
| MP-9 | Low | `readHeader` | A part's `filename` is answered as the sender wrote it: `../../etc/passwd`, `C:\x.txt` and `a%22b` reach the program unchanged. A program that joins it to a directory writes where the sender chose. | **Accepted.** The name is the sender's description of a file, not a path the server should trust. The module writes nothing to disk, and its doc and the guide say that a program names stored files itself. Browsers write `"`, CR and LF as `%22`, `%0D` and `%0A`, and those escapes are kept, as the HTML form submission algorithm expects ("a percent-escaped quote is kept as given" in `net_media_type`, and Node vector 5's `a"b\c.txt`). |
| MP-10 | Low | `formDataDispositionParse`, `httpFieldsParams` | Inside a quoted `Content-Disposition` value a backslash is an octet, not an escape. An RFC 9110 reader takes `"a\"b"` as `a"b`; this reader takes `"a\"` as `a\` and refuses the `b` after it. | **Accepted.** HTML form submission writes `"` as `%22` and leaves `\` alone, so `filename="C:\x.txt"` names the file a browser sent. A sender that escapes as RFC 9110 does is refused rather than misread: the closing quote comes after the backslash, so text follows a quoted value. Checks: "a backslash in a form-data value is kept", "so a backslash before the closing quote does not escape it" and "refused: a quote after a kept backslash", in `net_media_type`. A `Content-Type` keeps RFC 9110's escapes ("refused: a backslash ends the value"). `name` and `filename` are octets, not checked as UTF-8; the program that treats them as text checks them. |
| MP-11 | Medium | `httpFieldsParams` | The repeated-parameter check compared each new name with every earlier one, and nothing capped the count. A header line of `;ab=1` parameters within the 8,192-octet cap holds about 1,600 of them, so one part cost about 1.3 million string comparisons and a 64-part body about 86 million. These figures are counted from the code, not timed. A request's own `Content-Type`, which the program parses before any cap applies, cost the same per line. | **Fixed.** A 17th parameter is refused, so the check costs at most 120 comparisons. Before: the cap was absent, and the checks below fail with it removed. After: `net_media_type` "16 parameters parse", "refused: a 17th parameter", "16 parameters on a disposition parse" and "refused: a 17th parameter on a disposition". |
| MP-12 | Low | `readHeaders` | A body cut just after a header line's CR answered `MULTIPART_ERR_HEADER`, a malformed line, not `MULTIPART_ERR_UNTERMINATED`. A program that reads a body as it arrives and retries on unterminated would have refused a well-formed upload cut at that octet. | **Fixed.** A CR at the body's end is unterminated. Before: the prefix check failed at that cut. After: "every prefix of a 126-octet body answers only whole parts and closes only when whole". |
| MP-13 | Low | `delimiterAt`, `find`, `readHeaders`, `readHeader` | The cost bound in the module's doc is read from the code, not tested. A body of `n` octets with a boundary of `b` costs about `n * (b + 6)` comparisons at most. Each CR starts one delimiter comparison of at most `b + 6` octets, each run of transport padding is read once, and each header octet is read a fixed number of times within `maxHeaderBytes`. No check fails if a scan became quadratic. | **Open, untested.** A check would count comparisons, or time two body sizes, against an adversarial shape: a body of CR LF `--` and the boundary less its last octet, repeated. |

## Properties verified

**Agreement with a real sender** (`tests/link/net_multipart_read`,
`generate.mjs` writing `vectors.ts`). Node's `FormData` and `Response`
serialize six forms:

- text fields and an empty field;
- a value with CR, LF and CR LF, which the form submission algorithm turns
  into CR LF;
- a name holding `"`, CR and LF, which the algorithm writes as `%22`, `%0D`
  and `%0A`;
- a CSV file and a file of all 256 octet values;
- an empty file named `a"b\c.txt`;
- a blob with no name, and a UTF-8 field name `café`.

Each part's name, filename, type and data are compared with what the spec's
escaping gives. They are computed from the form, not read back from the body.

**Every refusal code** (`net_multipart_read`): each `MULTIPART_ERR_*` code
is provoked by at least one named check above, and `MULTIPART_END` is
answered again after the end ("and the end again").

**Media types** (`tests/link/net_media_type`, 51 checks):

- tokens and their case;
- quoted strings and their escapes, under both readers;
- whitespace around `;` and `=`;
- the window inside the array, and one below 0, past the array or ending
  before it starts;
- the 16-parameter cap;
- lookup in another case.

## Tests

- `link/net_multipart_read: exits with 0 and stdout matches expected.out`
- `link/net_media_type: exits with 0 and stdout matches expected.out`
- `std-panics: no std/ module gains its first panic site`
