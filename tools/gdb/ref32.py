# gdb pretty-printer for a Nish compact class's links (WP48).
#
# A link field of a class that `implements Compact` is stored as a 32-bit
# offset, not a pointer, and `-g` types it `ref32 <Class>`. This printer shows
# such a field as the object it names: `null` for offset 0, else a `<Class> *`
# you can dereference.
#
# Load it in gdb with
#
#     (gdb) source tools/gdb/ref32.py
#
# or put that line in ~/.gdbinit. Then `print *cell` shows `next = (Cell *)
# 0x40000068`, and `print *$ref32(cell->next)` follows the link.
#
# The decode depends on the target the program was built for, as the compiler
# chooses it (`zeroBasedLinks` in src/target.ts): on `*-linux-gnu` a link is
# zero-based, the address being `offset << 2`; everywhere else (macOS) it is
# based, `nish_ref_base + (offset << 2)`. The printer asks gdb for the
# inferior's OS ABI; `set nish-ref32-shape zero|based` overrides that.

import gdb

PREFIX = "ref32 "


class ShapeParameter(gdb.Parameter):
    """How a compact link decodes: auto (by OS ABI), zero or based."""

    set_doc = "Set how a Nish compact link decodes."
    show_doc = "Show how a Nish compact link decodes."

    def __init__(self):
        super().__init__("nish-ref32-shape", gdb.COMMAND_DATA, gdb.PARAM_ENUM, ["auto", "zero", "based"])
        self.value = "auto"


SHAPE = ShapeParameter()


def zero_based():
    """Whether links decode zero-based: the inferior is GNU/Linux, or the user said so."""
    if SHAPE.value != "auto":
        return SHAPE.value == "zero"
    return "GNU/Linux" in gdb.execute("show osabi", to_string=True)


def link_type(value):
    """The `ref32 <Class>` typedef `value` is declared with, or None when it is not a link."""
    t = value.type.unqualified()
    while t.code == gdb.TYPE_CODE_TYPEDEF:
        if t.name is not None and t.name.startswith(PREFIX):
            return t
        t = t.target().unqualified()
    return None


def target_type(link):
    """The `<Class> *` a `ref32 <Class>` typedef names, or None when gdb has no such struct."""
    name = link.name[len(PREFIX):]
    for spelling in ("struct " + name, name):
        try:
            return gdb.lookup_type(spelling).pointer()
        except gdb.error:
            pass
    return None


def offset_of(value):
    return int(value) & 0xFFFFFFFF


def decode(value):
    """The address a link names, 0 for null, or None when `nish_ref_base` cannot be read."""
    offset = offset_of(value)
    if offset == 0:
        return 0
    if zero_based():
        return offset << 2
    try:
        base = int(gdb.parse_and_eval("(unsigned long) nish_ref_base"))
    except (gdb.error, gdb.MemoryError):
        # No symbol (a stripped binary) or no process yet: no address to give.
        return None
    return base + (offset << 2)


class LinkPrinter:
    def __init__(self, value):
        self.value = value

    def to_string(self):
        address = decode(self.value)
        if address is None:
            return "offset 0x%x (nish_ref_base unreadable)" % offset_of(self.value)
        if address == 0:
            return "null"
        # A string, not the cast `gdb.Value`: gdb prints a pointer value an
        # integer printer answers with as nothing at all.
        pointer = target_type(link_type(self.value))
        if pointer is None:
            return "0x%x" % address
        return "(%s) 0x%x" % (pointer, address)


def lookup(value):
    return LinkPrinter(value) if link_type(value) is not None else None


class Ref32Function(gdb.Function):
    """$ref32(link): the `<Class> *` a compact link names, null for offset 0."""

    def __init__(self):
        super().__init__("ref32")

    def invoke(self, value):
        link = link_type(value)
        if link is None:
            raise gdb.GdbError("$ref32 takes a compact link (a `ref32 <Class>` field)")
        pointer = target_type(link)
        if pointer is None:
            raise gdb.GdbError("no struct named by %s" % link.name)
        address = decode(value)
        if address is None:
            raise gdb.GdbError("nish_ref_base cannot be read; the link is offset 0x%x" % offset_of(value))
        return gdb.Value(address).cast(pointer)


Ref32Function()
gdb.pretty_printers.append(lookup)
