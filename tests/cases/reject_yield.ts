// Phase 0: no coroutine runtime, so there is nothing for `yield` to suspend.
export const f = (): number => {
  yield 1;
  return 0;
};
