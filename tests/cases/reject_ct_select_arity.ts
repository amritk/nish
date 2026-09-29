// WP34 N6: ctSelect takes the mask and both candidates (NL2060).
export const pick = (mask: u32, a: u32): u32 => ctSelect(mask, a);
