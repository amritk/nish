// The cases where `pkiVerifyServer`'s verdict differs from limbo's, each with
// the finding of docs/security/crypto-pki.md that records why it is kept.
// main.ts fails when a case diverges that is not listed here, or a listed one
// no longer does, or diverges the other way from its `accepts`. PKI-25 lists the chains refused that limbo accepts; every
// other finding here is a chain accepted that limbo refuses: PKI-26 to PKI-28
// because the fix needs a part of the certificate `nish/crypto/x509` does not
// decode, or a Public Suffix List; PKI-29 to PKI-31 because pki follows RFC
// 5280 or the other validators there; PKI-32 because the rule would refuse a
// root Mozilla's store ships.
import { LimboDivergence } from "./types"

/** Every divergence kept, in cases.ts's order. */
export const limboDivergences = (): LimboDivergence[] => [
  { id: "cve::cve-2024-0567", finding: "PKI-25", accepts: false },
  { id: "pathlen::validation-ignores-pathlen-in-leaf", finding: "PKI-25", accepts: false },
  { id: "rfc5280::aki::critical-aki", finding: "PKI-26", accepts: true },
  { id: "rfc5280::nc::permitted-dns-match-noncritical", finding: "PKI-26", accepts: true },
  { id: "rfc5280::nc::permitted-self-issued", finding: "PKI-25", accepts: false },
  { id: "rfc5280::nc::invalid-dnsname-leading-period", finding: "PKI-31", accepts: true },
  { id: "rfc5280::nc::nc-forbids-othername-noop", finding: "PKI-25", accepts: false },
  { id: "rfc5280::pc::ica-noncritical-pc", finding: "PKI-26", accepts: true },
  { id: "rfc5280::san::noncritical-with-empty-subject", finding: "PKI-26", accepts: true },
  { id: "rfc5280::ski::root-missing-ski", finding: "PKI-32", accepts: true },
  { id: "rfc5280::validity::notafter-fractional", finding: "PKI-25", accepts: false },
  { id: "rfc5280::root-non-critical-basic-constraints", finding: "PKI-26", accepts: true },
  { id: "rfc5280::ca-as-leaf", finding: "PKI-25", accepts: false },
  { id: "webpki::aki::root-with-aki-missing-keyidentifier", finding: "PKI-27", accepts: true },
  { id: "webpki::aki::root-with-aki-all-fields", finding: "PKI-27", accepts: true },
  { id: "webpki::cn::ipv4-hex-mismatch", finding: "PKI-29", accepts: true },
  { id: "webpki::cn::ipv4-leading-zeros-mismatch", finding: "PKI-29", accepts: true },
  { id: "webpki::cn::ipv6-uppercase-mismatch", finding: "PKI-29", accepts: true },
  { id: "webpki::cn::ipv6-uncompressed-mismatch", finding: "PKI-29", accepts: true },
  { id: "webpki::cn::ipv6-non-rfc5952-mismatch", finding: "PKI-29", accepts: true },
  { id: "webpki::cn::punycode-not-in-san", finding: "PKI-29", accepts: true },
  { id: "webpki::cn::utf8-vs-punycode-mismatch", finding: "PKI-29", accepts: true },
  { id: "webpki::cn::not-in-san", finding: "PKI-29", accepts: true },
  { id: "webpki::cn::case-mismatch", finding: "PKI-29", accepts: true },
  { id: "webpki::eku::ee-critical-eku", finding: "PKI-26", accepts: true },
  { id: "webpki::eku::ee-without-eku", finding: "PKI-30", accepts: true },
  { id: "webpki::san::public-suffix-multi-label-wildcard-san", finding: "PKI-28", accepts: true },
  { id: "webpki::san::public-suffix-private-namespace-wildcard-san", finding: "PKI-28", accepts: true },
  { id: "webpki::san::san-critical-with-nonempty-subject", finding: "PKI-26", accepts: true },
  { id: "webpki::malformed-aia", finding: "PKI-27", accepts: true },
];
