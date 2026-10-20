// A second `GET /users/:id` is the same route under any parameter names, so
// `Router.add` answers `ROUTER_DUPLICATE` and a caller that treats a refused
// table as fatal stops before serving.
//
// It panics, on stderr, with
//
//     route table: GET /users/:name is refused with -5
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
  route(router, "GET", "/users/:id");
  route(router, "POST", "/users/:id");
  route(router, "GET", "/users/:name");
  console.log("unreachable: the duplicate was accepted");
  return 0;
};
