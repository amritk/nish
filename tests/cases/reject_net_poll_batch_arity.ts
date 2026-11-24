// NURING-40: `pollWaitBatch` takes its minimum and its maxWaitMs every time;
// there are no optional arguments.
export const main = (): number => pollWaitBatch(pollCreate(), [0, 0], 0, 2);
