// The helper lives in its own module and answers `g.value` from an expression
// body: its whole body is its answer, judged as `return g.value` is.
import { MutexGuard } from "nish/threads";

export class Box {
  s: string = "first";
}

export const grab = (g: MutexGuard<Box>): Box => g.value;
