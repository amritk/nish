// A request, and a callee that stores an array into the first request of a
// batch it is handed.
export class Req {
  path: string = "/"
  tags: string[] = []
}

export const tagFirst = (rs: Req[], tag: string): void => {
  rs[0].tags = [tag]
}
