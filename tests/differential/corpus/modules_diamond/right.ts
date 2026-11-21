import { base } from "./common";
import { mainConstant } from "./main";

export const rightValue = (): number => {
  return base() * 3 + mainConstant();
};
