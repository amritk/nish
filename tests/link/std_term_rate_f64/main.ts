// `nish/term-rate` under `--number-mode f64` (see `args`): the module spells
// every width it uses, so a program whose untyped numbers are doubles drives the
// same decisions as the `i32` build in `std_term_rate`. The counts it passes are
// typed `i32` consts, because a bare literal is a `number` here.
import { RateController, RateOptions } from "nish/term-rate";

const BYTES: i32 = 20000;
const TWO: i32 = 2;
const FPS: i32 = 60;

// Sends whenever the controller allows over `ms` milliseconds of a link with a
// `rttMs` round trip and `bytesPerSec` of bandwidth, answering each frame as it
// lands, then prints what the controller decided.
const drive = (name: string, c: RateController, rttMs: number, bytesPerSec: number, ms: number): void => {
  const acks: number[] = [];
  let next: i32 = 0;
  let maxUnacked: i32 = 0;
  let last = 0;
  for (let now = 0; now < ms; now += 1) {
    while (next < toI32(acks.length) && acks[next] <= now) {
      c.ackReceived(now);
      next++;
    }
    c.tick(now);
    if (c.mayDraw(now)) {
      c.frameSent(BYTES, 2000000, now);
      // A link answers in order, so a frame lands no sooner than the one before it.
      last = Math.max(last, now + rttMs + (toF64(BYTES) * 1000) / bytesPerSec);
      acks.push(last);
      if (c.unacked() > maxUnacked) {
        maxUnacked = c.unacked();
      }
    }
  }
  const d = c.decision();
  const s = c.stats();
  console.log(
    `${name}: fps ${d.fps}, divisor ${d.resolutionDivisor}, backend ${d.backendCap}, palette256 ${d.palette256}, most unacked ${maxUnacked}, dropped ${s.dropped}, queue ${c.sentMs.length}`
  );
};

export const main = (): i32 => {
  drive("fast", new RateController(new RateOptions()), 2, 100000000, 20000);
  drive("slow", new RateController(new RateOptions()), 120, 200000, 20000);
  const behind = new RateOptions();
  behind.maxUnacked = TWO;
  behind.fixedFps = FPS;
  drive("behind", new RateController(behind), 25, 50000000, 30000);
  return 0;
};
