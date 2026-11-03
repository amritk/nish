// NL2610: an outer string handed to a constructor that keeps it: the
// region's memory would point at memory outside it.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Grant {
  host: string;
  constructor(host: string) {
    this.host = host;
  }
}

class Game {
  host: string;
  constructor(host: string) {
    this.host = host;
  }
}

const open = (g: Grant): Game => new Game(g.host);

export const main = (): i32 => {
  const g = new Grant("example");
  const r = regionWith(g, open);
  free(r);
  return 0;
};
