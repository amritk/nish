// A string enum is stored as its member's ordinal, an `i32`, like a numeric
// enum; its strings are one table, `@.enumstr.Role`, that `String(r)` indexes.
// A `switch` over it lowers to an LLVM `switch` on the ordinal, and `===`
// compares ordinals, never bytes. The empty string is a value like any other.
enum Role {
  Admin = "admin",
  Guest = "guest",
  Nobody = "",
}

const rank = (r: Role): i32 => {
  switch (r) {
    case Role.Admin:
      return 3;
    case Role.Guest:
      return 1;
    default:
      return 0;
  }
};

export const test = (): i32 => {
  const roles: Role[] = [Role.Admin, Role.Guest, Role.Nobody];
  let total = 0;
  for (const r of roles) {
    console.log(String(r));
    total = total * 10 + rank(r);
    if (r !== Role.Guest) {
      total = total * 10;
    }
  }
  return total;
};
