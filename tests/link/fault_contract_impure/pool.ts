import { getenv } from "nish:process"

export class Limits {
  slots: i32
  constructor(slots: i32) {
    this.slots = slots
  }
}

/** The least slot count, `2` when `POOL_STRICT` is set: a read of the process, not of the limits. */
const leastSlots = (): i32 => {
  const strict: string | null = getenv("POOL_STRICT")
  return strict === null ? 1 : 2
}

export const limitsFault = (limits: Limits): string => {
  if (limits.slots < leastSlots()) {
    return `Pool: slots ${limits.slots} needs at least ${leastSlots()}`
  }
  return ""
}

export const otherFault = (limits: Limits): string => {
  if (limits.slots < 2) {
    return `Pool: slots ${limits.slots} needs at least 2`
  }
  return ""
}

const checkLimits = (limits: Limits): void => {
  const fault: string = limitsFault(limits)
  if (fault.length > 0) {
    panic(fault)
  }
}

export class Pool {
  slots: i32 = 0
  constructor(limits: Limits) {
    checkLimits(limits)
    this.slots = limits.slots
  }
}

export const shrink = (limits: Limits): void => {
  limits.slots = 0
}
