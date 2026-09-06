import { base } from "./common";
import { mainConstant } from "./main";

export function rightValue(): number {
  return base() * 3 + mainConstant();
}
