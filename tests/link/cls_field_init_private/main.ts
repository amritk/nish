import { Board } from "./board"

export const main = (): i32 => (new Board() !== null ? 0 : 1)
