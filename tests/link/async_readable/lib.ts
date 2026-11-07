// The tasks `main.ts` spawns (async_readable in tests/run.js's link section).
import { readable, sleep, writable } from "nish:async"
import { netClose, netRead, netWrite } from "nish:net"

export async function reader(fd: i32): Promise<void> {
  const buf: u8[] = new Array<u8>(8)
  console.log(`reader: ${netRead(fd, buf, 0, 8)} before the wait`)
  const ok = await readable(fd)
  const n = netRead(fd, buf, 0, 8)
  console.log(`reader: readable ${ok}, ${n} bytes, ${buf[0]} ${buf[1]}`)
  netClose(fd)
}

export async function writer(fd: i32): Promise<void> {
  await sleep(10)
  const ok = await writable(fd)
  const msg: u8[] = [104, 105]
  console.log(`writer: writable ${ok}, wrote ${netWrite(fd, msg, 0, 2)}`)
  netClose(fd)
}
