// The checker's half of `nish:region` (`src/emit-region.ts` is the emitter's):
// which function an instance of `std/region.ts` is. The rules a program is held
// to are below the roles.

import { CheckedProgram, FunctionSig, StructTemplateInfo, TemplateInfo } from "./program"
import { isRegionModule } from "./region"

/** What an instance of one of `nish:region`'s functions is. */
export const REGION_NONE: i32 = 0
/** `region(f)`. */
export const REGION_MAKE: i32 = 1
/** `regionWith(arg, f)`. */
export const REGION_MAKE_WITH: i32 = 2
/** `enter(r, f)`. */
export const REGION_ENTER: i32 = 3
/** `enterWith(r, arg, f)`. */
export const REGION_ENTER_WITH: i32 = 4
/** `free(r)`, whose body the emitter writes. */
export const REGION_FREE: i32 = 5
/** `handleNew()`: `nish_region_new`. */
export const REGION_NEW: i32 = 6
/** `open(h)`: `nish_region_enter` on a region with no root yet. */
export const REGION_OPEN: i32 = 7
/** `close(h, root)`: `nish_region_leave`, answering the handle. */
export const REGION_CLOSE: i32 = 8
/** `reopen(r)`: `nish_region_enter`, answering the root. */
export const REGION_REOPEN: i32 = 9
/** `leave(r, root)`: `nish_region_leave`. */
export const REGION_LEAVE: i32 = 10

/**
 * Whether `program` is `std/region.ts` as `nish:region` loads it. The package is
 * part of the test, as it is for `nish:secret`: a root-package file at the same
 * path is an ordinary module whose names mean nothing here.
 */
export const isRegionSource = (program: CheckedProgram): boolean =>
  isRegionModule(program.packageName, program.source.path)

/** Whether `template` is `Region<T>`'s class, which no program may `new`. */
export const isRegionTemplate = (template: StructTemplateInfo): boolean =>
  template.sourceName === "Region" && isRegionSource(template.home.program)

/** The role of a function of `std/region.ts` named `name`. */
const roleNamed = (name: string): i32 => {
  if (name === "region") {
    return REGION_MAKE
  }
  if (name === "regionWith") {
    return REGION_MAKE_WITH
  }
  if (name === "enter") {
    return REGION_ENTER
  }
  if (name === "enterWith") {
    return REGION_ENTER_WITH
  }
  if (name === "free") {
    return REGION_FREE
  }
  if (name === "handleNew") {
    return REGION_NEW
  }
  if (name === "open") {
    return REGION_OPEN
  }
  if (name === "close") {
    return REGION_CLOSE
  }
  if (name === "reopen") {
    return REGION_REOPEN
  }
  return name === "leave" ? REGION_LEAVE : REGION_NONE
}

/** The `REGION_*` role of an instantiation of `template`. */
const regionRole = (template: TemplateInfo): i32 =>
  template.owner !== null || !isRegionSource(template.home.program) ? REGION_NONE : roleNamed(template.sourceName)

/** Whether `template` runs an arrow that must capture nothing (`captureMode` in `src/generics.ts`). */
export const isRegionRunner = (template: TemplateInfo): boolean => {
  const role = regionRole(template)
  return role >= REGION_MAKE && role <= REGION_ENTER_WITH
}

/** The role of the instance `sig` is, or `REGION_NONE` when it is none of `nish:region`'s templates'. */
export const regionRoleOf = (sig: FunctionSig | null): i32 => {
  if (sig === null) {
    return REGION_NONE
  }
  const instance = sig.instance
  if (instance === null) {
    return REGION_NONE
  }
  const template = instance.template
  return template === null ? REGION_NONE : regionRole(template)
}

/**
 * The role of `sig` where `program` defines or instantiates it: `handleNew` and
 * `open` take no type parameter, so they are no template's instance and are
 * known by the module they are written in.
 */
export const regionRoleIn = (program: CheckedProgram, sig: FunctionSig): i32 => {
  if (sig.instance !== null) {
    return regionRoleOf(sig)
  }
  return sig.owner === null && sig.definedIn(program.source) && isRegionSource(program)
    ? roleNamed(sig.sourceName)
    : REGION_NONE
}

/** Whether `sig` is one of the intrinsics whose body the emitter writes. */
export const isRegionIntrinsic = (program: CheckedProgram, sig: FunctionSig): boolean =>
  regionRoleIn(program, sig) >= REGION_FREE
