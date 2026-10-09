// `QuicListener.handleWindow` reads a datagram from a window `(buf, at, len)`
// the program chose, so a window that does not lie inside its buffer panics
// rather than reading past it, and it is tested the way `p256WindowFits`
// tests one: the length is checked to be non-negative before `at` is held
// to `length - len`. The window here, [3, 3 + -1), passes that second test
// alone (3 <= 4); the program panics, on stderr, with
//
//     QuicListener.handleWindow: the window [3, 3 + -1) is outside a datagram of 3 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QUIC_LISTENER_ANSWER_SIZE, QuicListener, QuicListenerAnswer } from "nish/net/quic-listener";
import { lcClientAddress, lcConfig, lcKindName, lcListenerEntropy } from "../net_quic_lifecycle/common";

export const main = (): i32 => {
  const listener = new QuicListener(lcConfig(false), lcListenerEntropy());
  const answer = new QuicListenerAnswer(QUIC_LISTENER_ANSWER_SIZE);
  const bytes: u8[] = [0x40, 1, 2];
  const at: i32 = 3;
  const none: i32 = 0;
  const minus: i32 = -1;
  const now: i64 = 1000;
  console.log(`an empty window at the end: ${lcKindName(listener.handleWindow(bytes, at, none, lcClientAddress(), now, answer))}`);
  console.log(`unreachable: ${lcKindName(listener.handleWindow(bytes, at, minus, lcClientAddress(), now, answer))}`);
  return 0;
};
