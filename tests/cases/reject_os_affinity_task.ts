// `setCpuAffinity` changes the calling thread's CPU mask, which Linux keeps
// per thread, so a `scope()` task may not pin one worker of the pool.
import { scope } from "nish/threads";

const pin = (cpu: i32): i32 => setCpuAffinity(cpu);

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(pin, 0, out, 0);
  }
  return out[0];
};
