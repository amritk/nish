// `nish/net/http-fields`, the header model HTTP/2 and HTTP/3 share: the name
// and value rules, the connection-specific fields, and the request, response
// and trailer shapes with every refusal each one has. The checks live here so
// that `tests/link/net_http_fields_f64` runs every one again under
// `--number-mode f64`.
import {
  HTTP_FIELDS_AUTHORITY_MISMATCH,
  HTTP_FIELDS_BAD_CONTENT_LENGTH,
  HTTP_FIELDS_BAD_NAME,
  HTTP_FIELDS_BAD_PSEUDO_VALUE,
  HTTP_FIELDS_BAD_VALUE,
  HTTP_FIELDS_CONNECTION_SPECIFIC,
  HTTP_FIELDS_NO_LENGTH,
  HTTP_FIELDS_OK,
  HTTP_FIELDS_PSEUDO_AFTER_FIELD,
  HTTP_FIELDS_PSEUDO_FORBIDDEN,
  HTTP_FIELDS_PSEUDO_MISSING,
  HTTP_FIELDS_PSEUDO_REPEATED,
  HTTP_FIELDS_PSEUDO_UNKNOWN,
  HttpFields,
  httpFieldBytes,
  httpFieldConnectionSpecific,
  httpFieldIs,
  httpFieldNameValid,
  httpFieldSensitive,
  httpFieldValueValid,
  httpFieldsCheckOutgoing,
} from "nish/net/http-fields";
import { Suite } from "nish/testing";

/** A section as `name: value` pairs, one a line, split into the two lists a decoder answers. */
export class Section {
  names: u8[][];
  values: u8[][];

  constructor() {
    this.names = [];
    this.values = [];
  }

  /** Adds `name: value`. */
  add(name: string, value: string): Section {
    this.names.push(httpFieldBytes(name));
    this.values.push(httpFieldBytes(value));
    return this;
  }
}

/** A GET of `/` over https, with whatever the caller adds after it. */
const get = (): Section => new Section().add(":method", "GET").add(":scheme", "https").add(":path", "/").add(":authority", "example.com");

/** `bytes` as text, one character a byte. */
const textOf = (bytes: u8[] | null): string => {
  if (bytes === null) {
    return "(null)";
  }
  const parts: string[] = [];
  for (const b of bytes) {
    parts.push(String.fromCharCode(toI32(b)));
  }
  return parts.join("");
};

/** One byte as an array, so a name or value can hold any octet. */
const octet = (prefix: string, c: i32, suffix: string): u8[] => {
  const out: u8[] = httpFieldBytes(prefix);
  out.push(toU8(c));
  for (const b of httpFieldBytes(suffix)) {
    out.push(b);
  }
  return out;
};

/** Runs every check and answers the exit code. */
export const fieldsChecks = (): i32 => {
  const t = new Suite("http fields");
  const fields = new HttpFields();

  // --- names and values ----------------------------------------------------------
  t.ok("a lowercase token is a field name", httpFieldNameValid(httpFieldBytes("x-request-id!#$%&'*+.^_`|~09")));
  t.ok("an empty name is not", !httpFieldNameValid(httpFieldBytes("")));
  t.ok("an uppercase letter is not: HTTP/2 and HTTP/3 send names in lowercase", !httpFieldNameValid(httpFieldBytes("Accept")));
  t.ok("nor a space, a colon, a slash or a DEL", !httpFieldNameValid(httpFieldBytes("a b")) && !httpFieldNameValid(httpFieldBytes(":path")) && !httpFieldNameValid(httpFieldBytes("a/b")) && !httpFieldNameValid(octet("a", 127, "")));
  t.ok("a value may be empty, hold inner spaces, tabs and obs-text", httpFieldValueValid(httpFieldBytes("")) && httpFieldValueValid(httpFieldBytes("a b\tc")) && httpFieldValueValid(octet("caf", 233, "")));
  t.ok("but not a NUL, a CR or an LF anywhere", !httpFieldValueValid(octet("a", 0, "b")) && !httpFieldValueValid(octet("a", 13, "b")) && !httpFieldValueValid(octet("a", 10, "b")));
  t.ok("nor a space or a tab at either end", !httpFieldValueValid(httpFieldBytes(" a")) && !httpFieldValueValid(httpFieldBytes("a ")) && !httpFieldValueValid(httpFieldBytes("\ta")) && !httpFieldValueValid(httpFieldBytes("a\t")));
  t.ok("httpFieldIs compares octets, length first", httpFieldIs(httpFieldBytes("te"), "te") && !httpFieldIs(httpFieldBytes("te"), "tE") && !httpFieldIs(httpFieldBytes("t"), "te"));

  // --- connection-specific fields -------------------------------------------------
  const specific: string[] = ["connection", "proxy-connection", "keep-alive", "transfer-encoding", "upgrade"];
  let every: boolean = true;
  for (const name of specific) {
    every = every && httpFieldConnectionSpecific(httpFieldBytes(name), httpFieldBytes("x"));
  }
  t.ok("connection, proxy-connection, keep-alive, transfer-encoding and upgrade are connection-specific", every);
  t.ok("te is, unless its value is trailers", httpFieldConnectionSpecific(httpFieldBytes("te"), httpFieldBytes("gzip")) && !httpFieldConnectionSpecific(httpFieldBytes("te"), httpFieldBytes("trailers")));
  t.ok("an ordinary field is not", !httpFieldConnectionSpecific(httpFieldBytes("accept"), httpFieldBytes("*/*")));
  t.ok(
    "authorization, proxy-authorization, cookie and set-cookie are sensitive, and nothing else is",
    httpFieldSensitive(httpFieldBytes("authorization")) &&
      httpFieldSensitive(httpFieldBytes("proxy-authorization")) &&
      httpFieldSensitive(httpFieldBytes("cookie")) &&
      httpFieldSensitive(httpFieldBytes("set-cookie")) &&
      !httpFieldSensitive(httpFieldBytes("accept")) &&
      !httpFieldSensitive(httpFieldBytes("Cookie"))
  );

  // --- requests ---------------------------------------------------------------------
  const plain: Section = get().add("accept", "*/*").add("content-length", "12");
  t.eqI32("a GET with every pseudo-header reads", fields.readRequest(plain.names, plain.values, false), HTTP_FIELDS_OK);
  t.eqStr(
    "and records them, the regular fields in order, and the length",
    `${textOf(fields.method)} ${textOf(fields.scheme)} ${textOf(fields.authority)} ${textOf(fields.path)} [${textOf(fields.protocol)}] ${fields.names.length} ${textOf(fields.get("accept"))} ${fields.contentLength}`,
    "GET https example.com / [] 2 */* 12"
  );
  t.ok("get answers null for a field the section does not have, and isConnect is false", fields.get("cookie") === null && !fields.isConnect());
  const bare: Section = new Section().add(":method", "GET").add(":scheme", "http").add(":path", "/a?b");
  t.ok("one without :authority reads too, with no content-length", fields.readRequest(bare.names, bare.values, false) === HTTP_FIELDS_OK && fields.contentLength === HTTP_FIELDS_NO_LENGTH);
  const options: Section = new Section().add(":method", "OPTIONS").add(":scheme", "https").add(":path", "*");
  t.eqI32("OPTIONS may ask for *", fields.readRequest(options.names, options.values, false), HTTP_FIELDS_OK);
  const star: Section = new Section().add(":method", "GET").add(":scheme", "https").add(":path", "*");
  t.eqI32("no other method may", fields.readRequest(star.names, star.values, false), HTTP_FIELDS_BAD_PSEUDO_VALUE);
  const relative: Section = new Section().add(":method", "GET").add(":scheme", "https").add(":path", "a");
  t.eqI32("a path must start with /", fields.readRequest(relative.names, relative.values, false), HTTP_FIELDS_BAD_PSEUDO_VALUE);
  const empty: Section = new Section().add(":method", "GET").add(":scheme", "https").add(":path", "");
  t.eqI32("an empty :path is refused", fields.readRequest(empty.names, empty.values, false), HTTP_FIELDS_BAD_PSEUDO_VALUE);
  const noPath: Section = new Section().add(":method", "GET").add(":scheme", "https");
  t.eqI32("a GET without :path misses one", fields.readRequest(noPath.names, noPath.values, false), HTTP_FIELDS_PSEUDO_MISSING);
  const noMethod: Section = new Section().add(":scheme", "https").add(":path", "/");
  t.eqI32("so does one without :method", fields.readRequest(noMethod.names, noMethod.values, false), HTTP_FIELDS_PSEUDO_MISSING);
  const twice: Section = get().add(":path", "/again");
  t.eqI32("a pseudo-header twice is refused", fields.readRequest(twice.names, twice.values, false), HTTP_FIELDS_PSEUDO_REPEATED);
  const late: Section = new Section().add(":method", "GET").add("accept", "*/*").add(":scheme", "https").add(":path", "/");
  t.eqI32("one after a regular field is refused", fields.readRequest(late.names, late.values, false), HTTP_FIELDS_PSEUDO_AFTER_FIELD);
  const unknown: Section = get().add(":fragment", "x");
  t.eqI32("an unknown pseudo-header is refused", fields.readRequest(unknown.names, unknown.values, false), HTTP_FIELDS_PSEUDO_UNKNOWN);
  const status: Section = new Section().add(":status", "200").add(":method", "GET").add(":scheme", "https").add(":path", "/");
  t.eqI32(":status in a request is forbidden", fields.readRequest(status.names, status.values, false), HTTP_FIELDS_PSEUDO_FORBIDDEN);
  const upper: Section = get().add("Accept", "*/*");
  t.eqI32("an uppercase field name is refused", fields.readRequest(upper.names, upper.values, false), HTTP_FIELDS_BAD_NAME);
  const crlf: Section = get();
  crlf.names.push(httpFieldBytes("x-a"));
  crlf.values.push(octet("a", 10, "b"));
  t.eqI32("a value with an LF is refused", fields.readRequest(crlf.names, crlf.values, false), HTTP_FIELDS_BAD_VALUE);
  const pseudoValue: Section = new Section().add(":method", " GET").add(":scheme", "https").add(":path", "/");
  t.eqI32("so is a pseudo-header's value with a leading space", fields.readRequest(pseudoValue.names, pseudoValue.values, false), HTTP_FIELDS_BAD_VALUE);
  const keepAlive: Section = get().add("connection", "keep-alive");
  t.eqI32("a connection-specific field is refused", fields.readRequest(keepAlive.names, keepAlive.values, false), HTTP_FIELDS_CONNECTION_SPECIFIC);
  const te: Section = get().add("te", "trailers");
  t.eqI32("te: trailers is not", fields.readRequest(te.names, te.values, false), HTTP_FIELDS_OK);
  const method: Section = new Section().add(":method", "G(T").add(":scheme", "https").add(":path", "/");
  t.eqI32("a :method that is not a token is refused", fields.readRequest(method.names, method.values, false), HTTP_FIELDS_BAD_PSEUDO_VALUE);
  const scheme: Section = new Section().add(":method", "GET").add(":scheme", "1http").add(":path", "/");
  t.eqI32("a :scheme that does not start with a letter is refused", fields.readRequest(scheme.names, scheme.values, false), HTTP_FIELDS_BAD_PSEUDO_VALUE);
  const scheme2: Section = new Section().add(":method", "GET").add(":scheme", "ht_p").add(":path", "/");
  t.eqI32("so is one with a character RFC 3986 does not allow", fields.readRequest(scheme2.names, scheme2.values, false), HTTP_FIELDS_BAD_PSEUDO_VALUE);
  const scheme3: Section = new Section().add(":method", "GET").add(":scheme", "").add(":path", "/");
  t.eqI32("and an empty one", fields.readRequest(scheme3.names, scheme3.values, false), HTTP_FIELDS_BAD_PSEUDO_VALUE);
  const userinfo: Section = new Section().add(":method", "GET").add(":scheme", "https").add(":path", "/").add(":authority", "user@example.com");
  t.eqI32("an :authority with userinfo is refused", fields.readRequest(userinfo.names, userinfo.values, false), HTTP_FIELDS_BAD_PSEUDO_VALUE);
  const host: Section = get().add("host", "example.com");
  t.eqI32("a host that names :authority reads", fields.readRequest(host.names, host.values, false), HTTP_FIELDS_OK);
  const casedHost: Section = get().add("host", "Example.COM");
  t.eqI32("a host is compared without case, as a host name is", fields.readRequest(casedHost.names, casedHost.values, false), HTTP_FIELDS_OK);
  const otherHost: Section = get().add("host", "evil.example");
  t.eqI32("one that names another is refused", fields.readRequest(otherHost.names, otherHost.values, false), HTTP_FIELDS_AUTHORITY_MISMATCH);
  const hostOnly: Section = new Section().add(":method", "GET").add(":scheme", "https").add(":path", "/").add("host", "example.com");
  t.eqI32("host without :authority is left to the program", fields.readRequest(hostOnly.names, hostOnly.values, false), HTTP_FIELDS_OK);
  const lengths: Section = get().add("content-length", "5").add("content-length", "5");
  t.ok("two content-lengths that agree read", fields.readRequest(lengths.names, lengths.values, false) === HTTP_FIELDS_OK && fields.contentLength === toI64(5));
  const disagree: Section = get().add("content-length", "5").add("content-length", "6");
  t.eqI32("two that disagree are refused", fields.readRequest(disagree.names, disagree.values, false), HTTP_FIELDS_BAD_CONTENT_LENGTH);
  const signed: Section = get().add("content-length", "+5");
  t.eqI32("so is one that is not all digits", fields.readRequest(signed.names, signed.values, false), HTTP_FIELDS_BAD_CONTENT_LENGTH);
  const huge: Section = get().add("content-length", "1234567890123456789");
  t.eqI32("or longer than eighteen digits", fields.readRequest(huge.names, huge.values, false), HTTP_FIELDS_BAD_CONTENT_LENGTH);
  const blank: Section = get().add("content-length", "");
  t.eqI32("or empty", fields.readRequest(blank.names, blank.values, false), HTTP_FIELDS_BAD_CONTENT_LENGTH);
  const mismatched = new Section();
  mismatched.names.push(httpFieldBytes(":method"));
  t.eqI32("a section with more names than values is refused", fields.readRequest(mismatched.names, mismatched.values, false), HTTP_FIELDS_BAD_VALUE);

  // --- CONNECT, plain and extended -------------------------------------------------
  const connect: Section = new Section().add(":method", "CONNECT").add(":authority", "example.com:443");
  t.ok("a plain CONNECT has :authority alone", fields.readRequest(connect.names, connect.values, false) === HTTP_FIELDS_OK && fields.isConnect());
  const connectPath: Section = new Section().add(":method", "CONNECT").add(":authority", "example.com:443").add(":path", "/");
  t.eqI32("a :path on one is forbidden", fields.readRequest(connectPath.names, connectPath.values, false), HTTP_FIELDS_PSEUDO_FORBIDDEN);
  const connectBare: Section = new Section().add(":method", "CONNECT");
  t.eqI32("and :authority is required", fields.readRequest(connectBare.names, connectBare.values, false), HTTP_FIELDS_PSEUDO_MISSING);
  const ws: Section = new Section().add(":method", "CONNECT").add(":protocol", "websocket").add(":scheme", "https").add(":path", "/chat").add(":authority", "example.com");
  t.ok("an extended CONNECT reads where it is enabled", fields.readRequest(ws.names, ws.values, true) === HTTP_FIELDS_OK && textOf(fields.protocol) === "websocket");
  t.eqI32("and is refused where it is not", fields.readRequest(ws.names, ws.values, false), HTTP_FIELDS_PSEUDO_FORBIDDEN);
  const wsGet: Section = new Section().add(":method", "GET").add(":protocol", "websocket").add(":scheme", "https").add(":path", "/chat").add(":authority", "example.com");
  t.eqI32(":protocol with another method is forbidden", fields.readRequest(wsGet.names, wsGet.values, true), HTTP_FIELDS_PSEUDO_FORBIDDEN);
  const wsShort: Section = new Section().add(":method", "CONNECT").add(":protocol", "websocket").add(":authority", "example.com");
  t.eqI32("an extended CONNECT needs :scheme and :path", fields.readRequest(wsShort.names, wsShort.values, true), HTTP_FIELDS_PSEUDO_MISSING);
  const wsBad: Section = new Section().add(":method", "CONNECT").add(":protocol", "web socket").add(":scheme", "https").add(":path", "/").add(":authority", "example.com");
  t.eqI32("and a :protocol that is a token", fields.readRequest(wsBad.names, wsBad.values, true), HTTP_FIELDS_BAD_PSEUDO_VALUE);

  // --- responses and trailers --------------------------------------------------------
  const ok: Section = new Section().add(":status", "200").add("content-type", "text/plain");
  t.ok("a response with :status reads", fields.readResponse(ok.names, ok.values) === HTTP_FIELDS_OK && fields.status === 200 && textOf(fields.get("content-type")) === "text/plain");
  const noStatus: Section = new Section().add("content-type", "text/plain");
  t.eqI32("one without is missing it", fields.readResponse(noStatus.names, noStatus.values), HTTP_FIELDS_PSEUDO_MISSING);
  const reqInResp: Section = new Section().add(":status", "200").add(":path", "/");
  t.eqI32("a request pseudo-header in a response is forbidden", fields.readResponse(reqInResp.names, reqInResp.values), HTTP_FIELDS_PSEUDO_FORBIDDEN);
  const badStatus: string[] = ["99", "600", "2000", "20a", "099"];
  let refused: i32 = 0;
  for (const code of badStatus) {
    const section: Section = new Section().add(":status", code);
    if (fields.readResponse(section.names, section.values) === HTTP_FIELDS_BAD_PSEUDO_VALUE) {
      refused = refused + 1;
    }
  }
  t.eqI32("a status that is not three digits from 100 to 599 is refused", refused, toI32(badStatus.length));
  const interim: Section = new Section().add(":status", "103");
  t.ok("an interim 103 reads", fields.readResponse(interim.names, interim.values) === HTTP_FIELDS_OK && fields.status === 103);
  const trailers: Section = new Section().add("grpc-status", "0").add("x-checksum", "abc");
  t.ok("a trailer section of regular fields reads", fields.readTrailers(trailers.names, trailers.values) === HTTP_FIELDS_OK && toI32(fields.names.length) === 2);
  const pseudoTrailer: Section = new Section().add(":status", "200");
  t.eqI32("a pseudo-header in one is forbidden", fields.readTrailers(pseudoTrailer.names, pseudoTrailer.values), HTTP_FIELDS_PSEUDO_FORBIDDEN);
  const badTrailer: Section = new Section().add("Grpc-Status", "0");
  t.eqI32("and its names follow the same rules", fields.readTrailers(badTrailer.names, badTrailer.values), HTTP_FIELDS_BAD_NAME);

  // --- what a program sends --------------------------------------------------------
  const out: Section = new Section().add("content-type", "text/plain").add("cache-control", "no-store");
  t.eqI32("an outgoing section of valid fields passes", httpFieldsCheckOutgoing(out.names, out.values), HTTP_FIELDS_OK);
  const outUpper: Section = new Section().add("Content-Type", "text/plain");
  t.eqI32("an uppercase name is refused", httpFieldsCheckOutgoing(outUpper.names, outUpper.values), HTTP_FIELDS_BAD_NAME);
  const outPseudo: Section = new Section().add(":status", "200");
  t.eqI32("so is a pseudo-header, which the version writes itself", httpFieldsCheckOutgoing(outPseudo.names, outPseudo.values), HTTP_FIELDS_BAD_NAME);
  const outSplit = new Section();
  outSplit.names.push(httpFieldBytes("x-a"));
  outSplit.values.push(octet("a", 13, ""));
  t.eqI32("a value that would end a line once turned back into HTTP/1.1 is refused", httpFieldsCheckOutgoing(outSplit.names, outSplit.values), HTTP_FIELDS_BAD_VALUE);
  const outConn: Section = new Section().add("transfer-encoding", "chunked");
  t.eqI32("a connection-specific field is refused", httpFieldsCheckOutgoing(outConn.names, outConn.values), HTTP_FIELDS_CONNECTION_SPECIFIC);
  const outShort = new Section();
  outShort.names.push(httpFieldBytes("x-a"));
  t.eqI32("and two lists of different lengths", httpFieldsCheckOutgoing(outShort.names, outShort.values), HTTP_FIELDS_BAD_VALUE);

  fields.clear();
  t.ok("clear empties every field", toI32(fields.method.length) === 0 && fields.status === 0 && toI32(fields.names.length) === 0 && fields.contentLength === HTTP_FIELDS_NO_LENGTH);
  return t.done();
};
