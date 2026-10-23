// Plays the browser game without a browser: loads game.wasm through the
// loader nish wrote next to it, lets an autopilot steer the paddle under the
// ball for a fixed number of 60 Hz frames, and prints what happened. The run is
// deterministic, so tests/run.js checks its output.
//
//   node examples/browser-game/headless.mjs build/browser-game [frames]
//
// The build commands are at the top of main.ts.
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const dir = resolve(process.argv[2] ?? "build/browser-game")
const frames = Number(process.argv[3] ?? 10800) // three minutes at 60 Hz
const { load } = await import(pathToFileURL(join(dir, "game.mjs")).href)
const game = await load(readFileSync(join(dir, "game.wasm")))

const ACTION = 4
const BALL_X = 1 // the state slot main.ts keeps the ball's x in
const state = new Float64Array(game.stateLength())
const pixels = new Int32Array(game.screenWidth() * game.screenHeight())
game.newGame(state)

let levelsCleared = 0
let livesLost = 0
let lastLives = game.lives(state)
for (let frame = 0; frame < frames; frame++) {
  // Tap the action key every other frame: it serves, and moves on from a
  // cleared level or a lost game.
  const input = frame % 2 === 0 ? ACTION : 0
  // Aim a little off the ball's centre, sweeping side to side, so the ball
  // leaves the paddle at changing angles and reaches every column.
  const aim = state[BALL_X] + (((frame / 90) | 0) % 5) * 4 - 8
  const before = game.mode(state)
  game.step(state, 1 / 60, input, aim)
  if (before !== 2 && game.mode(state) === 2) {
    levelsCleared++
  }
  const lives = game.lives(state)
  if (lives < lastLives) {
    livesLost++
  }
  lastLives = lives
}
game.render(state, pixels)

// FNV-1a over the frame, so a change to the renderer shows up as a new number.
let hash = 0x811c9dc5
for (const p of pixels) {
  hash ^= p
  hash = Math.imul(hash, 0x01000193)
}
console.log(`frames ${frames}`)
console.log(`score ${game.score(state)}`)
console.log(`level ${game.level(state)}, cleared ${levelsCleared}`)
console.log(`lives ${game.lives(state)}, lost ${livesLost}`)
console.log(`bricks left ${game.bricksLeft(state)}`)
console.log(`frame hash ${(hash >>> 0).toString(16).padStart(8, "0")}`)
