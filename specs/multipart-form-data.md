---
title: "Spec 0002: nish/net/multipart — reading multipart/form-data bodies"
abbrev: nish/net/multipart
docname: draft-multipart-form-data-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-27
author:
  - name: Nish Authors
    org: nish
normative:
  RFC2046:
  RFC7578:
--- abstract

Status: proposed. Module: std/net/multipart.ts (nish/net/multipart). A reader
of the multipart/form-data bodies an HTML form sends (RFC 7578), framed as
RFC 2046 Section 5.1.1 frames every multipart body. This spec holds the
reader to the binding sentences of those sections that a receiver can be held
to, and to the refusals nish adds, through three functions that read a whole
body: multipartPartCount, multipartFieldData and multipartFieldFilename.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

A server that takes a file upload reads a multipart/form-data body. RFC 7578
defines its parts and RFC 2046 its framing. Most of their binding sentences
bind the sender: what a boundary may not appear in, which parameters a part
carries, how several files are sent. This spec quotes the ones a receiver can
be held to, and states the rest of what the reader does in its own words.

The module reads each part with MultipartReader, a class, and the functions
below read a whole body with it and its default MultipartLimits, so every
requirement here holds of the class as each function reaches it.

Out of scope: MultipartReader, a class that vector does not call; the three functions of this spec read every part through it.

Out of scope: MultipartLimits, a class of three limits; this spec reads with its defaults, 64 parts, 16 header lines and 8192 octets of them.

This spec does not cover RFC 7578's percent-encoded or non-ASCII field
names (Section 5.1), the `_charset_` field (Section 4.6), a part's
Content-Transfer-Encoding (Section 4.7), which the reader does not apply, or
the older multipart/mixed form of several files for one field (Section 4.3),
which it reads as one part with a multipart/mixed Content-Type.

# Interface

~~~ ts-interface
// module: nish/net/multipart
export const multipartPartCount = (body: u8[], boundary: string): i32
export const multipartFieldData = (body: u8[], boundary: string, name: string): u8[] | null
export const multipartFieldFilename = (body: u8[], boundary: string, name: string): string | null
~~~

Each function reads all of `body` as the message body, and `boundary` is the
`boundary` parameter of its Content-Type, quotes removed. A body in this spec
is written as the ASCII text of its octets.

# Framing

## Delimiters

> The boundary delimiter MUST occur at the beginning of a line, i.e.,
> following a CRLF, and the initial CRLF is considered to be attached to the
> boundary delimiter line rather than part of the preceding part.
> {{Section 5.1.1 of RFC2046}}
{: #R-LINE-START gi="blockquote"}

The first delimiter may open the body with no CRLF before it. For a body
that ends in its close delimiter, multipartPartCount MUST return how many
parts the body holds.
{: #R-COUNT}

The octets before the first delimiter and after the close delimiter MUST be
skipped.
{: #R-PREAMBLE}

Spaces and tabs between a delimiter and its CRLF, RFC 2046's transport
padding, MUST be skipped.
{: #R-PADDING}

A CRLF, two hyphens and the boundary followed by anything but transport
padding and a CRLF, or two more hyphens, MUST be read as data.
{: #R-NEAR}

## Header fields

A part's header field names MUST be matched without regard to case.
{: #R-FIELD-CASE}

RFC 7578 Section 4.8 bars a sender from other header fields. A header field
other than Content-Disposition and Content-Type MUST be ignored.
{: #R-OTHER-FIELDS}

# Parts

## Disposition

> Each part MUST contain a Content-Disposition header field [RFC2183]
> where the disposition type is "form-data".
> {{Section 4.2 of RFC7578}}
{: #R-DISPOSITION gi="blockquote"}

> The Content-Disposition header field MUST also contain an additional
> parameter of "name"; the value of the "name" parameter is the original
> field name from the form (possibly encoded; see Section 5.1).
> {{Section 4.2 of RFC7578}}
{: #R-NAME gi="blockquote"}

The disposition type MUST be matched without regard to case.
{: #R-TYPE-CASE}

## Data

multipartFieldData MUST return the data of the first part whose name is
`name`, octet for octet: every octet from the empty line that ends its header
fields to the CRLF of the delimiter after it.
{: #R-DATA}

multipartFieldData and multipartFieldFilename MUST return null when no part
before the close delimiter has that name, and when the body is refused before
one does.
{: #R-ABSENT}

## File names {#file-names}

multipartFieldFilename MUST return the `filename` parameter of the first part
whose name is `name` as the sender wrote it, quotes removed: a backslash
inside the quotes is an octet like any other, so a Windows path such as
`C:\x.txt` keeps its backslash, and a browser's escaped quote `%22a%22.txt`
stays as given.
{: #R-FILENAME}

multipartFieldFilename MUST return null for a part with no `filename`
parameter.
{: #R-FILENAME-NULL}

A `filename*` parameter MUST NOT be read in place of `filename`.
{: #R-FILENAME-STAR}

# Refusals {#refusals}

multipartPartCount returns one of these codes for a body it refuses:

- -1: the boundary is refused;
- -2: the body is unterminated;
- -3: a header line is refused;
- -4: a part has too many header lines or octets of them;
- -5: a part's disposition is refused;
- -6: the body has too many parts.

multipartPartCount MUST return -1 for a boundary that is empty, longer than
70 octets, holds an octet outside RFC 2046's bchars or ends in a space.
{: #R-BOUNDARY}

multipartPartCount MUST return -2 for a body with no opening delimiter, or
whose part's header lines or data run to its end.
{: #R-UNTERMINATED}

multipartPartCount MUST return -3 for a header line that ends in a CR or LF
alone, starts with a space or tab, or has no colon, and for a part with two
Content-Type fields.
{: #R-HEADER}

multipartPartCount MUST return -4 for a part with more than 16 header lines,
or more than 8192 octets of them.
{: #R-HEADERS}

multipartPartCount MUST return -5 for a part with no Content-Disposition,
two of them, one whose type is not form-data, or one with no name
parameter.
{: #R-DISPOSITION-REFUSED}

multipartPartCount MUST return -6 for a body of more than 64 parts.
{: #R-PARTS}

# Laws

~~~ ts-property
// P-DATA covers R-DATA, R-LINE-START — the data of a one-part body is what was sent, whatever its octets
// samples: 96
forall (v: u8[] /* 0..64 */) => {
  const d = multipartFieldData(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z", "f");
  return d !== null && unwrap(d) === v;
}
~~~

~~~ ts-property
// P-TWO covers R-COUNT, R-DATA — two parts are counted, and the second is found by its name
// samples: 96
forall (v: u8[] /* 0..32 */, w: u8[] /* 0..32 */) => {
  const body = concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", concat(v, concat("\r\n--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"g\"\r\n\r\n", concat(w, "\r\n--Xq7Bound9z--"))));
  const d = multipartFieldData(body, "Xq7Bound9z", "g");
  return multipartPartCount(body, "Xq7Bound9z") === 2 && d !== null && unwrap(d) === w;
}
~~~

~~~ ts-property
// P-PREAMBLE covers R-PREAMBLE, R-COUNT — a preamble and an epilogue of any octets are skipped
// samples: 96
forall (p: u8[] /* 0..32 */, e: u8[] /* 0..32 */) => multipartPartCount(concat(p, concat("\r\n--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\nhi\r\n--Xq7Bound9z--", e)), "Xq7Bound9z") === 1
~~~

~~~ ts-property
// P-PADDING covers R-PADDING — any run of spaces and tabs after a delimiter is transport padding
// samples: 64
forall (t: string /* 0..16 " \t" */) => multipartPartCount(concat("--Xq7Bound9z", concat(utf8(t), concat("\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\nhi\r\n--Xq7Bound9z--", utf8(t)))), "Xq7Bound9z") === 1
~~~

~~~ ts-property
// P-NEAR covers R-NEAR, R-DATA — a longer boundary after a CRLF and two hyphens is data
// samples: 96
forall (v: u8[] /* 0..32 */, x: string /* 1..8 alpha digit */) => {
  const kept = concat(v, concat("\r\n--Xq7Bound9z", utf8(x)));
  const d = multipartFieldData(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", concat(kept, "\r\n--Xq7Bound9z--")), "Xq7Bound9z", "f");
  return d !== null && unwrap(d) === kept;
}
~~~

~~~ ts-property
// P-NAME covers R-DATA, R-NAME — a part is found by the name it was sent under, and by no other
// samples: 64
forall (n: string /* 1..16 alpha digit */) => {
  const body = concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"", concat(utf8(n), "\"\r\n\r\nhi\r\n--Xq7Bound9z--"));
  const d = multipartFieldData(body, "Xq7Bound9z", n);
  return d !== null && unwrap(d) === utf8("hi") && multipartFieldData(body, "Xq7Bound9z", n + "_") === null;
}
~~~

~~~ ts-property
// P-CASE covers R-FIELD-CASE, R-TYPE-CASE — a field name and a disposition type in another case are read
// samples: 64
forall (v: u8[] /* 0..32 */) => multipartPartCount(concat("--Xq7Bound9z\r\ncontent-disposition: FORM-DATA; name=f\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z") === 1 && multipartPartCount(concat("--Xq7Bound9z\r\nCONTENT-DISPOSITION: Form-Data; name=f\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z") === 1
~~~

~~~ ts-property
// P-OTHER covers R-OTHER-FIELDS — a header field of any other name is ignored
// samples: 64
forall (n: string /* 1..16 alpha */, x: string /* 0..32 alpha digit */) => {
  const d = multipartFieldData(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\nX-", concat(utf8(n), concat(": ", concat(utf8(x), "\r\n\r\nhi\r\n--Xq7Bound9z--")))), "Xq7Bound9z", "f");
  return d !== null && unwrap(d) === utf8("hi");
}
~~~

~~~ ts-property
// P-ABSENT covers R-ABSENT — a name no part has, and a body refused before its part, give null
// samples: 64
forall (v: u8[] /* 0..32 */) => multipartFieldData(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z", "g") === null && multipartFieldFilename(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z", "g") === null && multipartFieldData(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", v), "Xq7Bound9z", "f") === null
~~~

~~~ ts-property
// P-FILENAME covers R-FILENAME — a file name is returned as written, backslashes and percent signs kept
// samples: 96
forall (f: string /* 1..32 "aZ09._-:/\\%" */) => {
  const g = multipartFieldFilename(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"; filename=\"", concat(utf8(f), "\"\r\n\r\nxx\r\n--Xq7Bound9z--")), "Xq7Bound9z", "f");
  return g !== null && unwrap(g) === f;
}
~~~

~~~ ts-property
// P-FILENAME-NULL covers R-FILENAME-NULL, R-FILENAME-STAR — a part with no filename parameter has none, even with filename*
// samples: 64
forall (f: string /* 1..16 alpha */) => multipartFieldFilename(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"; filename*=UTF-8''", concat(utf8(f), "\r\n\r\nxx\r\n--Xq7Bound9z--")), "Xq7Bound9z", "f") === null && multipartFieldFilename(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", concat(utf8(f), "\r\n--Xq7Bound9z--")), "Xq7Bound9z", "f") === null
~~~

~~~ ts-property
// P-BOUNDARY covers R-BOUNDARY, R-COUNT — a boundary of 1 to 70 bchars frames, and one of 71 or more is -1
// samples: 96
forall (b: string /* 1..90 alpha digit */) => {
  const n = multipartPartCount(concat("--", concat(utf8(b), concat("\r\nContent-Disposition: form-data; name=a\r\n\r\nhi\r\n--", concat(utf8(b), "--")))), b);
  return implies(b.length <= 70, n === 1) && implies(b.length > 70, n === -1);
}
~~~

~~~ ts-property
// P-BOUNDARY-CHARS covers R-BOUNDARY — an empty boundary, one with a semicolon and one ending in a space are -1
// samples: 64
forall (b: string /* 1..16 alpha digit */) => multipartPartCount(utf8("--\r\nContent-Disposition: form-data; name=a\r\n\r\nhi\r\n----"), "") === -1 && multipartPartCount(concat("--", concat(utf8(b + ";"), concat("\r\nContent-Disposition: form-data; name=a\r\n\r\nhi\r\n--", concat(utf8(b + ";"), "--")))), b + ";") === -1 && multipartPartCount(concat("--", concat(utf8(b + " "), concat("\r\nContent-Disposition: form-data; name=a\r\n\r\nhi\r\n--", concat(utf8(b + " "), "--")))), b + " ") === -1
~~~

~~~ ts-property
// P-UNTERMINATED covers R-UNTERMINATED — no opening delimiter, data to the end and header lines to the end are -2
// samples: 96
forall (v: u8[] /* 0..64 */, x: string /* 0..32 alpha digit */) => multipartPartCount(v, "Xq7Bound9z") === -2 && multipartPartCount(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", v), "Xq7Bound9z") === -2 && multipartPartCount(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\nX-Note: ", utf8(x)), "Xq7Bound9z") === -2
~~~

~~~ ts-property
// P-HEADER covers R-HEADER — a line with no colon, a folded line, a bare LF and a second Content-Type are -3
// samples: 64
forall (n: string /* 1..16 alpha */) => {
  const head = utf8("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\n");
  const tail = utf8("\r\n\r\nhi\r\n--Xq7Bound9z--");
  return multipartPartCount(concat(head, concat(utf8(n), tail)), "Xq7Bound9z") === -3 && multipartPartCount(concat(head, concat(" X-", concat(utf8(n), concat(": 1", tail)))), "Xq7Bound9z") === -3 && multipartPartCount(concat(head, concat("X-", concat(utf8(n), concat(": 1\nX-Note: 1", tail)))), "Xq7Bound9z") === -3 && multipartPartCount(concat(head, concat("Content-Type: text/", concat(utf8(n), concat("\r\nContent-Type: text/plain", tail)))), "Xq7Bound9z") === -3;
}
~~~

~~~ ts-property
// P-HEADERS covers R-HEADERS — 17 header lines, or a line past 8192 octets of them, are -4
// samples: 32
forall (v: u8[] /* 0..32 */) => multipartPartCount(concat("--Xq7Bound9z\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nX: 1\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z") === -4 && multipartPartCount(concat("--Xq7Bound9z\r\nX: ", concat(fill(97, 8190), concat("\r\nContent-Disposition: form-data; name=\"f\"\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")))), "Xq7Bound9z") === -4
~~~

~~~ ts-property
// P-DISPOSITION covers R-DISPOSITION, R-NAME, R-DISPOSITION-REFUSED — no disposition, another type, no name or two dispositions are -5
// samples: 64
forall (v: u8[] /* 0..32 */) => multipartPartCount(concat("--Xq7Bound9z\r\nX-Note: 1\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z") === -5 && multipartPartCount(concat("--Xq7Bound9z\r\nContent-Disposition: attachment; name=f\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z") === -5 && multipartPartCount(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; filename=x\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z") === -5 && multipartPartCount(concat("--Xq7Bound9z\r\nContent-Disposition: form-data; name=\"f\"\r\nContent-Disposition: form-data; name=g\r\n\r\n", concat(v, "\r\n--Xq7Bound9z--")), "Xq7Bound9z") === -5
~~~

~~~ ts-property
// P-PARTS covers R-PARTS, R-COUNT — 64 parts are read, and a 65th is -6
// samples: 16
forall (v: u8[] /* 0..8 */) => {
  const p1 = concat("\r\n--Xq7Bound9z\r\nContent-Disposition: form-data; name=a\r\n\r\n", v);
  const p4 = concat(concat(p1, p1), concat(p1, p1));
  const p16 = concat(concat(p4, p4), concat(p4, p4));
  const p64 = concat(concat(p16, p16), concat(p16, p16));
  return multipartPartCount(concat(p64, "\r\n--Xq7Bound9z--"), "Xq7Bound9z") === 64 && multipartPartCount(concat(p64, concat(p1, "\r\n--Xq7Bound9z--")), "Xq7Bound9z") === -6;
}
~~~

# Test Vectors

Each row's body is checked against the multipart reader of Python's email package.

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| C1 | `multipartPartCount([2d 2d 62 0d 0a 43 6f 6e 74 65 6e 74 2d 44 69 73 70 6f 73 69 74 69 6f 6e 3a 20 66 6f 72 6d 2d 64 61 74 61 3b 20 6e 61 6d 65 3d 22 61 22 0d 0a 0d 0a 68 69 0d 0a 2d 2d 62 0d 0a 43 6f 6e 74 65 6e 74 2d 44 69 73 70 6f 73 69 74 69 6f 6e 3a 20 66 6f 72 6d 2d 64 61 74 61 3b 20 6e 61 6d 65 3d 22 66 22 3b 20 66 69 6c 65 6e 61 6d 65 3d 22 78 2e 74 78 74 22 0d 0a 43 6f 6e 74 65 6e 74 2d 54 79 70 65 3a 20 74 65 78 74 2f 70 6c 61 69 6e 0d 0a 0d 0a 78 78 0d 0a 2d 2d 62 2d 2d], "b")` | `2` | R-COUNT | `python3 -c 'import email;m=email.message_from_bytes(b"Content-Type: multipart/form-data; boundary=b\r\n\r\n"+bytes.fromhex("2d2d620d0a436f6e74656e742d446973706f736974696f6e3a20666f726d2d646174613b206e616d653d2261220d0a0d0a68690d0a2d2d620d0a436f6e74656e742d446973706f736974696f6e3a20666f726d2d646174613b206e616d653d2266223b2066696c656e616d653d22782e747874220d0a436f6e74656e742d547970653a20746578742f706c61696e0d0a0d0a78780d0a2d2d622d2d"));print(len(m.get_payload()))'` | a field and a file, as a browser sends them |
| C2 | `multipartPartCount([70 72 65 0d 0a 2d 2d 62 20 09 0d 0a 43 6f 6e 74 65 6e 74 2d 44 69 73 70 6f 73 69 74 69 6f 6e 3a 20 66 6f 72 6d 2d 64 61 74 61 3b 20 6e 61 6d 65 3d 22 61 22 0d 0a 0d 0a 78 2d 2d 62 20 79 0d 0a 2d 2d 62 2d 2d 0d 0a 65 70 69], "b")` | `1` | R-PREAMBLE, R-PADDING, R-LINE-START | `python3 -c 'import email;m=email.message_from_bytes(b"Content-Type: multipart/form-data; boundary=b\r\n\r\n"+bytes.fromhex("7072650d0a2d2d6220090d0a436f6e74656e742d446973706f736974696f6e3a20666f726d2d646174613b206e616d653d2261220d0a0d0a782d2d6220790d0a2d2d622d2d0d0a657069"));print(len(m.get_payload()))'` | a preamble, padding, a boundary mid-line and an epilogue |
| D1 | `multipartFieldData([2d 2d 62 0d 0a 43 6f 6e 74 65 6e 74 2d 44 69 73 70 6f 73 69 74 69 6f 6e 3a 20 66 6f 72 6d 2d 64 61 74 61 3b 20 6e 61 6d 65 3d 22 61 22 0d 0a 0d 0a 68 69 0d 0a 2d 2d 62 0d 0a 43 6f 6e 74 65 6e 74 2d 44 69 73 70 6f 73 69 74 69 6f 6e 3a 20 66 6f 72 6d 2d 64 61 74 61 3b 20 6e 61 6d 65 3d 22 66 22 3b 20 66 69 6c 65 6e 61 6d 65 3d 22 78 2e 74 78 74 22 0d 0a 43 6f 6e 74 65 6e 74 2d 54 79 70 65 3a 20 74 65 78 74 2f 70 6c 61 69 6e 0d 0a 0d 0a 78 78 0d 0a 2d 2d 62 2d 2d], "b", "f")` | `[78 78]` | R-DATA | `python3 -c 'import email;m=email.message_from_bytes(b"Content-Type: multipart/form-data; boundary=b\r\n\r\n"+bytes.fromhex("2d2d620d0a436f6e74656e742d446973706f736974696f6e3a20666f726d2d646174613b206e616d653d2261220d0a0d0a68690d0a2d2d620d0a436f6e74656e742d446973706f736974696f6e3a20666f726d2d646174613b206e616d653d2266223b2066696c656e616d653d22782e747874220d0a436f6e74656e742d547970653a20746578742f706c61696e0d0a0d0a78780d0a2d2d622d2d"));print(m.get_payload()[1].get_payload(decode=True).hex())'` | the second part's data |
| D2 | `multipartFieldData([2d 2d 62 0d 0a 43 6f 6e 74 65 6e 74 2d 44 69 73 70 6f 73 69 74 69 6f 6e 3a 20 66 6f 72 6d 2d 64 61 74 61 3b 20 6e 61 6d 65 3d 22 61 22 0d 0a 0d 0a 68 69 0d 0a 0d 0a 2d 2d 62 2d 2d], "b", "a")` | `[68 69 0d 0a]` | R-DATA, R-LINE-START | `python3 -c 'import email;m=email.message_from_bytes(b"Content-Type: multipart/form-data; boundary=b\r\n\r\n"+bytes.fromhex("2d2d620d0a436f6e74656e742d446973706f736974696f6e3a20666f726d2d646174613b206e616d653d2261220d0a0d0a68690d0a0d0a2d2d622d2d"));print(m.get_payload()[0].get_payload(decode=True).hex())'` | the CRLF before a delimiter is the delimiter's, the one before it the data's |
| D3 | `multipartFieldData([2d 2d 62 0d 0a 43 6f 6e 74 65 6e 74 2d 44 69 73 70 6f 73 69 74 69 6f 6e 3a 20 66 6f 72 6d 2d 64 61 74 61 3b 20 6e 61 6d 65 3d 22 61 22 0d 0a 0d 0a 78 0d 0a 2d 2d 62 63 0d 0a 2d 2d 62 2d 2d], "b", "a")` | `[78 0d 0a 2d 2d 62 63]` | R-NEAR | `python3 -c 'import email;m=email.message_from_bytes(b"Content-Type: multipart/form-data; boundary=b\r\n\r\n"+bytes.fromhex("2d2d620d0a436f6e74656e742d446973706f736974696f6e3a20666f726d2d646174613b206e616d653d2261220d0a0d0a780d0a2d2d62630d0a2d2d622d2d"));print(m.get_payload()[0].get_payload(decode=True).hex())'` | a longer boundary after a CRLF and two hyphens is data |

# Security Considerations

A body is read from the network, so a sender picks every octet of it. The
reader copies no part's data, finds a delimiter by comparing at most the
boundary's length plus six octets at each CR of the body, and holds each
part's header lines to MultipartLimits, so a body of n octets and a boundary
of b octets costs about n * (b + 6) comparisons at most, however it is
shaped. docs/security/net-multipart.md records the reader's review.
