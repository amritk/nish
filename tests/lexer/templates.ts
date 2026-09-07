// Nested and adjacent templates: the brace-depth stack is the only thing that
// tells a substitution's `}` from a block's, and this is where it earns its
// keep. Nothing here has to be valid StaticTS — the lexer has no opinions.
const a = `plain`;
const b = `head${1}tail`;
const c = `x${`inner${2}`}y`;
const d = `${ { k: `${3}` } }`;
const e = `a${1}b${2}c${3}d`;
const f = `esc \` \${ \n \\ done`;
const g = `${ (() => { const q = 1; return q; })() }`;
const h = ``;
const i = `${1}`;
