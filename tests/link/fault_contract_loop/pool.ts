export class Limits {
  slots: i32
  constructor(slots: i32) {
    this.slots = slots
  }
}

export const limitsFault = (limits: Limits): string => {
  if (limits.slots < 1) {
    return `Pool: slots ${limits.slots} needs at least 1`
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
    limits.slots = 0
  }
}

export const shrink = (limits: Limits): void => {
  limits.slots = 0
}
