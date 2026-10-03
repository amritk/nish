// RFC 8448 §3, "Simple 1-RTT Handshake", as the bytes the trace prints. Each
// function answers one value, cited by the trace's own wording, so a failing
// check names what it compared. `tests/link/net_tls_rfc8448` and its f64 twin
// replay the trace against `nish/net/tls`.
import { fromHex } from "../crypto_x509/hex";

/** The client's ephemeral x25519 private key. */
export const rfc8448ClientPrivate = (): u8[] => fromHex("49af42ba7f7994852d713ef2784bcbcaa7911de26adc5642cb634540e7ea5005");

/** The client's x25519 share, as its ClientHello carries it. */
export const rfc8448ClientPublic = (): u8[] => fromHex("99381de560e4bd43d23d8e435a7dbafeb3c06e51c13cae4d5413691e529aaf2c");

/** The ClientHello, header included. */
export const rfc8448ClientHello = (): u8[] =>
  fromHex(
    [
      "010000c00303cb34ecb1e78163ba1c38c6dacb196a6dffa21a8d9912ec18a2ef6283024dece700000613011303130201",
      "0000910000000b0009000006736572766572ff01000100000a00140012001d0017001800190100010101020103010400",
      "230000003300260024001d002099381de560e4bd43d23d8e435a7dbafeb3c06e51c13cae4d5413691e529aaf2c002b00",
      "03020304000d0020001e040305030603020308040805080604010501060102010402050206020202002d00020101001c",
      "00024001",
    ].join("")
  );

/** The server's ephemeral x25519 private key, injected. */
export const rfc8448ServerPrivate = (): u8[] => fromHex("b1580eeadf6dd589b8ef4f2d5652578cc810e9980191ec8d058308cea216a21e");

/** The server's x25519 share. */
export const rfc8448ServerPublic = (): u8[] => fromHex("c9828876112095fe66762bdbf7c672e156d6cc253b833df1dd69b1b04e751f0f");

/** The server random, injected (the ServerHello's bytes 6 to 38). */
export const rfc8448ServerRandom = (): u8[] => fromHex("a6af06a4121860dc5e6e60249cd34c95930c8ac5cb1434dac155772ed3e26928");

/** The ServerHello. */
export const rfc8448ServerHello = (): u8[] =>
  fromHex(
    [
      "020000560303a6af06a4121860dc5e6e60249cd34c95930c8ac5cb1434dac155772ed3e2692800130100002e00330024",
      "001d0020c9828876112095fe66762bdbf7c672e156d6cc253b833df1dd69b1b04e751f0f002b00020304",
    ].join("")
  );

/** The early secret, extracted with no PSK. */
export const rfc8448EarlySecret = (): u8[] => fromHex("33ad0a1c607ec03b09e6cd9893680ce210adf300aa1f2660e1b22e10f170f92a");

/** Derive-Secret(early, "derived", ""), the salt of the handshake secret. */
export const rfc8448DerivedForHandshake = (): u8[] => fromHex("6f2615a108c702c5678f54fc9dbab69716c076189c48250cebeac3576c3611ba");

/** The x25519 shared secret. */
export const rfc8448Ecdhe = (): u8[] => fromHex("8bd4054fb55b9d63fdfbacf9f04b9f0d35e6d63f537563efd46272900f89492d");

/** The handshake secret. */
export const rfc8448HandshakeSecret = (): u8[] => fromHex("1dc826e93606aa6fdc0aadc12f741b01046aa6b99f691ed221a9f0ca043fbeac");

/** The transcript hash through ServerHello. */
export const rfc8448HelloHash = (): u8[] => fromHex("860c06edc07858ee8e78f0e7428c58edd6b43f2ca3e6e95f02ed063cf0e1cad8");

/** client_handshake_traffic_secret. */
export const rfc8448ClientHandshakeTraffic = (): u8[] => fromHex("b3eddb126e067f35a780b3abf45e2d8f3b1a950738f52e9600746a0e27a55a21");

/** server_handshake_traffic_secret. */
export const rfc8448ServerHandshakeTraffic = (): u8[] => fromHex("b67b7d690cc16c4e75e54213cb2d37b4e9c912bcded9105d42befd59d391ad38");

/** Derive-Secret(handshake, "derived", ""), the salt of the master secret. */
export const rfc8448DerivedForMaster = (): u8[] => fromHex("43de77e0c77713859a944db9db2590b53190a65b3ee2e4f12dd7a0bb7ce254b4");

/** The master secret. */
export const rfc8448MasterSecret = (): u8[] => fromHex("18df06843d13a08bf2a449844c5f8a478001bc4d4c627984d5a41da8d0402919");

/** The server's handshake write key. */
export const rfc8448ServerHandshakeKey = (): u8[] => fromHex("3fce516009c21727d0f2e4e86ee403bc");

/** The server's handshake write IV. */
export const rfc8448ServerHandshakeIv = (): u8[] => fromHex("5d313eb2671276ee13000b30");

/** The client's handshake write key. */
export const rfc8448ClientHandshakeKey = (): u8[] => fromHex("dbfaa693d1762c5b666af5d950258d01");

/** The client's handshake write IV. */
export const rfc8448ClientHandshakeIv = (): u8[] => fromHex("5bd3c71b836e0b76bb73265f");

/** EncryptedExtensions: supported_groups, record_size_limit and the server_name acknowledgement. */
export const rfc8448EncryptedExtensions = (): u8[] => fromHex("080000240022000a00140012001d00170018001901000101010201030104001c0002400100000000");

/** The Certificate message. */
export const rfc8448Certificate = (): u8[] =>
  fromHex(
    [
      "0b0001b9000001b50001b0308201ac30820115a003020102020102300d06092a864886f70d01010b0500300e310c300a",
      "06035504031303727361301e170d3136303733303031323335395a170d3236303733303031323335395a300e310c300a",
      "0603550403130372736130819f300d06092a864886f70d010101050003818d0030818902818100b4bb498f8279303d98",
      "0836399b36c6988c0c68de55e1bdb826d3901a2461eafd2de49a91d015abbc9a95137ace6c1af19eaa6af98c7ced4312",
      "0998e187a80ee0ccb0524b1b018c3e0b63264d449a6d38e22a5fda430846748030530ef0461c8ca9d9efbfae8ea6d1d0",
      "3e2bd193eff0ab9a8002c47428a6d35a8d88d79f7f1e3f0203010001a31a301830090603551d1304023000300b060355",
      "1d0f0404030205a0300d06092a864886f70d01010b05000381810085aad2a0e5b9276b908c65f73a7267170618a54c5f",
      "8a7b337d2df7a594365417f2eae8f8a58c8f8172f9319cf36b7fd6c55b80f21a03015156726096fd335e5e67f2dbf102",
      "702e608ccae6bec1fc63a42a99be5c3eb7107c3c54e9b9eb2bd5203b1c3b84e0a8b2f759409ba3eac9d91d402dcc0cc8",
      "f8961229ac9187b42b4de10000",
    ].join("")
  );

/** The server's one certificate, DER (the Certificate message's bytes 11 to 443). */
export const rfc8448CertificateDer = (): u8[] =>
  fromHex(
    [
      "308201ac30820115a003020102020102300d06092a864886f70d01010b0500300e310c300a0603550403130372736130",
      "1e170d3136303733303031323335395a170d3236303733303031323335395a300e310c300a0603550403130372736130",
      "819f300d06092a864886f70d010101050003818d0030818902818100b4bb498f8279303d980836399b36c6988c0c68de",
      "55e1bdb826d3901a2461eafd2de49a91d015abbc9a95137ace6c1af19eaa6af98c7ced43120998e187a80ee0ccb0524b",
      "1b018c3e0b63264d449a6d38e22a5fda430846748030530ef0461c8ca9d9efbfae8ea6d1d03e2bd193eff0ab9a8002c4",
      "7428a6d35a8d88d79f7f1e3f0203010001a31a301830090603551d1304023000300b0603551d0f0404030205a0300d06",
      "092a864886f70d01010b05000381810085aad2a0e5b9276b908c65f73a7267170618a54c5f8a7b337d2df7a594365417",
      "f2eae8f8a58c8f8172f9319cf36b7fd6c55b80f21a03015156726096fd335e5e67f2dbf102702e608ccae6bec1fc63a4",
      "2a99be5c3eb7107c3c54e9b9eb2bd5203b1c3b84e0a8b2f759409ba3eac9d91d402dcc0cc8f8961229ac9187b42b4de1",
    ].join("")
  );

/** CertificateVerify, rsa_pss_rsae_sha256. */
export const rfc8448CertificateVerify = (): u8[] =>
  fromHex(
    [
      "0f000084080400805a747c5d88fa9bd2e55ab085a61015b7211f824cd484145ab3ff52f1fda8477b0b7abc90db78e2d3",
      "3a5c141a078653fa6bef780c5ea248eeaaa785c4f394cab6d30bbe8d4859ee511f602957b15411ac027671459e46445c",
      "9ea58c181e818e95b8c3fb0bf3278409d3be152a3da5043e063dda65cdf5aea20d53dfacd42f74f3",
    ].join("")
  );

/** The trace's RSA-PSS signature, injected through the signing hand-off. */
export const rfc8448RsaPssSignature = (): u8[] =>
  fromHex(
    [
      "5a747c5d88fa9bd2e55ab085a61015b7211f824cd484145ab3ff52f1fda8477b0b7abc90db78e2d33a5c141a078653fa",
      "6bef780c5ea248eeaaa785c4f394cab6d30bbe8d4859ee511f602957b15411ac027671459e46445c9ea58c181e818e95",
      "b8c3fb0bf3278409d3be152a3da5043e063dda65cdf5aea20d53dfacd42f74f3",
    ].join("")
  );

/** The server's finished_key. */
export const rfc8448ServerFinishedKey = (): u8[] => fromHex("008d3b66f816ea559f96b537e885c31fc068bf492c652f01f288a1d8cdc19fc8");

/** The server's Finished. */
export const rfc8448ServerFinished = (): u8[] => fromHex("140000209b9b141d906337fbd2cbdce71df4deda4ab42c309572cb7fffee5454b78f0718");

/** The transcript hash through the server Finished. */
export const rfc8448ServerFlightHash = (): u8[] => fromHex("9608102a0f1ccc6db6250b7b7e417b1a000eaada3daae4777a7686c9ff83df13");

/** client_application_traffic_secret_0. */
export const rfc8448ClientApplicationTraffic = (): u8[] => fromHex("9e40646ce79a7f9dc05af8889bce6552875afa0b06df0087f792ebb7c17504a5");

/** server_application_traffic_secret_0. */
export const rfc8448ServerApplicationTraffic = (): u8[] => fromHex("a11af9f05531f856ad47116b45a950328204b4f44bfb6b3a4b4f1f3fcb631643");

/** exporter_master_secret. */
export const rfc8448ExporterSecret = (): u8[] => fromHex("fe22f881176eda18eb8f44529e6792c50c9a3f89452f68d8ae311b4309d3cf50");

/** The server's application write key. */
export const rfc8448ServerApplicationKey = (): u8[] => fromHex("9f02283b6c9c07efc26bb9f2ac92e356");

/** The server's application write IV. */
export const rfc8448ServerApplicationIv = (): u8[] => fromHex("cf782b88dd83549aadf1e984");

/** The client's application write key. */
export const rfc8448ClientApplicationKey = (): u8[] => fromHex("17422dda596ed5d9acd890e3c63f5051");

/** The client's application write IV. */
export const rfc8448ClientApplicationIv = (): u8[] => fromHex("5b78923dee08579033e523d9");

/** The client's finished_key. */
export const rfc8448ClientFinishedKey = (): u8[] => fromHex("b80ad01015fb2f0bd65ff7d4da5d6bf83f84821d1f87fdc7d3c75b5a7b42d9c4");

/** The client's Finished. */
export const rfc8448ClientFinished = (): u8[] => fromHex("14000020a8ec436d677634ae525ac1fcebe11a039ec17694fac6e98527b642f2edd5ce61");

/** EncryptedExtensions' supported_groups and record_size_limit, which the server does not write itself, handed to it as `extraExtensions`. */
export const rfc8448ExtraExtensions = (): u8[] => fromHex("000a00140012001d00170018001901000101010201030104001c00024001");

/** The transcript hash through Certificate, which CertificateVerify signs. The RFC does not print it; this is SHA-256 over the four messages above, computed with Python's hashlib. */
export const rfc8448CertificateTranscriptHash = (): u8[] => fromHex("764d6632b3c35c3f3205e3499ac3edbaabb88295fba751461d3678e2e5ea0687");
