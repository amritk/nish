// An imported string enum is the exporter's enum: the importer names its
// members, switches over it, compares it, keys a `Map` with it and prints it
// through `String(r)`, which reads the importer's own copy of the strings.
import { Role, rank } from "./roles";

const label = (r: Role): string => {
  switch (r) {
    case Role.Admin:
      return "root";
    default:
      return "user";
  }
};

export const main = (): number => {
  const roles: Role[] = [Role.Admin, Role.Guest, Role.Ghost];
  const seen = new Map<Role, i32>();
  let total = 0;
  for (const r of roles) {
    console.log(`[${String(r)}] ${label(r)} ${rank(r)}`);
    seen.set(r, rank(r));
    total = total + rank(r);
  }
  console.log(`${seen.size} roles, rank ${total}`);
  return Role.Admin === roles[0] ? 0 : 1;
};
