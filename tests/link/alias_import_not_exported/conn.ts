export class Socket {
  fd: i32 = 0;
}

type Conn = Socket | null;

export const none = (): Conn => null;
