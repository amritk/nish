// A pattern longer than `RouterLimits.maxPatternBytes` is refused whole, so
// `Router.add` answers `ROUTER_TOO_LONG`, and a caller that treats a refused
// table as fatal stops before serving.
//
// It panics, on stderr, with
//
//     route table: a pattern of 17 bytes is refused with -3
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Router, RouterLimits } from "nish/net/router";

const route = (router: Router, method: string, pattern: string): i32 => {
  const index = router.add(method, pattern);
  if (index < 0) {
    panic(`route table: a pattern of ${pattern.length} bytes is refused with ${index}`);
  }
  console.log(`${method} ${pattern} is route ${index}`);
  return index;
};

export const main = (): i32 => {
  const limits = new RouterLimits();
  limits.maxPatternBytes = 16;
  const router = new Router(limits);
  route(router, "GET", "/sixteen/bytes/x");
  route(router, "GET", "/seventeen/bytes/");
  console.log("unreachable: the long pattern was accepted");
  return 0;
};
