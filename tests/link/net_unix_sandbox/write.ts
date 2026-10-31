// A pathname listener under `--sandbox`, from a program whose main reaches
// `net` and `fs.write`: the bind makes the socket file, the listener takes a
// connection, and the file is unlinked when it stops.
import { unlinkSync } from "nish:fs"
import { netClose, unixConnect, unixListen } from "nish:net"

export const main = (): number => {
  const fd = unixListen("write.sock", 4, 1)
  const client = unixConnect("write.sock")
  console.log(`pathname ${fd >= 0} ${client >= 0}`)
  netClose(client)
  netClose(fd)
  console.log(`unlink ${unlinkSync("write.sock")}`)
  return 0
}
