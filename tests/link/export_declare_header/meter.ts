// The program's own export. Its method `Meter.read` is spelled `Meter_read`
// in C, the identifier of the binding it calls: a header that took the
// binding for an export too would declare one identifier twice, and the
// compile would be refused as a clash.
import { CMeter, meter_new, Meter_read, meter_free } from "./sys"

export class Meter {
  start: i32
  constructor(start: i32) {
    this.start = start
  }
  read(): i32 {
    const m: CMeter | null = meter_new(this.start)
    if (m === null) {
      return -1
    }
    const n = Meter_read(m)
    meter_free(m)
    return n
  }
}
