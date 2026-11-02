import { Region, enter, free, region } from "nish:region"

class Session {
  hits: i32 = 0
}

const open = (): Session => new Session()
const touch = (s: Session): i32 => {
  s.hits = s.hits + 1
  return s.hits
}

export const serveOnce = (): i32 => {
  const r: Region<Session> = region(open)
  const n = enter(r, touch)
  free(r)
  return n
}
