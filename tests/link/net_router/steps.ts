// `nish/net/router`'s steps: the ids `Router.step` names, what `Router.use`
// binds them to, and the set `Router.steps` answers for each thing `match`
// can answer — a route, `ROUTER_METHOD_NOT_ALLOWED`, and every other code,
// which reads as `ROUTER_NOT_FOUND`'s.
import {
  ROUTER_BAD_ESCAPE,
  ROUTER_FULL,
  ROUTER_MAX_STEPS,
  ROUTER_METHOD_NOT_ALLOWED,
  ROUTER_NOT_FOUND,
  Router,
  RouterLimits,
} from "nish/net/router";
import { Suite } from "nish/testing";

export const stepChecks = (t: Suite): void => {
  const r = new Router(new RouterLimits());
  const home: i32 = r.add("GET", "/");
  const user: i32 = r.add("GET", "/users/:id");
  const echo: i32 = r.add("POST", "/echo");
  t.eqI32("a table with no step binds none to a route", r.steps(user), toI32(0));
  t.eqI32("nor to the requests no route matches", r.steps(ROUTER_NOT_FOUND), toI32(0));
  const id: i32 = r.step();
  const auth: i32 = r.step();
  const tag: i32 = r.step();
  t.eqI32("steps are named 0, 1, 2 in the order asked for", id * 100 + auth * 10 + tag, toI32(12));
  for (let route: i32 = home; route <= echo; route++) {
    r.use(route, id);
  }
  r.use(user, auth);
  r.use(user, auth);
  r.use(ROUTER_NOT_FOUND, tag);
  r.use(ROUTER_METHOD_NOT_ALLOWED, id);
  t.eqI32("a route answers one bit per step bound to it, a step bound twice once", r.steps(user), toI32(3));
  t.eqI32("a route bound to one step answers its bit alone", r.steps(home), toI32(1));
  t.eqI32("405 answers the steps bound to ROUTER_METHOD_NOT_ALLOWED", r.steps(ROUTER_METHOD_NOT_ALLOWED), toI32(1));
  t.eqI32("404 answers the steps bound to ROUTER_NOT_FOUND", r.steps(ROUTER_NOT_FOUND), toI32(4));
  t.eqI32("any other code answers the same as 404", r.steps(ROUTER_BAD_ESCAPE), toI32(4));
  t.eqI32("an index past the table answers no step", r.steps(echo + 1), toI32(0));
  const later: i32 = r.add("GET", "/later");
  t.eqI32("a route added after the steps starts bound to none", r.steps(later), toI32(0));

  const full = new Router(new RouterLimits());
  let last: i32 = -1;
  for (let k: i32 = 0; k < ROUTER_MAX_STEPS; k++) {
    last = full.step();
  }
  t.eqI32(`${ROUTER_MAX_STEPS} steps fit, the last named ${ROUTER_MAX_STEPS - 1}`, last, ROUTER_MAX_STEPS - 1);
  t.eqI32("one more is refused with ROUTER_FULL", full.step(), ROUTER_FULL);
  const top: i32 = full.add("GET", "/");
  full.use(top, last);
  full.use(top, toI32(0));
  t.eqI32("the highest step's bit keeps the set positive", full.steps(top), (1 << last) | 1);
};
