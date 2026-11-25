import { Box } from "./use"

/** Swaps the box's bins for its shorter spare. */
export const shrink = (s: Box): i32 => {
  s.bins = s.spare
  return 0
}
