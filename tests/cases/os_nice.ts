// `setNice(n)` is lower-only, as root too: `n` takes 0..19, anything else is
// -22 with no system call, and a value below the current nice value is -13
// with none either. `setIdlePriority` moves the case's own process to
// SCHED_IDLE on Linux and is -95 elsewhere; it never raises. `os_nice.c`
// calls each export in turn and reads the kernel's state back with
// `getpriority` and `sched_getscheduler`. The two `ps` checks show that a
// child started afterwards inherits the nice value and the idle class.
export const lower = (): i32 => setNice(1);
export const above = (): i32 => setNice(20);
export const negative = (): i32 => setNice(-1);
export const below = (): i32 => setNice(0);
export const childNice = (): i32 => spawnSync(["sh", "-c", 'test "$(ps -o nice= -p $$)" -eq 1']);
export const idle = (): i32 => setIdlePriority();
export const childClass = (): i32 => spawnSync(["sh", "-c", 'test "$(ps -o cls= -p $$)" = IDL']);
