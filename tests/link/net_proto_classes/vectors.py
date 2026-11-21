# Writes vectors.ts: messages of classes.proto encoded by Google's reference
# implementation (the `protobuf` Python package), with what each one holds,
# for main.ts to decode into the classes `nish proto` wrote and re-encode
# byte for byte.
#
#   python3 -I tests/link/net_proto_classes/vectors.py > tests/link/net_proto_classes/vectors.ts
#
# The schema is classes.proto, built in code (no protoc). `Unpacked` has
# All's packable repeated fields with `[packed = false]`: its bytes, read as an
# All, must re-encode packed. A vector's input is what main.ts decodes, its
# output what the classes must write back, and a vector that is not `ok`, which
# the reference implementation refuses too, must make decode return false.
import struct
import sys

import google.protobuf
import google.protobuf.message
from google.protobuf import descriptor_pb2, descriptor_pool, message_factory

F = descriptor_pb2.FieldDescriptorProto
fdp = descriptor_pb2.FileDescriptorProto(name="classes.proto", package="wire.v1", syntax="proto3")
color = fdp.enum_type.add(name="Color")
for name, number in [("COLOR_RED", 0), ("COLOR_GREEN", 1), ("COLOR_NEG", -2)]:
    color.value.add(name=name, number=number)

leaf = fdp.message_type.add(name="Leaf")
leaf.field.add(name="a", number=1, type=F.TYPE_INT32, label=F.LABEL_OPTIONAL)
leaf.field.add(name="s", number=2, type=F.TYPE_STRING, label=F.LABEL_OPTIONAL)
leaf.field.add(name="child", number=3, type=F.TYPE_MESSAGE, type_name=".wire.v1.Leaf", label=F.LABEL_OPTIONAL)

SCALARS = [
    ("i32", 1, F.TYPE_INT32),
    ("s32", 2, F.TYPE_SINT32),
    ("sf32", 3, F.TYPE_SFIXED32),
    ("u32", 4, F.TYPE_UINT32),
    ("f32", 5, F.TYPE_FIXED32),
    ("i64", 6, F.TYPE_INT64),
    ("s64", 7, F.TYPE_SINT64),
    ("sf64", 8, F.TYPE_SFIXED64),
    ("u64", 9, F.TYPE_UINT64),
    ("f64", 10, F.TYPE_FIXED64),
    ("fl", 11, F.TYPE_FLOAT),
    ("db", 12, F.TYPE_DOUBLE),
    ("b", 13, F.TYPE_BOOL),
    ("str", 14, F.TYPE_STRING),
    ("by", 15, F.TYPE_BYTES),
]
PACKABLE = [
    ("ri", 18, F.TYPE_INT32, None),
    ("rs", 19, F.TYPE_SINT64, None),
    ("rd", 20, F.TYPE_DOUBLE, None),
    ("rb", 24, F.TYPE_BOOL, None),
    ("rf", 25, F.TYPE_FIXED32, None),
    ("rc", 26, F.TYPE_ENUM, ".wire.v1.Color"),
]


def add_entry(msg, name, key, value, value_type=None):
    """A map field: its entry message, nested in `msg`, as protoc makes one."""
    entry_name = "".join(p.capitalize() for p in name.split("_")) + "Entry"
    entry = msg.nested_type.add(name=entry_name)
    entry.options.map_entry = True
    entry.field.add(name="key", number=1, type=key, label=F.LABEL_OPTIONAL)
    if value_type is None:
        entry.field.add(name="value", number=2, type=value, label=F.LABEL_OPTIONAL)
    else:
        entry.field.add(name="value", number=2, type=value, type_name=value_type, label=F.LABEL_OPTIONAL)
    return f".wire.v1.All.{entry_name}"


msg = fdp.message_type.add(name="All")
for name, number, typ in SCALARS:
    msg.field.add(name=name, number=number, type=typ, label=F.LABEL_OPTIONAL)
msg.field.add(name="color", number=16, type=F.TYPE_ENUM, type_name=".wire.v1.Color", label=F.LABEL_OPTIONAL)
msg.field.add(name="leaf", number=17, type=F.TYPE_MESSAGE, type_name=".wire.v1.Leaf", label=F.LABEL_OPTIONAL)
for name, number, typ, type_name in PACKABLE:
    f = msg.field.add(name=name, number=number, type=typ, label=F.LABEL_REPEATED)
    if type_name is not None:
        f.type_name = type_name
msg.field.add(name="rstr", number=21, type=F.TYPE_STRING, label=F.LABEL_REPEATED)
msg.field.add(name="rby", number=22, type=F.TYPE_BYTES, label=F.LABEL_REPEATED)
msg.field.add(name="rleaf", number=23, type=F.TYPE_MESSAGE, type_name=".wire.v1.Leaf", label=F.LABEL_REPEATED)
msg.oneof_decl.add(name="choice")
msg.oneof_decl.add(name="_oi")
msg.oneof_decl.add(name="_os")
msg.oneof_decl.add(name="_ol")
msg.field.add(name="oi", number=27, type=F.TYPE_INT32, label=F.LABEL_OPTIONAL, oneof_index=1, proto3_optional=True)
msg.field.add(name="os", number=28, type=F.TYPE_STRING, label=F.LABEL_OPTIONAL, oneof_index=2, proto3_optional=True)
for name, number, key, value, value_type in [
    ("ms", 29, F.TYPE_STRING, F.TYPE_INT32, None),
    ("ml", 30, F.TYPE_INT64, F.TYPE_MESSAGE, ".wire.v1.Leaf"),
    ("mu", 31, F.TYPE_UINT32, F.TYPE_STRING, None),
    ("mb", 32, F.TYPE_BOOL, F.TYPE_BYTES, None),
]:
    entry = add_entry(msg, name, key, value, value_type)
    msg.field.add(name=name, number=number, type=F.TYPE_MESSAGE, type_name=entry, label=F.LABEL_REPEATED)
msg.field.add(name="ci", number=33, type=F.TYPE_INT32, label=F.LABEL_OPTIONAL, oneof_index=0)
msg.field.add(name="cs", number=34, type=F.TYPE_STRING, label=F.LABEL_OPTIONAL, oneof_index=0)
msg.field.add(name="cl", number=35, type=F.TYPE_MESSAGE, type_name=".wire.v1.Leaf", label=F.LABEL_OPTIONAL, oneof_index=0)
inner = msg.nested_type.add(name="Inner")
inner.field.add(name="colors", number=1, type=F.TYPE_ENUM, type_name=".wire.v1.Color", label=F.LABEL_REPEATED)
inner.field.add(name="again", number=2, type=F.TYPE_MESSAGE, type_name=".wire.v1.All.Inner", label=F.LABEL_OPTIONAL)
msg.field.add(name="inner", number=36, type=F.TYPE_MESSAGE, type_name=".wire.v1.All.Inner", label=F.LABEL_OPTIONAL)
msg.field.add(name="ol", number=37, type=F.TYPE_MESSAGE, type_name=".wire.v1.Leaf", label=F.LABEL_OPTIONAL, oneof_index=3, proto3_optional=True)
msg.field.add(name="far", number=536870911, type=F.TYPE_UINT32, label=F.LABEL_OPTIONAL)

unpacked = fdp.message_type.add(name="Unpacked")
for name, number, typ, type_name in PACKABLE:
    f = unpacked.field.add(name=name, number=number, type=typ, label=F.LABEL_REPEATED)
    f.options.packed = False
    if type_name is not None:
        f.type_name = type_name

pool = descriptor_pool.DescriptorPool()
pool.Add(fdp)
All = message_factory.GetMessageClass(pool.FindMessageTypeByName("wire.v1.All"))
Leaf = message_factory.GetMessageClass(pool.FindMessageTypeByName("wire.v1.Leaf"))
Unpacked = message_factory.GetMessageClass(pool.FindMessageTypeByName("wire.v1.Unpacked"))

CASES = {None: 0, "ci": 33, "cs": 34, "cl": 35}


def chain(m, first, then):
    """How many messages hang from `m`: one through `first`, then each through `then`."""
    if not m.HasField(first):
        return 0
    m = getattr(m, first)
    n = 1
    while m.HasField(then):
        m = getattr(m, then)
        n += 1
    return n


def summary(m):
    """What main.ts's `summary` prints for the All `m`."""
    reps = sum(len(getattr(m, f)) for f in ["ri", "rs", "rd", "rstr", "rby", "rleaf", "rb", "rf", "rc"])
    maps = sum(len(getattr(m, f)) for f in ["ms", "ml", "mu", "mb"])
    leaf = chain(m, "leaf", "child")
    inner = chain(m, "inner", "again")
    return (
        f"i32={m.i32} s64={m.s64} u32={m.u32} oi={int(m.HasField('oi'))}:{m.oi} os={int(m.HasField('os'))} "
        f"ol={int(m.HasField('ol'))} case={CASES[m.WhichOneof('choice')]} "
        f"color={m.color} leaf={leaf} inner={inner} repeated={reps} maps={maps}"
    )


def varint(v):
    out = bytearray()
    v &= (1 << 64) - 1
    while v >= 0x80:
        out.append(v & 0x7F | 0x80)
        v >>= 7
    out.append(v)
    return bytes(out)


def tag(field, wire):
    return varint(field << 3 | wire)


def ser(m):
    return m.SerializeToString(deterministic=True)


def vector(name, m=None, data=None, ok=True):
    """A vector: `m`'s bytes, or `data` read back as an All by the reference
    implementation, which then writes the output the classes must match."""
    if data is None:
        data = ser(m)
    parsed = All()
    if not ok:
        try:
            parsed.ParseFromString(data)
        except google.protobuf.message.DecodeError:
            return name, data, b"", False, ""
        raise SystemExit(f"{name}: the reference implementation reads it")
    parsed.ParseFromString(data)
    parsed.DiscardUnknownFields()
    return name, data, ser(parsed), True, summary(parsed)


def build(**fields):
    m = All()
    for key, value in fields.items():
        if isinstance(value, list):
            getattr(m, key).extend(value)
        elif isinstance(value, dict):
            target = getattr(m, key)
            for k, v in value.items():
                if isinstance(v, tuple):
                    target[k].a, target[k].s = v
                else:
                    target[k] = v
        else:
            setattr(m, key, value)
    return m


def with_(m, fill):
    """`m` after `fill(m)`: for a message field set through its sub-message."""
    fill(m)
    return m


def leaf_chain(depth):
    """A Leaf with `depth - 1` children below it, each one's `a` its depth."""
    top = Leaf(a=1)
    at = top
    for d in range(2, depth + 1):
        at.child.a = d
        at = at.child
    return top


def nested_bytes(depth):
    """An All whose `leaf` holds `depth` Leafs one in another, written by hand:
    the reference implementation reads at most 100 below the top message, as
    ProtoReader does (PROTO_MAX_DEPTH), and writes no deeper."""
    body = b""
    for _ in range(depth - 1):
        body = tag(3, 2) + varint(len(body)) + body
    return tag(17, 2) + varint(len(body)) + body


every = build(
    i32=-(2**31), s32=-(2**31), sf32=-(2**31), u32=2**32 - 1, f32=2**32 - 1,
    i64=-(2**63), s64=2**63 - 1, sf64=-(2**63), u64=2**64 - 1, f64=2**64 - 1,
    fl=1.5, db=-0.1, b=True, str="hi é漢", by=bytes([0, 1, 127, 128, 255]),
    color=1, ri=[1, -1, 300], rs=[-1, 1, -(2**63)], rd=[1.0, -2.5], rstr=["a", "", "é"],
    rby=[b"", bytes([255])], rb=[True, False, True], rf=[0, 2**32 - 1], rc=[0, 1, -2, 7],
    oi=-3, os="set", cs="chosen", far=1,
)
every.leaf.CopyFrom(leaf_chain(2))
every.rleaf.add(a=5)
every.rleaf.add(s="two")
every.inner.colors.extend([1, -2])
every.inner.again.colors.append(0)

packed = build(ri=[0, -5, 2**31 - 1], rs=[-1, 2**62], rd=[0.5, float("inf")], rb=[True, True], rf=[7, 0], rc=[1, 99, -2])
unpacked_bytes = Unpacked(ri=[0, -5, 2**31 - 1], rs=[-1, 2**62], rd=[0.5, float("inf")], rb=[True, True], rf=[7, 0], rc=[1, 99, -2])

VECTORS = [
    vector("empty", All()),
    vector("every field kind", every),
    vector("scalar maxima", build(i32=2**31 - 1, s32=2**31 - 1, sf32=2**31 - 1, i64=2**63 - 1, sf64=2**63 - 1, s64=-(2**63))),
    vector("negative int32 takes ten bytes", build(i32=-1)),
    vector("float subnormal and double infinity", build(fl=1e-45, db=float("-inf"))),
    vector("a two-byte string length", build(str="x" * 300)),
    vector("enum value the schema names", build(color=1)),
    vector("negative enum value", build(color=-2)),
    vector("enum value the schema does not name", build(color=12345)),
    vector("nested message three deep", with_(All(), lambda m: m.leaf.CopyFrom(leaf_chain(3)))),
    vector("packed repeated", packed),
    vector("unpacked repeated reads and writes packed", data=ser(unpacked_bytes)),
    vector("packed run split in two", data=ser(build(ri=[1, 2])) + ser(build(ri=[3]))),
    vector("repeated strings bytes and messages", build(rstr=["x", "yy"], rby=[b"\x00", b""])),
    vector("optional set to zero is written", build(oi=0, os="")),
    vector("optional message present at its defaults", with_(All(), lambda m: m.ol.SetInParent())),
    vector("optional message with a field", with_(All(), lambda m: m.ol.CopyFrom(Leaf(a=2)))),
    vector("map string to int32", build(ms={"k": 7})),
    vector("map entry at its defaults", build(ms={"": 0})),
    vector("map int64 to message", build(ml={-9: (4, "v")})),
    vector("map uint32 to string", build(mu={2**32 - 1: "max"})),
    vector("map bool to bytes", build(mb={True: b"\x01\x02"})),
    vector("map key repeated keeps the last", data=ser(build(ms={"k": 1})) + ser(build(ms={"k": 2}))),
    vector("oneof int32 zero is written", build(ci=0)),
    vector("oneof string", build(cs="s")),
    vector("oneof empty message", with_(All(), lambda m: m.cl.SetInParent())),
    vector("oneof last member wins", data=ser(build(ci=5)) + ser(build(cs="last"))),
    vector(
        "message field merges",
        data=ser(with_(All(), lambda m: m.leaf.CopyFrom(Leaf(a=1)))) + ser(with_(All(), lambda m: m.leaf.CopyFrom(Leaf(s="x")))),
    ),
    vector("nested message in a nested message", with_(All(), lambda m: m.inner.again.again.colors.append(1))),
    vector("largest field number", build(far=2**32 - 1)),
    vector("unknown fields are dropped", data=ser(build(i32=1)) + tag(99, 0) + varint(5) + tag(100, 2) + varint(2) + b"ab"),
    vector("a wrong wire type is skipped", data=tag(1, 2) + varint(1) + b"z" + tag(14, 0) + varint(3) + ser(build(b=True))),
    vector("one hundred nested messages", data=nested_bytes(100)),
    vector("past the depth limit", data=nested_bytes(101), ok=False),
    vector("truncated length", data=tag(14, 2) + varint(5) + b"ab", ok=False),
    vector("packed length past the field", data=tag(18, 2) + varint(9) + varint(1), ok=False),
    vector("truncated varint", data=tag(1, 0) + b"\x80", ok=False),
    vector("truncated fixed64", data=tag(10, 1) + b"\x01\x02", ok=False),
    vector("length past the end of a nested message", data=tag(17, 2) + varint(3) + tag(2, 2) + varint(9) + b"a", ok=False),
    vector("bad map entry", data=tag(29, 2) + varint(3) + tag(1, 2) + varint(7), ok=False),
]


def u8s(b):
    return "[" + ", ".join(str(x) for x in b) + "]"


out = sys.stdout
out.write(f"// Generated by tests/link/net_proto_classes/vectors.py with protobuf {google.protobuf.__version__}:\n")
out.write("//   python3 -I tests/link/net_proto_classes/vectors.py > tests/link/net_proto_classes/vectors.ts\n")
out.write("// Do not edit; rerun the command.\n\n")
out.write("""/** A message the reference implementation encoded, and what it holds. */
export class ClassVector {
  name: string
  input: u8[]
  output: u8[]
  summary: string
  ok: boolean
  constructor(name: string, input: u8[], output: u8[], ok: boolean, summary: string) {
    this.name = name
    this.input = input
    this.output = output
    this.ok = ok
    this.summary = summary
  }
}

/** Every vector, in order. */
export const classVectors = (): ClassVector[] => {
  const out: ClassVector[] = []
""")
for name, data, output, ok, summ in VECTORS:
    out.write(f'  out.push(new ClassVector("{name}", {u8s(data)}, {u8s(output)}, {"true" if ok else "false"}, "{summ}"))\n')
out.write("  return out\n}\n")
