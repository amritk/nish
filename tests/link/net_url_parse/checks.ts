// `nish/net/url`'s `urlParse`, `urlResolve`, `urlSerialize` and `urlOrigin`.
// Four groups of checks:
//
// - **RFC 3986 §5.4.** Every normal (§5.4.1) and abnormal (§5.4.2) example,
//   resolved against the RFC's base `http://a/b/c/d;p?q` and written back. The
//   one answer that differs is `http:g`, whose strict result is an http URL
//   with no host, which this module refuses.
// - **The parts** `urlParse` splits a URL into: a lower-cased scheme and host,
//   userinfo, a port, an IPv6 host without brackets, a path with its dot
//   segments removed (`%2e` among them), and a query and fragment that are
//   null when absent and empty when written empty.
// - **The refusals**, one URL per rule, each answered with null, and the
//   limit beside each that is accepted.
// - **Origins** and default ports.
import { Suite } from "nish/testing";
import { Url, urlDefaultPort, urlOrigin, urlParse, urlResolve, urlSerialize } from "nish/net/url";

/** `ref` resolved against `base` and written back, or `null`. */
const resolved = (base: Url, ref: string): string => {
  const u: Url | null = urlResolve(base, ref);
  if (u === null) {
    return "null";
  }
  return urlSerialize(u);
};

/** A nullable part as text: `null`, or the part in quotes. */
const part = (s: string | null): string => {
  if (s === null) {
    return "null";
  }
  return `"${s}"`;
};

/** Every part of `s` as `urlParse` splits it, one line, or `null`. */
const parts = (s: string): string => {
  const u: Url | null = urlParse(s);
  if (u === null) {
    return "null";
  }
  const authority: string = u.hasAuthority ? "//" : "-";
  return `${u.scheme} ${authority} user=${part(u.username)} pass=${part(u.password)} host=${part(u.host)} port=${u.port} path=${part(u.path)} query=${part(u.query)} fragment=${part(u.fragment)}`;
};

/** `s` parsed, for a base the test knows is valid; a null here is a failed check. */
const parsed = (s: string): Url => {
  const u: Url | null = urlParse(s);
  if (u !== null) {
    return u;
  }
  panic(`net_url_parse: the base ${s} did not parse`);
};

/** `s` parsed and written back, or `null`. */
const roundTrip = (s: string): string => {
  const u: Url | null = urlParse(s);
  if (u === null) {
    return "null";
  }
  return urlSerialize(u);
};

/** `s`'s origin, or `null` when it does not parse or has none. */
const originOf = (s: string): string => {
  const u: Url | null = urlParse(s);
  if (u === null) {
    return "null";
  }
  const o: string | null = urlOrigin(u);
  if (o === null) {
    return "null";
  }
  return o;
};

/** RFC 3986 §5.4.1, as reference and target pairs. */
const normalExamples = (): string[] => [
  "g:h", "g:h",
  "g", "http://a/b/c/g",
  "./g", "http://a/b/c/g",
  "g/", "http://a/b/c/g/",
  "/g", "http://a/g",
  "//g", "http://g",
  "?y", "http://a/b/c/d;p?y",
  "g?y", "http://a/b/c/g?y",
  "#s", "http://a/b/c/d;p?q#s",
  "g#s", "http://a/b/c/g#s",
  "g?y#s", "http://a/b/c/g?y#s",
  ";x", "http://a/b/c/;x",
  "g;x", "http://a/b/c/g;x",
  "g;x?y#s", "http://a/b/c/g;x?y#s",
  "", "http://a/b/c/d;p?q",
  ".", "http://a/b/c/",
  "./", "http://a/b/c/",
  "..", "http://a/b/",
  "../", "http://a/b/",
  "../g", "http://a/b/g",
  "../..", "http://a/",
  "../../", "http://a/",
  "../../g", "http://a/g",
];

/** RFC 3986 §5.4.2, as reference and target pairs; `http:g` is discussed above. */
const abnormalExamples = (): string[] => [
  "../../../g", "http://a/g",
  "../../../../g", "http://a/g",
  "/./g", "http://a/g",
  "/../g", "http://a/g",
  "g.", "http://a/b/c/g.",
  ".g", "http://a/b/c/.g",
  "g..", "http://a/b/c/g..",
  "..g", "http://a/b/c/..g",
  "./../g", "http://a/b/g",
  "./g/.", "http://a/b/c/g/",
  "g/./h", "http://a/b/c/g/h",
  "g/../h", "http://a/b/c/h",
  "g;x=1/./y", "http://a/b/c/g;x=1/y",
  "g;x=1/../y", "http://a/b/c/y",
  "g?y/./x", "http://a/b/c/g?y/./x",
  "g?y/../x", "http://a/b/c/g?y/../x",
  "g#s/./x", "http://a/b/c/g#s/./x",
  "g#s/../x", "http://a/b/c/g#s/../x",
];

/** URLs `urlParse` refuses, each with the rule it breaks. */
const refusedUrls = (): string[] => [
  "no scheme", "//a/b",
  "no scheme: a relative path", "a/b",
  "a scheme that starts with a digit", "1http://a/",
  "an empty scheme", "://a/",
  "a space", "http://a/b c",
  "a tab", "http://a/\tb",
  "a CR LF", "http://a/\r\nHost: b",
  "a NUL", "http://a/\u0000",
  "a DEL", "http://a/\u007f",
  "a byte past 0x7F", "http://a/\u00e9",
  "a % not followed by two hex digits", "http://a/%zz",
  "a % at the end", "http://a/%4",
  "an empty http host", "http:///b",
  "an empty https host", "https://",
  "an http URL with no authority", "http:/b",
  "an empty host with a port", "http://:80/",
  "a percent-encoded byte in the host", "http://%61/",
  "a sub-delim in the host", "http://a!b/",
  "a backslash in the host", "http://a\\b/",
  "two @ in the authority", "http://u@evil@a/",
  "a [ in the userinfo", "http://u[@a/",
  "a ] in the userinfo", "http://u]@a/",
  "port 65536", "http://a:65536/",
  "a port of twenty digits", "http://a:99999999999999999999/",
  "a signed port", "http://a:+80/",
  "a port with a letter", "http://a:8o/",
  "two ports", "http://a:80:81/",
  "an unclosed IPv6 literal", "http://[::1/",
  "an empty IPv6 literal", "http://[]/",
  "an IPv6 literal with nine groups", "http://[1:2:3:4:5:6:7:8:9]/",
  "an IPv6 literal with seven groups and no ::", "http://[1:2:3:4:5:6:7]/",
  "an IPv6 literal with :: and eight groups", "http://[1:2:3:4::5:6:7:8]/",
  "an IPv6 literal with two ::", "http://[1::2::3]/",
  "an IPv6 literal with :::", "http://[1:::2]/",
  "an IPv6 group of five digits", "http://[12345::1]/",
  "an IPv6 literal ending in one :", "http://[1::2:]/",
  "an IPv6 literal starting with one :", "http://[:1::2]/",
  "an IPv6 literal with a non-hex digit", "http://[::g]/",
  "an IPv6 zone", "http://[fe80::1%25eth0]/",
  "an IPvFuture literal", "http://[v1.x]/",
  "an IPv6 literal with a bad IPv4 tail", "http://[::1.2.3.256]/",
  "an IPv6 literal with an IPv4 tail too many", "http://[1:2:3:4:5:6:7:1.2.3.4]/",
  "bytes between ] and the port", "http://[::1]x:80/",
  "an IPv4 octet above 255", "http://1.2.3.256/",
  "an IPv4 address of three parts", "http://127.1/",
  "an IPv4 address of five parts", "http://1.2.3.4.5/",
  "an IPv4 octet with a leading zero", "http://010.0.0.1/",
  "an IPv4 address with a trailing dot", "http://127.0.0.1./",
  "a host that is one decimal number", "http://2130706433/",
  "a host whose last label is hex", "http://0x7f.0.0.1/",
  "a reg-name whose last label is a number", "http://a.b.123/",
];

/**
 * `count` seeded strings over the bytes the parser splits on, each parsed and
 * resolved against `base`: none may panic, and every URL either answer gives
 * must write back to a string that parses to itself. Answers how many broke
 * that, and how many parsed, so the corpus is known to reach both sides.
 */
const roundTripFuzz = (base: Url, count: i32): string => {
  const prefixes: string[] = ["http://", "https://", "HTTP://", "g:", "//", "", "/", "file://"];
  const alphabet: string = "aZ09:/?#@[].%2eEf+-~!\\ xv";
  let seed: i32 = 1;
  let broken: i32 = 0;
  let parsedCount: i32 = 0;
  for (let n: i32 = 0; n < count; n += 1) {
    seed = (seed * 75 + 74) % 65537;
    const parts: string[] = [prefixes[seed % toI32(prefixes.length)]];
    const len: i32 = seed % 13;
    for (let k: i32 = 0; k < len; k += 1) {
      seed = (seed * 75 + 74) % 65537;
      const at: i32 = seed % toI32(alphabet.length);
      parts.push(alphabet.slice(at, at + 1));
    }
    const text: string = parts.join("");
    const answers: string[] = [roundTrip(text), resolved(base, text)];
    for (let k: i32 = 0; k < 2; k += 1) {
      if (answers[k] !== "null") {
        parsedCount += 1;
        if (roundTrip(answers[k]) !== answers[k]) {
          broken += 1;
        }
      }
    }
  }
  return `${broken} broken, ${parsedCount} parsed`;
};

export const urlParseChecks = (): i32 => {
  const t = new Suite("net_url_parse");
  const base: Url | null = urlParse("http://a/b/c/d;p?q");
  if (base === null) {
    t.fail("the RFC 3986 §5.4 base parses", "null");
    return t.done();
  }
  t.eqStr("the RFC 3986 §5.4 base parses and writes back", urlSerialize(base), "http://a/b/c/d;p?q");

  const normal: string[] = normalExamples();
  const abnormal: string[] = abnormalExamples();
  const refused: string[] = refusedUrls();
  for (let i: i32 = 0; i + 1 < toI32(normal.length); i += 2) {
    t.eqStr(`§5.4.1 "${normal[i]}"`, resolved(base, normal[i]), normal[i + 1]);
  }
  for (let i: i32 = 0; i + 1 < toI32(abnormal.length); i += 2) {
    t.eqStr(`§5.4.2 "${abnormal[i]}"`, resolved(base, abnormal[i]), abnormal[i + 1]);
  }
  t.eqStr("§5.4.2 \"http:g\" resolves strictly to an http URL with no host, which is refused", resolved(base, "http:g"), "null");
  t.eqStr("a reference with an empty authority is refused for http", resolved(base, "//"), "null");
  t.eqStr("a reference breaking a parse rule is refused", resolved(base, "g h"), "null");
  t.eqStr("a reference with a bad host is refused", resolved(base, "//a%2e/"), "null");
  t.eqStr("the base's fragment is not carried over", resolved(parsed("http://a/b#f"), "c"), "http://a/c");
  t.eqStr("an empty reference drops the base's fragment", resolved(parsed("http://a/b?q#f"), ""), "http://a/b?q");
  t.eqStr("the base's userinfo and port are carried over", resolved(parsed("http://u:p@a:8080/b/c"), "../d"), "http://u:p@a:8080/d");
  t.eqStr("a relative path against an empty base path with an authority", resolved(parsed("http://a"), "g"), "http://a/g");
  t.eqStr("a relative path against a base with no authority", resolved(parsed("mailto:x"), "y"), "mailto:y");
  t.eqStr("a reference's scheme and host are lower-cased", resolved(base, "HTTPS://EXAMPLE.com/X"), "https://example.com/X");
  t.eqStr("a .. in a reference with an authority is removed", resolved(base, "//g/x/../y"), "http://g/y");
  t.eqStr("resolving does not change the base", urlSerialize(base), "http://a/b/c/d;p?q");

  t.eqStr("the parts of a full URL", parts("HTTP://User:Pa%20ss@WWW.Example.COM:8080/a/B?x=1&y#Frag"),
    "http // user=\"User\" pass=\"Pa%20ss\" host=\"www.example.com\" port=8080 path=\"/a/B\" query=\"x=1&y\" fragment=\"Frag\"");
  t.eqStr("no userinfo, port, query or fragment", parts("https://a.b"),
    "https // user=\"\" pass=\"\" host=\"a.b\" port=-1 path=\"\" query=null fragment=null");
  t.eqStr("a query and fragment written empty are empty, not null", parts("http://a/?#"),
    "http // user=\"\" pass=\"\" host=\"a\" port=-1 path=\"/\" query=\"\" fragment=\"\"");
  t.eqStr("a username alone", parts("http://u@a/"),
    "http // user=\"u\" pass=\"\" host=\"a\" port=-1 path=\"/\" query=null fragment=null");
  t.eqStr("an empty port is no port", parts("http://a:/"),
    "http // user=\"\" pass=\"\" host=\"a\" port=-1 path=\"/\" query=null fragment=null");
  t.eqStr("port 0", parts("http://a:0/"),
    "http // user=\"\" pass=\"\" host=\"a\" port=0 path=\"/\" query=null fragment=null");
  t.eqStr("port 65535", parts("http://a:65535/"),
    "http // user=\"\" pass=\"\" host=\"a\" port=65535 path=\"/\" query=null fragment=null");
  t.eqStr("a port with leading zeros", parts("http://a:00080/"),
    "http // user=\"\" pass=\"\" host=\"a\" port=80 path=\"/\" query=null fragment=null");
  t.eqStr("an IPv6 host loses its brackets and is lower-cased", parts("http://[2001:DB8::1]:8443/"),
    "http // user=\"\" pass=\"\" host=\"2001:db8::1\" port=8443 path=\"/\" query=null fragment=null");
  t.eqStr("an IPv4 host", parts("http://192.168.0.1/"),
    "http // user=\"\" pass=\"\" host=\"192.168.0.1\" port=-1 path=\"/\" query=null fragment=null");
  t.eqStr("a file URL with an empty host", parts("file:///etc/hosts"),
    "file // user=\"\" pass=\"\" host=\"\" port=-1 path=\"/etc/hosts\" query=null fragment=null");
  t.eqStr("a URL with no authority", parts("mailto:a@b.c"),
    "mailto - user=\"\" pass=\"\" host=\"\" port=-1 path=\"a@b.c\" query=null fragment=null");
  t.eqStr("a scheme with digits, +, - and .", parts("a1+b-c.d:x"),
    "a1+b-c.d - user=\"\" pass=\"\" host=\"\" port=-1 path=\"x\" query=null fragment=null");
  t.eqStr("a ? and # in the fragment belong to it", parts("http://a/b#c?d#e"),
    "http // user=\"\" pass=\"\" host=\"a\" port=-1 path=\"/b\" query=null fragment=\"c?d#e\"");
  t.eqStr("a : and @ in the path belong to it", parts("http://a/b:c@d"),
    "http // user=\"\" pass=\"\" host=\"a\" port=-1 path=\"/b:c@d\" query=null fragment=null");
  t.eqStr("dot segments are removed when parsing", roundTrip("http://a/b/./c/../../d"), "http://a/d");
  t.eqStr("dot segments written as %2e are removed", roundTrip("http://a/b/%2e/c/%2E%2e/.%2e/d"), "http://a/d");
  t.eqStr("%2e%2e at the end leaves a directory", roundTrip("http://a/b/c/%2e%2e"), "http://a/b/");
  t.eqStr("%2e inside a segment is kept", roundTrip("http://a/b%2ec/%2e%2e%2e"), "http://a/b%2ec/%2e%2e%2e");
  t.eqStr("dot segments in the query are kept", roundTrip("http://a/?x/../y"), "http://a/?x/../y");
  t.eqStr("an empty segment before .. is the one removed", roundTrip("http://a/b//../c"), "http://a/b/c");
  t.eqStr("a path that would read back as an authority is written after /.", roundTrip("g:/..//x"), "g:/.//x");
  t.ok("which parses back to the same path", parts(roundTrip("g:/..//x")) === parts("g:/..//x"));
  t.eqStr("an IPv6 host is written back in brackets", roundTrip("http://[::1]:80/"), "http://[::1]:80/");
  t.eqStr("userinfo is written back", roundTrip("http://u:p@a/"), "http://u:p@a/");
  t.eqStr("a username alone is written back", roundTrip("http://u@a/"), "http://u@a/");
  t.eqStr("an empty userinfo is dropped", roundTrip("http://@a/"), "http://a/");
  t.eqStr("an empty password is written as none", roundTrip("http://u:@a/"), "http://u@a/");
  t.eqStr("a default port written out is kept", roundTrip("http://a:80/"), "http://a:80/");
  t.eqStr("an escape keeps the case it was written in", roundTrip("http://a/%4a%4A?%4a#%4A"), "http://a/%4a%4A?%4a#%4A");

  const ipv6Accepted: string[] = [
    "::", "::1", "1::", "1:2:3:4:5:6:7:8", "1:2:3:4:5:6:7::", "::2:3:4:5:6:7:8",
    "1:2:3:4:5:6::8", "abcd:ef01::", "::ffff:1.2.3.4", "1:2:3:4:5:6:1.2.3.4", "::1.2.3.4",
  ];
  for (let i: i32 = 0; i < toI32(ipv6Accepted.length); i += 1) {
    t.ok(`an IPv6 literal [${ipv6Accepted[i]}] is accepted`, urlParse(`http://[${ipv6Accepted[i]}]/`) !== null);
  }
  t.ok("255.255.255.255 is an IPv4 host", urlParse("http://255.255.255.255/") !== null);
  t.ok("0.0.0.0 is an IPv4 host", urlParse("http://0.0.0.0/") !== null);
  t.ok("a reg-name with a numeric label that is not the last", urlParse("http://1.a/") !== null);
  t.ok("a reg-name ending in a dot", urlParse("http://a.b./") !== null);
  t.ok("a reg-name with unreserved punctuation", urlParse("http://a-b_c~d.e/") !== null);
  t.ok("a reg-name whose last label starts with 0x but is not hex", urlParse("http://a.0xg/") !== null);

  for (let i: i32 = 0; i + 1 < toI32(refused.length); i += 2) {
    t.eqStr(`refused: ${refused[i]}`, parts(refused[i + 1]), "null");
  }

  t.eqStr(
    "4,000 seeded strings parse and resolve without a panic, and each answer writes back to itself",
    roundTripFuzz(base, 4000),
    "0 broken, 2161 parsed",
  );

  t.ok("http's default port", urlDefaultPort("http") === 80);
  t.ok("https's default port", urlDefaultPort("https") === 443);
  t.ok("another scheme has none", urlDefaultPort("ftp") === -1);
  t.eqStr("an origin writes the default port", originOf("HTTP://A.com/x"), "http://a.com:80");
  t.ok("so an explicit default port is the same origin", originOf("http://a.com:80/y?z") === originOf("http://A.COM/"));
  t.eqStr("an https origin", originOf("https://a.com/"), "https://a.com:443");
  t.ok("http and https are different origins", originOf("http://a.com/") !== originOf("https://a.com/"));
  t.eqStr("an explicit port", originOf("https://a.com:8443/"), "https://a.com:8443");
  t.eqStr("userinfo is not part of an origin", originOf("http://u:p@a.com/"), "http://a.com:80");
  t.eqStr("an IPv6 origin is bracketed", originOf("http://[::1]/"), "http://[::1]:80");
  t.eqStr("a scheme other than http or https has no origin", originOf("file:///x"), "null");
  return t.done();
};
