%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"gso sent \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"gro bind \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"ecn \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" sent \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"plain sent \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"gro\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"plain\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c" bytes, segment \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c", intact \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" bytes, ecn \00" }, align 8
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
  %4 = call i32 @nish_udp_recv_from(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %3, %struct.nish_array* %from, %struct.nish_array* %meta)
  store i32 %4, i32* %n.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond

while.cond:
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp eq i32 %7, -11
  br i1 %8, label %while.body, label %while.end

while.body:
  %9 = trunc i64 %6 to i32
  %10 = sext i32 %9 to i64
  %11 = call i32 @nish_udp_recv_from(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %10, %struct.nish_array* %from, %struct.nish_array* %meta)
  store i32 %11, i32* %n.addr, align 4
  br label %while.cond

while.end:
  %12 = load i32, i32* %n.addr, align 4
  ret i32 %12
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
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 %11, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 %11, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %16 = call i8* @nish_alloc_struct(i64 %11)
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 %11, i1 false), !alias.scope !4, !noalias !3
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %13, %struct.nish_array** %data.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %23 = load i32, i32* %i.addr, align 4
  %24 = trunc i64 %20 to i32
  %25 = icmp slt i32 %23, %24
  br i1 %25, label %for.body, label %for.end

for.body:
  %26 = load i32, i32* %i.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = load i32, i32* %i.addr, align 4
  %29 = srem i32 %28, 251
  %30 = trunc i32 %29 to i8
  %31 = bitcast i8* %22 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 %27
  store i8 %30, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %37 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %37, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %to.addr, align 8
  %39 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %39, i32* %sender.addr, align 4
  %40 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %41 = load i32, i32* %node.addr, align 4
  %42 = call i32 @nish_net_address(%struct.nish_array* %40, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %41)
  %43 = load i32, i32* %sender.addr, align 4
  %44 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %45 = sext i32 4800 to i64
  %46 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %47 = add i64 0, %45
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %49 = load i64, i64* %48, align 8
  %50 = icmp ule i64 0, %47
  %51 = icmp ule i64 %47, %49
  %52 = and i1 %50, %51
  br i1 %52, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %47, i64 %49)
  unreachable

net.ok:
  %53 = call i32 @nish_udp_send_to(i32 %43, %struct.nish_array* %44, i64 0, i64 %45, %struct.nish_array* %46, i32 1200, i32 0)
  store i32 %53, i32* %gso.addr, align 4
  %54 = load i32, i32* %gso.addr, align 4
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i8* %55)
  call void @nish_print(i8* %56)
  %57 = load i32, i32* %gso.addr, align 4
  %58 = icmp eq i32 %57, -95
  br i1 %58, label %if.then, label %if.end

if.then:
  %59 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 2)
  store i32 %59, i32* %refused.addr, align 4
  %60 = load i32, i32* %refused.addr, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.2 to i8*), i8* %61)
  call void @nish_print(i8* %62)
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %65 = bitcast [3 x i32]* %arr.data.1 to i8*
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %67 = bitcast i8* %65 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 0
  store i32 1, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %69 = getelementptr inbounds i32, i32* %67, i64 1
  store i32 2, i32* %69, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %70 = getelementptr inbounds i32, i32* %67, i64 2
  store i32 3, i32* %70, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %71 = load i64, i64* %forof.idx, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = icmp ult i64 %71, %73
  br i1 %74, label %forof.body, label %forof.end

forof.body:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %77 = bitcast i8* %76 to i32*
  %78 = getelementptr inbounds i32, i32* %77, i64 %71
  %79 = load i32, i32* %78, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %79, i32* %ecn.addr, align 4
  %80 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %81 = load i8*, i8** %80, align 8
  %82 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %83 = load i64, i64* %82, align 8
  %84 = load i32, i32* %ecn.addr, align 4
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*))
  %88 = load i32, i32* %sender.addr, align 4
  %89 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %90 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %91 = load i32, i32* %ecn.addr, align 4
  %92 = add i64 0, 16
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 0
  %94 = load i64, i64* %93, align 8
  %95 = icmp ule i64 0, %92
  %96 = icmp ule i64 %92, %94
  %97 = and i1 %95, %96
  br i1 %97, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %92, i64 %94)
  unreachable

net.ok.1:
  %98 = call i32 @nish_udp_send_to(i32 %88, %struct.nish_array* %89, i64 0, i64 16, %struct.nish_array* %90, i32 0, i32 %91)
  %99 = call i8* @nish_str_from_i32(i32 %98)
  %100 = call i8* @nish_str_concat(i8* %87, i8* %99)
  call void @nish_print(i8* %100)
  %101 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %102 = load i8*, i8** %101, align 8
  %103 = icmp eq i8* %102, %81
  br i1 %103, label %pass.rewind, label %pass.free

pass.rewind:
  %104 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %83, i64* %104, align 8
  br label %pass.done

pass.free:
  %105 = ptrtoint i8* %81 to i64
  %106 = add i64 %105, %83
  call void @nish_arena_release(i64 %106)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %107 = load i64, i64* %forof.idx, align 8
  %108 = add i64 %107, 1
  store i64 %108, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %109 = load i32, i32* %sender.addr, align 4
  %110 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %111 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %112 = add i64 0, 16
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 0
  %114 = load i64, i64* %113, align 8
  %115 = icmp ule i64 0, %112
  %116 = icmp ule i64 %112, %114
  %117 = and i1 %115, %116
  br i1 %117, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %112, i64 %114)
  unreachable

net.ok.2:
  %118 = call i32 @nish_udp_send_to(i32 %109, %struct.nish_array* %110, i64 0, i64 16, %struct.nish_array* %111, i32 0, i32 0)
  %119 = call i8* @nish_str_from_i32(i32 %118)
  %120 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.5 to i8*), i8* %119)
  call void @nish_print(i8* %120)
  %121 = load i32, i32* %sender.addr, align 4
  %122 = call i32 @nish_net_close(i32 %121)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %122

if.end:
  %123 = call i8* @nish_alloc_struct(i64 24)
  %124 = bitcast i8* %123 to %struct.nish_array*
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 0
  store i64 65536, i64* %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 1
  store i64 65536, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %127 = call i8* @nish_alloc_struct(i64 65536)
  call void @llvm.memset.p0i8.i64(i8* align 8 %127, i8 0, i64 65536, i1 false), !alias.scope !4, !noalias !3
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 2
  store i8* %127, i8** %128, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %124, %struct.nish_array** %buf.addr, align 8
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 18, i64* %129, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 18, i64* %130, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %131 = bitcast [18 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %131, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %131, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %from.addr, align 8
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %135 = bitcast [2 x i32]* %arr.data.3 to i8*
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %135, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %137 = bitcast i8* %135 to i32*
  %138 = getelementptr inbounds i32, i32* %137, i64 0
  store i32 0, i32* %138, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %139 = getelementptr inbounds i32, i32* %137, i64 1
  store i32 0, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %meta.addr, align 8
  %140 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 2)
  store i32 %140, i32* %gro.addr, align 4
  %141 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %141, i32* %plain.addr, align 4
  %142 = load i32, i32* %gro.addr, align 4
  %143 = load i32, i32* %plain.addr, align 4
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 2, i64* %144, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 2, i64* %145, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %146 = bitcast [2 x i32]* %arr.data.4 to i8*
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %146, i8** %147, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %148 = bitcast i8* %146 to i32*
  %149 = getelementptr inbounds i32, i32* %148, i64 0
  store i32 %142, i32* %149, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %150 = getelementptr inbounds i32, i32* %148, i64 1
  store i32 %143, i32* %150, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %151 = load i64, i64* %forof.idx.1, align 8
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  %153 = load i64, i64* %152, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %154 = icmp ult i64 %151, %153
  br i1 %154, label %forof.body.1, label %forof.end.1

forof.body.1:
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %157 = bitcast i8* %156 to i32*
  %158 = getelementptr inbounds i32, i32* %157, i64 %151
  %159 = load i32, i32* %158, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %159, i32* %fd.addr, align 4
  %160 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %161 = load i8*, i8** %160, align 8
  %162 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %163 = load i64, i64* %162, align 8
  %164 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %165 = load i32, i32* %fd.addr, align 4
  %166 = call i32 @nish_net_local_port(i32 %165)
  %167 = call i32 @nish_net_address(%struct.nish_array* %164, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %166)
  %168 = load i32, i32* %sender.addr, align 4
  %169 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %170 = sext i32 4800 to i64
  %171 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %172 = add i64 0, %170
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %169, i64 0, i32 0
  %174 = load i64, i64* %173, align 8
  %175 = icmp ule i64 0, %172
  %176 = icmp ule i64 %172, %174
  %177 = and i1 %175, %176
  br i1 %177, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %172, i64 %174)
  unreachable

net.ok.3:
  %178 = call i32 @nish_udp_send_to(i32 %168, %struct.nish_array* %169, i64 0, i64 %170, %struct.nish_array* %171, i32 1200, i32 0)
  %179 = load i32, i32* %fd.addr, align 4
  %180 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %181 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %182 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %183 = call i32 @receive(i32 %179, %struct.nish_array* %180, %struct.nish_array* %181, %struct.nish_array* %182)
  store i32 %183, i32* %n.addr, align 4
  %184 = load i32, i32* %fd.addr, align 4
  %185 = load i32, i32* %gro.addr, align 4
  %186 = icmp eq i32 %184, %185
  br i1 %186, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %187 = phi i8* [ bitcast ({ i64, [4 x i8] }* @.str.6 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), %cond.false ]
  %188 = call i8* @nish_str_concat(i8* %187, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %189 = load i32, i32* %n.addr, align 4
  %190 = call i8* @nish_str_from_i32(i32 %189)
  %191 = call i8* @nish_str_concat(i8* %188, i8* %190)
  %192 = call i8* @nish_str_concat(i8* %191, i8* bitcast ({ i64, [17 x i8] }* @.str.9 to i8*))
  %193 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %193, i64 0, i32 0
  %195 = load i64, i64* %194, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %196 = icmp ult i64 0, %195
  br i1 %196, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %195)
  unreachable

bounds.ok.1:
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %193, i64 0, i32 2
  %198 = load i8*, i8** %197, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %199 = bitcast i8* %198 to i32*
  %200 = getelementptr inbounds i32, i32* %199, i64 0
  %201 = load i32, i32* %200, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %202 = call i8* @nish_str_from_i32(i32 %201)
  %203 = call i8* @nish_str_concat(i8* %192, i8* %202)
  %204 = call i8* @nish_str_concat(i8* %203, i8* bitcast ({ i64, [10 x i8] }* @.str.10 to i8*))
  %205 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %206 = load i32, i32* %n.addr, align 4
  %207 = call i1 @intact(%struct.nish_array* %205, i32 %206)
  %208 = select i1 %207, i8* bitcast ({ i64, [5 x i8] }* @.str.11 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.12 to i8*)
  %209 = call i8* @nish_str_concat(i8* %204, i8* %208)
  call void @nish_print(i8* %209)
  %210 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %211 = load i8*, i8** %210, align 8
  %212 = icmp eq i8* %211, %161
  br i1 %212, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %213 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %163, i64* %213, align 8
  br label %pass.done.1

pass.free.1:
  %214 = ptrtoint i8* %161 to i64
  %215 = add i64 %214, %163
  call void @nish_arena_release(i64 %215)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc.1

forof.inc.1:
  %216 = load i64, i64* %forof.idx.1, align 8
  %217 = add i64 %216, 1
  store i64 %217, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %218 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %219 = load i32, i32* %plain.addr, align 4
  %220 = call i32 @nish_net_local_port(i32 %219)
  %221 = call i32 @nish_net_address(%struct.nish_array* %218, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %220)
  %222 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 4, i64* %222, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 4, i64* %223, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %224 = bitcast [4 x i32]* %arr.data.5 to i8*
  %225 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %224, i8** %225, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %226 = bitcast i8* %224 to i32*
  %227 = getelementptr inbounds i32, i32* %226, i64 0
  store i32 1, i32* %227, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %228 = getelementptr inbounds i32, i32* %226, i64 1
  store i32 2, i32* %228, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %229 = getelementptr inbounds i32, i32* %226, i64 2
  store i32 3, i32* %229, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %230 = getelementptr inbounds i32, i32* %226, i64 3
  store i32 0, i32* %230, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.cond.2:
  %231 = load i64, i64* %forof.idx.2, align 8
  %232 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  %233 = load i64, i64* %232, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %234 = icmp ult i64 %231, %233
  br i1 %234, label %forof.body.2, label %forof.end.2

forof.body.2:
  %235 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  %236 = load i8*, i8** %235, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %237 = bitcast i8* %236 to i32*
  %238 = getelementptr inbounds i32, i32* %237, i64 %231
  %239 = load i32, i32* %238, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %239, i32* %ecn.addr.1, align 4
  %240 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %241 = load i8*, i8** %240, align 8
  %242 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %243 = load i64, i64* %242, align 8
  %244 = load i32, i32* %sender.addr, align 4
  %245 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %246 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %247 = load i32, i32* %ecn.addr.1, align 4
  %248 = add i64 0, 16
  %249 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %245, i64 0, i32 0
  %250 = load i64, i64* %249, align 8
  %251 = icmp ule i64 0, %248
  %252 = icmp ule i64 %248, %250
  %253 = and i1 %251, %252
  br i1 %253, label %net.ok.4, label %net.fail.4

net.fail.4:
  call void @nish_panic_slice(i64 0, i64 %248, i64 %250)
  unreachable

net.ok.4:
  %254 = call i32 @nish_udp_send_to(i32 %244, %struct.nish_array* %245, i64 0, i64 16, %struct.nish_array* %246, i32 0, i32 %247)
  %255 = load i32, i32* %plain.addr, align 4
  %256 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %257 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %258 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %259 = call i32 @receive(i32 %255, %struct.nish_array* %256, %struct.nish_array* %257, %struct.nish_array* %258)
  store i32 %259, i32* %n.addr.1, align 4
  br label %while.cond

while.cond:
  %260 = load i32, i32* %n.addr.1, align 4
  %261 = icmp eq i32 %260, 1200
  br i1 %261, label %while.body, label %while.end

while.body:
  %262 = load i32, i32* %plain.addr, align 4
  %263 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %264 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %265 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %266 = call i32 @receive(i32 %262, %struct.nish_array* %263, %struct.nish_array* %264, %struct.nish_array* %265)
  store i32 %266, i32* %n.addr.1, align 4
  br label %while.cond

while.end:
  %267 = load i32, i32* %ecn.addr.1, align 4
  %268 = call i8* @nish_str_from_i32(i32 %267)
  %269 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* %268)
  %270 = call i8* @nish_str_concat(i8* %269, i8* bitcast ({ i64, [3 x i8] }* @.str.13 to i8*))
  %271 = load i32, i32* %n.addr.1, align 4
  %272 = call i8* @nish_str_from_i32(i32 %271)
  %273 = call i8* @nish_str_concat(i8* %270, i8* %272)
  %274 = call i8* @nish_str_concat(i8* %273, i8* bitcast ({ i64, [13 x i8] }* @.str.14 to i8*))
  %275 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %276 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %275, i64 0, i32 0
  %277 = load i64, i64* %276, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %278 = icmp ult i64 1, %277
  br i1 %278, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %277)
  unreachable

bounds.ok.2:
  %279 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %275, i64 0, i32 2
  %280 = load i8*, i8** %279, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %281 = bitcast i8* %280 to i32*
  %282 = getelementptr inbounds i32, i32* %281, i64 1
  %283 = load i32, i32* %282, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %284 = call i8* @nish_str_from_i32(i32 %283)
  %285 = call i8* @nish_str_concat(i8* %274, i8* %284)
  call void @nish_print(i8* %285)
  %286 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %287 = load i8*, i8** %286, align 8
  %288 = icmp eq i8* %287, %241
  br i1 %288, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %289 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %243, i64* %289, align 8
  br label %pass.done.2

pass.free.2:
  %290 = ptrtoint i8* %241 to i64
  %291 = add i64 %290, %243
  call void @nish_arena_release(i64 %291)
  br label %pass.done.2

pass.done.2:
  br label %forof.inc.2

forof.inc.2:
  %292 = load i64, i64* %forof.idx.2, align 8
  %293 = add i64 %292, 1
  store i64 %293, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.end.2:
  %294 = load i32, i32* %sender.addr, align 4
  %295 = call i32 @nish_net_close(i32 %294)
  %296 = load i32, i32* %gro.addr, align 4
  %297 = call i32 @nish_net_close(i32 %296)
  %298 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %295, i32 %297)
  %299 = extractvalue { i32, i1 } %298, 0
  %300 = extractvalue { i32, i1 } %298, 1
  br i1 %300, label %ovf.fail, label %ovf.ok

ovf.ok:
  %301 = load i32, i32* %plain.addr, align 4
  %302 = call i32 @nish_net_close(i32 %301)
  %303 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %299, i32 %302)
  %304 = extractvalue { i32, i1 } %303, 0
  %305 = extractvalue { i32, i1 } %303, 1
  br i1 %305, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %304

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
