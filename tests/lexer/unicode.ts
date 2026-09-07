// Byte offsets, not code points: every position below is several bytes wide,
// and the oracle maps the scanner's UTF-16 indices through the same encoding.
const café = "café";
const 日本 = "日本語のテキスト";
const emoji = "🎉 party";
const mixed = `héllo ${café} 🎉`;
// Comment with späti and 🎉 in it.
const after = 1;
