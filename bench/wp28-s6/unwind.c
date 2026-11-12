// S6's landing-pad runtime: the exception object and the personality routine
// the hand-written .ll files name. The unwinder is the toolchain's own
// Itanium one (_Unwind_RaiseException in libgcc_s on Linux, in libSystem's
// libunwind on macOS); the personality is this file rather than a borrowed
// one because __gxx_personality_v0 brings the C++ runtime and its type
// matching with it and __gcc_personality_v0 runs cleanups but never catches.
//
// This is the cheapest a landing-pad throw can be made: the exception object
// is one thread-local, so a throw allocates nothing, and every landing pad is
// a catch-all, so the personality matches no types. A real lowering would add
// to both.
#include <stdint.h>
#include <stdlib.h>
#include <unwind.h>

typedef struct {
  struct _Unwind_Exception header;
  int32_t code;
} NishS6Exception;

static _Thread_local NishS6Exception nish_s6_exception;

// The object `throw.ll` raises, carrying `code`.
void *nish_s6_prepare(int32_t code) {
  // "NISHS6\0\0", the class the ABI wants a language to stamp on its own.
  nish_s6_exception.header.exception_class = 0x4e49534853360000ull;
  nish_s6_exception.header.exception_cleanup = 0;
  nish_s6_exception.code = code;
  return &nish_s6_exception.header;
}

// The i32 that was thrown, read back in a landing pad.
int32_t nish_s6_caught(void *exception) {
  return ((NishS6Exception *)exception)->code;
}

static uint64_t read_uleb(const uint8_t **p) {
  uint64_t value = 0;
  unsigned shift = 0;
  uint8_t byte;
  do {
    byte = *(*p)++;
    value |= (uint64_t)(byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return value;
}

// A call-site table field: LLVM writes them as uleb128 (0x01) on ELF and has
// written udata4 (0x03) on Mach-O.
static uint64_t read_site(const uint8_t **p, uint8_t encoding) {
  if (encoding == 0x01) {
    return read_uleb(p);
  }
  if (encoding == 0x03) {
    uint32_t value;
    __builtin_memcpy(&value, *p, 4);
    *p += 4;
    return value;
  }
  abort();
}

// Finds the call site the frame is stopped in and, if it has a landing pad
// with a catch, lands there with the exception pointer in the first EH
// register. The type table is never read: the only clause these programs have
// is `catch ptr null`.
_Unwind_Reason_Code nish_s6_personality(int version, _Unwind_Action actions, uint64_t exception_class,
                                        struct _Unwind_Exception *exception, struct _Unwind_Context *context) {
  (void)exception_class;
  if (version != 1) {
    return _URC_FATAL_PHASE1_ERROR;
  }
  const uint8_t *p = (const uint8_t *)_Unwind_GetLanguageSpecificData(context);
  if (!p) {
    return _URC_CONTINUE_UNWIND;
  }
  int ip_before = 0;
  uintptr_t ip = _Unwind_GetIPInfo(context, &ip_before);
  if (!ip_before) {
    ip--;
  }
  uintptr_t start = _Unwind_GetRegionStart(context);
  // The header: where landing pads are relative to (omitted, so the function
  // start), the type table's encoding and offset (skipped), the call-site
  // encoding and the table's length.
  if (*p++ != 0xff) {
    abort();
  }
  if (*p++ != 0xff) {
    read_uleb(&p);
  }
  uint8_t site_encoding = *p++;
  uint64_t table_length = read_uleb(&p);
  const uint8_t *end = p + table_length;
  while (p < end) {
    uint64_t site_start = read_site(&p, site_encoding);
    uint64_t site_length = read_site(&p, site_encoding);
    uint64_t landing_pad = read_site(&p, site_encoding);
    uint64_t action = read_uleb(&p);
    uint64_t offset = ip - start;
    if (offset < site_start || offset >= site_start + site_length) {
      continue;
    }
    // No pad: the call is not under a try. Action 0 is a cleanup, which these
    // programs never emit and a search must not stop at.
    if (landing_pad == 0 || action == 0) {
      return _URC_CONTINUE_UNWIND;
    }
    if (actions & _UA_SEARCH_PHASE) {
      return _URC_HANDLER_FOUND;
    }
    _Unwind_SetGR(context, __builtin_eh_return_data_regno(0), (uintptr_t)exception);
    _Unwind_SetGR(context, __builtin_eh_return_data_regno(1), 0);
    _Unwind_SetIP(context, start + landing_pad);
    return _URC_INSTALL_CONTEXT;
  }
  return _URC_CONTINUE_UNWIND;
}
