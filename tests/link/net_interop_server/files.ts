// What the interop server serves: the files of one directory, as the
// quic-interop-runner mounts it at `/www`, or, with none, one short text for
// every path.
import { httpFieldBytes } from "nish/net/http-fields";
import { textOf } from "../crypto_x509/hex";

/** The body every GET answers when no directory was given. */
export const HELLO: string = "hello from nish interop\n";

/** Whether `path` names a file under the root: absolute, and no `..` or backslash in it. */
export const safePath = (path: string): boolean => path.startsWith("/") && path.indexOf("/..") < 0 && path.indexOf("\\") < 0;

/** The files of `www`, or `HELLO` for every path when `www` is "". */
export class InteropFiles {
  www: string;
  /** The content type of what `get` answers. */
  type: string;

  constructor(www: string) {
    this.www = www;
    this.type = www === "" ? "text/plain" : "application/octet-stream";
  }

  /** The body of a GET for `path`, the request's `:path` bytes: the file, `HELLO`, or `null` when there is no such file. */
  get(path: u8[]): u8[] | null {
    if (this.www === "") {
      return httpFieldBytes(HELLO);
    }
    const text: string = textOf(path);
    return safePath(text) ? readFileBytesSync(`${this.www}${text}`) : null;
  }
}
