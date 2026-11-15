// The exporter: a string enum, and a function whose signature names it, so the
// importer's IR has a `declare` whose parameter is the enum's `i32` ordinal.
export enum Role {
  Admin = "admin",
  Guest = "guest",
  Ghost = "",
}

export const rank = (r: Role): i32 => {
  switch (r) {
    case Role.Admin:
      return 3;
    case Role.Guest:
      return 1;
    default:
      return 0;
  }
};
