%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"gso sent \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"gro bind \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"ecn \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" sent \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"plain sent \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"gro\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"plain\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c" bytes, segment \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c", intact \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" bytes, ecn \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #3
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #3
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #3
declare noundef i32 @nish_net_local_port(i32 noundef) #3
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #3
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare i32 @llvm.fptosi.sat.i32.f64(double) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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
  %gso.addr = alloca i32, align 4
  %refused.addr = alloca i32, align 4
  %ecn.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %buf.addr = alloca %struct.nish_array*, align 8
  %from.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [18 x i8], align 8
  %meta.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [2 x i32], align 8
  %gro.addr = alloca i32, align 4
  %plain.addr = alloca i32, align 4
  %fd.addr = alloca i32, align 4
  %forof.idx.1 = alloca i64, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [2 x i32], align 8
  %n.addr = alloca i32, align 4
  %ecn.addr.1 = alloca i32, align 4
  %forof.idx.2 = alloca i64, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [4 x i32], align 8
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
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
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
  store i32 %54, i32* %gso.addr, align 4
  %55 = load i32, i32* %gso.addr, align 4
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.2 to i8*), i8* %56)
  call void @nish_print(i8* %57)
  %58 = load i32, i32* %gso.addr, align 4
  %59 = icmp eq i32 %58, -95
  br i1 %59, label %if.then, label %if.end

if.then:
  %60 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 2)
  store i32 %60, i32* %refused.addr, align 4
  %61 = load i32, i32* %refused.addr, align 4
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*), i8* %62)
  call void @nish_print(i8* %63)
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %66 = bitcast [3 x i32]* %arr.data.1 to i8*
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %66, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %68 = bitcast i8* %66 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 0
  store i32 1, i32* %69, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %70 = getelementptr inbounds i32, i32* %68, i64 1
  store i32 2, i32* %70, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %71 = getelementptr inbounds i32, i32* %68, i64 2
  store i32 3, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %72 = load i64, i64* %forof.idx, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = icmp ult i64 %72, %74
  br i1 %75, label %forof.body, label %forof.end

forof.body:
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = bitcast i8* %77 to i32*
  %79 = getelementptr inbounds i32, i32* %78, i64 %72
  %80 = load i32, i32* %79, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %80, i32* %ecn.addr, align 4
  %81 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %82 = load i8*, i8** %81, align 8
  %83 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %84 = load i64, i64* %83, align 8
  %85 = load i32, i32* %ecn.addr, align 4
  %86 = call i8* @nish_str_from_i32(i32 %85)
  %87 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* %86)
  %88 = call i8* @nish_str_concat(i8* %87, i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*))
  %89 = load i32, i32* %sender.addr, align 4
  %90 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %91 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %92 = load i32, i32* %ecn.addr, align 4
  %93 = add i64 0, 16
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %95 = load i64, i64* %94, align 8
  %96 = icmp ule i64 0, %93
  %97 = icmp ule i64 %93, %95
  %98 = and i1 %96, %97
  br i1 %98, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %93, i64 %95)
  unreachable

net.ok.1:
  %99 = call i32 @nish_udp_send_to(i32 %89, %struct.nish_array* %90, i64 0, i64 16, %struct.nish_array* %91, i32 0, i32 %92)
  %100 = call i8* @nish_str_from_i32(i32 %99)
  %101 = call i8* @nish_str_concat(i8* %88, i8* %100)
  call void @nish_print(i8* %101)
  %102 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %103 = load i8*, i8** %102, align 8
  %104 = icmp eq i8* %103, %82
  br i1 %104, label %pass.rewind, label %pass.free

pass.rewind:
  %105 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %84, i64* %105, align 8
  br label %pass.done

pass.free:
  %106 = ptrtoint i8* %82 to i64
  %107 = add i64 %106, %84
  call void @nish_arena_release(i64 %107)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %108 = load i64, i64* %forof.idx, align 8
  %109 = add i64 %108, 1
  store i64 %109, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %110 = load i32, i32* %sender.addr, align 4
  %111 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %112 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %113 = add i64 0, 16
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %115 = load i64, i64* %114, align 8
  %116 = icmp ule i64 0, %113
  %117 = icmp ule i64 %113, %115
  %118 = and i1 %116, %117
  br i1 %118, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %113, i64 %115)
  unreachable

net.ok.2:
  %119 = call i32 @nish_udp_send_to(i32 %110, %struct.nish_array* %111, i64 0, i64 16, %struct.nish_array* %112, i32 0, i32 0)
  %120 = call i8* @nish_str_from_i32(i32 %119)
  %121 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.6 to i8*), i8* %120)
  call void @nish_print(i8* %121)
  %122 = load i32, i32* %sender.addr, align 4
  %123 = call i32 @nish_net_close(i32 %122)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %123

if.end:
  %124 = call i8* @nish_alloc_struct(i64 24)
  %125 = bitcast i8* %124 to %struct.nish_array*
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 0
  store i64 65536, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 1
  store i64 65536, i64* %127, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %128 = call i8* @nish_alloc_struct(i64 65536)
  call void @llvm.memset.p0i8.i64(i8* align 8 %128, i8 0, i64 65536, i1 false), !alias.scope !4, !noalias !3
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 2
  store i8* %128, i8** %129, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %125, %struct.nish_array** %buf.addr, align 8
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 18, i64* %130, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 18, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %132 = bitcast [18 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %132, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %132, i8** %133, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %from.addr, align 8
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %135, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %136 = bitcast [2 x i32]* %arr.data.3 to i8*
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %136, i8** %137, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %138 = bitcast i8* %136 to i32*
  %139 = getelementptr inbounds i32, i32* %138, i64 0
  store i32 0, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %140 = getelementptr inbounds i32, i32* %138, i64 1
  store i32 0, i32* %140, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %meta.addr, align 8
  %141 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 2)
  store i32 %141, i32* %gro.addr, align 4
  %142 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 0)
  store i32 %142, i32* %plain.addr, align 4
  %143 = load i32, i32* %gro.addr, align 4
  %144 = load i32, i32* %plain.addr, align 4
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 2, i64* %145, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 2, i64* %146, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %147 = bitcast [2 x i32]* %arr.data.4 to i8*
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %147, i8** %148, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %149 = bitcast i8* %147 to i32*
  %150 = getelementptr inbounds i32, i32* %149, i64 0
  store i32 %143, i32* %150, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %151 = getelementptr inbounds i32, i32* %149, i64 1
  store i32 %144, i32* %151, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %152 = load i64, i64* %forof.idx.1, align 8
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  %154 = load i64, i64* %153, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %155 = icmp ult i64 %152, %154
  br i1 %155, label %forof.body.1, label %forof.end.1

forof.body.1:
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  %157 = load i8*, i8** %156, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %158 = bitcast i8* %157 to i32*
  %159 = getelementptr inbounds i32, i32* %158, i64 %152
  %160 = load i32, i32* %159, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %160, i32* %fd.addr, align 4
  %161 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %162 = load i8*, i8** %161, align 8
  %163 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %164 = load i64, i64* %163, align 8
  %165 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %166 = load i32, i32* %fd.addr, align 4
  %167 = call i32 @nish_net_local_port(i32 %166)
  %168 = call i32 @nish_net_address(%struct.nish_array* %165, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %167)
  %169 = load i32, i32* %sender.addr, align 4
  %170 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %171 = sext i32 4800 to i64
  %172 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %173 = add i64 0, %171
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 0
  %175 = load i64, i64* %174, align 8
  %176 = icmp ule i64 0, %173
  %177 = icmp ule i64 %173, %175
  %178 = and i1 %176, %177
  br i1 %178, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %173, i64 %175)
  unreachable

net.ok.3:
  %179 = call i32 @nish_udp_send_to(i32 %169, %struct.nish_array* %170, i64 0, i64 %171, %struct.nish_array* %172, i32 1200, i32 0)
  %180 = load i32, i32* %fd.addr, align 4
  %181 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %182 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %183 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %184 = call i32 @receive(i32 %180, %struct.nish_array* %181, %struct.nish_array* %182, %struct.nish_array* %183)
  store i32 %184, i32* %n.addr, align 4
  %185 = load i32, i32* %fd.addr, align 4
  %186 = load i32, i32* %gro.addr, align 4
  %187 = icmp eq i32 %185, %186
  br i1 %187, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %188 = phi i8* [ bitcast ({ i64, [4 x i8] }* @.str.7 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), %cond.false ]
  %189 = call i8* @nish_str_concat(i8* %188, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %190 = load i32, i32* %n.addr, align 4
  %191 = call i8* @nish_str_from_i32(i32 %190)
  %192 = call i8* @nish_str_concat(i8* %189, i8* %191)
  %193 = call i8* @nish_str_concat(i8* %192, i8* bitcast ({ i64, [17 x i8] }* @.str.10 to i8*))
  %194 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %194, i64 0, i32 0
  %196 = load i64, i64* %195, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %197 = icmp ult i64 0, %196
  br i1 %197, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %196)
  unreachable

bounds.ok.1:
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %194, i64 0, i32 2
  %199 = load i8*, i8** %198, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %200 = bitcast i8* %199 to i32*
  %201 = getelementptr inbounds i32, i32* %200, i64 0
  %202 = load i32, i32* %201, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %203 = call i8* @nish_str_from_i32(i32 %202)
  %204 = call i8* @nish_str_concat(i8* %193, i8* %203)
  %205 = call i8* @nish_str_concat(i8* %204, i8* bitcast ({ i64, [10 x i8] }* @.str.11 to i8*))
  %206 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %207 = load i32, i32* %n.addr, align 4
  %208 = call i1 @intact(%struct.nish_array* %206, i32 %207)
  %209 = select i1 %208, i8* bitcast ({ i64, [5 x i8] }* @.str.12 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.13 to i8*)
  %210 = call i8* @nish_str_concat(i8* %205, i8* %209)
  call void @nish_print(i8* %210)
  %211 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %212 = load i8*, i8** %211, align 8
  %213 = icmp eq i8* %212, %162
  br i1 %213, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %214 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %164, i64* %214, align 8
  br label %pass.done.1

pass.free.1:
  %215 = ptrtoint i8* %162 to i64
  %216 = add i64 %215, %164
  call void @nish_arena_release(i64 %216)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc.1

forof.inc.1:
  %217 = load i64, i64* %forof.idx.1, align 8
  %218 = add i64 %217, 1
  store i64 %218, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %219 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %220 = load i32, i32* %plain.addr, align 4
  %221 = call i32 @nish_net_local_port(i32 %220)
  %222 = call i32 @nish_net_address(%struct.nish_array* %219, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %221)
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 4, i64* %223, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %224 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 4, i64* %224, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %225 = bitcast [4 x i32]* %arr.data.5 to i8*
  %226 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %225, i8** %226, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %227 = bitcast i8* %225 to i32*
  %228 = getelementptr inbounds i32, i32* %227, i64 0
  store i32 1, i32* %228, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %229 = getelementptr inbounds i32, i32* %227, i64 1
  store i32 2, i32* %229, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %230 = getelementptr inbounds i32, i32* %227, i64 2
  store i32 3, i32* %230, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %231 = getelementptr inbounds i32, i32* %227, i64 3
  store i32 0, i32* %231, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.cond.2:
  %232 = load i64, i64* %forof.idx.2, align 8
  %233 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  %234 = load i64, i64* %233, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %235 = icmp ult i64 %232, %234
  br i1 %235, label %forof.body.2, label %forof.end.2

forof.body.2:
  %236 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  %237 = load i8*, i8** %236, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %238 = bitcast i8* %237 to i32*
  %239 = getelementptr inbounds i32, i32* %238, i64 %232
  %240 = load i32, i32* %239, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %240, i32* %ecn.addr.1, align 4
  %241 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %242 = load i8*, i8** %241, align 8
  %243 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %244 = load i64, i64* %243, align 8
  %245 = load i32, i32* %sender.addr, align 4
  %246 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %247 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %248 = load i32, i32* %ecn.addr.1, align 4
  %249 = add i64 0, 16
  %250 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %246, i64 0, i32 0
  %251 = load i64, i64* %250, align 8
  %252 = icmp ule i64 0, %249
  %253 = icmp ule i64 %249, %251
  %254 = and i1 %252, %253
  br i1 %254, label %net.ok.4, label %net.fail.4

net.fail.4:
  call void @nish_panic_slice(i64 0, i64 %249, i64 %251)
  unreachable

net.ok.4:
  %255 = call i32 @nish_udp_send_to(i32 %245, %struct.nish_array* %246, i64 0, i64 16, %struct.nish_array* %247, i32 0, i32 %248)
  %256 = load i32, i32* %plain.addr, align 4
  %257 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %258 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %259 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %260 = call i32 @receive(i32 %256, %struct.nish_array* %257, %struct.nish_array* %258, %struct.nish_array* %259)
  store i32 %260, i32* %n.addr.1, align 4
  br label %while.cond

while.cond:
  %261 = load i32, i32* %n.addr.1, align 4
  %262 = icmp eq i32 %261, 1200
  br i1 %262, label %while.body, label %while.end

while.body:
  %263 = load i32, i32* %plain.addr, align 4
  %264 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %265 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %266 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %267 = call i32 @receive(i32 %263, %struct.nish_array* %264, %struct.nish_array* %265, %struct.nish_array* %266)
  store i32 %267, i32* %n.addr.1, align 4
  br label %while.cond

while.end:
  %268 = load i32, i32* %ecn.addr.1, align 4
  %269 = call i8* @nish_str_from_i32(i32 %268)
  %270 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* %269)
  %271 = call i8* @nish_str_concat(i8* %270, i8* bitcast ({ i64, [3 x i8] }* @.str.14 to i8*))
  %272 = load i32, i32* %n.addr.1, align 4
  %273 = call i8* @nish_str_from_i32(i32 %272)
  %274 = call i8* @nish_str_concat(i8* %271, i8* %273)
  %275 = call i8* @nish_str_concat(i8* %274, i8* bitcast ({ i64, [13 x i8] }* @.str.15 to i8*))
  %276 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %277 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %276, i64 0, i32 0
  %278 = load i64, i64* %277, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %279 = icmp ult i64 1, %278
  br i1 %279, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %278)
  unreachable

bounds.ok.2:
  %280 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %276, i64 0, i32 2
  %281 = load i8*, i8** %280, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %282 = bitcast i8* %281 to i32*
  %283 = getelementptr inbounds i32, i32* %282, i64 1
  %284 = load i32, i32* %283, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %285 = call i8* @nish_str_from_i32(i32 %284)
  %286 = call i8* @nish_str_concat(i8* %275, i8* %285)
  call void @nish_print(i8* %286)
  %287 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %288 = load i8*, i8** %287, align 8
  %289 = icmp eq i8* %288, %242
  br i1 %289, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %290 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %244, i64* %290, align 8
  br label %pass.done.2

pass.free.2:
  %291 = ptrtoint i8* %242 to i64
  %292 = add i64 %291, %244
  call void @nish_arena_release(i64 %292)
  br label %pass.done.2

pass.done.2:
  br label %forof.inc.2

forof.inc.2:
  %293 = load i64, i64* %forof.idx.2, align 8
  %294 = add i64 %293, 1
  store i64 %294, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.end.2:
  %295 = load i32, i32* %sender.addr, align 4
  %296 = call i32 @nish_net_close(i32 %295)
  %297 = load i32, i32* %gro.addr, align 4
  %298 = call i32 @nish_net_close(i32 %297)
  %299 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %296, i32 %298)
  %300 = extractvalue { i32, i1 } %299, 0
  %301 = extractvalue { i32, i1 } %299, 1
  br i1 %301, label %ovf.fail, label %ovf.ok

ovf.ok:
  %302 = load i32, i32* %plain.addr, align 4
  %303 = call i32 @nish_net_close(i32 %302)
  %304 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %300, i32 %303)
  %305 = extractvalue { i32, i1 } %304, 0
  %306 = extractvalue { i32, i1 } %304, 1
  br i1 %306, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %305

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

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!19, !20, !21, !22, !23}
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
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
