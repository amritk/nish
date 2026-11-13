// NL3057: a dependency written for the compatibility dialect cannot be part of
// a program whose root package builds the strict one. The root is the ceiling.
import { twice } from "pkg_loose";

export const main = (): i32 => twice(21) - 42;
