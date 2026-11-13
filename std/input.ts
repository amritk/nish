/**
 * `nish/input` — what one fixed step of a program reads from its player: the
 * key and mouse events since the last step, and which keys are held down.
 *
 * The module is pure: no capability, no I/O and no clock. Code that steps a
 * scene takes a `StepInput`, so it compiles for a terminal, for `wasm32`
 * behind a page, or for a test that scripts the keys, and runs the same way
 * under each. The host owns one `StepInput` and points it at what it read
 * each step; nothing is copied.
 *
 *     import { KEY_CHAR, KeyState } from "nish/term"
 *     import { StepInput } from "nish/input"
 *
 *     const quits = (input: StepInput): boolean => input.isDown(KEY_CHAR, 113)
 *
 *     const input = new StepInput(new KeyState())
 *     // each step, with the events the host read and its clock in ms:
 *     input.events = input.keys.apply(read, nowMs)
 *     if (quits(input)) { ... }
 *
 * A terminal program sets `events` and `keys` from the `TermInput` that
 * `nish/term-io`'s `runTerminal` hands it. The events and key state themselves
 * (`TermEvent`, `KeyState` and the `KEY_`, `EVENT_` and `ACTION_` constants)
 * are `nish/term`'s, which is pure too.
 */
import { KeyState, TermEvent } from "nish/term"

/** The input of one step: the events since the last step and which keys are down. */
export class StepInput {
  /** The events since the last step, in the order they arrived; the step may filter them in place. */
  events: TermEvent[]
  /** Which keys are down, for `isDown`. */
  keys: KeyState

  /**
   * An input with no events yet.
   *
   * @param keys The key state the host keeps current, which `isDown` reads.
   */
  constructor(keys: KeyState) {
    this.events = []
    this.keys = keys
  }

  /**
   * Whether a key is down.
   *
   * @param key The key's `KEY_` kind.
   * @param code The code point for `KEY_CHAR`; it tells `KEY_CONTROL` and `KEY_UNKNOWN` keys apart
   *   too, and is ignored for the other kinds.
   * @returns True from the key's press until its release, real or synthetic, or a loss of focus.
   */
  isDown(key: i32, code: i32): boolean {
    return this.keys.isDown(key, code)
  }
}
