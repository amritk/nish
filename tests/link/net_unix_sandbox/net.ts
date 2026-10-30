// The Unix-domain calls under `--sandbox`, from a program whose main reaches
// `net` and nothing more. `serve` listens on an abstract name and waits, built
// without the sandbox, so the runner has a listener outside it. `probe` is
// built with it: an abstract listener of its own and a connect to it work, a
// pathname bind is refused by Landlock, since making the socket file is a
// write `fs.write` grants, and on ABI 6 a connect to the listener outside is
// refused by the abstract-socket scope.
import { netClose, pollAdd, pollCreate, pollWait, unixConnect, unixListen } from "nish:net"

const OUTSIDE: string = "@nish-net-unix-sandbox-outside"

export const main = (): number => {
  if (process.argv.length > 1 && process.argv[1] === "serve") {
    const fd = unixListen(OUTSIDE, 4, 0)
    const loop = pollCreate()
    pollAdd(loop, fd, 4, 0)
    const ready: i32[] = new Array<i32>(2)
    pollWait(loop, ready, 60000)
    return 0
  }
  const own = unixListen("@nish-net-unix-sandbox-own", 4, 0)
  const client = unixConnect("@nish-net-unix-sandbox-own")
  console.log(`abstract ${own >= 0} ${client >= 0}`)
  console.log(`pathname ${unixListen("net.sock", 4, 0)}`)
  console.log(`outside ${unixConnect(OUTSIDE)}`)
  netClose(client)
  netClose(own)
  return 0
}
