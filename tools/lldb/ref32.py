# lldb formatter for a Nish compact class's links (WP48).
#
# A link field of a class that `implements Compact` is stored as a 32-bit
# offset, not a pointer, and `-g` types it `ref32 <Class>`. This formatter
# shows such a field as the object it names: `null` for offset 0, else a
# `<Class> *` whose fields expand under it.
#
# Load it in lldb with
#
#     (lldb) command script import tools/lldb/ref32.py
#
# or put that line in ~/.lldbinit. Then `frame variable *cell` shows
# `next = (Cell *) 0x40000068` with the linked cell's fields beneath it.
#
# The decode depends on the target the program was built for, as the compiler
# chooses it (`zeroBasedLinks` in src/target.ts): on `*-linux-gnu` a link is
# zero-based, the address being `offset << 2`; everywhere else (macOS) it is
# based, `nish_ref_base + (offset << 2)`. The formatter reads the target's
# triple; `NISH_REF32_SHAPE=zero|based` in lldb's environment overrides it.

import os

import lldb

PREFIX = "ref32 "


def zero_based(target):
    """Whether links decode zero-based: a `*-linux-gnu` target, or the user said so."""
    shape = os.environ.get("NISH_REF32_SHAPE", "auto")
    if shape != "auto":
        return shape == "zero"
    return "linux" in (target.GetTriple() or "")


def offset_of(valobj):
    """The stored offset, or None when the link itself cannot be read (optimized out, bad memory)."""
    error = lldb.SBError()
    offset = valobj.GetValueAsUnsigned(error, 0)
    if error.Fail():
        return None
    return offset & 0xFFFFFFFF


def decode(valobj):
    """The address a link names, 0 for null, or None when the link or `nish_ref_base` cannot be read."""
    offset = offset_of(valobj)
    if offset is None:
        return None
    if offset == 0:
        return 0
    target = valobj.GetTarget()
    if zero_based(target):
        return offset << 2
    base = target.FindFirstGlobalVariable("nish_ref_base")
    if not base.IsValid():
        # No symbol (a stripped binary): no address to give.
        return None
    error = lldb.SBError()
    value = base.GetValueAsUnsigned(error, 0)
    if error.Fail():
        return None
    return value + (offset << 2)


def target_type(valobj):
    """The `<Class> *` a `ref32 <Class>` names, or None when the program has no such struct."""
    name = valobj.GetType().GetName()[len(PREFIX):]
    found = valobj.GetTarget().FindFirstType(name)
    return found.GetPointerType() if found.IsValid() else None


def pointer(valobj):
    """The decoded link as a `<Class> *` value, or None for null or an unknown class."""
    address = decode(valobj)
    pointee = target_type(valobj)
    if address is None or address == 0 or pointee is None:
        return None
    data = lldb.SBData.CreateDataFromUInt64Array(
        valobj.GetTarget().GetByteOrder(), valobj.GetTarget().GetAddressByteSize(), [address]
    )
    return valobj.CreateValueFromData("target", data, pointee)


def summary(valobj, _internal):
    link = valobj.GetNonSyntheticValue()
    offset = offset_of(link)
    if offset is None:
        return "(link unreadable)"
    address = decode(link)
    if address is None:
        return "offset 0x%x (nish_ref_base unreadable)" % offset
    if address == 0:
        return "null"
    pointee = target_type(valobj.GetNonSyntheticValue())
    name = pointee.GetName() if pointee is not None else "?"
    return "(%s) 0x%x" % (name, address)


class LinkChildren:
    """The fields of the object a link names, as the link's own children."""

    def __init__(self, valobj, _internal):
        self.valobj = valobj
        self.target = None

    def update(self):
        p = pointer(self.valobj)
        self.target = p.Dereference() if p is not None else None
        return False

    def num_children(self):
        return self.target.GetNumChildren() if self.target is not None else 0

    def get_child_index(self, name):
        return self.target.GetIndexOfChildWithName(name) if self.target is not None else -1

    def get_child_at_index(self, index):
        return self.target.GetChildAtIndex(index) if self.target is not None else None

    def has_children(self):
        return True


def __lldb_init_module(debugger, _internal):
    match = "--regex '^ref32 '"
    debugger.HandleCommand("type summary add %s -F %s.summary" % (match, __name__))
    debugger.HandleCommand("type synthetic add %s -l %s.LinkChildren" % (match, __name__))
