/**
 * `nish/input` — what one fixed step of a program reads from its player: the
 * key and mouse events since the last step, and which keys are held down.
 *
 * The module is pure: no capability, no I/O and no clock. It names the shape
 * that every host fills in, so code that steps a scene can be compiled for a
 * terminal, for `wasm32` behind a page, or for a test that scripts the
 * keys, and run the same way under each.
 *
 *     import { KEY_CHAR, KeyState, TermEvent } from "nish/term"
 *     import { InputFrame, StepInput, inputDown } from "nish/input"
 *
 *     const step = (input: InputFrame): boolean => !inputDown(input, KEY_CHAR, 113)
 *
 *     const input = new StepInput(new KeyState())
 *     // each step, with the events the host read and its clock in ms:
 *     input.events = input.keys.apply(read, nowMs)
 *     if (!step(input)) { ... }  // `q` is down
 *
 * The events and key state themselves (`TermEvent`, `KeyState` and the `KEY_`,
 * `EVENT_` and `ACTION_` constants) are `nish/term`'s, which is pure too.
 * `nish/term-io`'s `TermInput` implements `InputFrame`, so a terminal program
 * passes the input `runTerminal` hands it straight to a function that takes an
 * `InputFrame`.
 *
 * Private helpers share the importing program's flat symbol namespace, which
 * is why each one carries the module's name.
 */
import { KeyState, TermEvent } from "nish/term"

/**
 * The input of one step: the events since the last step and which keys are
 * down. A class that `implements` it lists these two fields first.
 */
export interface InputFrame {
  /** The events since the last step, in the order they arrived. */
  events: TermEvent[]
  /** Which keys are down. */
  keys: KeyState
}

/** An `InputFrame` a host owns and refills each step, for a host with no terminal. */
export class StepInput implements InputFrame {
  /** The events since the last step, in the order they arrived. */
  events: TermEvent[]
  /** Which keys are down. */
  keys: KeyState

  /**
   * An input with no events yet.
   *
   * @param keys The key state the host keeps current.
   */
  constructor(keys: KeyState) {
    this.events = []
    this.keys = keys
  }
}

/**
 * Whether a key is down in a step's input.
 *
 * @param input The step's input.
 * @param key The key's `KEY_` kind.
 * @param code The code point for `KEY_CHAR`; it tells `KEY_CONTROL` and `KEY_UNKNOWN` keys apart
 *   too, and is ignored for the other kinds.
 * @returns True from the key's press until its release, real or synthetic, or a loss of focus.
 */
export const inputDown = (input: InputFrame, key: i32, code: i32): boolean => input.keys.isDown(key, code)
