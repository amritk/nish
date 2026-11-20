#include <stddef.h>
#include <stdint.h>
typedef struct db db;
int db_open(const char *path, db **out);
void db_close(db *d);
char *db_error(db *d);
void db_free_error(char *message);
char *db_path(db *d) __attribute__((returns_nonnull));
const char *db_name(db *d);
int64_t db_write(db *d, const void *data, size_t len);
int64_t db_read(db *d, void *into, size_t cap);
int db_rename(db *d, const char *name);
uint8_t db_flags(db *d, uint16_t mask, unsigned long long seed, float scale);
signed char db_tiny(short s);
int internal_helper(int x);
