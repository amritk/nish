const char * _Nonnull * get_names(void);
typedef char * _Nonnull nn_t;
nn_t *nn_list(void);
nn_t nn_one(void);
char * _Nullable may_name(void);
char * _Nonnull must_name(void);
int * _Nullable * _Nonnull grid(void);
const int *first_int(const int *values);
const double *weights(const double * _Nonnull w);

/* `returns_nonnull` on a later declaration marks the function. clang keeps
   the first declaration's nullability, so a later `_Nonnull` changes nothing. */
int *later_rn(void);
__attribute__((returns_nonnull)) int *later_rn(void);
int *later_nn(void);
int *_Nonnull later_nn(void);
