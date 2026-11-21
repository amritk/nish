#include <stddef.h>
#include <stdint.h>

#define WC_MAX_WORD 64
#define WC_NAME "wc"
enum wc_mode { WC_BYTES, WC_WORDS = 2 };

typedef struct counter counter;
struct wc_span { int64_t start; int64_t len; };

counter *wc_new(enum wc_mode mode);
int wc_feed(counter *c, const char *text);
int64_t wc_total(counter *c, int64_t *words);
int wc_last(counter *c, struct wc_span *span);
char *wc_report(counter *c);
void wc_free(counter *c);
void wc_free_report(char *r);
int wc_log(const char *format, ...);
