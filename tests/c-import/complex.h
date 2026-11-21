#include <stdarg.h>
double _Complex c_mag(double _Complex z);
_Complex double c_conj(void);
float _Complex c_f(void);
long double _Complex c_ld(void);
void c_param(int n, _Complex float z);
__int128 big_add(__int128 a);
unsigned __int128 big_u(void);
struct cfield { int n; double _Complex z; };
struct cptr { double _Complex *z; };
int c_vprint(const char *format, va_list args);
typedef double _Complex cplx;
cplx c_typedef(void);
