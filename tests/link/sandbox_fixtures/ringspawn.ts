// A `--sandbox` probe whose main reaches net, a `NET_LISTEN_RING` listen and
// process.spawn (WP63 S3): with both granted the filter leaves io_uring open
// and the sandbox makes no ring. The guarded calls are never made; they are
// there so that main's capability set holds what they name.
import { NET_LISTEN_RING, tcpListenFlags } from "nish:net"

declare function sb_probe(op: string, path: string): i32

export const main = (): i32 => {
  const args = process.argv
  if (args.length > 9) console.log(`${tcpListenFlags("127.0.0.1", 0, 1, NET_LISTEN_RING)}`)
  if (args.length > 9) console.log(spawnSync([args[3]]))
  return sb_probe(args[1], args.length > 2 ? args[2] : "")
}
