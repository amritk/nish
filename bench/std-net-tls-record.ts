// TLS 1.3 records (std/net/tls/record.ts) under an instruction count: `n`
// rounds that each seal a 256-byte application_data record (with padding) on
// one TlsRecordProtection and open it on a peer installed from the same
// secret under TLS_AES_128_GCM_SHA256, then seal and open a short
// handshake-typed record. The count includes the AES-GCM a record costs, as
// a TLS connection's does; it reaches the window, length and padding checks
// whose panic sites the std/ ratchet counts, so a fix to one of them shows
// here as a count that holds or falls. It prints a sum over what it opened.
import {
  TLS_CONTENT_APPLICATION_DATA,
  TLS_CONTENT_HANDSHAKE,
  TLS_MAX_RECORD,
  TlsRecordProtection,
} from "nish/net/tls/record"
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule"

export const main = (): i32 => {
  const n: i32 = 1000 // bench:n
  const secret: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    secret[i] = toU8((i * 29 + 7) & 255)
  }
  const sender = new TlsRecordProtection()
  const receiver = new TlsRecordProtection()
  if (!sender.install(TLS_AES_128_GCM_SHA256, secret) || !receiver.install(TLS_AES_128_GCM_SHA256, secret)) {
    console.log("install failed")
    return 1
  }
  const data: u8[] = new Array<u8>(256)
  for (let i: i32 = 0; i < 256; i++) {
    data[i] = toU8(i & 255)
  }
  const record: u8[] = new Array<u8>(TLS_MAX_RECORD)
  const out: u8[] = new Array<u8>(TLS_MAX_RECORD)
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const slot: i32 = round & 255
    data[slot] = toU8(slot)
    const sealed: i32 = sender.seal(TLS_CONTENT_APPLICATION_DATA, data, 0, 256, round & 15, record, 0)
    const opened: i32 = sealed < 0 ? sealed : receiver.open(record, 0, sealed, out, 0)
    const shortSealed: i32 = sender.seal(TLS_CONTENT_HANDSHAKE, data, round & 63, 32, 0, record, 0)
    const shortOpened: i32 = shortSealed < 0 ? shortSealed : receiver.open(record, 0, shortSealed, out, 0)
    if (opened < 0 || shortOpened < 0) {
      console.log(`record failed on round ${round}: ${opened} ${shortOpened}`)
      return 1
    }
    const tail: i32 = slot & 31
    sum += toI64(sealed + opened + shortSealed + shortOpened + receiver.contentType) + toI64(out[tail])
  }
  console.log(`${sum}`)
  return 0
}
