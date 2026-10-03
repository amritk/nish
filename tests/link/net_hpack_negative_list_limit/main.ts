// The header-list limit is the caller's number, so a negative one panics.
//
// It panics, on stderr, with
//
//     HpackDecoder: a header-list limit of -1
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { HpackDecoder } from "nish/net/hpack";

export const main = (): i32 => {
  const none = new HpackDecoder(4096, 0);
  console.log(`a header-list limit of ${none.maxHeaderListSize}`);
  const refused = new HpackDecoder(4096, -1);
  console.log(`unreachable: a limit of ${refused.maxHeaderListSize}`);
  return 0;
};
