// The interface half of `reject_cls_static`: one `collectField` serves a class
// and an interface, so the rule holds here too and the sentence says which kind
// it is. It needs its own case because the *code* is shared with the class
// sentence, and a code a case already covers proves nothing about a sentence no
// case reaches — which is how a `static` constructor once slipped through
// (docs/wp19-stage0-retirement.md R3).
export interface Config {
  static size: i32;
}
