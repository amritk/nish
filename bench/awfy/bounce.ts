// This code is derived from the SOM benchmarks, see AUTHORS.md file.
// Ported to Nish from the JavaScript version; licensed as LICENSE.md.

import { Random } from "./som";

class Ball {
  x: i32;
  y: i32;
  xVel: i32;
  yVel: i32;

  constructor(random: Random) {
    this.x = random.next() % 500;
    this.y = random.next() % 500;
    this.xVel = (random.next() % 300) - 150;
    this.yVel = (random.next() % 300) - 150;
  }

  bounce(): boolean {
    const xLimit = 500;
    const yLimit = 500;
    let bounced = false;

    this.x += this.xVel;
    this.y += this.yVel;

    if (this.x > xLimit) {
      this.x = xLimit;
      this.xVel = 0 - Math.abs(this.xVel);
      bounced = true;
    }

    if (this.x < 0) {
      this.x = 0;
      this.xVel = Math.abs(this.xVel);
      bounced = true;
    }

    if (this.y > yLimit) {
      this.y = yLimit;
      this.yVel = 0 - Math.abs(this.yVel);
      bounced = true;
    }

    if (this.y < 0) {
      this.y = 0;
      this.yVel = Math.abs(this.yVel);
      bounced = true;
    }

    return bounced;
  }
}

export class Bounce {
  innerBenchmarkLoop(innerIterations: i32): boolean {
    for (let i = 0; i < innerIterations; i += 1) {
      if (!this.verifyResult(this.benchmark())) {
        return false;
      }
    }
    return true;
  }

  benchmark(): i32 {
    const random = new Random();
    const ballCount = 100;
    let bounces = 0;
    const balls: Ball[] = [];

    for (let i = 0; i < ballCount; i += 1) {
      balls.push(new Ball(random));
    }

    for (let i = 0; i < 50; i += 1) {
      for (const ball of balls) {
        if (ball.bounce()) {
          bounces += 1;
        }
      }
    }
    return bounces;
  }

  verifyResult(result: i32): boolean {
    return result === 1331;
  }
}
