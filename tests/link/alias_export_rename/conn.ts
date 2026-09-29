export class Socket {
  fd: i32;

  constructor(fd: i32) {
    this.fd = fd;
  }
}

export type Conn = Socket | null;

export const dial = (fd: i32): Conn => (fd > 0 ? new Socket(fd) : null);
