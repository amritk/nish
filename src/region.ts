// `nish:region`'s identity: which module is the source behind it. The rules
// are in `src/region-check.ts` and the lowering in `src/emit-region.ts`; this
// file imports nothing of the checker's, so `src/program.ts` can ask it.

import { CLI } from "./branding"
import { stdModuleName } from "./std-modules"

/** The library spelling of `nish:region`'s source, which an import may not use. */
export const REGION_STD_SPECIFIER: string = "nish/region"

/** Whether a module is `std/region.ts`: the package is part of the test, as for `isSecretModule`. */
export const isRegionModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(REGION_STD_SPECIFIER)
