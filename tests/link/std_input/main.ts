// `nish/input` (`std/input.ts`): a host's one `StepInput`, pointed each step at
// the events it read and the `KeyState` that applied them, as a terminal host
// points it at term-io's `TermInput`. It checks that `isDown` reads the key
// state through a press, a held step and a release; that pointing `events` and
// `keys` elsewhere copies nothing, so the input reads whatever they read now;
// and the negatives, an empty step, a key never pressed, a letter in the other
// case and a release of a key that was not down, none of which shows a key
// down or panics.
import { Suite } from "../../../std/testing"
import { ACTION_PRESS, ACTION_RELEASE, EVENT_KEY, KEY_CHAR, KEY_SPACE, KeyState, TermEvent } from "nish/term"
import { StepInput } from "../../../std/input"

/** A key event of `key` (`code` for `KEY_CHAR`) with `action`. */
const keyEvent = (key: i32, code: i32, action: i32): TermEvent => {
  const e = new TermEvent(EVENT_KEY)
  e.key = key
  e.code = code
  e.action = action
  return e
}

/** One step: `read` applied to the input's key state at `nowMs`, and the input pointed at what that gives. */
const step = (input: StepInput, read: TermEvent[], nowMs: f64): void => {
  input.events = input.keys.apply(read, nowMs)
}

const testSteps = (t: Suite): void => {
  const input = new StepInput(new KeyState())
  // Real releases, so silence lets no key go between the steps below.
  input.keys.releasesAreSynthetic = false
  t.eqI32("a new input has no events", toI32(input.events.length), 0)
  t.ok("and no key down", !input.isDown(KEY_CHAR, 113))
  step(input, [keyEvent(KEY_CHAR, 113, ACTION_PRESS)], 0.0)
  t.eqI32("a press is the step's one event", toI32(input.events.length), 1)
  t.ok("and q is down", input.isDown(KEY_CHAR, 113))
  t.ok("as is Q: a letter is one key in either case", input.isDown(KEY_CHAR, 81))
  t.ok("but space is not", !input.isDown(KEY_SPACE, 0))
  step(input, [], 8.0)
  t.eqI32("an empty step has no events", toI32(input.events.length), 0)
  t.ok("and q is still held", input.isDown(KEY_CHAR, 113))
  step(input, [keyEvent(KEY_CHAR, 113, ACTION_RELEASE)], 16.0)
  t.ok("a release lets q go", !input.isDown(KEY_CHAR, 113))
  step(input, [keyEvent(KEY_SPACE, 0, ACTION_RELEASE)], 24.0)
  t.eqI32("a release of a key not down is dropped", toI32(input.events.length), 0)
  t.ok("and shows nothing down", !input.isDown(KEY_SPACE, 0))
}

/** The times the second test reads at, in milliseconds. */
const AT_0: f64 = 0.0
const AT_8: f64 = 8.0

const testPointed = (t: Suite): void => {
  const input = new StepInput(new KeyState())
  const other = new KeyState()
  other.releasesAreSynthetic = false
  const read: TermEvent[] = other.apply([keyEvent(KEY_SPACE, 0, ACTION_PRESS)], AT_0)
  input.events = read
  input.keys = other
  t.ok("pointed at another key state, the input reads it", input.isDown(KEY_SPACE, 0))
  t.eqI32("and the events it was pointed at", toI32(input.events.length), 1)
  read.pop()
  t.eqI32("which are not a copy: a change to them shows", toI32(input.events.length), 0)
  other.apply([keyEvent(KEY_SPACE, 0, ACTION_RELEASE)], AT_8)
  t.ok("nor is the key state", !input.isDown(KEY_SPACE, 0))
}

export const main = (): number => {
  const t = new Suite("std_input")
  testSteps(t)
  testPointed(t)
  return t.done()
}
