// `Http1ResponseParser.feed` with a negative offset is refused with
// `HTTP1_E_WINDOW` even when the window's end is inside the buffer: bytes
// before `data[0]` are not the response's. The refusal is final.
import { HTTP1_ERROR } from "nish/net/http1-codec";
import { HTTP1_E_WINDOW, Http1ResponseParser } from "nish/net/http1-client-codec";

export const main = (): i32 => {
  const maxBody: i64 = 1024;
  const p: Http1ResponseParser = new Http1ResponseParser(64, 512, 16, maxBody, 128);
  const data: u8[] = [72, 84, 84];
  const off: i32 = -1;
  const len: i32 = 2;
  console.log("feeding bytes -1 to 1 of a 3-byte array");
  p.feed(data, off, len);
  const text: string = "HTTP/1.1 204 No Content\r\n\r\n";
  const whole: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i += 1) {
    whole.push(toU8(text.charCodeAt(i)));
  }
  p.feed(whole, 0, toI32(whole.length));
  const refused: boolean = p.next() === HTTP1_ERROR;
  console.log(`refused: ${refused}, window error: ${p.error === HTTP1_E_WINDOW}, ${p.buffered()} buffered`);
  return 0;
};
