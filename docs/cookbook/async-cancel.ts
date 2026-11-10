import {
  cancel,
  cancelAfter,
  cancelled,
  readableWithin,
  sleep,
  spawn,
  taskId,
  writableWithin,
} from "nish:async"
import { netClose, udpBind } from "nish:net"

class Slot {
  id: i64 = 0
}

const quiet = async (fd: i32): Promise<void> => {
  const ready = await readableWithin(fd, 5)
  const open = await writableWithin(fd, 5)
  console.log(`quiet: ready ${ready}, open ${open}, cancelled ${cancelled()}`)
}

const parked = async (slot: Slot): Promise<void> => {
  slot.id = taskId()
  const slept = await sleep(1000)
  console.log(`parked: slept ${slept}, cancelled ${cancelled()}`)
}

const nap = async (): Promise<void> => {
  const armed = cancelAfter(taskId(), 10)
  const slept = await sleep(1000)
  const again = await sleep(1000)
  console.log(`nap: armed ${armed}, slept ${slept}, again ${again}, cancelled ${cancelled()}`)
}

export const main = async (): Promise<i32> => {
  const fd = udpBind("127.0.0.1", 0, 0)
  if (fd < 0) {
    console.log(`bind failed: ${fd}`)
    return 1
  }
  const slot = new Slot()
  spawn(parked(slot))
  console.log(
    `main: ${taskId()}, cancel main ${cancel(taskId())}, cancel parked ${cancel(slot.id)}, again ${cancel(slot.id)}`
  )
  spawn(nap())
  await quiet(fd)
  await sleep(30)
  netClose(fd)
  return 0
}
