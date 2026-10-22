// The handshake family's Node twin: node:tls over a node:stream duplexPair,
// under the contract in bench/crypto/README.md and the inputs in this
// family's README.md. Each iteration is one full TLS 1.3 handshake, client and
// server in this process, then the message sent and read back. Node has no
// stable QUIC, so the quic kernel is absent.
import { createPrivateKey, X509Certificate } from "node:crypto"
import { duplexPair } from "node:stream"
import { connect, createSecureContext, TLSSocket } from "node:tls"

import { FOLD_START, fold, inputs, now, parseArgs, report, tweak } from "../lib/gen.mjs"

// The certificate and key every twin serves: tests/link/net_tls_common/server.ts's leaf.
const leafCertificate =
  "308201133081bba003020102020101300a06082a8648ce3d04030230143112301006035504030c096c6f63616c686f7374301e" +
  "170d3236303130313030303030305a170d3236303130323030303030305a30143112301006035504030c096c6f63616c686f" +
  "73743059301306072a8648ce3d020106082a8648ce3d0301070342000460fed4ba255a9d31c961eb74c6356d68c049b8923b" +
  "61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299300a06082a8648" +
  "ce3d040302034700304402200c0b8258087e44f6428624ddfd22cc752379dd41ca39ecfb138a13c8a47193e102200d00e6e9" +
  "e36e4d0b5caa1cc1c6feea59eb10c1b010c9edff71a38b182cb8631d"
const leafPKCS8 =
  "308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420c9afa9d845ba75166b5c215767b1" +
  "d6934e50c3db36e89b127b8a622b120f6721a1440342000460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669" +
  "622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299"

const fail = (what) => {
  console.error(`node.mjs: ${what} failed`)
  process.exit(1)
}

const args = parseArgs("node.mjs")
if (args.kernel !== "tls13") {
  console.error(`node.mjs: no kernel ${args.kernel}`)
  process.exit(2)
}
if (args.size < 4) {
  console.error("node.mjs: the size is at least 4 bytes")
  process.exit(2)
}
// Both sides pinned to TLS 1.3, TLS_AES_128_GCM_SHA256 and X25519. node:tls has
// no way to set the ticket count, so the server sends OpenSSL's default two,
// as no other twin does; nothing resumes from them.
const pinned = {
  minVersion: "TLSv1.3",
  maxVersion: "TLSv1.3",
  ciphers: "TLS_AES_128_GCM_SHA256",
  ecdhCurve: "X25519",
}
const server = createSecureContext({
  ...pinned,
  cert: new X509Certificate(Buffer.from(leafCertificate, "hex")).toString(),
  key: createPrivateKey({ key: Buffer.from(leafPKCS8, "hex"), format: "der", type: "pkcs8" }).export({
    format: "pem",
    type: "pkcs8",
  }),
})
const client = createSecureContext(pinned)

// Reads exactly `n` bytes from `socket`.
const readExactly = (socket, n) =>
  new Promise((resolve, reject) => {
    const parts = []
    let got = 0
    const onData = (chunk) => {
      parts.push(chunk)
      got += chunk.length
      if (got >= n) {
        socket.off("data", onData)
        socket.off("error", reject)
        resolve(Buffer.concat(parts))
      }
    }
    socket.on("data", onData)
    socket.once("error", reject)
  })

const once = async (message) => {
  const [a, b] = duplexPair()
  const s = new TLSSocket(b, { isServer: true, secureContext: server })
  s.on("error", () => fail("the server"))
  const served = readExactly(s, message.length).then((request) => s.write(request))
  // The leaf's validity ended in 2026 and it names no trust anchor, so the
  // client skips the chain; OpenSSL still checks the CertificateVerify signature.
  const c = connect({ socket: a, secureContext: client, rejectUnauthorized: false, servername: "localhost" })
  await new Promise((resolve, reject) => {
    c.once("secureConnect", resolve)
    c.once("error", reject)
  }).catch(() => fail("the client handshake"))
  const back = readExactly(c, message.length)
  c.write(message)
  const [echo] = await Promise.all([back, served]).catch(() => fail("the echo"))
  const suite = c.getCipher().standardName === "TLS_AES_128_GCM_SHA256" ? 0x1301 : 0xffff
  const group = c.getEphemeralKeyInfo().name === "X25519" ? 0x001d : 0xffff
  c.destroy()
  s.destroy()
  const out = Buffer.alloc(4 + message.length)
  out.writeUInt16BE(suite, 0)
  out.writeUInt16BE(group, 2)
  echo.copy(out, 4, 0, message.length)
  return out
}

const msg = inputs(args.kernel, args.size, 0, 0, 0, args.size).msg
const base = Buffer.from(msg.subarray(0, 4))
let sum = FOLD_START
const started = now()
for (let i = 0; i < args.iterations; i++) {
  tweak(msg, 0, base, i)
  sum = fold(sum, await once(msg))
}
report(sum, started)
