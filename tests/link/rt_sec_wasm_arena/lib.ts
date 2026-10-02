// The line this program prints for a step that did not run, so a missing tool
// reads as itself rather than as four absent probe lines.
export const failed = (step: string, status: number): string => `${step} failed: ${status}`;
