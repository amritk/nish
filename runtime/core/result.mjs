import { panic } from "./host.mjs";

/**
 * `nish:secret` (docs/LANGUAGE.md, "Secrets"). Natively the compiler holds a
 * `Secret` to its rules and `wipe` is a volatile store of zeros; here the rules
 * have already been checked by the compiler or by nobody, so a `Secret` is a
 * plain wrapper and `wipe` zero-fills what it holds. `runtime/nish.mjs`
 * resolves the `nish:secret` specifier to `runtime/shim.mjs`, which re-exports
 * this module, so these are its exports by name. A zero-fill under Node promises nothing about copies the
 * engine made, which is the native wipe's whole point and is not claimed here.
 */
export class Secret {
  constructor(value) {
    this.value = value;
  }
}

export function secret(value) {
  return new Secret(value);
}

export function expose(s, f) {
  return f(s.value);
}

export function exposeWith(s, arg, f) {
  return f(s.value, arg);
}

/** Zero an array of integers, or every integer field of a record: `0` for a number, `0n` for an `i64` or `u64`. */
function zeroFill(target) {
  if (Array.isArray(target) || ArrayBuffer.isView(target)) {
    for (let i = 0; i < target.length; i++) {
      target[i] = typeof target[i] === "bigint" ? 0n : 0;
    }
    return;
  }
  for (const key of Object.keys(target)) {
    const field = target[key];
    if (typeof field === "bigint") target[key] = 0n;
    else if (typeof field === "number") target[key] = 0;
  }
}

export function wipe(target) {
  zeroFill(target instanceof Secret ? target.value : target);
}

/**
 * `secureZero(bytes)` (#385): every element set to zero, which is what the
 * native `nish_wipe` leaves. Nothing here can drop a store to an array the
 * caller still holds, so a loop is the whole of it. What it cannot promise is
 * what the native build does: a collector that moved the array may have left a
 * copy of the old bytes behind, and JavaScript has no way to reach it.
 */
export function secureZero(bytes) {
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = 0;
  }
}

// ---- Result (WP16) ---------------------------------------------------------
//
// Natively a `Result` is a two-arm struct in the arena; here it is an ordinary
// object with the same three names, so `r.ok`, `r.value` and `r.error` in the
// rewritten program mean what they mean in the compiled one. Only `orReturn`
// needs help: it returns from the *enclosing* function, which no expression in
// JavaScript can do, so it throws a sentinel that `rewrite.js` catches in a
// wrapper around every body that contains one.

class Propagate {
  constructor(error) {
    this.error = error;
  }
}

class NishResult {
  constructor(ok, value, error) {
    this.ok = ok;
    if (ok) this.value = value;
    else this.error = error;
  }
  isOk() {
    return this.ok;
  }
  isErr() {
    return !this.ok;
  }
  unwrapOr(fallback) {
    return this.ok ? this.value : fallback;
  }
  expect(message) {
    if (this.ok) return this.value;
    panic(message);
  }
  orReturn() {
    if (this.ok) return this.value;
    throw new Propagate(this.error);
  }
}

/** `Ok(v)`; `Ok()` on a `Result<void, E>` carries nothing. */
export function Ok(value) {
  return new NishResult(true, value, undefined);
}

/** `Err(e)`. */
export function Err(error) {
  return new NishResult(false, undefined, error);
}

/**
 * The `catch` half of `orReturn`: re-raise anything that is not a propagation,
 * and answer the `Err` the enclosing function should return otherwise. The
 * rewriter emits `return __nish.caught(e)` and nothing else, so a genuine
 * runtime error still reaches Node unchanged.
 */
export function caught(thrown) {
  if (thrown instanceof Propagate) return new NishResult(false, undefined, thrown.error);
  throw thrown;
}
