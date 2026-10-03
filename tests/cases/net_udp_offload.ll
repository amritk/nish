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
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare noundef i32 @nish_net_local_port(i32 noundef) #2
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #4
declare void @nish_panic_div(i1 noundef zeroext) #4
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

define internal noundef zeroext i1 @intact(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %n) #0 {
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
  %17 = icmp eq i32 251, 0
  %18 = icmp eq i32 %16, -2147483648
  %19 = icmp eq i32 251, -1
  %20 = and i1 %18, %19
  %21 = or i1 %17, %20
  br i1 %21, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %17)
  unreachable

div.ok:
  %22 = srem i32 %16, 251
  %23 = icmp ne i32 %15, %22
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  ret i1 false

if.end.1:
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
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
  %30 = icmp eq i32 251, 0
  %31 = icmp eq i32 %29, -2147483648
  %32 = icmp eq i32 251, -1
  %33 = and i1 %31, %32
  %34 = or i1 %30, %33
  br i1 %34, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %30)
  unreachable

div.ok:
  %35 = srem i32 %29, 251
  %36 = trunc i32 %35 to i8
  %37 = bitcast i8* %23 to i8*
  %38 = getelementptr inbounds i8, i8* %37, i64 %28
  store i8 %36, i8* %38, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %43 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %43, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %to.addr, align 8
  %45 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 0)
  store i32 %45, i32* %sender.addr, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %47 = load i32, i32* %node.addr, align 4
  %48 = call i32 @nish_net_address(%struct.nish_array* %46, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %47)
  %49 = load i32, i32* %sender.addr, align 4
  %50 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %51 = sext i32 4800 to i64
  %52 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %53 = add i64 0, %51
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %55 = load i64, i64* %54, align 8
  %56 = icmp ule i64 0, %53
  %57 = icmp ule i64 %53, %55
  %58 = and i1 %56, %57
  br i1 %58, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %53, i64 %55)
  unreachable

net.ok:
  %59 = call i32 @nish_udp_send_to(i32 %49, %struct.nish_array* %50, i64 0, i64 %51, %struct.nish_array* %52, i32 1200, i32 0)
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.2 to i8*), i8* %60)
  call void @nish_print(i8* %61)
  %62 = call i8* @nish_alloc_struct(i64 24)
  %63 = bitcast i8* %62 to %struct.nish_array*
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  store i64 65536, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 1
  store i64 65536, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %66 = call i8* @nish_alloc_struct(i64 65536)
  call void @llvm.memset.p0i8.i64(i8* align 8 %66, i8 0, i64 65536, i1 false), !alias.scope !4, !noalias !3
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  store i8* %66, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %63, %struct.nish_array** %buf.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 18, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 18, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %70 = bitcast [18 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %70, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %70, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %from.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %74 = bitcast [2 x i32]* %arr.data.2 to i8*
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %74, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %76 = bitcast i8* %74 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 0
  store i32 0, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %78 = getelementptr inbounds i32, i32* %76, i64 1
  store i32 0, i32* %78, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %meta.addr, align 8
  %79 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 2)
  store i32 %79, i32* %gro.addr, align 4
  %80 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 0)
  store i32 %80, i32* %plain.addr, align 4
  %81 = load i32, i32* %gro.addr, align 4
  %82 = load i32, i32* %plain.addr, align 4
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %85 = bitcast [2 x i32]* %arr.data.3 to i8*
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %85, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %87 = bitcast i8* %85 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 0
  store i32 %81, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %89 = getelementptr inbounds i32, i32* %87, i64 1
  store i32 %82, i32* %89, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %90 = load i64, i64* %forof.idx, align 8
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = icmp ult i64 %90, %92
  br i1 %93, label %forof.body, label %forof.end

forof.body:
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %96 = bitcast i8* %95 to i32*
  %97 = getelementptr inbounds i32, i32* %96, i64 %90
  %98 = load i32, i32* %97, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %98, i32* %fd.addr, align 4
  %99 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %100 = load i8*, i8** %99, align 8
  %101 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %102 = load i64, i64* %101, align 8
  %103 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %104 = load i32, i32* %fd.addr, align 4
  %105 = call i32 @nish_net_local_port(i32 %104)
  %106 = call i32 @nish_net_address(%struct.nish_array* %103, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %105)
  %107 = load i32, i32* %sender.addr, align 4
  %108 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %109 = sext i32 4800 to i64
  %110 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %111 = add i64 0, %109
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %113 = load i64, i64* %112, align 8
  %114 = icmp ule i64 0, %111
  %115 = icmp ule i64 %111, %113
  %116 = and i1 %114, %115
  br i1 %116, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %111, i64 %113)
  unreachable

net.ok.1:
  %117 = call i32 @nish_udp_send_to(i32 %107, %struct.nish_array* %108, i64 0, i64 %109, %struct.nish_array* %110, i32 1200, i32 0)
  %118 = load i32, i32* %fd.addr, align 4
  %119 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %120 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %121 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %122 = call i32 @receive(i32 %118, %struct.nish_array* %119, %struct.nish_array* %120, %struct.nish_array* %121)
  store i32 %122, i32* %n.addr, align 4
  %123 = load i32, i32* %fd.addr, align 4
  %124 = load i32, i32* %gro.addr, align 4
  %125 = icmp eq i32 %123, %124
  br i1 %125, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %126 = phi i8* [ bitcast ({ i64, [4 x i8] }* @.str.3 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.4 to i8*), %cond.false ]
  %127 = call i8* @nish_str_concat(i8* %126, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %128 = load i32, i32* %n.addr, align 4
  %129 = call i8* @nish_str_from_i32(i32 %128)
  %130 = call i8* @nish_str_concat(i8* %127, i8* %129)
  %131 = call i8* @nish_str_concat(i8* %130, i8* bitcast ({ i64, [17 x i8] }* @.str.6 to i8*))
  %132 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 0
  %134 = load i64, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %135 = icmp ult i64 0, %134
  br i1 %135, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %134)
  unreachable

bounds.ok.1:
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %138 = bitcast i8* %137 to i32*
  %139 = getelementptr inbounds i32, i32* %138, i64 0
  %140 = load i32, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %141 = call i8* @nish_str_from_i32(i32 %140)
  %142 = call i8* @nish_str_concat(i8* %131, i8* %141)
  %143 = call i8* @nish_str_concat(i8* %142, i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*))
  %144 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %145 = load i32, i32* %n.addr, align 4
  %146 = call i1 @intact(%struct.nish_array* %144, i32 %145)
  %147 = select i1 %146, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %148 = call i8* @nish_str_concat(i8* %143, i8* %147)
  call void @nish_print(i8* %148)
  %149 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %150 = load i8*, i8** %149, align 8
  %151 = icmp eq i8* %150, %100
  br i1 %151, label %pass.rewind, label %pass.free

pass.rewind:
  %152 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %102, i64* %152, align 8
  br label %pass.done

pass.free:
  %153 = ptrtoint i8* %100 to i64
  %154 = add i64 %153, %102
  call void @nish_arena_release(i64 %154)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %155 = load i64, i64* %forof.idx, align 8
  %156 = add i64 %155, 1
  store i64 %156, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %157 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %158 = load i32, i32* %plain.addr, align 4
  %159 = call i32 @nish_net_local_port(i32 %158)
  %160 = call i32 @nish_net_address(%struct.nish_array* %157, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 %159)
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 4, i64* %161, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 4, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %163 = bitcast [4 x i32]* %arr.data.4 to i8*
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %163, i8** %164, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %165 = bitcast i8* %163 to i32*
  %166 = getelementptr inbounds i32, i32* %165, i64 0
  store i32 1, i32* %166, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %167 = getelementptr inbounds i32, i32* %165, i64 1
  store i32 2, i32* %167, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %168 = getelementptr inbounds i32, i32* %165, i64 2
  store i32 3, i32* %168, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %169 = getelementptr inbounds i32, i32* %165, i64 3
  store i32 0, i32* %169, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %170 = load i64, i64* %forof.idx.1, align 8
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  %172 = load i64, i64* %171, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %173 = icmp ult i64 %170, %172
  br i1 %173, label %forof.body.1, label %forof.end.1

forof.body.1:
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  %175 = load i8*, i8** %174, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %176 = bitcast i8* %175 to i32*
  %177 = getelementptr inbounds i32, i32* %176, i64 %170
  %178 = load i32, i32* %177, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %178, i32* %ecn.addr, align 4
  %179 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %180 = load i8*, i8** %179, align 8
  %181 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %182 = load i64, i64* %181, align 8
  %183 = load i32, i32* %sender.addr, align 4
  %184 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %185 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %186 = load i32, i32* %ecn.addr, align 4
  %187 = add i64 0, 16
  %188 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %184, i64 0, i32 0
  %189 = load i64, i64* %188, align 8
  %190 = icmp ule i64 0, %187
  %191 = icmp ule i64 %187, %189
  %192 = and i1 %190, %191
  br i1 %192, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %187, i64 %189)
  unreachable

net.ok.2:
  %193 = call i32 @nish_udp_send_to(i32 %183, %struct.nish_array* %184, i64 0, i64 16, %struct.nish_array* %185, i32 0, i32 %186)
  %194 = load i32, i32* %plain.addr, align 4
  %195 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %196 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %197 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %198 = call i32 @receive(i32 %194, %struct.nish_array* %195, %struct.nish_array* %196, %struct.nish_array* %197)
  store i32 %198, i32* %n.addr.1, align 4
  br label %while.cond

while.cond:
  %199 = load i32, i32* %n.addr.1, align 4
  %200 = icmp eq i32 %199, 1200
  br i1 %200, label %while.body, label %while.end

while.body:
  %201 = load i32, i32* %plain.addr, align 4
  %202 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %203 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %204 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %205 = call i32 @receive(i32 %201, %struct.nish_array* %202, %struct.nish_array* %203, %struct.nish_array* %204)
  store i32 %205, i32* %n.addr.1, align 4
  br label %while.cond

while.end:
  %206 = load i32, i32* %ecn.addr, align 4
  %207 = call i8* @nish_str_from_i32(i32 %206)
  %208 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i8* %207)
  %209 = call i8* @nish_str_concat(i8* %208, i8* bitcast ({ i64, [3 x i8] }* @.str.11 to i8*))
  %210 = load i32, i32* %n.addr.1, align 4
  %211 = call i8* @nish_str_from_i32(i32 %210)
  %212 = call i8* @nish_str_concat(i8* %209, i8* %211)
  %213 = call i8* @nish_str_concat(i8* %212, i8* bitcast ({ i64, [13 x i8] }* @.str.12 to i8*))
  %214 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %214, i64 0, i32 0
  %216 = load i64, i64* %215, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %217 = icmp ult i64 1, %216
  br i1 %217, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %216)
  unreachable

bounds.ok.2:
  %218 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %214, i64 0, i32 2
  %219 = load i8*, i8** %218, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %220 = bitcast i8* %219 to i32*
  %221 = getelementptr inbounds i32, i32* %220, i64 1
  %222 = load i32, i32* %221, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %223 = call i8* @nish_str_from_i32(i32 %222)
  %224 = call i8* @nish_str_concat(i8* %213, i8* %223)
  call void @nish_print(i8* %224)
  %225 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %226 = load i8*, i8** %225, align 8
  %227 = icmp eq i8* %226, %180
  br i1 %227, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %228 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %182, i64* %228, align 8
  br label %pass.done.1

pass.free.1:
  %229 = ptrtoint i8* %180 to i64
  %230 = add i64 %229, %182
  call void @nish_arena_release(i64 %230)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc.1

forof.inc.1:
  %231 = load i64, i64* %forof.idx.1, align 8
  %232 = add i64 %231, 1
  store i64 %232, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %233 = load i32, i32* %sender.addr, align 4
  %234 = call i32 @nish_net_close(i32 %233)
  %235 = load i32, i32* %gro.addr, align 4
  %236 = call i32 @nish_net_close(i32 %235)
  %237 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %234, i32 %236)
  %238 = extractvalue { i32, i1 } %237, 0
  %239 = extractvalue { i32, i1 } %237, 1
  br i1 %239, label %ovf.fail, label %ovf.ok

ovf.ok:
  %240 = load i32, i32* %plain.addr, align 4
  %241 = call i32 @nish_net_close(i32 %240)
  %242 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %238, i32 %241)
  %243 = extractvalue { i32, i1 } %242, 0
  %244 = extractvalue { i32, i1 } %242, 1
  br i1 %244, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %243

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
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
