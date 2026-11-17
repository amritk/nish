// A `--sandbox` probe whose main reaches net but never `NET_LISTEN_RING`
// (WP63 S3): the sandbox makes no ring for it. The guarded listen is never
// made; it is there so that main's capability set holds net.
import { tcpListen } from "nish:net"

declare function sb_probe(op: string, path: string): i32

export const main = (): i32 => {
  const args = process.argv
  if (args.length > 9) console.log(`${tcpListen("127.0.0.1", 0, 1)}`)
  return sb_probe(args[1], args.length > 2 ? args[2] : "")
}
