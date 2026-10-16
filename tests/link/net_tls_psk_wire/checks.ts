// The `pre_shared_key` wire of `nish/net/tls`, against RFC 8448 and the
// refusals of "Resumption" in `docs/security/tls.md`.
//
// RFC 8448 §3 pins the NewSessionTicket a server writes and the PSK its
// resumption master secret gives the ticket's nonce; §4 pins the early
// secret, binder key and binder of the resumed ClientHello, that hello's
// `pre_shared_key` as `TlsClientHelloView` reads it, the handshake-secret
// salt, and the ServerHello that accepts identity 0. Rows 10-13 are pinned at
// the codec and through a `TlsServer`: a PSK without modes is
// `missing_extension`, a PSK that is not last or whose counts differ is
// `illegal_parameter`, and a malformed offer or mode list is `decode_error`,
// which wins over both.
import { Suite } from "nish/testing";
import { HkdfScratch } from "nish/crypto/hkdf";
import {
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_MISSING_EXTENSION,
  TLS_EXT_PRE_SHARED_KEY,
  TLS_EXT_PSK_KEY_EXCHANGE_MODES,
  TLS_EXT_SUPPORTED_VERSIONS,
  TLS_VERSION_13,
  TlsClientHello,
  TlsClientHelloView,
  tlsEncodeNewSessionTicket,
  tlsEncodeServerHelloPsk,
  tlsParseClientHello,
  tlsReadClientHello,
  tlsSelectPskIdentity,
  tlsWriteNewSessionTicket,
} from "nish/net/tls/codec";
import {
  TLS_AES_128_GCM_SHA256,
  tlsBinderKey,
  tlsBinderKeyInto,
  tlsBinderVerify,
  tlsFinishedVerifyData,
  tlsHandshakeSalt,
  tlsHandshakeSaltInto,
  tlsPskEarlySecret,
  tlsPskEarlySecretInto,
  tlsResumptionPsk,
  tlsResumptionPskInto,
} from "nish/net/tls/schedule";
import { Secret, secret, wipe } from "nish:secret";
import { TlsServer } from "nish/net/tls";
import { secretCopy, secretHex } from "../net_tls_common/secrets";
import {
  cat,
  clientHello,
  extSupportedVersions,
  extension,
  sendHello,
  standardExtensions,
  standardWith,
  transcriptHash,
  vec16,
  vec8,
} from "../net_tls_common/client";
import { fromHex, toHex } from "../crypto_x509/hex";
import { newServer, tcpConfig } from "../net_tls_common/server";

const SUITE: i32 = TLS_AES_128_GCM_SHA256;
const H: i32 = 32;

/** RFC 8448 §3's resumption master secret. */
const RES_MASTER: string = "7df235f2031d2a051287d02b0241b0bfdaf86cc856231f2d5aba46c434ec196c";

/** RFC 8448 §3's NewSessionTicket, header included: 205 octets. */
const NST: string =
  "040000c90000001efad6aac502000000b22c035d829359ee5ff7af4ec900000000262a6494dc486d2c8a34cb33fa90bf1b" +
  "0070ad3c498883c9367c09a2be785abc55cd226097a3a982117283f82a03a143efd3ff5dd36d64e861be7fd61d2827db27" +
  "9cce145077d454a3664d4e6da4d29ee03725a6a4dafcd0fc67d2aea70529513e3da2677fa5906c5b3f7d8f92f228bda40d" +
  "da721470f9fbf297b5aea617646fac5c03272e970727c621a79141ef5f7de6505e5bfbc388e93343694093934ae4d357" +
  "0008002a000400000400";

/** RFC 8448 §4's resumed ClientHello, header included: 512 octets. */
const CH: string =
  "010001fc03031bc3ceb6bbe39cff938355b5a50adb6db21b7a6af649d7b4bc419d7876487d9500000613011303130201" +
  "0001cd0000000b0009000006736572766572ff01000100000a00140012001d0017001800190100010101020103010400" +
  "3300260024001d0020e4ffb68ac05f8d96c99da26698346c6be16482badddafe051a66b4f18d668f0b002a0000002b00" +
  "03020304000d0020001e040305030603020308040805080604010501060102010402050206020202002d00020101001c" +
  "000240010015005700000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
  "2900dd00b800b22c035d829359ee5ff7af4ec900000000262a6494dc486d2c8a34cb33fa90bf1b0070ad3c498883c936" +
  "7c09a2be785abc55cd226097a3a982117283f82a03a143efd3ff5dd36d64e861be7fd61d2827db279cce145077d454a3" +
  "664d4e6da4d29ee03725a6a4dafcd0fc67d2aea70529513e3da2677fa5906c5b3f7d8f92f228bda40dda721470f9fbf2" +
  "97b5aea617646fac5c03272e970727c621a79141ef5f7de6505e5bfbc388e93343694093934ae4d357fad6aacb002120" +
  "3add4fb2d8fdf822a0ca3cf7678ef5e88dae990141c5924d57bb6fa31b9e5f9d";

/** RFC 8448 §4's ServerHello accepting identity 0: 96 octets. */
const SH: string =
  "0200005c03033ccfd2dec890222763472ae8136777c9d7358777bb66e91ea5122495f559ea2d00130100003400290002" +
  "000000330024001d0020121761ee42c333e1b9e77b60dd57c2053cd94512ab47f115e86eff50942cea31002b00020304";

const PSK: string = "4ecd0eb6ec3b4d87f5d6028f922ca4c5851a277fd41311c9e62d2c9492e1c4f3";
const EARLY: string = "9b2188e9b2fc6d64d71dc329900e20bb41915000f678aa839cbb797cb7d8332c";
const BINDER_KEY: string = "69fe131a3bbad5d63c64eebcc30e395b9d8107726a13d074e389dbc8a4e47256";
const TRUNCATED: string = "63224b2e4573f2d3454ca84b9d009a04f6be9e05711a8396473aefa01e924a14";
const BINDER: string = "3add4fb2d8fdf822a0ca3cf7678ef5e88dae990141c5924d57bb6fa31b9e5f9d";
const SALT: string = "5f1790bbd82c5e7d376ed2e1e52f8e6038c9346db61b43be9a52f77ef3998e80";

/** `bytes[from .. from + n)`. */
const slice = (bytes: u8[], from: i32, n: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < n && from + k < toI32(bytes.length); k++) {
    out.push(bytes[from + k]);
  }
  return out;
};

/** A `pre_shared_key` extension offering `identities`, each with age 0, and `binders`. */
const psk = (identities: u8[][], binders: u8[][]): u8[] => {
  const ids: u8[][] = [];
  for (const id of identities) {
    ids.push(cat([vec16(id), fromHex("00000000")]));
  }
  const bs: u8[][] = [];
  for (const b of binders) {
    bs.push(vec8(b));
  }
  return extension(TLS_EXT_PRE_SHARED_KEY, cat([vec16(cat(ids)), vec16(cat(bs))]));
};

/** A `psk_key_exchange_modes` extension listing `modes`. */
const modes = (list: u8[]): u8[] => extension(TLS_EXT_PSK_KEY_EXCHANGE_MODES, vec8(list));

/** A ClientHello offering the one suite with the standard extensions and then `more`. */
const hello = (more: u8[][]): u8[] => clientHello([SUITE], standardWith(more));

/** `message` as a `TlsClientHelloView` reads it, past its 4-byte header. */
const viewOf = (message: u8[]): TlsClientHelloView => {
  const view = new TlsClientHelloView();
  const four: i32 = 4;
  tlsReadClientHello(view, message, four, toI32(message.length) - four);
  return view;
};

/** The alert the codec gives `message`. */
const codecAlert = (message: u8[]): i32 => viewOf(message).alert;

/** The alert a fresh TCP server answers to `message`. */
const serverAlert = (message: u8[]): i32 => {
  const none: string[] = [];
  const server: TlsServer = newServer(tcpConfig(none));
  return sendHello(server, message);
};

/** Runs every check and answers the exit code. */
export const pskWireChecks = (): i32 => {
  const t = new Suite("tls psk wire");
  const zero: i32 = 0;
  const one: i32 = 1;
  const empty: u8[] = [];
  const kdf = new HkdfScratch();
  const id: u8[] = fromHex("01");
  const binder32: u8[] = new Array<u8>(32);
  const binder31: u8[] = new Array<u8>(31);
  const dhe: u8[] = [toU8(1)];

  // --- RFC 8448 §3: the ticket and the PSK it stands for ---------------------
  const nst: u8[] = fromHex(NST);
  const nonce: u8[] = fromHex("0000");
  const ticket: u8[] = slice(nst, 17, 178);
  const extra: u8[] = fromHex("002a000400000400");
  const lifetime: u32 = toU32(0x1e);
  const ageAdd: u32 = 0xfad6aac5;
  t.eqI32("RFC 8448 §3's NewSessionTicket is 205 octets", toI32(nst.length), 205);
  t.eqStr(
    "tlsEncodeNewSessionTicket writes RFC 8448 §3's NewSessionTicket",
    toHex(tlsEncodeNewSessionTicket(lifetime, ageAdd, nonce, ticket, extra)),
    NST
  );
  const placed: u8[] = new Array<u8>(212);
  const five: i32 = 5;
  t.eqI32(
    "tlsWriteNewSessionTicket at offset 5 answers where it ended",
    tlsWriteNewSessionTicket(placed, five, lifetime, ageAdd, nonce, zero, 2, ticket, zero, 178, extra),
    210
  );
  t.eqStr("and wrote the same bytes there", toHex(slice(placed, five, 205)), NST);
  const resMaster: Secret<u8[]> = secret(fromHex(RES_MASTER));
  const pskSecret: Secret<u8[]> = tlsResumptionPsk(H, resMaster, nonce);
  t.eqStr("tlsResumptionPsk gives RFC 8448 §3's PSK for nonce 0000", secretHex(pskSecret), PSK);
  const pskPlain: u8[] = new Array<u8>(H);
  const nonceWindow: u8[] = fromHex("ff0000ff");
  tlsResumptionPskInto(kdf, H, fromHex(RES_MASTER), nonceWindow, one, 2, pskPlain);
  t.eqStr("tlsResumptionPskInto gives it from a window of the nonce", toHex(pskPlain), PSK);

  // --- RFC 8448 §4: early secret, binder key, binder ------------------------
  const early: Secret<u8[]> = tlsPskEarlySecret(H, pskSecret);
  t.eqStr("tlsPskEarlySecret gives RFC 8448 §4's early secret", secretHex(early), EARLY);
  const earlyPlain: u8[] = new Array<u8>(H);
  tlsPskEarlySecretInto(kdf, H, pskPlain, earlyPlain);
  t.eqStr("so does tlsPskEarlySecretInto", toHex(earlyPlain), EARLY);
  const binderKey: Secret<u8[]> = tlsBinderKey(H, early);
  t.eqStr("tlsBinderKey gives RFC 8448 §4's binder key", secretHex(binderKey), BINDER_KEY);
  const binderKeyPlain: u8[] = new Array<u8>(H);
  tlsBinderKeyInto(kdf, H, earlyPlain, binderKeyPlain);
  t.eqStr("so does tlsBinderKeyInto", toHex(binderKeyPlain), BINDER_KEY);
  const salt: Secret<u8[]> = tlsHandshakeSalt(H, early);
  t.eqStr("tlsHandshakeSalt gives RFC 8448 §4's derived salt", secretHex(salt), SALT);
  const saltPlain: u8[] = new Array<u8>(H);
  tlsHandshakeSaltInto(kdf, H, earlyPlain, saltPlain);
  t.eqStr("so does tlsHandshakeSaltInto", toHex(saltPlain), SALT);

  // --- RFC 8448 §4: the resumed ClientHello ---------------------------------
  const ch: u8[] = fromHex(CH);
  t.eqI32("RFC 8448 §4's ClientHello is 512 octets", toI32(ch.length), 512);
  const view: TlsClientHelloView = viewOf(ch);
  t.eqI32("it parses", view.alert, zero);
  t.ok("with a pre_shared_key", view.hasPreSharedKey);
  t.ok("and psk_key_exchange_modes", view.hasPskModes);
  t.ok("offering psk_dhe_ke", view.pskDheKe);
  t.eqI32("one identity", view.pskIdentityCount, one);
  t.eqI32("one binder", view.pskBinderCount, one);
  t.eqI32("the binders list's prefix is at octet 477", view.pskBindersPrefixAt, 477);
  const truncated: u8[] = transcriptHash(H, slice(ch, zero, view.pskBindersPrefixAt));
  t.eqStr("the hello up to it hashes to RFC 8448 §4's truncated hash", toHex(truncated), TRUNCATED);
  t.eqStr(
    "tlsFinishedVerifyData under the binder key gives RFC 8448 §4's binder",
    toHex(tlsFinishedVerifyData(H, binderKey, truncated)),
    BINDER
  );
  t.ok("tlsSelectPskIdentity finds identity 0", tlsSelectPskIdentity(view, zero));
  t.eqStr("which is §3's ticket", toHex(slice(ch, view.pskIdentityAt, view.pskIdentityLength)), toHex(ticket));
  t.ok("with its obfuscated age", view.pskTicketAge === 0xfad6aacb);
  t.eqStr("and binder 0 is §4's binder", toHex(slice(ch, view.pskBinderAt, view.pskBinderLength)), BINDER);
  t.ok(
    "tlsBinderVerify accepts it",
    tlsBinderVerify(kdf, H, binderKeyPlain, truncated, zero, ch, view.pskBinderAt, view.pskBinderLength)
  );
  const flipped: u8[] = fromHex(CH);
  flipped[511] = toU8(toI32(flipped[511]) ^ 1);
  t.ok(
    "and refuses it with its last bit flipped",
    !tlsBinderVerify(kdf, H, binderKeyPlain, truncated, zero, flipped, view.pskBinderAt, view.pskBinderLength)
  );
  t.ok(
    "or cut to 31 bytes",
    !tlsBinderVerify(kdf, H, binderKeyPlain, truncated, zero, ch, view.pskBinderAt, view.pskBinderLength - one)
  );
  t.ok("there is no identity 1", !tlsSelectPskIdentity(view, one));
  t.ok("or identity -1", !tlsSelectPskIdentity(view, -1));
  const parsed: TlsClientHello = tlsParseClientHello(ch, 4, 508);
  t.eqI32("tlsParseClientHello reads it too", parsed.alert, zero);
  t.eqI32("with one identity", toI32(parsed.pskIdentities.length), one);
  t.eqStr("the ticket", toHex(parsed.pskIdentities[0]), toHex(ticket));
  t.ok("its age", parsed.pskTicketAges[0] === 0xfad6aacb);
  t.eqStr("its binder", toHex(parsed.pskBinders[0]), BINDER);
  t.eqI32("the binders' prefix, from the body", parsed.pskBindersPrefix, 473);
  t.eqStr("and the modes", toHex(parsed.pskModes), "01");
  t.ok("psk_dhe_ke among them", parsed.pskDheKe);

  // --- RFC 8448 §4: the ServerHello -----------------------------------------
  const sh: u8[] = fromHex(SH);
  t.eqStr(
    "tlsEncodeServerHelloPsk writes RFC 8448 §4's ServerHello",
    toHex(
      tlsEncodeServerHelloPsk(
        slice(sh, 6, 32),
        empty,
        SUITE,
        fromHex("121761ee42c333e1b9e77b60dd57c2053cd94512ab47f115e86eff50942cea31"),
        zero
      )
    ),
    SH
  );
  wipe(salt);
  wipe(binderKey);
  wipe(early);
  wipe(pskSecret);
  wipe(resMaster);

  // --- Row 10: a PSK without modes ------------------------------------------
  const offer: u8[] = psk([id], [binder32]);
  const noModes: u8[] = hello([offer]);
  t.eqI32("a pre_shared_key without psk_key_exchange_modes is missing_extension", codecAlert(noModes), TLS_ALERT_MISSING_EXTENSION);
  t.eqI32("and the server answers it", serverAlert(noModes), TLS_ALERT_MISSING_EXTENSION);

  // --- Row 11: a PSK that is not last ---------------------------------------
  const notLast: u8[] = clientHello([SUITE], [modes(dhe), offer, standardExtensions()[0], standardExtensions()[1], standardExtensions()[2], standardExtensions()[3]]);
  t.eqI32("a well-formed pre_shared_key that is not last is illegal_parameter", codecAlert(notLast), TLS_ALERT_ILLEGAL_PARAMETER);
  t.eqI32("and the server answers it", serverAlert(notLast), TLS_ALERT_ILLEGAL_PARAMETER);

  // --- Row 12: identity and binder counts -----------------------------------
  const twoOne: u8[] = hello([modes(dhe), psk([id, id], [binder32])]);
  t.eqI32("two identities and one binder is illegal_parameter", codecAlert(twoOne), TLS_ALERT_ILLEGAL_PARAMETER);
  t.eqI32("and the server answers it", serverAlert(twoOne), TLS_ALERT_ILLEGAL_PARAMETER);
  const oneTwo: u8[] = hello([modes(dhe), psk([id], [binder32, binder32])]);
  t.eqI32("one identity and two binders is illegal_parameter", codecAlert(oneTwo), TLS_ALERT_ILLEGAL_PARAMETER);
  t.eqI32("and the server answers it", serverAlert(oneTwo), TLS_ALERT_ILLEGAL_PARAMETER);

  // --- Row 13: malformed input ----------------------------------------------
  const shortIdentities: u8[] = hello([
    modes(dhe),
    extension(TLS_EXT_PRE_SHARED_KEY, cat([vec16(fromHex("0001aa")), vec16(vec8(binder32))])),
  ]);
  t.eqI32("an identity list under 7 bytes is decode_error", codecAlert(shortIdentities), TLS_ALERT_DECODE_ERROR);
  t.eqI32("and the server answers it", serverAlert(shortIdentities), TLS_ALERT_DECODE_ERROR);
  const emptyIdentity: u8[] = hello([modes(dhe), psk([id, empty], [binder32, binder32])]);
  t.eqI32("an empty identity is decode_error", codecAlert(emptyIdentity), TLS_ALERT_DECODE_ERROR);
  t.eqI32("and the server answers it", serverAlert(emptyIdentity), TLS_ALERT_DECODE_ERROR);
  const shortBinder: u8[] = hello([modes(dhe), psk([id], [binder31])]);
  t.eqI32("a 31-byte binder is decode_error", codecAlert(shortBinder), TLS_ALERT_DECODE_ERROR);
  t.eqI32("and the server answers it", serverAlert(shortBinder), TLS_ALERT_DECODE_ERROR);
  const noBinders: u8[] = hello([
    modes(dhe),
    extension(TLS_EXT_PRE_SHARED_KEY, cat([vec16(cat([vec16(id), fromHex("00000000")])), vec16(empty)])),
  ]);
  t.eqI32("an empty binder list is decode_error", codecAlert(noBinders), TLS_ALERT_DECODE_ERROR);
  t.eqI32("and the server answers it", serverAlert(noBinders), TLS_ALERT_DECODE_ERROR);
  const pastEnd: u8[] = hello([
    modes(dhe),
    extension(TLS_EXT_PRE_SHARED_KEY, cat([fromHex("00ff"), vec16(id), fromHex("00000000"), vec16(vec8(binder32))])),
  ]);
  t.eqI32("an identity list past the extension is decode_error", codecAlert(pastEnd), TLS_ALERT_DECODE_ERROR);
  t.eqI32("and the server answers it", serverAlert(pastEnd), TLS_ALERT_DECODE_ERROR);
  const trailing: u8[] = hello([
    modes(dhe),
    extension(
      TLS_EXT_PRE_SHARED_KEY,
      cat([vec16(cat([vec16(id), fromHex("00000000")])), vec16(vec8(binder32)), fromHex("00")])
    ),
  ]);
  t.eqI32("bytes after the binders are decode_error", codecAlert(trailing), TLS_ALERT_DECODE_ERROR);
  t.eqI32("and the server answers it", serverAlert(trailing), TLS_ALERT_DECODE_ERROR);
  const emptyModes: u8[] = hello([modes(empty), offer]);
  t.eqI32("an empty mode list is decode_error", codecAlert(emptyModes), TLS_ALERT_DECODE_ERROR);
  t.eqI32("and the server answers it", serverAlert(emptyModes), TLS_ALERT_DECODE_ERROR);
  const emptyModesAlone: u8[] = hello([modes(empty)]);
  t.eqI32("so it is with no pre_shared_key", codecAlert(emptyModesAlone), TLS_ALERT_DECODE_ERROR);
  t.eqI32("and the server answers it", serverAlert(emptyModesAlone), TLS_ALERT_DECODE_ERROR);
  const modesPastEnd: u8[] = hello([extension(TLS_EXT_PSK_KEY_EXCHANGE_MODES, fromHex("0501"))]);
  t.eqI32("a mode list past its extension is decode_error with no pre_shared_key", codecAlert(modesPastEnd), TLS_ALERT_DECODE_ERROR);
  t.eqI32("and the server answers it", serverAlert(modesPastEnd), TLS_ALERT_DECODE_ERROR);

  // --- Which refusal wins ---------------------------------------------------
  t.eqI32(
    "a malformed offer whose counts differ is decode_error",
    codecAlert(hello([modes(dhe), psk([id, id], [binder31])])),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "so is a malformed offer without modes",
    codecAlert(hello([psk([id], [binder31])])),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "counts that differ without modes are illegal_parameter",
    codecAlert(hello([psk([id, id], [binder32])])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );

  // --- What is accepted -----------------------------------------------------
  const keOnly: TlsClientHelloView = viewOf(hello([modes([toU8(0)]), offer]));
  t.eqI32("psk_ke alone parses", keOnly.alert, zero);
  t.ok("and is not psk_dhe_ke", !keOnly.pskDheKe);
  const unknownMode: TlsClientHelloView = viewOf(hello([modes([toU8(7), toU8(1)]), offer]));
  t.eqI32("an unknown mode is passed over", unknownMode.alert, zero);
  t.ok("and psk_dhe_ke after it still counts", unknownMode.pskDheKe);
  t.eqI32("the server goes on without the PSK", serverAlert(hello([modes(dhe), offer])), zero);
  t.eqI32(
    "a hello with no PSK at all still parses",
    codecAlert(clientHello([SUITE], [extSupportedVersions([TLS_VERSION_13])])),
    zero
  );
  return t.done();
};
