// An instantiation of a generic record, laid inline as storage.
export interface Slot<T> {
  v: T
}

export const slots = new Array<Slot<i32>>(4)
