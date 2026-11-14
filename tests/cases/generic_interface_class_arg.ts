// A generic call whose `T` is bound to an interface takes a class that
// implements it: in `pick(n, a, new B())` `T` is `Named` from `a`, and the
// `B` converts to `Named` at the argument, as a `Named` parameter would.
interface Named {
  name: string;
}

class A implements Named {
  name: string = "a";
}

class B implements Named {
  name: string = "b";
  extra: i32 = 7;
}

const pick = <T>(n: i32, first: T, second: T): T => (n > 0 ? first : second);

export const main = (): void => {
  const a: Named = new A();
  console.log(pick(1, a, new B()).name);
  console.log(pick(0, a, new B()).name);
};
