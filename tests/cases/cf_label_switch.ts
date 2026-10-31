// A `break` that names the loop around a `switch` leaves both at once, and a
// labelled `continue` from a clause goes to the next turn of the loop it
// names; a `break` that names the `switch` leaves only the switch.
function run(ops: number[]): number {
  let acc = 0;
  loop: for (const op of ops) {
    sw: switch (op) {
      case 0:
        break loop;
      case 1:
        acc += 1;
        continue loop;
      case 2:
        if (acc > 3) {
          break sw;
        }
        acc += 10;
        break;
      default:
        acc += 100;
    }
    acc += 1000;
  }
  return acc;
}

export function test(): number {
  return run([1, 2, 5, 1, 2, 0, 7]);
}
