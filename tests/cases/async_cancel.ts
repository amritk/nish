// WP49 stage 5, part 7: cancelling a task, and bounding a descriptor wait.
// `quiet` waits on a UDP socket nothing writes to, for at most 5 ms: the wait
// answers false and the task is not cancelled. `parked` sleeps for a second,
// having stored its handle where `main` reads it; `main` cancels it with
// `cancel`, so the sleep answers false at once. `nap` cancels itself after
// 10 ms with `cancelAfter`, so its one-second sleep answers false, and its next
// wait answers false without waiting. `main`'s own handle is 0 and cancelling
// it does nothing. Every line prints long before a second has passed.
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
  spawn(nap())
  await quiet(fd)
  await sleep(30)
  netClose(fd)
  return 0
}
