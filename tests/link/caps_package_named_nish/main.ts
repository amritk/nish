// WP35: a dependency that calls itself `nish`, beside the standard library.
// The report tells them apart by where each module was resolved, not by the
// package name, so the dependency keeps its own path, relative to this
// directory, and its own entry, and `std/text.ts` keeps the library's name.
// Nothing refuses such a package; this pins that the report does not confuse
// the two. The exit code is `trim("  ab  ")`'s length plus the dependency's 3.
import { trim } from "nish/text";
import { three } from "nish";

export const main = (): i32 => toI32(trim("  ab  ").length) + three();
