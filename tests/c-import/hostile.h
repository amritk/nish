/* Names and text a module must not copy: each is listed, never written. */

#include <limits.h>

/* `$` is a byte clang takes in a name and Nish does not. */
int get$value(int x);

/* A Cyrillic letter that looks like a Latin one. */
int pаss(int x);

/* A struct whose name, and one whose field's name, is not an ASCII identifier. */
struct wіdget { int a; };
void use_widget(struct wіdget *w);
struct box { int ok; int $bad; };
void use_box(struct box *b);

/* An enumerator whose name holds `$`. */
enum mode { MODE_A, MODE_$B };

/* String macros: printable ASCII is copied, anything else is listed. */
#define GREETING "hello"
#define SNEAKY "admin‮txt.exe"
#define CAFE "café"
#define TABBED "a	b"
#define RUBOUT "ab"

/* A macro name that runs on past `$`: listed whole, never read as limits.h's INT_MAX. */
#define INT_MAX$X 0

/* A macro name outside ASCII: listed by line, never written as a name. */
#define CAFÉ_ONE 1
