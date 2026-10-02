// RFC 8448 §5, "HelloRetryRequest", as the bytes the trace prints. Its
// exchange is over secp256r1, which has no ECDH in the stack, so the handshake
// cannot be replayed; what can is the transcript's \`message_hash\` rule and the
// schedule over it, which is what \`checks.ts\` takes these for.
import { fromHex } from "../net_tls_common/hex";

/** The first ClientHello, with an x25519 share. */
export const rfc8448RetryClientHello1 = (): u8[] =>
  fromHex(
    [
      "010000b00303b0b1c5a5aa37c5919f2ed1d5c6fff7fcb7849716945a2b8cee9258a346677b6f00000613011303130201",
      "0000810000000b0009000006736572766572ff01000100000a00080006001d00170018003300260024001d0020e8e8e3",
      "f3b93a25ed97a14a7dcacb8a272c6288e585c6484d05262fcad062ad1f002b0003020304000d0020001e040305030603",
      "020308040805080604010501060102010402050206020202002d00020101001c00024001",
    ].join("")
  );

/** The HelloRetryRequest asking for secp256r1, with a cookie. */
export const rfc8448RetryHelloRetryRequest = (): u8[] =>
  fromHex(
    [
      "020000ac0303cf21ad74e59a6111be1d8c021e65b891c2a211167abb8c5e079e09e2c8a8339c00130100008400330002",
      "0017002c0074007271dcd04bb88bc3189119398a00000000eefafc76c146b823b096f8aacad365dd0030953f4edf6256",
      "36e5f21bb2e23fcc654b1b5b40318d10d137abcbb87574e36e8a1f025f7dfa5d6e50781b5eda4aa15b0c8be778257d16",
      "aa3030e9e7841dd9e4c0342267e8ca0caf571fb2b7cff0f934b0002b00020304",
    ].join("")
  );

/** The second ClientHello, with the secp256r1 share. */
export const rfc8448RetryClientHello2 = (): u8[] =>
  fromHex(
    [
      "010001fc0303b0b1c5a5aa37c5919f2ed1d5c6fff7fcb7849716945a2b8cee9258a346677b6f00000613011303130201",
      "0001cd0000000b0009000006736572766572ff01000100000a00080006001d001700180033004700450017004104a6da",
      "7392ec591e17abfd535964b99894d13befb221b3def2ebe3830eac8f0151812677c4d6d2237e85cf01d6910cfb83954e",
      "76ba7352830534159897e8065780002b0003020304000d0020001e040305030603020308040805080604010501060102",
      "010402050206020202002c0074007271dcd04bb88bc3189119398a00000000eefafc76c146b823b096f8aacad365dd00",
      "30953f4edf625636e5f21bb2e23fcc654b1b5b40318d10d137abcbb87574e36e8a1f025f7dfa5d6e50781b5eda4aa15b",
      "0c8be778257d16aa3030e9e7841dd9e4c0342267e8ca0caf571fb2b7cff0f934b0002d00020101001c00024001001500",
      "af0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "0000000000000000000000000000000000000000000000000000000000000000",
    ].join("")
  );

/** The ServerHello. */
export const rfc8448RetryServerHello = (): u8[] =>
  fromHex(
    [
      "020000770303bb341d847fd789c47c387172dc0c9bf147fccacb5043d86ca4c598d3ff571b9800130100004f00330045",
      "0017004104583e054b7a66672ae020ad9d2686fcc85b5ad41a134a0f03ee72b893052bd85b4c8de6776f5b04ac07d835",
      "40eab3e3d9c547bc6528c4317d294686093a6cad7d002b00020304",
    ].join("")
  );

/** The transcript hash through ServerHello, which "tls13 c hs traffic" takes: message_hash(ClientHello1), HelloRetryRequest, ClientHello2, ServerHello. */
export const rfc8448RetryHelloHash = (): u8[] => fromHex("8aa8e828ec2f8a884fec95a3139de01c15a3daa7ff5bfc3f4bfcc21b438d7bf8");

/** The secp256r1 shared secret. */
export const rfc8448RetryEcdhe = (): u8[] => fromHex("c142ce13ca11b5c2233652e63ad3d97844f1621fbfb9de69d547dc8fedeabeb4");

/** The handshake secret. */
export const rfc8448RetryHandshakeSecret = (): u8[] => fromHex("ce022e5e6e81e50736d773f2d3adfce8220d049bf510f0dbfac927ef4243b148");

/** client_handshake_traffic_secret. */
export const rfc8448RetryClientHandshakeTraffic = (): u8[] => fromHex("158aa7ab8855073582b41d674b4055cabcc534728f659314861b4e08e2011566");

/** server_handshake_traffic_secret. */
export const rfc8448RetryServerHandshakeTraffic = (): u8[] => fromHex("3403e781e2af7b6508da28574f6e95a1abf162de83a97927c37672a4a0cef8a1");
