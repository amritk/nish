// What the relay starts from: its options (main.rs's `parse_options`, with
// grant.rs's caller's refusals), and its identity (tls.rs's tests): a minted
// self-signed certificate pinned by its own hash, a PEM pair loaded from
// disk and deliberately not pinned, the `--cert-out` bodies byte for byte,
// one of `--cert` and `--key` without the other refused, a key that is not
// the certificate's refused, and a renewal picked up, a half-written or
// crossed one kept away, and a missing file read as "unchanged".
import { mkdirSync, writeFileSync } from "nish:fs";
import { Secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import {
  MILLIS_PER_DAY,
  RelayIdentity,
  RelayWatch,
  SELF_SIGNED_DAYS,
  relayCertOutBody,
  relayDottedHex,
  relayLoadPem,
  relayMintIdentity,
  relayRenew,
  relaySourceFrom,
} from "../../../examples/relay/identity";
import { RelayOptions, relayIsAddress, relayNamed, relayParseArgs, relaySplitSans } from "../../../examples/relay/options";
import { CA_PEM, CA_PKCS8_PEM, LEAF_PEM } from "../crypto_x509/fixtures";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";

/** The options `argv` (after the program name) gives over the defaults: the refusal, or a summary. */
const parsed = (argv: string[]): string => {
  const o = new RelayOptions();
  relayParseArgs(o, argv, n32(0));
  if (o.error.length > 0) {
    return `error: ${o.error}`;
  }
  return `${o.port} ${o.bind} ${o.path} ${o.secret} ${o.certOut} ${o.cert} ${o.key} [${o.sans.join(",")}] ${o.offload} ${o.help}`;
};

/** The option checks. */
const optionChecks = (t: Suite): void => {
  const none: string[] = [];
  t.eqStr("the defaults: port 4433, no bind, /cs, the development secret", parsed(none), "4433  /cs cs-dev-secret    [] false false");
  t.eqStr(
    "every option main.rs has",
    parsed(["--port", "5000", "--bind", "::1", "--path", "/play", "--secret", "s3", "--cert-out", "h.json", "--cert", "c.pem", "--key", "k.pem", "--san", "a", "--san", "b", "--offload"]),
    "5000 ::1 /play s3 h.json c.pem k.pem [a,b] true false"
  );
  t.eqStr("--help is a switch", parsed(["--help"]), "4433  /cs cs-dev-secret    [] false true");
  t.eqStr("an option without its value", parsed(["--port"]), "error: --port needs a value");
  t.eqStr("a port that is not one", parsed(["--port", "x"]), "error: bad port x");
  t.eqStr("a port past 65535", parsed(["--port", "65536"]), "error: bad port 65536");
  t.eqStr("a bind address that is a name", parsed(["--bind", "relay.local"]), "error: bad bind address relay.local");
  t.eqStr("an option main.rs does not have", parsed(["--verbose", "1"]), "error: unknown option --verbose");
  t.eqStr("a path that does not start with /", parsed(["--path", "cs"]), "error: bad path cs: a path starts with /");
  const sans: string[] = [];
  relaySplitSans(" 192.168.1.20, cs.local,,  ", sans);
  t.eqStr("CS_RELAY_SAN is split on commas and trimmed", sans.join("|"), "192.168.1.20|cs.local");
  // main.rs's san_tests: a LAN address is development, and a host name is not.
  t.ok("no SAN, address literals and localhost are development", !relayNamed(none) && !relayNamed(["192.168.1.20"]) && !relayNamed(["10.0.0.4", "172.17.0.1"]) && !relayNamed(["localhost"]) && !relayNamed(["fe80::1"]) && !relayNamed(["203.0.113.9"]));
  t.ok("a host name is a deployment", relayNamed(["cs-staging.example.com"]) && relayNamed(["192.168.1.20", "cs-staging.example.com"]));
  t.ok("an address literal is one, a name is not", relayIsAddress("::1") && relayIsAddress("127.0.0.1") && !relayIsAddress("localhost"));
};

/** The identity checks. */
const identityChecks = (t: Suite): void => {
  t.eqStr("a certificate without its key is refused", relaySourceFrom("a.pem", "").error, "--cert needs --key: a certificate is not a key pair");
  t.eqStr("a key without its certificate is refused", relaySourceFrom("", "a.key").error, "--key needs --cert: a key is not a certificate");
  const self = relaySourceFrom("", "");
  t.ok("neither is the self-signed arrangement rather than an error", !self.pem && self.error.length === 0);

  const minted = new RelayIdentity();
  const key: Secret<u8[]> | null = relayMintIdentity(n64(0), minted);
  t.ok("a self-signed identity is minted", key !== null && toI32(minted.chain.length) === n32(1) && minted.pinned);
  if (key !== null) {
    wipe(key);
  }
  t.eqI32("pinned by its own hash: dotted hex of a SHA-256, 32 bytes and 31 separators", toI32(minted.hash.length), n32(95));
  t.eqI64("for thirteen days", minted.expiresAt, toI64(SELF_SIGNED_DAYS) * MILLIS_PER_DAY);
  t.eqStr("dotted hex", relayDottedHex(fromHex("abcd01")), "ab:cd:01");

  const pinned = new RelayIdentity();
  pinned.pinned = true;
  pinned.hash = "AB:CD";
  pinned.expiresAt = n64(1700000000000);
  t.eqStr("a pinned note carries the hash and when it dies", relayCertOutBody(pinned), '{"hash":"AB:CD","expiresAt":1700000000000}');
  t.eqStr("a trusted note writes a file with no hash in it", relayCertOutBody(new RelayIdentity()), '{"trusted":true}');

  mkdirSync("build/net_relay");
  const cert: string = "build/net_relay/chain.pem";
  const keyFile: string = "build/net_relay/key.pem";
  // The CA certificate and its own key: a pair that belongs together.
  writeFileSync(cert, CA_PEM);
  writeFileSync(keyFile, CA_PKCS8_PEM);
  const source = relaySourceFrom(cert, keyFile);
  const loaded = new RelayIdentity();
  const pem: Secret<u8[]> | null = relayLoadPem(source, loaded);
  t.ok("a PEM pair on disk is loaded, and deliberately not pinned", pem !== null && toI32(loaded.chain.length) === n32(1) && !loaded.pinned && relayCertOutBody(loaded) === '{"trusted":true}');
  if (pem !== null) {
    wipe(pem);
  }
  const watch = new RelayWatch(source);
  t.ok("and it is watchable", watch.mark() && !watch.changed());
  const quiet = new RelayIdentity();
  const unchanged: Secret<u8[]> | null = relayRenew(watch, quiet);
  t.ok("an unchanged pair is no renewal", unchanged === null && quiet.error.length === 0);
  if (unchanged !== null) {
    wipe(unchanged);
  }

  // The moment in the middle of a renewal: a chain created and not yet filled.
  writeFileSync(cert, "");
  const half = new RelayIdentity();
  const halfKey: Secret<u8[]> | null = relayRenew(watch, half);
  t.ok("a chain still being written is an error rather than an empty identity", halfKey === null && half.error === "build/net_relay/chain.pem holds no certificate; it is empty or still being written");
  if (halfKey !== null) {
    wipe(halfKey);
  }
  t.ok("and it is not marked seen, so the next poll looks again", watch.changed());

  // A certificate the key does not belong to: an operator who copied one file before the other.
  writeFileSync(cert, LEAF_PEM);
  const crossed = new RelayIdentity();
  const crossedKey: Secret<u8[]> | null = relayRenew(watch, crossed);
  t.ok(
    "a renewal whose key is not the certificate's is refused, and the identity serving is kept",
    crossedKey === null && crossed.error === "could not load build/net_relay/chain.pem and build/net_relay/key.pem: the key is not the one the certificate names" && watch.changed()
  );
  if (crossedKey !== null) {
    wipe(crossedKey);
  }

  writeFileSync(cert, `${CA_PEM}${LEAF_PEM}`);
  const renewed = new RelayIdentity();
  const next: Secret<u8[]> | null = relayRenew(watch, renewed);
  t.ok("the finished pair is the renewal: a chain of two", next !== null && toI32(renewed.chain.length) === n32(2) && !watch.changed());
  if (next !== null) {
    wipe(next);
  }

  writeFileSync(keyFile, "not a key");
  const badKey = new RelayIdentity();
  const bad: Secret<u8[]> | null = relayRenew(watch, badKey);
  t.ok("a key file with no P-256 key is an error", bad === null && badKey.error === "could not load build/net_relay/chain.pem and build/net_relay/key.pem: build/net_relay/key.pem holds no P-256 private key");
  if (bad !== null) {
    wipe(bad);
  }

  // At start-up a crossed pair is refused the same way, with nothing to fall back to.
  writeFileSync(cert, LEAF_PEM);
  writeFileSync(keyFile, CA_PKCS8_PEM);
  const atStart = new RelayIdentity();
  const startKey: Secret<u8[]> | null = relayLoadPem(source, atStart);
  t.ok("at start-up a key that is not the certificate's is refused", startKey === null && atStart.error.endsWith("the key is not the one the certificate names"));
  if (startKey !== null) {
    wipe(startKey);
  }

  const gone = relaySourceFrom("build/net_relay/none.pem", "build/net_relay/none.key");
  const missing = new RelayIdentity();
  const nothing: Secret<u8[]> | null = relayLoadPem(gone, missing);
  t.ok("files that are not there are an error rather than a panic", nothing === null && missing.error.startsWith("could not load build/net_relay/none.pem"));
  if (nothing !== null) {
    wipe(nothing);
  }
  const goneWatch = new RelayWatch(gone);
  t.ok("and the watcher reads them as nothing having changed", !goneWatch.mark() && !goneWatch.changed());
};

/** Every setup check. */
export const setupChecks = (t: Suite): void => {
  optionChecks(t);
  identityChecks(t);
};
