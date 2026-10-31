// The Unix-domain calls under `--sandbox`, from a program whose main reaches
// `net` and nothing more. `serve NAME` listens on the abstract name NAME and
// waits, built without the sandbox, so the runner has a listener outside it;
// a listen that fails exits 1 at once. `probe NAME` is built with it: an
// abstract listener of its own and a connect to it work, a pathname bind is
// refused by Landlock, since making the socket file is a write `fs.write`
// grants, and a connect to the listener outside is refused by the
// abstract-socket scope on ABI 6 and connects below it. The runner puts its
// pid in NAME, so two runs at once do not meet.
import { netClose, pollAdd, pollCreate, pollWait, unixConnect, unixListen } from "nish:net"

export const main = (): number => {
  const outside = process.argv.length > 2 ? process.argv[2] : "@nish-net-unix-sandbox-outside"
  if (process.argv.length > 1 && process.argv[1] === "serve") {
    const fd = unixListen(outside, 4, 0)
    if (fd < 0) {
      console.log(`serve ${fd}`)
      return 1
    }
    const loop = pollCreate()
    pollAdd(loop, fd, 4, 0)
    const ready: i32[] = new Array<i32>(2)
    pollWait(loop, ready, 60000)
    return 0
  }
  const ownName = `${outside}-own`
  const own = unixListen(ownName, 4, 0)
  const client = unixConnect(ownName)
  console.log(`abstract ${own >= 0} ${client >= 0}`)
  console.log(`pathname ${unixListen("net.sock", 4, 0)}`)
  const reach = unixConnect(outside)
  console.log(`outside ${reach >= 0 ? "connected" : `${reach}`}`)
  if (reach >= 0) {
    netClose(reach)
  }
  netClose(client)
  netClose(own)
  return 0
}
