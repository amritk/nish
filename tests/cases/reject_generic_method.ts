// Type arguments are never written at a call site, and a method call is no
// exception: one token of lookahead cannot tell `h.get<i32>(7)` from
// `(h.get < i32) > (7)`, so `T` is inferred from the argument (WP18 §2a,
// §15.8). This case refused every generic method until G8 made them legal; the
// rule it pins now is the one about the call.
class Holder {
  value: i32 = 0;

  get<T>(x: T): T {
    return x;
  }
}

export const test = (): number => {
  const h = new Holder();
  return h.get<i32>(7);
};
