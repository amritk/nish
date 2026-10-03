// Two named roots. This one needs all five rounds, because Phase 0 reports one
// loose equality per module per round. Each round still loads `b.ts` after
// refusing this file, so `b.ts` is fixed in the first round; if loading stopped
// at this file, `b.ts` would not be reached before the cap.
export const a = (x: i32, y: i32): boolean => x === y || y === x || x !== 0 || y !== 0 || x === 1
