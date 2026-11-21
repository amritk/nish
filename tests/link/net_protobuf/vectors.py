# Writes vectors.ts: protobuf messages encoded by Google's reference
# implementation (the `protobuf` Python package), with the fields each one
# holds, for checks.ts to decode and re-encode byte for byte.
#
#   python3 -I tests/link/net_protobuf/vectors.py > tests/link/net_protobuf/vectors.ts
#
# The schema is built in code (no protoc): `All` below, proto3, so repeated
# scalars are packed (but fields 21 to 23, marked `[packed = false]`) and
# fields at their default are not sent. `Extra` holds fields All does not
# know; a vector built with `extra=` ends with them, and the reader skips them.
import struct
import sys

import google.protobuf
from google.protobuf import descriptor_pb2, descriptor_pool, message_factory

F = descriptor_pb2.FieldDescriptorProto
fdp = descriptor_pb2.FileDescriptorProto(name="vectors.proto", package="v", syntax="proto3")
inner = fdp.message_type.add(name="Inner")
inner.field.add(name="a", number=1, type=F.TYPE_INT32, label=F.LABEL_OPTIONAL)
inner.field.add(name="s", number=2, type=F.TYPE_STRING, label=F.LABEL_OPTIONAL)
inner.field.add(name="child", number=3, type=F.TYPE_MESSAGE, type_name=".v.Inner", label=F.LABEL_OPTIONAL)

SCALARS = [
    ("i32", 1, F.TYPE_INT32),
    ("i64", 2, F.TYPE_INT64),
    ("u32", 3, F.TYPE_UINT32),
    ("u64", 4, F.TYPE_UINT64),
    ("s32", 5, F.TYPE_SINT32),
    ("s64", 6, F.TYPE_SINT64),
    ("b", 7, F.TYPE_BOOL),
    ("f32", 8, F.TYPE_FIXED32),
    ("f64", 9, F.TYPE_FIXED64),
    ("sf32", 10, F.TYPE_SFIXED32),
    ("sf64", 11, F.TYPE_SFIXED64),
    ("fl", 12, F.TYPE_FLOAT),
    ("d", 13, F.TYPE_DOUBLE),
    ("str", 14, F.TYPE_STRING),
    ("by", 15, F.TYPE_BYTES),
]
msg = fdp.message_type.add(name="All")
for name, number, typ in SCALARS:
    msg.field.add(name=name, number=number, type=typ, label=F.LABEL_OPTIONAL)
msg.field.add(name="inner", number=16, type=F.TYPE_MESSAGE, type_name=".v.Inner", label=F.LABEL_OPTIONAL)
msg.field.add(name="pi32", number=17, type=F.TYPE_INT32, label=F.LABEL_REPEATED)
msg.field.add(name="pf32", number=18, type=F.TYPE_FIXED32, label=F.LABEL_REPEATED)
msg.field.add(name="pd", number=19, type=F.TYPE_DOUBLE, label=F.LABEL_REPEATED)
msg.field.add(name="ps64", number=20, type=F.TYPE_SINT64, label=F.LABEL_REPEATED)
for name, number, typ in [("ru32", 21, F.TYPE_UINT32), ("ru64", 22, F.TYPE_UINT64), ("rf64", 23, F.TYPE_FIXED64)]:
    msg.field.add(name=name, number=number, type=typ, label=F.LABEL_REPEATED).options.packed = False
msg.field.add(name="far", number=536870911, type=F.TYPE_UINT32, label=F.LABEL_OPTIONAL)
extra = fdp.message_type.add(name="Extra")
extra.field.add(name="x64", number=30, type=F.TYPE_FIXED64, label=F.LABEL_OPTIONAL)
extra.field.add(name="xs", number=31, type=F.TYPE_STRING, label=F.LABEL_OPTIONAL)
extra.field.add(name="xv", number=32, type=F.TYPE_UINT64, label=F.LABEL_OPTIONAL)
extra.field.add(name="x32", number=33, type=F.TYPE_FIXED32, label=F.LABEL_OPTIONAL)

pool = descriptor_pool.DescriptorPool()
pool.Add(fdp)
All = message_factory.GetMessageClass(pool.FindMessageTypeByName("v.All"))
Extra = message_factory.GetMessageClass(pool.FindMessageTypeByName("v.Extra"))


def text(m):
    """The fields of `m` in wire order, as checks.ts prints them."""
    out = []
    for fd, value in m.ListFields():
        values = value if fd.is_repeated else [value]
        for v in values:
            if fd.type == F.TYPE_MESSAGE:
                out.append(f"{fd.number}{{{text(v)}}}")
            elif fd.type == F.TYPE_BOOL:
                out.append(f"{fd.number}={'true' if v else 'false'}")
            elif fd.type == F.TYPE_FLOAT:
                out.append(f"{fd.number}=f{struct.unpack('<I', struct.pack('<f', v))[0]}")
            elif fd.type == F.TYPE_DOUBLE:
                out.append(f"{fd.number}=d{struct.unpack('<Q', struct.pack('<d', v))[0]}")
            elif fd.type in (F.TYPE_STRING, F.TYPE_BYTES):
                raw = v.encode() if isinstance(v, str) else v
                out.append(f"{fd.number}=[{'.'.join(str(b) for b in raw)}]")
            else:
                out.append(f"{fd.number}={v}")
    return " ".join(out)


def vector(name, extra=None, **fields):
    """A vector: its name, its bytes, the known bytes' count, and its fields.

    With `extra`, the bytes are All's then Extra's, parsed back as one All
    (which keeps Extra's fields as unknown); the writer re-encodes only the
    known bytes."""
    m = All()
    for key, value in fields.items():
        if key == "inner":
            m.inner.a = value[0]
            m.inner.s = value[1]
            if len(value) > 2:
                m.inner.child.a = value[2]
        elif key in ("pi32", "pf32", "pd", "ps64", "ru32", "ru64", "rf64"):
            getattr(m, key).extend(value)
        else:
            setattr(m, key, value)
    known = m.SerializeToString()
    if extra is None:
        return name, known, len(known), text(m)
    tail = Extra(**extra).SerializeToString()
    whole = All()
    whole.ParseFromString(known + tail)
    assert whole.SerializeToString() == known + tail and text(whole) == text(m)
    return name, known + tail, len(known), text(whole)


VECTORS = [
    vector("empty"),
    vector("one varint", i32=150),
    vector("negative int32 takes ten bytes", i32=-1),
    vector("int32 minimum", i32=-(2**31)),
    vector("int32 maximum", i32=2**31 - 1),
    vector("int64 extremes", i64=-(2**63), u64=2**64 - 1),
    vector("int64 maximum", i64=2**63 - 1),
    vector("uint32 maximum", u32=2**32 - 1),
    vector("zigzag", s32=-1, s64=-(2**63)),
    vector("zigzag minimum int32", s32=-(2**31)),
    vector("zigzag maxima", s32=2**31 - 1, s64=2**63 - 1),
    vector("bool", b=True),
    vector("fixed widths", f32=2**32 - 1, f64=2**64 - 1, sf32=-2, sf64=-(2**63)),
    vector("sfixed minima", sf32=-(2**31), sf64=-(2**63)),
    vector("sfixed maxima", sf32=2**31 - 1, sf64=2**63 - 1),
    vector("unpacked zeros and maxima", ru32=[0, 2**32 - 1], ru64=[0, 2**64 - 1], rf64=[0, 2**64 - 1]),
    vector("float and double", fl=1.5, d=-0.1),
    vector("float subnormal and infinity", fl=1e-45, d=float("inf")),
    vector("string", str="hi é漢"),
    vector("bytes", by=bytes(range(0, 256, 15))),
    vector("long string, a two-byte length", str="x" * 300),
    vector("embedded message", inner=(-7, "in", 3)),
    vector("packed", pi32=[1, -1, 300], pf32=[0, 2**32 - 1], pd=[1.0, -2.5], ps64=[-1, 1, -(2**63)]),
    vector("largest field number", far=1),
    vector("unknown fields after known ones", i32=1, extra=dict(x64=2**64 - 1, xs="skip", xv=2**63, x32=5)),
    vector(
        "every field",
        i32=-5, i64=5, u32=7, u64=9, s32=-11, s64=13, b=True, f32=15, f64=17, sf32=-19, sf64=-21,
        fl=-0.5, d=3.25, str="s", by=b"\x00\xff", inner=(1, "x"), pi32=[2], pf32=[3], pd=[4.0], ps64=[-5],
        far=6,
    ),
]

print("// Generated by tests/link/net_protobuf/vectors.py with protobuf", google.protobuf.__version__ + ":")
print("//   python3 -I tests/link/net_protobuf/vectors.py > tests/link/net_protobuf/vectors.ts")
print("// Do not edit; rerun the command.")
print()
print("/** A message the reference implementation encoded, and the fields it holds. */")
print("export class ProtoVector {")
print("  name: string")
print("  bytes: u8[]")
print("  /** How many leading bytes are fields the reader knows; the rest it skips. */")
print("  known: i32")
print("  fields: string")
print("  constructor(name: string, bytes: u8[], known: i32, fields: string) {")
print("    this.name = name")
print("    this.bytes = bytes")
print("    this.known = known")
print("    this.fields = fields")
print("  }")
print("}")
print()
print("/** Every vector, in order. */")
print("export const protoVectors = (): ProtoVector[] => {")
print("  const out: ProtoVector[] = []")
for name, raw, known, fields in VECTORS:
    body = ", ".join(str(b) for b in raw)
    print(f"  out.push(new ProtoVector({name!r}, [{body}], {known}, {fields!r}))".replace("'", '"'))
print("  return out")
print("}")
