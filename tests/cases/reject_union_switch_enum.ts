// Stricter than TypeScript: a `switch` on a plain enum is never complete,
// even when its labels name every member, because an enum can arrive from C
// holding any `i32`. Only a union's tag, which nothing but its variant writes,
// lets a function end in a `switch`.
enum Kind {
  Circle,
  Square,
  Tri,
}

const sides = (k: Kind): i32 => {
  switch (k) {
    case Kind.Circle:
      return 0;
    case Kind.Square:
      return 4;
    case Kind.Tri:
      return 3;
  }
};
