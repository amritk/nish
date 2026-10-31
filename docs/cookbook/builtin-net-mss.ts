// `netMss`, a connected TCP socket's send MSS: one call into runtime-net.c,
// `nounwind willreturn` since its two or three syscalls never wait, and a
// write, so two calls never fold into one: the kernel's answer moves as the
// path does. Anything but a connected TCP socket answers `-1`.
import { netMss } from "nish:net"

export const segment = (fd: i32): i32 => netMss(fd)

export const batch = (fd: i32, fallback: i32): i32 => {
  const mss = netMss(fd)
  return mss > 0 ? mss : fallback
}
