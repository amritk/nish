/**
 * `nish/runtime/node` exports nothing: importing it installs that host on the
 * core in `nish/runtime` (docs/RUN_UNDER_NODE.md). `nish/runtime/browser`
 * installs its host too, and exports `NishExit` (`browser.d.ts`).
 */
export {};
