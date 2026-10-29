---
name: Lower-only setNice and setIdlePriority
overview: setNice and setIdlePriority already ship in nish:process (PR #985). This closes the gap to the request: setNice accepts only 0..19 and refuses any raise, even as root, and both get a native test that reads the kernel's state back with getpriority and sched_getscheduler. Capability, wasm refusal and the .d.ts/.h surface are already in place and are kept.
stages:
  - id: lower-only
    title: "setNice refuses any raise and out-of-range values"
    goal: setNice(n) answers -22 outside 0..19 and -13 when n is below the current nice value, with no setpriority call on either path; a native case reads getpriority and sched_getscheduler back after each call
    verification: npm run check && npm run lint && node tests/run.js os_nice && node tests/run.js caps_process_nice && node tests/run.js reject_os && node tests/run.js wasi
    status: pending
    todos:
      - id: runtime-range-and-raise
        content: In nish_set_nice (runtime/runtime-os.c) reject n outside 0..19 with -EINVAL, read getpriority(PRIO_PROCESS, 0) with errno cleared, and reject n below it with -EACCES before calling setpriority — see Owns
        status: pending
      - id: header-and-dts
        content: Update the contract comments on nish_set_nice in runtime/nish.h and on setNice in runtime/nish.d.ts (both the global and nish:process forms) to the 0..19 lower-only rule
        status: pending
      - id: native-case
        content: Add tests/cases/os_nice.c, the native driver that reads getpriority and sched_getscheduler after setNice and setIdlePriority, and rewrite tests/cases/os_nice.ts so root no longer expects a raise to succeed
        status: pending
      - id: docs
        content: Replace the clamping sentence in docs/LANGUAGE.md (Scheduling section, the setNice row), docs/AI.md (the scheduling paragraph) and docs/guide/using-nish/standard-library.md (the setNice paragraph) with the 0..19 lower-only contract and the -22 / -13 answers
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens/checked for os_nice with node tests/self/goldens.js --update and read the diff; regenerate tests/cases/os_nice.ll with UPDATE_GOLDENS=1 node tests/run.js os_nice
        status: pending
      - id: budget
        content: If runtime-os.c's .text size moves past its ceiling in tests/runtime-budgets.js, raise the ceiling with the measured figure and say so in the commit body
        status: pending
    Owns: runtime/runtime-os.c, runtime/nish.h, runtime/nish.d.ts, tests/cases/os_nice.ts, tests/cases/os_nice.c, tests/cases/os_nice.ll, tests/self/goldens/checked/tests/cases/os_nice.ts.txt, tests/runtime-budgets.js, docs/LANGUAGE.md, docs/AI.md, docs/guide/using-nish/standard-library.md
---

# Lower-only setNice and setIdlePriority

## What exists

- `nish_set_nice` and `nish_set_idle_priority` in `runtime/runtime-os.c`
  (PR #985), the builtins in `src/builtins.ts` and `src/emit-builtins.ts`,
  the `process.spawn` row in `src/capabilities.ts`, the wasm refusal
  (`refuseOnWasm`), and the Node throw in `runtime/nish.mjs`.
- Tests: `os_nice`, `caps_process_nice`, `reject_os_nice_wasm`,
  `reject_os_idle_wasm`, `reject_os_nice_task`.

## What changes

`setNice` today hands `n` to `setpriority` unchecked. The kernel clamps it to
-20..19, so `setNice(-20)` succeeds as root and raises priority, and
`tests/cases/os_nice.ts` asserts that it does. The request is that the call
only ever lowers priority and takes 0..19. So:

1. `n < 0` or `n > 19`: `-EINVAL` (-22), no system call.
2. `n` below the current nice value (read with `getpriority`): `-EACCES`
   (-13), no system call. This applies to root too.
3. Otherwise `setpriority(PRIO_PROCESS, 0, n)`, answering 0 or `-errno`.

`setIdlePriority` already only lowers (it moves to `SCHED_IDLE`) and needs no
code change. Its test reads the class back with `ps`; the native driver reads
`sched_getscheduler(0)` instead.

## Acceptance criteria

1. `setNice(n)` with `n` outside 0..19 answers -22 and leaves the nice value unchanged, read back with `getpriority`.
2. `setNice(n)` with `n` below the current nice value answers -13 and leaves the value unchanged, as root and as an unprivileged user alike.
3. `setNice(n)` with `n` in 0..19 at or above the current value answers 0, and `getpriority(PRIO_PROCESS, 0)` then reads `n`.
4. `setIdlePriority()` answers 0 on Linux, and `sched_getscheduler(0)` then reads `SCHED_IDLE`. It answers -95 elsewhere. It never raises.
5. Both builtins still refuse on wasm32 and wasi at compile time (`reject_os_nice_wasm`, `reject_os_idle_wasm` stay green).
6. Both stay `process.spawn` in the capability report (`caps_process_nice` stays green).
7. `docs/LANGUAGE.md`, `docs/AI.md` and the guide page state the 0..19 lower-only contract and the -22 / -13 answers, and no longer say the kernel clamps.
