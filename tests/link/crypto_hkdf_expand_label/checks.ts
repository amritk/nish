// `nish/crypto/hkdf`'s HKDF-Expand-Label against the published answers.
//
// RFC 8448 §3, the simple 1-RTT handshake with TLS_AES_128_GCM_SHA256, prints
// every HKDF-Expand-Label step of its key schedule with its PRK, its context
// hash and its output: every one of them is here, each cited by the line that
// introduces it there. RFC 9001 A.1 derives QUIC v1's Initial secrets, keys,
// IVs and header-protection keys from the client's Destination Connection ID;
// all of A.1 is here, from the extract on.
//
// Neither RFC prints a SHA-384 vector, so the SHA-384 ones start from the
// early secret of TLS_AES_256_GCM_SHA384 (an extract of 48 zero bytes) and
// were checked against OpenSSL's TLS13-KDF and against a direct transcription
// of RFC 8446 §7.1 over Python's `hmac` module. So were the edge cases at the
// end: the longest label, the longest context and the longest length together,
// a length of zero, and a secret longer than HashLen.
import { Suite } from "nish/testing";
import { hkdfExpandLabelSha256, hkdfExpandLabelSha384, hkdfExtractSha256, hkdfExtractSha384 } from "nish/crypto/hkdf";

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes` as lowercase hex, two digits a byte, the way both RFCs print them. */
const hexOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    const hi: i32 = v >> 4;
    const lo: i32 = v & 15;
    parts.push(HEX_DIGITS.substring(hi, hi + 1));
    parts.push(HEX_DIGITS.substring(lo, lo + 1));
  }
  return parts.join("");
};

/** The value of one lowercase hex digit. */
const nibbleOf = (c: i32): i32 => (c >= 97 ? c - 87 : c - 48);

/** The bytes a lowercase hex string spells, two digits a byte. */
const bytesOf = (hex: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(hex.length);
  for (let k: i32 = 0; k + 1 < n; k += 2) {
    out.push(toU8(nibbleOf(toI32(hex.charCodeAt(k))) * 16 + nibbleOf(toI32(hex.charCodeAt(k + 1)))));
  }
  return out;
};

/** The bytes `0, 1, …, n - 1`. */
const counting = (n: i32): u8[] => {
  const out: u8[] = [];
  for (let v: i32 = 0; v < n; v += 1) {
    out.push(toU8(v));
  }
  return out;
};

/** `n` copies of the letter `a`. */
export const letters = (n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    parts.push("a");
  }
  return parts.join("");
};

/**
 * Runs every check and answers the exit code. A function of its own rather
 * than the body of `main`, so that `tests/link/crypto_hkdf_expand_label_f64`
 * can run the same checks under `--number-mode f64`.
 */
export const expandLabelChecks = (): i32 => {
  const t = new Suite("hkdf expand label");
  // Typed locals rather than bare literals: a literal can be an `f64` under
  // `--number-mode f64`.
  const l0: i32 = 0;
  const l12: i32 = 12;
  const l16: i32 = 16;
  const l32: i32 = 32;
  const l48: i32 = 48;
  const l255: i32 = 255;
  const none: u8[] = [];

  // --- RFC 8448 §3 -----------------------------------------------------------
  const early: u8[] = bytesOf("33ad0a1c607ec03b09e6cd9893680ce210adf300aa1f2660e1b22e10f170f92a");
  const emptyHash: u8[] = bytesOf("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  const hsSecret: u8[] = bytesOf("1dc826e93606aa6fdc0aadc12f741b01046aa6b99f691ed221a9f0ca043fbeac");
  const hsHash: u8[] = bytesOf("860c06edc07858ee8e78f0e7428c58edd6b43f2ca3e6e95f02ed063cf0e1cad8");
  const master: u8[] = bytesOf("18df06843d13a08bf2a449844c5f8a478001bc4d4c627984d5a41da8d0402919");
  const apHash: u8[] = bytesOf("9608102a0f1ccc6db6250b7b7e417b1a000eaada3daae4777a7686c9ff83df13");

  t.eqStr(
    'RFC 8448 §3 derive secret for handshake "tls13 derived"',
    hexOf(hkdfExpandLabelSha256(early, "derived", emptyHash, l32)),
    "6f2615a108c702c5678f54fc9dbab69716c076189c48250cebeac3576c3611ba"
  );
  const cHs: u8[] = hkdfExpandLabelSha256(hsSecret, "c hs traffic", hsHash, l32);
  t.eqStr('RFC 8448 §3 derive secret "tls13 c hs traffic"', hexOf(cHs), "b3eddb126e067f35a780b3abf45e2d8f3b1a950738f52e9600746a0e27a55a21");
  const sHs: u8[] = hkdfExpandLabelSha256(hsSecret, "s hs traffic", hsHash, l32);
  t.eqStr('RFC 8448 §3 derive secret "tls13 s hs traffic"', hexOf(sHs), "b67b7d690cc16c4e75e54213cb2d37b4e9c912bcded9105d42befd59d391ad38");
  t.eqStr(
    'RFC 8448 §3 derive secret for master "tls13 derived"',
    hexOf(hkdfExpandLabelSha256(hsSecret, "derived", emptyHash, l32)),
    "43de77e0c77713859a944db9db2590b53190a65b3ee2e4f12dd7a0bb7ce254b4"
  );
  t.eqStr("RFC 8448 §3 server handshake write key", hexOf(hkdfExpandLabelSha256(sHs, "key", none, l16)), "3fce516009c21727d0f2e4e86ee403bc");
  t.eqStr("RFC 8448 §3 server handshake write iv", hexOf(hkdfExpandLabelSha256(sHs, "iv", none, l12)), "5d313eb2671276ee13000b30");
  t.eqStr(
    'RFC 8448 §3 server calculate finished "tls13 finished"',
    hexOf(hkdfExpandLabelSha256(sHs, "finished", none, l32)),
    "008d3b66f816ea559f96b537e885c31fc068bf492c652f01f288a1d8cdc19fc8"
  );
  const cAp: u8[] = hkdfExpandLabelSha256(master, "c ap traffic", apHash, l32);
  t.eqStr('RFC 8448 §3 derive secret "tls13 c ap traffic"', hexOf(cAp), "9e40646ce79a7f9dc05af8889bce6552875afa0b06df0087f792ebb7c17504a5");
  const sAp: u8[] = hkdfExpandLabelSha256(master, "s ap traffic", apHash, l32);
  t.eqStr('RFC 8448 §3 derive secret "tls13 s ap traffic"', hexOf(sAp), "a11af9f05531f856ad47116b45a950328204b4f44bfb6b3a4b4f1f3fcb631643");
  t.eqStr(
    'RFC 8448 §3 derive secret "tls13 exp master"',
    hexOf(hkdfExpandLabelSha256(master, "exp master", apHash, l32)),
    "fe22f881176eda18eb8f44529e6792c50c9a3f89452f68d8ae311b4309d3cf50"
  );
  t.eqStr("RFC 8448 §3 server application write key", hexOf(hkdfExpandLabelSha256(sAp, "key", none, l16)), "9f02283b6c9c07efc26bb9f2ac92e356");
  t.eqStr("RFC 8448 §3 server application write iv", hexOf(hkdfExpandLabelSha256(sAp, "iv", none, l12)), "cf782b88dd83549aadf1e984");
  t.eqStr("RFC 8448 §3 server handshake read key", hexOf(hkdfExpandLabelSha256(cHs, "key", none, l16)), "dbfaa693d1762c5b666af5d950258d01");
  t.eqStr("RFC 8448 §3 server handshake read iv", hexOf(hkdfExpandLabelSha256(cHs, "iv", none, l12)), "5bd3c71b836e0b76bb73265f");
  t.eqStr(
    'RFC 8448 §3 client calculate finished "tls13 finished"',
    hexOf(hkdfExpandLabelSha256(cHs, "finished", none, l32)),
    "b80ad01015fb2f0bd65ff7d4da5d6bf83f84821d1f87fdc7d3c75b5a7b42d9c4"
  );
  t.eqStr("RFC 8448 §3 client application write key", hexOf(hkdfExpandLabelSha256(cAp, "key", none, l16)), "17422dda596ed5d9acd890e3c63f5051");
  t.eqStr("RFC 8448 §3 client application write iv", hexOf(hkdfExpandLabelSha256(cAp, "iv", none, l12)), "5b78923dee08579033e523d9");

  // --- RFC 9001 A.1 ----------------------------------------------------------
  const initialSalt: u8[] = bytesOf("38762cf7f55934b34d179ae6a4c80cadccbb7f0a");
  const dcid: u8[] = bytesOf("8394c8f03e515708");
  const initial: u8[] = hkdfExtractSha256(initialSalt, dcid);
  t.eqStr("RFC 9001 A.1 initial_secret", hexOf(initial), "7db5df06e7a69e432496adedb00851923595221596ae2ae9fb8115c1e9ed0a44");
  const client: u8[] = hkdfExpandLabelSha256(initial, "client in", none, l32);
  t.eqStr("RFC 9001 A.1 client_initial_secret", hexOf(client), "c00cf151ca5be075ed0ebfb5c80323c42d6b7db67881289af4008f1f6c357aea");
  t.eqStr("RFC 9001 A.1 client key", hexOf(hkdfExpandLabelSha256(client, "quic key", none, l16)), "1f369613dd76d5467730efcbe3b1a22d");
  t.eqStr("RFC 9001 A.1 client iv", hexOf(hkdfExpandLabelSha256(client, "quic iv", none, l12)), "fa044b2f42a3fd3b46fb255c");
  t.eqStr("RFC 9001 A.1 client hp", hexOf(hkdfExpandLabelSha256(client, "quic hp", none, l16)), "9f50449e04a0e810283a1e9933adedd2");
  const server: u8[] = hkdfExpandLabelSha256(initial, "server in", none, l32);
  t.eqStr("RFC 9001 A.1 server_initial_secret", hexOf(server), "3c199828fd139efd216c155ad844cc81fb82fa8d7446fa7d78be803acdda951b");
  t.eqStr("RFC 9001 A.1 server key", hexOf(hkdfExpandLabelSha256(server, "quic key", none, l16)), "cf3a5331653c364c88f0f379b6067e37");
  t.eqStr("RFC 9001 A.1 server iv", hexOf(hkdfExpandLabelSha256(server, "quic iv", none, l12)), "0ac1493ca1905853b0bba03e");
  t.eqStr("RFC 9001 A.1 server hp", hexOf(hkdfExpandLabelSha256(server, "quic hp", none, l16)), "c206b8d9b9f0f37644430b490eeaa314");

  // --- SHA-384 (checked against OpenSSL and Python) --------------------------
  const early384: u8[] = hkdfExtractSha384(none, new Array<u8>(48));
  t.eqStr(
    "TLS_AES_256_GCM_SHA384 early secret",
    hexOf(early384),
    "7ee8206f5570023e6dc7519eb1073bc4e791ad37b5c382aa10ba18e2357e716971f9362f2c2fe2a76bfd78dfec4ea9b5"
  );
  t.eqStr(
    'SHA-384 "tls13 derived" over the empty transcript hash',
    hexOf(
      hkdfExpandLabelSha384(
        early384,
        "derived",
        bytesOf("38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b"),
        l48
      )
    ),
    "1591dac5cbbf0330a4a84de9c753330e92d01f0a88214b4464972fd668049e93e52f2b16fad922fdc0584478428f282b"
  );
  t.eqStr("SHA-384 key (32 bytes)", hexOf(hkdfExpandLabelSha384(early384, "key", none, l32)), "ebcdc973d6a2f2183366ca8b2fd863591bf528b2524b5cd7c66cf7a70467b6cf");
  t.eqStr("SHA-384 iv", hexOf(hkdfExpandLabelSha384(early384, "iv", none, l12)), "22ac56124d171e635cebe14e");
  t.eqStr(
    "SHA-384 finished (48 bytes)",
    hexOf(hkdfExpandLabelSha384(early384, "finished", none, l48)),
    "67821fe38fe191a64add771cd551ebe7ca5d291ff5bdaca60c86428d6f7338948611d7b79a4e4cd7999abdf215b02a66"
  );

  // --- The edges: every bound at its largest accepted value -----------------
  const longest: string = letters(249);
  const context255: u8[] = counting(255);
  t.eqStr(
    "SHA-256: a 249-byte label, a 255-byte context and 255 bytes out",
    hexOf(hkdfExpandLabelSha256(sHs, longest, context255, l255)),
    "8dd3a5ca797b01971c971e67c276070e83b1bbfbb76df39b8ad3bf367fe060533ccd3f3e99443bed294b629cb521af7be039ca5ff5013ec1c22f09d0fccc559b390b22f5609aa6c9c2a03962236be1678f683f0f42731aa61391ec8383990007935f2cc0c0e8ef2bb3dc2b3a75a7d9c8e95920097ab322773db79e416d7fc9bd905b64c35e2077e5ac7cb1943f6d184d19933b0a28a6033c59a56b058806c7eba35544853f0e179b5972583e0a4a6d67eafc80ae66fd4b70ad4a799f52f2ec0f5aa4b7cb613b3f1ef81e41bafca1de380ab7f194745554664c983b313b0b809221b97aa9e0e6e3d939d98ebdd10365f8a65e507e51323710c8cb63a732c8ed"
  );
  t.eqStr(
    "SHA-384: a 249-byte label, a 255-byte context and 255 bytes out",
    hexOf(hkdfExpandLabelSha384(early384, longest, context255, l255)),
    "530bdc7be663414c9060e310e7d2ebadbb12344a83a651ef5cb3a6700cce3ef270647663b9234158575ca7ca2258f48ed097c53547714f000db5959b6ecef1d2a1e109e629a257b06902f0a605bc3bf4840c09a16845a816876f086c518a6728565a607b33fa5290a39771600d8c2071f7273905e15cc4af95c6ac6f1896b8d151916f35495b14fa0e0078a5cfa02cdb6ded3f9a84bbebe8e85eed44bd1b49b5df6d6812523987f1340f1299239cdc187530fafde5ab162d988b67fff06004d566bc3a45c1ae3d13c091fe90994e3f92ea3680d237c82d7517ad3d55fa63dcbd509f89b967872d5c8734c1e35000fcead8178149b73794c98f88886d8ab12c"
  );
  t.eqI32("SHA-256: a length of zero is an empty array", toI32(hkdfExpandLabelSha256(sHs, "key", none, l0).length), l0);
  t.eqI32("SHA-384: a length of zero is an empty array", toI32(hkdfExpandLabelSha384(early384, "key", none, l0).length), l0);
  t.eqStr("SHA-256: a secret longer than HashLen is accepted", hexOf(hkdfExpandLabelSha256(counting(64), "key", none, l16)), "bfd6889970fffb9b42ea2c32211d01f5");
  return t.done();
};
