// parseInt / parseFloat / Number over the command line (WP7): the numeric
// arguments are summed three ways; the odd ones out exercise the no-digits
// (0), trailing-garbage (parseFloat keeps the prefix, Number gives NaN) and
// saturation (parseInt clamps into i32) cases.
export function main(): number {
  const args = process.argv;
  let ints = 0;
  let floats: f64 = 0;
  let numbers: f64 = 0;
  for (let i = 1; i < args.length; i++) {
    const p = parseInt(args[i]);
    const f = parseFloat(args[i]);
    const n = Number(args[i]);
    console.log(`${args[i]}: parseInt ${p}, parseFloat ${f}, Number ${n}`);
    ints += p;
    floats += f;
    numbers += n;
  }
  console.log(`ints ${ints}`);
  console.log(`floats ${floats}`);
  console.log(`numbers ${numbers}`);
  console.log(`Number(ints) + Number(true) = ${Number(ints) + Number(true)}`);
  return ints;
}
