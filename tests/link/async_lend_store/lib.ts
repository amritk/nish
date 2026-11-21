// The request a server holds per connection, and a handler that keeps a
// piece of it: `remember` stores the array it is given into the request.
export class Req {
  path: string = "/"
  tags: string[] = []
}

export const remember = (r: Req, tag: string): void => {
  r.tags = [tag]
}

export const pathOf = (r: Req): string => r.path
