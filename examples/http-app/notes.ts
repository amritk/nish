// The notes the API keeps, in memory and in the order they were added.

/** At most `capacity` notes, each an id and its text; ids are never reused. */
export class Notes {
  ids: i32[]
  texts: string[]
  capacity: i32 = 0
  nextId: i32 = 1

  constructor(capacity: i32) {
    this.capacity = capacity
    this.ids = []
    this.texts = []
  }

  /** How many notes there are. */
  count(): i32 {
    return toI32(this.ids.length)
  }

  /** Adds `text` and answers its id, or -1 when the store is full. */
  add(text: string): i32 {
    if (this.count() >= this.capacity) {
      return -1
    }
    const id: i32 = this.nextId
    this.nextId += 1
    this.ids.push(id)
    this.texts.push(text)
    return id
  }

  /** Where note `id` is, or -1 when there is none. */
  find(id: i32): i32 {
    for (let k: i32 = 0; k < toI32(this.ids.length); k++) {
      if (this.ids[k] === id) {
        return k
      }
    }
    return -1
  }

  /** Removes note `id`, keeping the others in order; answers whether it was there. */
  remove(id: i32): boolean {
    const at: i32 = this.find(id)
    if (at < 0) {
      return false
    }
    const last: i32 = toI32(this.ids.length) - 1
    for (
      let k: i32 = at;
      k < last && k + 1 < toI32(this.ids.length) && k + 1 < toI32(this.texts.length);
      k++
    ) {
      this.ids[k] = this.ids[k + 1]
      this.texts[k] = this.texts[k + 1]
    }
    this.ids.pop()
    this.texts.pop()
    return true
  }
}
