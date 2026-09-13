// NL2226: the catch-all for an exported statement that is neither a function,
// class, interface nor constant. It names the statement's own kind, so the
// message says which one was written. `export import A = require(...)` is what
// reaches it now that WP23 gave the exported enum a rule of its own (NL2288).
export import A = require("./wordings_lib");
