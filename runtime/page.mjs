// nish/page: the page-side helpers for a wasm module built with
// `--profile wasm-host` (docs/wp50-wasm-host.md §11): the typed handle table a
// host module keeps its objects in, the page's half of `nish/host/ring`, and
// the default `onPanic` reporter. Plain ECMAScript with no imports, so a
// browser loads it as it is.

/**
 * The objects a host module hands the program as `HostHandle<"kind">`
 * values: `add` answers a handle, `get` reads it and `take` removes it. Slot 0
 * is "none" and is never handed out, and a handle that names no object (0, a
 * taken slot, a number no `add` answered) throws a RangeError rather than
 * answering `undefined`: thrown inside an import, that ends the module, which
 * is what a program holding a forged handle has earned. A taken slot is handed
 * out again by a later `add`, so a stale handle the program kept names the
 * newer object; it can reach only what the table holds.
 */
export class HostTable {
  #slots = [undefined];
  #free = [];

  /** Stores `value` and answers its handle, never 0. */
  add(value) {
    const reused = this.#free.pop();
    if (reused !== undefined) {
      this.#slots[reused] = value;
      return reused;
    }
    this.#slots.push(value);
    return this.#slots.length - 1;
  }

  /** The object `handle` names. */
  get(handle) {
    return this.#slots[this.#check(handle)];
  }

  /** Removes the object `handle` names and answers it; the handle names nothing after. */
  take(handle) {
    const at = this.#check(handle);
    const value = this.#slots[at];
    this.#slots[at] = undefined;
    this.#free.push(at);
    return value;
  }

  /** How many objects the table holds. */
  get size() {
    return this.#slots.length - 1 - this.#free.length;
  }

  #check(handle) {
    if (
      !Number.isInteger(handle) ||
      handle <= 0 ||
      handle >= this.#slots.length ||
      this.#free.includes(handle)
    ) {
      throw new RangeError(`nish: no host object has handle ${handle}`);
    }
    return handle;
  }
}

/**
 * The page's half of a `nish/host/ring` ring held in module storage: `memory`
 * is the loaded module's `memory` and `field` its `layout` entry, an
 * `Int32Array` of two counts and the slots. The words are read through one
 * `Int32Array` view, made again only when a growing memory replaced its
 * buffer. The arithmetic is the module's (`std/host/ring.ts`): the head and
 * the tail are counts modulo twice the capacity, reduced before every use, so
 * counts the program wrote out of protocol are never read out of bounds.
 */
export const ringOver = (memory, field) => {
  const at = field.at;
  const length = field.length;
  if (!Number.isInteger(at) || at < 0 || at % 4 !== 0 || !Number.isInteger(length) || length < 0) {
    throw new RangeError("nish: a ring is an Int32Array's layout entry: { at, length }");
  }
  const capacity = length > 2 ? length - 2 : 0;
  const twice = capacity * 2;
  let view = null;
  const words = () => {
    if (view === null || view.buffer !== memory.buffer) {
      view = new Int32Array(memory.buffer, at, length);
    }
    return view;
  };
  const count = (c) => {
    const r = c % twice;
    return r < 0 ? r + twice : r;
  };
  const size = () => {
    if (capacity === 0) {
      return 0;
    }
    const w = words();
    const n = count(count(w[1]) - count(w[0]));
    return n > capacity ? capacity : n;
  };
  return {
    capacity,
    size,
    free: () => capacity - size(),
    /** Puts `word` (an i32) at the tail; false, and nothing changed, when the ring is full. */
    push(word) {
      if (capacity === 0 || size() >= capacity) {
        return false;
      }
      const w = words();
      const tail = count(w[1]);
      w[2 + (tail % capacity)] = word;
      w[1] = count(tail + 1);
      return true;
    },
    /** Takes the word at the head; 0, and nothing changed, when the ring is empty. */
    shift() {
      if (capacity === 0 || size() === 0) {
        return 0;
      }
      const w = words();
      const head = count(w[0]);
      const word = w[2 + (head % capacity)];
      w[0] = count(head + 1);
      return word;
    },
    /** Empties the ring: the head catches up with the tail. */
    clear() {
      if (length >= 2) {
        const w = words();
        w[0] = w[1];
      }
    },
  };
};

/**
 * The reporter a loader calls when no `onPanic` was given: the panic's message
 * on the console, as a native program prints it on stderr. The loader throws
 * `NishPanic` after it either way.
 */
export const reportPanic = (panic) => {
  console.error("nish: " + panic.message);
};
