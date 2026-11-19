struct __attribute__((packed)) p { unsigned char tag; unsigned int v; };
struct __attribute__((aligned(16))) a16 { int x; };
#pragma pack(push, 1)
struct pk { unsigned char tag; double d; };
#pragma pack(pop)
struct fa { int x; int y __attribute__((aligned(8))); };
typedef int wide_int __attribute__((aligned(8)));
struct wa { wide_int w; };
struct plain { int x; unsigned int y; };
int use_p(struct p *v);
int use_plain(struct plain *v);
/* An `aligned` on a typedef's later declaration marks the typedef: `la` is not bound. */
typedef long long late_aligned;
typedef late_aligned late_aligned __attribute__((aligned(16)));
struct la { late_aligned a; };
int use_la(struct la *v);
