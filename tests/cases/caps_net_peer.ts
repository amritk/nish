// WP35: `peerCredentials` is a `nish:net` export, so it is `net`, as every
// other is, imported by name and reached from `main` through `peer`. It is
// asked of stdin, which may be a pipe, a file or a socket depending on who
// runs the test, so what is printed is only that it answered 0 or a refusal,
// never a credential: the label is the point, not the peer.
import { peerCredentials } from "nish:net";

const peer = (fd: i32): i32 => peerCredentials(fd, [0, 0, 0]);

export const main = (): number => {
  console.log(peer(0) <= 0 ? 0 : 1);
  return 0;
};
