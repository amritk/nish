/*
 * WP89 S3b: a doc comment directly before a declaration lands on the binding
 * `nish c-import` writes for it, so a generated module documents what it
 * exports. A comment the module's own comment could not hold is dropped
 * whole, and so is every comment that is not a doc comment.
 */

/** A window the library owns. */
typedef struct doc_window doc_window;

/**
 * A point on the window.
 *
 * Both coordinates count from the top left.
 */
struct doc_point {
  int x;
  int y;
};

/** The shapes the library draws. */
enum doc_shape {
  /** A filled square. */
  DOC_SQUARE = 1,
  DOC_CIRCLE = 2, /**< a trailing comment, which is not carried */
  /** A line: café is non-ASCII, which the module's comment does not hold. */
  DOC_LINE = 3
};

/** The widest window, in pixels. */
#define DOC_MAX_WIDTH 4096

// A line comment is not a doc comment.
#define DOC_MAX_HEIGHT 2160

/* Neither is a plain block comment. */
#define DOC_DEPTH 32

/** A comment a blank line above stays where it is. */

#define DOC_FPS 60

/**
 * Opens a window.
 *
 * @param width the width in pixels
 * @param height the height in pixels
 * @returns the window, or null when it cannot open
 */
doc_window *doc_open(int width, int height);

/** Closes `w`. */
void doc_close(doc_window *w);

/** A doc comment	with a tab, which the module's comment does not hold. */
int doc_count(void);

int doc_plain(void); /* nothing above it */
