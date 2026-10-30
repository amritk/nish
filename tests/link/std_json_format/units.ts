// The edges the suite does not reach: the dispatcher's ids and unknowns, the
// strict duration grammar, leap seconds across offsets, the URI forms
// `nish/net/url` refuses, IRI ranges, and the documented regex false negatives.
import { Suite } from "nish/testing";
import {
  JSON_FORMAT_DATE_TIME,
  JSON_FORMAT_INVALID,
  JSON_FORMAT_REGEX,
  JSON_FORMAT_UNKNOWN,
  JSON_FORMAT_VALID,
  isDate,
  isDateTime,
  isDuration,
  isEmail,
  isHostname,
  isIpv4,
  isIpv6,
  isIri,
  isIriReference,
  isRegex,
  isTime,
  isUri,
  isUriReference,
  isUriTemplate,
  isUuid,
  jsonFormatCheck,
  jsonFormatId,
  jsonFormatValidate,
} from "nish/json-format";

/** `n` copies of `a`. */
const jftAs = (n: i32): string => {
  let out = "";
  for (let i: i32 = 0; i < n; i += 1) {
    out = `${out}a`;
  }
  return out;
};

export const jftUnits = (t: Suite): void => {
  t.ok("dispatch: date-time is id 0", jsonFormatId("date-time") === JSON_FORMAT_DATE_TIME);
  t.ok("dispatch: regex is id 14", jsonFormatId("regex") === JSON_FORMAT_REGEX);
  t.ok("dispatch: a name is matched exactly", jsonFormatId("Date-Time") === -1);
  t.ok("dispatch: idn-email is unknown", jsonFormatValidate("idn-email", "x@y") === JSON_FORMAT_UNKNOWN);
  t.ok("dispatch: idn-hostname is unknown", jsonFormatValidate("idn-hostname", "x") === JSON_FORMAT_UNKNOWN);
  t.ok("dispatch: json-pointer is unknown", jsonFormatValidate("json-pointer", "/a") === JSON_FORMAT_UNKNOWN);
  t.ok("dispatch: relative-json-pointer is unknown", jsonFormatValidate("relative-json-pointer", "0") === JSON_FORMAT_UNKNOWN);
  t.ok("dispatch: an empty name is unknown", jsonFormatValidate("", "") === JSON_FORMAT_UNKNOWN);
  t.ok("dispatch: id -1 is unknown", jsonFormatCheck(-1, "x") === JSON_FORMAT_UNKNOWN);
  t.ok("dispatch: id 15 is unknown", jsonFormatCheck(15, "x") === JSON_FORMAT_UNKNOWN);
  t.ok("dispatch: a valid value", jsonFormatCheck(jsonFormatId("ipv4"), "10.0.0.1") === JSON_FORMAT_VALID);
  t.ok("dispatch: an invalid value", jsonFormatCheck(jsonFormatId("ipv4"), "10.0.0") === JSON_FORMAT_INVALID);

  t.eqBool("date: 29 February of 2000", isDate("2000-02-29"), true);
  t.eqBool("date: 29 February of 1900", isDate("1900-02-29"), false);
  t.eqBool("date: 31 April", isDate("2021-04-31"), false);
  t.eqBool("date: a trailing character", isDate("2021-04-30Z"), false);
  t.eqBool("date-time: lower-case t and z", isDateTime("1963-06-19t08:30:06z"), true);
  t.eqBool("date-time: a space for T", isDateTime("1963-06-19 08:30:06Z"), false);
  t.eqBool("time: a leap second east of UTC", isTime("00:29:60+00:30"), true);
  t.eqBool("time: a leap second west of UTC", isTime("23:29:60-00:30"), true);
  t.eqBool("time: 23:59:60 local west of UTC is not one", isTime("23:59:60-00:30"), false);
  t.eqBool("time: a fraction with no digit", isTime("08:30:06.Z"), false);
  t.eqBool("time: an offset of 24 hours", isTime("08:30:06+24:00"), false);
  t.eqBool("time: no offset", isTime("08:30:06"), false);

  t.eqBool("duration: years and months", isDuration("P1Y2M"), true);
  t.eqBool("duration: a skipped month is the ABNF's refusal", isDuration("P1Y1D"), false);
  t.eqBool("duration: a skipped minute", isDuration("PT1H1S"), false);
  t.eqBool("duration: days and a time", isDuration("P4DT12H30M5S"), true);
  t.eqBool("duration: a T with nothing after it", isDuration("P1DT"), false);
  t.eqBool("duration: two Ts", isDuration("PT1HT1M"), false);
  t.eqBool("duration: a week after a day", isDuration("P1D2W"), false);
  t.eqBool("duration: a number with no unit", isDuration("P1"), false);

  t.eqBool("email: a quoted local part with a space", isEmail("\"joe bloggs\"@example.com"), true);
  t.eqBool("email: a quoted pair", isEmail("\"a\\\"b\"@example.com"), true);
  t.eqBool("email: an IPv6 literal", isEmail("joe@[IPv6:::1]"), true);
  t.eqBool("email: a general literal", isEmail("joe@[x-tag:content]"), true);
  t.eqBool("email: an unclosed literal", isEmail("joe@[127.0.0.1"), false);
  t.eqBool("email: a local part of 65 octets", isEmail(`${jftAs(65)}@example.com`), false);
  t.eqBool("email: a local part of 64 octets", isEmail(`${jftAs(64)}@example.com`), true);
  t.eqBool("email: no domain", isEmail("joe@"), false);

  t.eqBool("hostname: a label of 63", isHostname(`${jftAs(63)}.com`), true);
  t.eqBool("hostname: a label of 64", isHostname(`${jftAs(64)}.com`), false);
  t.eqBool("hostname: an empty label", isHostname("a..b"), false);
  t.eqBool("hostname: a trailing dot", isHostname("example.com."), false);
  t.eqBool("hostname: empty", isHostname(""), false);

  t.eqBool("ipv4: 255", isIpv4("255.255.255.255"), true);
  t.eqBool("ipv4: 256", isIpv4("256.0.0.1"), false);
  t.eqBool("ipv4: a fifth part", isIpv4("1.2.3.4.5"), false);
  t.eqBool("ipv6: the unspecified address", isIpv6("::"), true);
  t.eqBool("ipv6: a trailing ::", isIpv6("1::"), true);
  t.eqBool("ipv6: an IPv4 tail", isIpv6("::ffff:192.168.0.1"), true);
  t.eqBool("ipv6: an IPv4 tail in the middle", isIpv6("::1.2.3.4:1"), false);
  t.eqBool("ipv6: a lone trailing colon", isIpv6("1:2:3:4:5:6:7:"), false);
  t.eqBool("ipv6: a zone", isIpv6("fe80::1%eth0"), false);
  t.eqBool("ipv6: two ::", isIpv6("1::2::3"), false);
  t.eqBool("ipv6: nine groups", isIpv6("1:2:3:4:5:6:7:8:9"), false);

  t.eqBool("uuid: upper case", isUuid("2EB8AA08-AA98-11EA-B4AA-73B441D16380"), true);
  t.eqBool("uuid: a dash moved", isUuid("2eb8aa0-8aa98-11ea-b4aa-73b441d16380"), false);

  t.eqBool("uri: a percent-encoded reg-name", isUri("http://ex%41mple.com/"), true);
  t.eqBool("uri: a numeric reg-name", isUri("http://999.999.999.999/"), true);
  t.eqBool("uri: a userinfo and port", isUri("http://u:p@example.com:8080/a?b#c"), true);
  t.eqBool("uri: a URN", isUri("urn:isbn:0451450523"), true);
  t.eqBool("uri: IPvFuture", isUri("http://[v1.fe80::a+en1]/"), true);
  t.eqBool("uri: an empty IPvFuture body", isUri("http://[v1.]/"), false);
  t.eqBool("uri: a bad percent escape", isUri("http://example.com/%zz"), false);
  t.eqBool("uri: a space", isUri("http://example.com/a b"), false);
  t.eqBool("uri: a non-digit port", isUri("http://example.com:8o/"), false);
  t.eqBool("uri: a second # in the fragment", isUri("http://example.com/#a#b"), false);
  t.eqBool("uri: a non-ASCII character", isUri("http://example.com/é"), false);
  t.eqBool("uri: no scheme", isUri("//example.com/"), false);
  t.eqBool("uri-reference: a network-path reference", isUriReference("//example.com/"), true);
  t.eqBool("uri-reference: the empty reference", isUriReference(""), true);
  t.eqBool("uri-reference: a colon after the first segment", isUriReference("a/b:c"), true);
  t.eqBool("uri-reference: a colon in the first segment", isUriReference("1a:b"), false);

  t.eqBool("iri: a ucschar in the path", isIri("http://example.com/é"), true);
  t.eqBool("iri: a character past the BMP", isIri("http://example.com/\u{1f600}"), true);
  t.eqBool("iri: iprivate in the query", isIri("http://example.com/?"), true);
  t.eqBool("iri: iprivate in the path", isIri("http://example.com/"), false);
  t.eqBool("iri: a non-character", isIri("http://example.com/￾"), false);
  t.eqBool("iri: a C1 control", isIri("http://example.com/\u0085"), false);
  t.eqBool("iri-reference: a relative IRI", isIriReference("é/a"), true);

  t.eqBool("uri-template: a prefix modifier", isUriTemplate("{var:30}"), true);
  t.eqBool("uri-template: a prefix of 10000", isUriTemplate("{var:10000}"), false);
  t.eqBool("uri-template: a prefix of 0", isUriTemplate("{var:0}"), false);
  t.eqBool("uri-template: an explode list", isUriTemplate("{/list*,path:4}"), true);
  t.eqBool("uri-template: a dotted name", isUriTemplate("{a.b}"), true);
  t.eqBool("uri-template: a trailing dot", isUriTemplate("{a.}"), false);
  t.eqBool("uri-template: an empty expression", isUriTemplate("{}"), false);
  t.eqBool("uri-template: an unclosed expression", isUriTemplate("{a"), false);
  t.eqBool("uri-template: a space", isUriTemplate("a b"), false);

  t.eqBool("regex: a class and a quantifier", isRegex("^[a-z]+\\d{2,3}$"), true);
  t.eqBool("regex: an unclosed group", isRegex("(a"), false);
  // Known differences: ECMA-262 patterns nish/regex refuses, answered invalid.
  t.eqBool("regex: lookahead is a known false negative", isRegex("(?=a)a"), false);
  t.eqBool("regex: a backreference is a known false negative", isRegex("(a)\\1"), false);
};
