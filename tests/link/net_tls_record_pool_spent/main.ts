// A `TlsRecordReader` that borrows from a shared pool (`borrowFrom`, as
// `TlsRecordServer` points its slots' readers) takes a buffer at its first
// byte. With every buffer of that pool lent to another reader, `push` answers
// `-TLS_ALERT_INTERNAL_ERROR` and takes nothing, rather than panicking in the
// pool. Once the other reader gives its buffer back, the same push is taken.
// Without the test in `push` the spent pool would panic: exit 1.
import { BufferPool } from "nish/net/buffer-pool";
import { TLS_ALERT_INTERNAL_ERROR } from "nish/net/tls/codec";
import { TLS_MAX_RECORD, TlsRecordReader } from "nish/net/tls/record";

export const main = (): i32 => {
  const pool = new BufferPool("Test.reader", TLS_MAX_RECORD, 1);
  const first = new TlsRecordReader();
  const second = new TlsRecordReader();
  first.borrowFrom(pool);
  second.borrowFrom(pool);
  const data: u8[] = [23, 3, 3, 0, 1, 0];
  const start: i32 = 0;
  console.log(`first reader took: ${first.push(data, start, toI32(data.length))}`);
  const refused: i32 = second.push(data, start, toI32(data.length));
  console.log(`second reader, pool spent: ${refused === -TLS_ALERT_INTERNAL_ERROR}`);
  first.reset();
  console.log(`after a give-back: ${second.push(data, start, toI32(data.length))}`);
  return 0;
};
