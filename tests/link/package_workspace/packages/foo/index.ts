// `foo`, reached through the link `node_modules/foo`. Its relative import is
// in package `foo` as well (see `main.ts`).
import { helper } from "./helper";

export const foo = (): i32 => helper() * 10;
