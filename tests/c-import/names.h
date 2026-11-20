struct stat { long st_size; };
int stat(const char *path, struct stat *buf);
typedef struct { int a; } pair;
struct pair { int b; };
struct string { int len; };
struct Array { int n; };
struct kw { int this; int prototype; int type; int delete; };
int eval(int x);
int new(int x);
int OutI64(void);
enum nz { null, undefined, ok_value };
int width(void);
#define width 3
#define OutI32 1
#define let 2
#define ok_value 9
#define FINE 4

/* A reserved parameter name renamed with `_` stays distinct from one already named so. */
int two_in(int in, int in_);
int two_in_rev(int in_, int in);
