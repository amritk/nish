%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"gso sent \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"gro\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"plain\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c" bytes, segment \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c", intact \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"ecn \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" bytes, ecn \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_exit(i32 noundef) #4
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #3
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #3
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #3
declare noundef i32 @nish_net_local_port(i32 noundef) #3
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #3
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i32 @llvm.fptosi.sat.i32.f64(double) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef i32 @receive(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %from, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %meta) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = add i64 0, %3
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = icmp ule i64 0, %4
  %8 = icmp ule i64 %4, %6
  %9 = and i1 %7, %8
  br i1 %9, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %4, i64 %6)
  unreachable

net.ok:
  %10 = call i32 @nish_udp_recv_from(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %3, %struct.nish_array* %from, %struct.nish_array* %meta)
  store i32 %10, i32* %n.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond

while.cond:
  %13 = load i32, i32* %n.addr, align 4
  %14 = icmp eq i32 %13, -11
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = trunc i64 %12 to i32
  %16 = sext i32 %15 to i64
  %17 = add i64 0, %16
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %19 = load i64, i64* %18, align 8
  %20 = icmp ule i64 0, %17
  %21 = icmp ule i64 %17, %19
  %22 = and i1 %20, %21
  br i1 %22, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %17, i64 %19)
  unreachable

net.ok.1:
  %23 = call i32 @nish_udp_recv_from(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %16, %struct.nish_array* %from, %struct.nish_array* %meta)
  store i32 %23, i32* %n.addr, align 4
  br label %while.cond

while.end:
  %24 = load i32, i32* %n.addr, align 4
  ret i32 %24
}

define internal noundef zeroext i1 @intact(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %n, %3
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  store i32 0, i32* %i.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp slt i32 %8, %n
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %7 to i8*
  %13 = getelementptr inbounds i8, i8* %12, i64 %11
  %14 = load i8, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = zext i8 %14 to i32
  %16 = load i32, i32* %i.addr, align 4
  %17 = srem i32 %16, 251
  %18 = icmp ne i32 %15, %17
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  ret i1 false

if.end.1:
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 true
}

define noundef i32 @nish_main() #0 {
entry:
  %node.addr = alloca i32, align 4
  %data.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %to.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %sender.addr = alloca i32, align 4
  %buf.addr = alloca %struct.nish_array*, align 8
  %from.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [18 x i8], align 8
  %meta.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i32], align 8
  %gro.addr = alloca i32, align 4
  %plain.addr = alloca i32, align 4
  %fd.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [2 x i32], align 8
  %n.addr = alloca i32, align 4
  %ecn.addr = alloca i32, align 4
  %forof.idx.1 = alloca i64, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [4 x i32], align 8
  %n.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 1, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 1
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  %9 = call double @nish_parse_number(i8* %8, i32 2)
  %10 = call i32 @llvm.fptosi.sat.i32.f64(double %9)
  store i32 %10, i32* %node.addr, align 4
  %11 = sext i32 4800 to i64
  %12 = icmp ule i64 %11, 2147483647
  br i1 %12, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %17 = call i8* @nish_alloc_struct(i64 %11)
  call void @llvm.memset.p0i8.i64(i8* align 8 %17, i8 0, i64 %11, i1 false), !alias.scope !4, !noalias !3
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %14, %struct.nish_array** %data.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %19 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %24 = load i32, i32* %i.addr, align 4
  %25 = trunc i64 %21 to i32
  %26 = icmp slt i32 %24, %25
  br i1 %26, label %for.body, label %for.end

for.body:
  %27 = load i32, i32* %i.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = load i32, i32* %i.addr, align 4
  %30 = srem i32 %29, 251
  %31 = trunc i32 %30 to i8
  %32 = bitcast i8* %23 to i8*
  %33 = getelementptr inbounds i8, i8* %32, i64 %28
  store i8 %31, i8* %33, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %34 = load i32, i32* %i.addr, align 4
  %35 = add nsw i32 %34, 1
  store i32 %35, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %38 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %38, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %38, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %to.addr, align 8
  %40 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 0)
  store i32 %40, i32* %sender.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %42 = load i32, i32* %node.addr, align 4
  %43 = call i32 @nish_net_address(%struct.nish_array* %41, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %42)
  %44 = load i32, i32* %sender.addr, align 4
  %45 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %46 = sext i32 4800 to i64
  %47 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %48 = add i64 0, %46
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %50 = load i64, i64* %49, align 8
  %51 = icmp ule i64 0, %48
  %52 = icmp ule i64 %48, %50
  %53 = and i1 %51, %52
  br i1 %53, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %48, i64 %50)
  unreachable

net.ok:
  %54 = call i32 @nish_udp_send_to(i32 %44, %struct.nish_array* %45, i64 0, i64 %46, %struct.nish_array* %47, i32 1200, i32 0)
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.2 to i8*), i8* %55)
  call void @nish_print(i8* %56)
  %57 = call i8* @nish_alloc_struct(i64 24)
  %58 = bitcast i8* %57 to %struct.nish_array*
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  store i64 65536, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 1
  store i64 65536, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %61 = call i8* @nish_alloc_struct(i64 65536)
  call void @llvm.memset.p0i8.i64(i8* align 8 %61, i8 0, i64 65536, i1 false), !alias.scope !4, !noalias !3
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  store i8* %61, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %58, %struct.nish_array** %buf.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 18, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 18, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %65 = bitcast [18 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %65, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %from.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %69 = bitcast [2 x i32]* %arr.data.2 to i8*
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %69, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %71 = bitcast i8* %69 to i32*
  %72 = getelementptr inbounds i32, i32* %71, i64 0
  store i32 0, i32* %72, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %73 = getelementptr inbounds i32, i32* %71, i64 1
  store i32 0, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %meta.addr, align 8
  %74 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 2)
  store i32 %74, i32* %gro.addr, align 4
  %75 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 0)
  store i32 %75, i32* %plain.addr, align 4
  %76 = load i32, i32* %gro.addr, align 4
  %77 = load i32, i32* %plain.addr, align 4
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %80 = bitcast [2 x i32]* %arr.data.3 to i8*
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %80, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %82 = bitcast i8* %80 to i32*
  %83 = getelementptr inbounds i32, i32* %82, i64 0
  store i32 %76, i32* %83, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %84 = getelementptr inbounds i32, i32* %82, i64 1
  store i32 %77, i32* %84, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %85 = load i64, i64* %forof.idx, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = icmp ult i64 %85, %87
  br i1 %88, label %forof.body, label %forof.end

forof.body:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %91 = bitcast i8* %90 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 %85
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %93, i32* %fd.addr, align 4
  %94 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %95 = load i8*, i8** %94, align 8
  %96 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %97 = load i64, i64* %96, align 8
  %98 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %99 = load i32, i32* %fd.addr, align 4
  %100 = call i32 @nish_net_local_port(i32 %99)
  %101 = call i32 @nish_net_address(%struct.nish_array* %98, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %100)
  %102 = load i32, i32* %sender.addr, align 4
  %103 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %104 = sext i32 4800 to i64
  %105 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %106 = add i64 0, %104
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 0
  %108 = load i64, i64* %107, align 8
  %109 = icmp ule i64 0, %106
  %110 = icmp ule i64 %106, %108
  %111 = and i1 %109, %110
  br i1 %111, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %106, i64 %108)
  unreachable

net.ok.1:
  %112 = call i32 @nish_udp_send_to(i32 %102, %struct.nish_array* %103, i64 0, i64 %104, %struct.nish_array* %105, i32 1200, i32 0)
  %113 = load i32, i32* %fd.addr, align 4
  %114 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %115 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %116 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %117 = call i32 @receive(i32 %113, %struct.nish_array* %114, %struct.nish_array* %115, %struct.nish_array* %116)
  store i32 %117, i32* %n.addr, align 4
  %118 = load i32, i32* %fd.addr, align 4
  %119 = load i32, i32* %gro.addr, align 4
  %120 = icmp eq i32 %118, %119
  br i1 %120, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %121 = phi i8* [ bitcast ({ i64, [4 x i8] }* @.str.3 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.4 to i8*), %cond.false ]
  %122 = call i8* @nish_str_concat(i8* %121, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %123 = load i32, i32* %n.addr, align 4
  %124 = call i8* @nish_str_from_i32(i32 %123)
  %125 = call i8* @nish_str_concat(i8* %122, i8* %124)
  %126 = call i8* @nish_str_concat(i8* %125, i8* bitcast ({ i64, [17 x i8] }* @.str.6 to i8*))
  %127 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 0
  %129 = load i64, i64* %128, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %130 = icmp ult i64 0, %129
  br i1 %130, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %129)
  unreachable

bounds.ok.1:
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %133 = bitcast i8* %132 to i32*
  %134 = getelementptr inbounds i32, i32* %133, i64 0
  %135 = load i32, i32* %134, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %136 = call i8* @nish_str_from_i32(i32 %135)
  %137 = call i8* @nish_str_concat(i8* %126, i8* %136)
  %138 = call i8* @nish_str_concat(i8* %137, i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*))
  %139 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %140 = load i32, i32* %n.addr, align 4
  %141 = call i1 @intact(%struct.nish_array* %139, i32 %140)
  %142 = select i1 %141, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %143 = call i8* @nish_str_concat(i8* %138, i8* %142)
  call void @nish_print(i8* %143)
  %144 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %145 = load i8*, i8** %144, align 8
  %146 = icmp eq i8* %145, %95
  br i1 %146, label %pass.rewind, label %pass.free

pass.rewind:
  %147 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %97, i64* %147, align 8
  br label %pass.done

pass.free:
  %148 = ptrtoint i8* %95 to i64
  %149 = add i64 %148, %97
  call void @nish_arena_release(i64 %149)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %150 = load i64, i64* %forof.idx, align 8
  %151 = add i64 %150, 1
  store i64 %151, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %152 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %153 = load i32, i32* %plain.addr, align 4
  %154 = call i32 @nish_net_local_port(i32 %153)
  %155 = call i32 @nish_net_address(%struct.nish_array* %152, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %154)
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 4, i64* %156, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %157 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 4, i64* %157, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %158 = bitcast [4 x i32]* %arr.data.4 to i8*
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %158, i8** %159, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %160 = bitcast i8* %158 to i32*
  %161 = getelementptr inbounds i32, i32* %160, i64 0
  store i32 1, i32* %161, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %162 = getelementptr inbounds i32, i32* %160, i64 1
  store i32 2, i32* %162, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %163 = getelementptr inbounds i32, i32* %160, i64 2
  store i32 3, i32* %163, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %164 = getelementptr inbounds i32, i32* %160, i64 3
  store i32 0, i32* %164, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %165 = load i64, i64* %forof.idx.1, align 8
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  %167 = load i64, i64* %166, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %168 = icmp ult i64 %165, %167
  br i1 %168, label %forof.body.1, label %forof.end.1

forof.body.1:
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  %170 = load i8*, i8** %169, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %171 = bitcast i8* %170 to i32*
  %172 = getelementptr inbounds i32, i32* %171, i64 %165
  %173 = load i32, i32* %172, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %173, i32* %ecn.addr, align 4
  %174 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %175 = load i8*, i8** %174, align 8
  %176 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %177 = load i64, i64* %176, align 8
  %178 = load i32, i32* %sender.addr, align 4
  %179 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %180 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %181 = load i32, i32* %ecn.addr, align 4
  %182 = add i64 0, 16
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %179, i64 0, i32 0
  %184 = load i64, i64* %183, align 8
  %185 = icmp ule i64 0, %182
  %186 = icmp ule i64 %182, %184
  %187 = and i1 %185, %186
  br i1 %187, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %182, i64 %184)
  unreachable

net.ok.2:
  %188 = call i32 @nish_udp_send_to(i32 %178, %struct.nish_array* %179, i64 0, i64 16, %struct.nish_array* %180, i32 0, i32 %181)
  %189 = load i32, i32* %plain.addr, align 4
  %190 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %191 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %192 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %193 = call i32 @receive(i32 %189, %struct.nish_array* %190, %struct.nish_array* %191, %struct.nish_array* %192)
  store i32 %193, i32* %n.addr.1, align 4
  br label %while.cond

while.cond:
  %194 = load i32, i32* %n.addr.1, align 4
  %195 = icmp eq i32 %194, 1200
  br i1 %195, label %while.body, label %while.end

while.body:
  %196 = load i32, i32* %plain.addr, align 4
  %197 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %198 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %199 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %200 = call i32 @receive(i32 %196, %struct.nish_array* %197, %struct.nish_array* %198, %struct.nish_array* %199)
  store i32 %200, i32* %n.addr.1, align 4
  br label %while.cond

while.end:
  %201 = load i32, i32* %ecn.addr, align 4
  %202 = call i8* @nish_str_from_i32(i32 %201)
  %203 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8* %202)
  %204 = call i8* @nish_str_concat(i8* %203, i8* bitcast ({ i64, [3 x i8] }* @.str.11 to i8*))
  %205 = load i32, i32* %n.addr.1, align 4
  %206 = call i8* @nish_str_from_i32(i32 %205)
  %207 = call i8* @nish_str_concat(i8* %204, i8* %206)
  %208 = call i8* @nish_str_concat(i8* %207, i8* bitcast ({ i64, [13 x i8] }* @.str.12 to i8*))
  %209 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %210 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %209, i64 0, i32 0
  %211 = load i64, i64* %210, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %212 = icmp ult i64 1, %211
  br i1 %212, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %211)
  unreachable

bounds.ok.2:
  %213 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %209, i64 0, i32 2
  %214 = load i8*, i8** %213, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %215 = bitcast i8* %214 to i32*
  %216 = getelementptr inbounds i32, i32* %215, i64 1
  %217 = load i32, i32* %216, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %218 = call i8* @nish_str_from_i32(i32 %217)
  %219 = call i8* @nish_str_concat(i8* %208, i8* %218)
  call void @nish_print(i8* %219)
  %220 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %221 = load i8*, i8** %220, align 8
  %222 = icmp eq i8* %221, %175
  br i1 %222, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %223 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %177, i64* %223, align 8
  br label %pass.done.1

pass.free.1:
  %224 = ptrtoint i8* %175 to i64
  %225 = add i64 %224, %177
  call void @nish_arena_release(i64 %225)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc.1

forof.inc.1:
  %226 = load i64, i64* %forof.idx.1, align 8
  %227 = add i64 %226, 1
  store i64 %227, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %228 = load i32, i32* %sender.addr, align 4
  %229 = call i32 @nish_net_close(i32 %228)
  %230 = load i32, i32* %gro.addr, align 4
  %231 = call i32 @nish_net_close(i32 %230)
  %232 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %229, i32 %231)
  %233 = extractvalue { i32, i1 } %232, 0
  %234 = extractvalue { i32, i1 } %232, 1
  br i1 %234, label %ovf.fail, label %ovf.ok

ovf.ok:
  %235 = load i32, i32* %plain.addr, align 4
  %236 = call i32 @nish_net_close(i32 %235)
  %237 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %233, i32 %236)
  %238 = extractvalue { i32, i1 } %237, 0
  %239 = extractvalue { i32, i1 } %237, 1
  br i1 %239, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %238

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { nounwind willreturn readnone }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"element ptr", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!9, !7, i64 8}
!17 = !{!"element i32", !6, i64 0}
!18 = !{!17, !17, i64 0}
