// A route with three parameters needs six slots; a caller that hands `match`
// four gets `ROUTER_TOO_MANY_PARAMS`, with the slots untouched, rather than a
// write past its storage, and here treats that as fatal.
//
// It panics, on stderr, with
//
//     match: /a/1/b/2/c/3 is refused with -9
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Router, RouterLimits } from "nish/net/router";
import { httpFieldBytes } from "nish/net/http-fields";

const lookup = (router: Router, target: string, params: i32[]): i32 => {
  const method = httpFieldBytes("GET");
  const bytes = httpFieldBytes(target);
  const route = router.match(method, 0, method.length, bytes, 0, bytes.length, params);
  if (route < 0) {
    panic(`match: ${target} is refused with ${route}`);
  }
  console.log(`${target} is route ${route}, its first parameter at ${params[0]} to ${params[1]}`);
  return route;
};

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  router.add("GET", "/a/:x");
  router.add("GET", "/a/:x/b/:y/c/:z");
  const params: i32[] = [0, 0, 0, 0];
  lookup(router, "/a/1", params);
  lookup(router, "/a/1/b/2/c/3", params);
  console.log("unreachable: six offsets went into four slots");
  return 0;
};
