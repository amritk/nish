// The checked twins of the router: `routerChecked` answers a limit outside its
// range as an `Err` where `new Router` panics, `tryMatch` answers a range
// outside its buffer as ROUTER_NOT_FOUND where `match` panics, and
// `tryParamCount` answers -1 for a route the table does not hold where
// `paramCount` panics. Each refusal is printed and the program goes on, so the
// exit code 0 pins that none of them panicked.
import { httpFieldBytes } from "nish/net/http-fields";
import {
  ROUTER_NOT_FOUND,
  Router,
  RouterLimits,
  routerChecked,
} from "nish/net/router";

export const main = (): i32 => {
  const bad = new RouterLimits();
  bad.maxSegments = 0;
  const refused: Result<Router, string> = routerChecked(bad);
  if (refused.isErr()) {
    console.log(`refused: ${refused.error}`);
  }
  const wide = new RouterLimits();
  wide.maxMethods = 65;
  const tooWide: Result<Router, string> = routerChecked(wide);
  if (tooWide.isErr()) {
    console.log(`refused: ${tooWide.error}`);
  }
  const made: Result<Router, string> = routerChecked(new RouterLimits());
  if (made.isErr()) {
    console.log(`unexpected: ${made.error}`);
    return 1;
  }
  const router: Router = made.value;
  router.add("GET", "/notes/:id");
  const method: u8[] = httpFieldBytes("GET");
  const target: u8[] = httpFieldBytes("/notes/7");
  const params: i32[] = [0, 0];
  const end: i32 = toI32(target.length);
  const inside: i32 = router.tryMatch(
    method,
    0,
    toI32(method.length),
    target,
    0,
    end,
    params,
  );
  console.log(
    `inside: route ${inside}, ${router.tryParamCount(inside)} param at ${params[0]} to ${params[1]}`,
  );
  const past: i32 = router.tryMatch(
    method,
    0,
    toI32(method.length),
    target,
    0,
    9,
    params,
  );
  console.log(
    `past the end: ${past === ROUTER_NOT_FOUND ? "not found" : `route ${past}`}`,
  );
  const negative: i32 = router.tryMatch(
    method,
    -1,
    toI32(method.length),
    target,
    0,
    end,
    params,
  );
  console.log(
    `negative method start: ${negative === ROUTER_NOT_FOUND ? "not found" : `route ${negative}`}`,
  );
  const negativeTarget: i32 = router.tryMatch(
    method,
    0,
    toI32(method.length),
    target,
    -1,
    end,
    params,
  );
  console.log(
    `negative target start: ${negativeTarget === ROUTER_NOT_FOUND ? "not found" : `route ${negativeTarget}`}`,
  );
  const reversed: i32 = router.tryMatch(
    method,
    0,
    toI32(method.length),
    target,
    end,
    1,
    params,
  );
  console.log(
    `reversed target: ${reversed === ROUTER_NOT_FOUND ? "not found" : `route ${reversed}`}`,
  );
  console.log(
    `off the table: ${router.tryParamCount(99)}, ${router.tryParamCount(-1)}`,
  );
  return 0;
};
