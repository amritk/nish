// The template is here and its constraint is `./main`'s `Shape`, imported back
// across the cycle. Every instantiation is defined in this module.
import { Shape } from "./main";

export const areaOf = <T extends Shape>(shape: T): i32 => shape.area;
