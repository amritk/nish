/* Opaque structs: each one a bound function returns is its own class. */
#include <stddef.h>
struct conn;
struct conn *conn_open(const char *host);
int conn_send(struct conn *c, const char *msg, size_t len);
void conn_close(struct conn *c);

/* A second opaque struct is a second class, never the first one. */
typedef struct chan chan;
chan *conn_chan(struct conn *c, int id);
int chan_id(const chan *ch);

/* Reached through a pointer to a pointer: only a CPtr stands for it. */
typedef struct stmt stmt;
int stmt_prepare(struct conn *c, const char *sql, stmt **out);
stmt *stmt_next(stmt *s);
void stmt_done(stmt *s);

/* A field of a bound struct points to it: a field holds only a CPtr. */
struct inner;
struct outer { struct inner *in; int n; };
struct inner *outer_inner(struct outer *o);

/* No bound function returns it, so no value of a class could exist. */
struct ghost;
void ghost_poke(struct ghost *g);

/* Returned owned (the override file says so): an owned result is a CPtr. */
struct blob;
struct blob *blob_make(size_t n);
void blob_free(struct blob *b);

/* Declared again later: still one struct, one class. */
struct later;
struct later *later_get(void);
struct later;
void later_put(struct later *l);

/* Its name is a function's too, so the class could not take it. */
struct chan_id;
struct chan_id *chan_id_of(chan *ch);
