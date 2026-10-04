// A key written twice in a capability policy is refused at the second one
// (NL3032): reading both would union the lists and widen the policy, and
// keeping either would ignore what the other says.
export const main = (): i32 => 0;
