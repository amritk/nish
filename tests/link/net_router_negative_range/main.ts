// A target range that ends past its buffer is a programming error, not a
// request to refuse: `match` panics before it reads a byte of the target,
// and so before the exact-path table's unchecked comparison can be reached
// with a range outside the array (docs/security/router.md, ROUTE-12).
//
// It panics, on stderr, with
//
//     Router.match: the target range 0 to 8 is outside its 7 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
//
// The route is static and seven bytes long, so the range 0 to 8 is one the
// table would otherwise be asked about: without the check, the lookup would
// hash a byte past the end.
import { httpFieldBytes } from "nish/net/http-fields";
import { Router, RouterLimits } from "nish/net/router";

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  router.add("GET", "/health");
  router.add("GET", "/health/deep");
  const method: u8[] = httpFieldBytes("GET");
  const target: u8[] = httpFieldBytes("/health");
  const params: i32[] = [];
  const inside: i32 = router.match(method, 0, toI32(method.length), target, 0, toI32(target.length), params);
  console.log(`a range inside its buffer answers route ${inside}`);
  const outside: i32 = router.match(method, 0, toI32(method.length), target, 0, toI32(target.length) + 1, params);
  console.log(`unreachable: a range past its buffer answered ${outside}`);
  return 0;
};
