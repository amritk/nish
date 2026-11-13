// WP49 stage 5, part 7: cancelling a task, and bounding a descriptor wait.
// `quiet` waits on a UDP socket nothing writes to, for at most 5 ms: the wait
// answers false and the task is not cancelled. `parked` sleeps for a second,
// having stored its handle where `main` reads it; `main` cancels it with
// `cancel`, so the sleep answers false at once. `nap` cancels itself after
// 10 ms with `cancelAfter`, so its one-second sleep answers false, and its next
// wait answers false without waiting. `main`'s own handle is 0 and cancelling
// it does nothing. Every line prints long before a second has passed.
//
// The print order is structural, not timed: `nap` is spawned only after
// `await quiet(fd)` returns, so `quiet:` is printed before `nap` exists. The
// one clock left is `main`'s closing sleep, which must outlast `nap`'s 10 ms
// cancellation; 200 ms leaves a wide margin on a loaded runner and stays far
// under the one-second sleeps. When the two waits raced from the same moment,
// a slow machine printed `nap:` first.
import { cancel, cancelAfter, cancelled, readableWithin, sleep, spawn, taskId, writableWithin } from "nish:async"
import { netClose, udpBind } from "nish:net"

class Slot {
  id: i64 = 0
}

async function quiet(fd: i32): Promise<void> {
  const ready = await readableWithin(fd, 5)
  const open = await writableWithin(fd, 5)
  console.log(`quiet: ready ${ready}, open ${open}, cancelled ${cancelled()}`)
}

async function parked(slot: Slot): Promise<void> {
  slot.id = taskId()
  const slept = await sleep(1000)
  console.log(`parked: slept ${slept}, cancelled ${cancelled()}`)
}

async function nap(): Promise<void> {
  const armed = cancelAfter(taskId(), 10)
  const slept = await sleep(1000)
  const again = await sleep(1000)
  console.log(`nap: armed ${armed}, slept ${slept}, again ${again}, cancelled ${cancelled()}`)
}

export async function main(): Promise<i32> {
  const fd = udpBind("127.0.0.1", 0, 0)
  if (fd < 0) {
    console.log(`bind failed: ${fd}`)
    return 1
  }
  const slot = new Slot()
  spawn(parked(slot))
  console.log(`main: ${taskId()}, cancel main ${cancel(taskId())}, cancel parked ${cancel(slot.id)}, again ${cancel(slot.id)}`)
  await quiet(fd)
  spawn(nap())
  await sleep(200)
  netClose(fd)
  return 0
}
