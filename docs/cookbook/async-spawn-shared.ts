import { sleep, spawn } from "nish:async";

class Tally {
  hits: i32 = 0;
}

async function count(tally: Tally, n: i32): Promise<void> {
  await sleep(n);
  tally.hits = tally.hits + n;
}

async function start(tally: Tally): Promise<void> {
  spawn(count(tally, 5));
}

export async function main(): Promise<i32> {
  const tally = new Tally();
  await start(tally);
  await sleep(10);
  return tally.hits;
}
