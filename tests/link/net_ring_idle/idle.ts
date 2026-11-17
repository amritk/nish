// What an idle keep-alive slot of a `NET_LISTEN_RING` listener costs in
// memory (NURING-38). tests/run.js's `net_ring` section starts this program
// under a descriptor limit of 4,096, so every slot is in one ring, and
// `client.mjs` in `idle` mode opens 3,000 connections to the port it prints;
// each sends five bytes, reads the
// echo and then stays open, sending nothing more. With every one echoed and
// idle the program reads its anonymous resident set from /proc/self/status
// and prints what it grew by per connection since the listener opened, then
// exits, which ends the client. Exit 0 is a pass, 2 says the kernel refused
// rings (the section's skip), and 1 is a failure, with its line.
import { fileClose, fileOpen, fileReadAt } from "nish:fs"
import {
  NET_LISTEN_RING,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpListenFlags,
} from "nish:net"

/** The connections the client opens. */
const CLIENTS: i32 = 3000
/** The bytes each one sends, and is sent back. */
const EACH: i32 = 5
/** The token the listener is reported under; a slot handle is never negative. */
const LISTENER: i32 = -1

/** The /proc/self/status field the anonymous resident set is read from. */
const FIELD: string = "RssAnon:"

/**
 * The anonymous resident set in bytes, /proc/self/status's `RssAnon` (which
 * the kernel gives in kB whatever its page size), or -1. procfs answers the
 * current figures at offset 0 each time.
 * @param fd /proc/self/status, open
 * @param buf where the file is read
 * @returns the bytes, or -1
 */
const anonResident = (fd: i32, buf: u8[]): i64 => {
  const got: i32 = fileReadAt(fd, buf, 0, toI32(buf.length), 0)
  const width: i32 = toI32(FIELD.length)
  for (let at: i32 = 0; at + width < got && at + width < buf.length; at++) {
    let same: boolean = true
    for (let j: i32 = 0; j < width && same; j++) {
      same = toI32(buf[at + j]) === FIELD.charCodeAt(j)
    }
    if (same) {
      let value: i64 = 0
      let digits: boolean = false
      for (let k: i32 = at + width; k < got && k < buf.length; k++) {
        const c: i32 = toI32(buf[k])
        if (c >= 48 && c <= 57) {
          value = value * 10 + toI64(c - 48)
          digits = true
        } else if (digits) {
          return value * 1024
        }
      }
      return -1
    }
  }
  return -1
}

export const main = (): i32 => {
  const status: i32 = fileOpen("/proc/self/status")
  const text: u8[] = new Array<u8>(4096)
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 4096, NET_LISTEN_RING)
  if (listener < 0) {
    console.log(`tcpListenFlags failed with ${listener}`)
    return 1
  }
  const state: i32 = netRingState()
  if (state !== 1) {
    console.log(`rings refused: ${state}`)
    return 2
  }
  const loop: i32 = pollCreate()
  pollAdd(loop, listener, 1, LISTENER)
  const ready: i32[] = new Array<i32>(128)
  const peer: u8[] = new Array<u8>(18)
  const buf: u8[] = new Array<u8>(64)
  const before: i64 = anonResident(status, text)
  console.log(`port ${netLocalPort(listener)}`)
  let accepted: i32 = 0
  let echoed: i32 = 0
  while (echoed < CLIENTS * EACH) {
    const n: i32 = pollWait(loop, ready, 10000)
    if (n <= 0) {
      console.log(`pollWait answered ${n} with ${accepted} accepted, ${echoed} bytes echoed`)
      return 1
    }
    for (let k: i32 = 0; k < n; k++) {
      const token: i32 = ready[2 * k]
      if (token === LISTENER) {
        let h: i32 = tcpAccept(listener, peer)
        while (h >= 0) {
          accepted += 1
          pollAdd(loop, h, 1, h)
          h = tcpAccept(listener, peer)
        }
        if (h !== -11) {
          console.log(`tcpAccept answered ${h} after ${accepted}`)
          return 1
        }
        continue
      }
      // Read to -11, as a server does, so the slot is idle when it is done.
      let got: i32 = netRead(token, buf, 0, toI32(buf.length))
      while (got > 0) {
        if (netWrite(token, buf, 0, got) !== got) {
          console.log(`netWrite of ${got} did not take it all`)
          return 1
        }
        echoed += got
        got = netRead(token, buf, 0, toI32(buf.length))
      }
      if (got !== -11) {
        console.log(`netRead answered ${got}`)
        return 1
      }
    }
  }
  const after: i64 = anonResident(status, text)
  fileClose(status)
  if (before < 0 || after < 0) {
    console.log("/proc/self/status could not be read")
    return 1
  }
  console.log(`idle: ${(after - before) / toI64(CLIENTS)} bytes per connection`)
  return 0
}
