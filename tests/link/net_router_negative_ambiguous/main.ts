// A `*` takes the rest of the path, so `/files/*/raw` would need the router to
// guess where the rest ends: `Router.add` answers `ROUTER_AMBIGUOUS`, and a
// caller that treats a refused table as fatal stops before serving.
//
// It panics, on stderr, with
//
//     route table: GET /files/*/raw is refused with -4
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Router, RouterLimits } from "nish/net/router";

const route = (router: Router, method: string, pattern: string): i32 => {
  const index = router.add(method, pattern);
  if (index < 0) {
    panic(`route table: ${method} ${pattern} is refused with ${index}`);
  }
  console.log(`${method} ${pattern} is route ${index}`);
  return index;
};

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  route(router, "GET", "/files/*");
  route(router, "GET", "/files/:name");
  route(router, "GET", "/files/*/raw");
  console.log("unreachable: the ambiguous route was accepted");
  return 0;
};
