// WP40: `pkg_app` calls `pkg_http`, which reaches `net`. The root package
// grants `pkg_http` alone, so `pkg_app`, which reaches `net` through it, is
// refused: what a dependency reaches through another is its own.
import { fetchPage } from "pkg_app";

export const main = (): i32 => (process.argv.length > 99 ? fetchPage(1) : 0);
