/* Enums whose values do or do not fit the type a Nish constant takes. */
enum small { SMALL_A, SMALL_B = 7, SMALL_C };
enum high { HIGH_A = 0x80000000u, HIGH_B };
enum wide { WIDE_A = 0x100000000, WIDE_B };
enum huge { HUGE_A = 0xFFFFFFFFFFFFFFFFull };
enum top { TOP_A = 0x7FFFFFFFFFFFFFFF, TOP_B };
enum cast { CAST_A = (unsigned char)3, CAST_B };
enum __attribute__((packed)) narrow { NARROW_A, NARROW_B };

int take_small(enum small s);
int take_high(enum high h);
int take_wide(enum wide w);
int take_narrow(enum narrow n);
int take_cast(enum cast c);

/* The pointee is a const pointer: the callee writes through neither level. */
int read_names(char *const *names, int count);

/* Doc comments on enumerators are not values: DOC_B counts on from DOC_A. */
enum documented {
  /** The first. */
  DOC_A = 5,
  /** The second, implicit. */
  DOC_B,
};

/* `enum high;` again after its definition names the same enum, so it stays unsigned. */
enum high;
int take_high_again(enum high h);
