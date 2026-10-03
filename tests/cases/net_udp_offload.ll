%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"gso sent \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"gro\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"plain\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c" bytes, segment \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c", intact \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"ecn \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" bytes, ecn \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare noundef i32 @nish_net_local_port(i32 noundef) #2
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  %29 = icmp eq i32 251, 0
  %30 = icmp eq i32 %28, -2147483648
  %31 = icmp eq i32 251, -1
  %32 = and i1 %30, %31
  %33 = or i1 %29, %32
  br i1 %33, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %29)
  unreachable

div.ok:
  %34 = srem i32 %28, 251
  %35 = trunc i32 %34 to i8
  %36 = bitcast i8* %22 to i8*
  %37 = getelementptr inbounds i8, i8* %36, i64 %27
  store i8 %35, i8* %37, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %38 = load i32, i32* %i.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %42 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %42, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %42, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %to.addr, align 8
  %44 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %44, i32* %sender.addr, align 4
  %45 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %46 = load i32, i32* %node.addr, align 4
  %47 = call i32 @nish_net_address(%struct.nish_array* %45, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %46)
  %48 = load i32, i32* %sender.addr, align 4
  %49 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %50 = sext i32 4800 to i64
  %51 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %52 = add i64 0, %50
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %54 = load i64, i64* %53, align 8
  %55 = icmp ule i64 0, %52
  %56 = icmp ule i64 %52, %54
  %57 = and i1 %55, %56
  br i1 %57, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %52, i64 %54)
  unreachable

net.ok:
  %58 = call i32 @nish_udp_send_to(i32 %48, %struct.nish_array* %49, i64 0, i64 %50, %struct.nish_array* %51, i32 1200, i32 0)
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i8* %59)
  call void @nish_print(i8* %60)
  %61 = call i8* @nish_alloc_struct(i64 24)
  %62 = bitcast i8* %61 to %struct.nish_array*
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  store i64 65536, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 1
  store i64 65536, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %65 = call i8* @nish_alloc_struct(i64 65536)
  call void @llvm.memset.p0i8.i64(i8* align 8 %65, i8 0, i64 65536, i1 false), !alias.scope !4, !noalias !3
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %62, %struct.nish_array** %buf.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 18, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 18, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %69 = bitcast [18 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %69, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %69, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %from.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %73 = bitcast [2 x i32]* %arr.data.2 to i8*
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %73, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %75 = bitcast i8* %73 to i32*
  %76 = getelementptr inbounds i32, i32* %75, i64 0
  store i32 0, i32* %76, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %77 = getelementptr inbounds i32, i32* %75, i64 1
  store i32 0, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %meta.addr, align 8
  %78 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 2)
  store i32 %78, i32* %gro.addr, align 4
  %79 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %79, i32* %plain.addr, align 4
  %80 = load i32, i32* %gro.addr, align 4
  %81 = load i32, i32* %plain.addr, align 4
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %84 = bitcast [2 x i32]* %arr.data.3 to i8*
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %84, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %86 = bitcast i8* %84 to i32*
  %87 = getelementptr inbounds i32, i32* %86, i64 0
  store i32 %80, i32* %87, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %88 = getelementptr inbounds i32, i32* %86, i64 1
  store i32 %81, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %89 = load i64, i64* %forof.idx, align 8
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  %91 = load i64, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = icmp ult i64 %89, %91
  br i1 %92, label %forof.body, label %forof.end

forof.body:
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  %94 = load i8*, i8** %93, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %95 = bitcast i8* %94 to i32*
  %96 = getelementptr inbounds i32, i32* %95, i64 %89
  %97 = load i32, i32* %96, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %97, i32* %fd.addr, align 4
  %98 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %99 = load i8*, i8** %98, align 8
  %100 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %101 = load i64, i64* %100, align 8
  %102 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %103 = load i32, i32* %fd.addr, align 4
  %104 = call i32 @nish_net_local_port(i32 %103)
  %105 = call i32 @nish_net_address(%struct.nish_array* %102, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %104)
  %106 = load i32, i32* %sender.addr, align 4
  %107 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %108 = sext i32 4800 to i64
  %109 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %110 = add i64 0, %108
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %112 = load i64, i64* %111, align 8
  %113 = icmp ule i64 0, %110
  %114 = icmp ule i64 %110, %112
  %115 = and i1 %113, %114
  br i1 %115, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %110, i64 %112)
  unreachable

net.ok.1:
  %116 = call i32 @nish_udp_send_to(i32 %106, %struct.nish_array* %107, i64 0, i64 %108, %struct.nish_array* %109, i32 1200, i32 0)
  %117 = load i32, i32* %fd.addr, align 4
  %118 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %119 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %120 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %121 = call i32 @receive(i32 %117, %struct.nish_array* %118, %struct.nish_array* %119, %struct.nish_array* %120)
  store i32 %121, i32* %n.addr, align 4
  %122 = load i32, i32* %fd.addr, align 4
  %123 = load i32, i32* %gro.addr, align 4
  %124 = icmp eq i32 %122, %123
  br i1 %124, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %125 = phi i8* [ bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), %cond.false ]
  %126 = call i8* @nish_str_concat(i8* %125, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %127 = load i32, i32* %n.addr, align 4
  %128 = call i8* @nish_str_from_i32(i32 %127)
  %129 = call i8* @nish_str_concat(i8* %126, i8* %128)
  %130 = call i8* @nish_str_concat(i8* %129, i8* bitcast ({ i64, [17 x i8] }* @.str.5 to i8*))
  %131 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 0
  %133 = load i64, i64* %132, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = icmp ult i64 0, %133
  br i1 %134, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %133)
  unreachable

bounds.ok.1:
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 2
  %136 = load i8*, i8** %135, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %137 = bitcast i8* %136 to i32*
  %138 = getelementptr inbounds i32, i32* %137, i64 0
  %139 = load i32, i32* %138, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %140 = call i8* @nish_str_from_i32(i32 %139)
  %141 = call i8* @nish_str_concat(i8* %130, i8* %140)
  %142 = call i8* @nish_str_concat(i8* %141, i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*))
  %143 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %144 = load i32, i32* %n.addr, align 4
  %145 = call i1 @intact(%struct.nish_array* %143, i32 %144)
  %146 = select i1 %145, i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*)
  %147 = call i8* @nish_str_concat(i8* %142, i8* %146)
  call void @nish_print(i8* %147)
  %148 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %149 = load i8*, i8** %148, align 8
  %150 = icmp eq i8* %149, %99
  br i1 %150, label %pass.rewind, label %pass.free

pass.rewind:
  %151 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %101, i64* %151, align 8
  br label %pass.done

pass.free:
  %152 = ptrtoint i8* %99 to i64
  %153 = add i64 %152, %101
  call void @nish_arena_release(i64 %153)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %154 = load i64, i64* %forof.idx, align 8
  %155 = add i64 %154, 1
  store i64 %155, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %156 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %157 = load i32, i32* %plain.addr, align 4
  %158 = call i32 @nish_net_local_port(i32 %157)
  %159 = call i32 @nish_net_address(%struct.nish_array* %156, i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %158)
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 4, i64* %160, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 4, i64* %161, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %162 = bitcast [4 x i32]* %arr.data.4 to i8*
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %162, i8** %163, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %164 = bitcast i8* %162 to i32*
  %165 = getelementptr inbounds i32, i32* %164, i64 0
  store i32 1, i32* %165, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %166 = getelementptr inbounds i32, i32* %164, i64 1
  store i32 2, i32* %166, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %167 = getelementptr inbounds i32, i32* %164, i64 2
  store i32 3, i32* %167, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %168 = getelementptr inbounds i32, i32* %164, i64 3
  store i32 0, i32* %168, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %169 = load i64, i64* %forof.idx.1, align 8
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  %171 = load i64, i64* %170, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %172 = icmp ult i64 %169, %171
  br i1 %172, label %forof.body.1, label %forof.end.1

forof.body.1:
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  %174 = load i8*, i8** %173, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %175 = bitcast i8* %174 to i32*
  %176 = getelementptr inbounds i32, i32* %175, i64 %169
  %177 = load i32, i32* %176, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store i32 %177, i32* %ecn.addr, align 4
  %178 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %179 = load i8*, i8** %178, align 8
  %180 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %181 = load i64, i64* %180, align 8
  %182 = load i32, i32* %sender.addr, align 4
  %183 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %184 = load %struct.nish_array*, %struct.nish_array** %to.addr, align 8
  %185 = load i32, i32* %ecn.addr, align 4
  %186 = add i64 0, 16
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 0
  %188 = load i64, i64* %187, align 8
  %189 = icmp ule i64 0, %186
  %190 = icmp ule i64 %186, %188
  %191 = and i1 %189, %190
  br i1 %191, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %186, i64 %188)
  unreachable

net.ok.2:
  %192 = call i32 @nish_udp_send_to(i32 %182, %struct.nish_array* %183, i64 0, i64 16, %struct.nish_array* %184, i32 0, i32 %185)
  %193 = load i32, i32* %plain.addr, align 4
  %194 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %195 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %196 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %197 = call i32 @receive(i32 %193, %struct.nish_array* %194, %struct.nish_array* %195, %struct.nish_array* %196)
  store i32 %197, i32* %n.addr.1, align 4
  br label %while.cond

while.cond:
  %198 = load i32, i32* %n.addr.1, align 4
  %199 = icmp eq i32 %198, 1200
  br i1 %199, label %while.body, label %while.end

while.body:
  %200 = load i32, i32* %plain.addr, align 4
  %201 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %202 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %203 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %204 = call i32 @receive(i32 %200, %struct.nish_array* %201, %struct.nish_array* %202, %struct.nish_array* %203)
  store i32 %204, i32* %n.addr.1, align 4
  br label %while.cond

while.end:
  %205 = load i32, i32* %ecn.addr, align 4
  %206 = call i8* @nish_str_from_i32(i32 %205)
  %207 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.9 to i8*), i8* %206)
  %208 = call i8* @nish_str_concat(i8* %207, i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*))
  %209 = load i32, i32* %n.addr.1, align 4
  %210 = call i8* @nish_str_from_i32(i32 %209)
  %211 = call i8* @nish_str_concat(i8* %208, i8* %210)
  %212 = call i8* @nish_str_concat(i8* %211, i8* bitcast ({ i64, [13 x i8] }* @.str.11 to i8*))
  %213 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %213, i64 0, i32 0
  %215 = load i64, i64* %214, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %216 = icmp ult i64 1, %215
  br i1 %216, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %215)
  unreachable

bounds.ok.2:
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %213, i64 0, i32 2
  %218 = load i8*, i8** %217, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %219 = bitcast i8* %218 to i32*
  %220 = getelementptr inbounds i32, i32* %219, i64 1
  %221 = load i32, i32* %220, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %222 = call i8* @nish_str_from_i32(i32 %221)
  %223 = call i8* @nish_str_concat(i8* %212, i8* %222)
  call void @nish_print(i8* %223)
  %224 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %225 = load i8*, i8** %224, align 8
  %226 = icmp eq i8* %225, %179
  br i1 %226, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %227 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %181, i64* %227, align 8
  br label %pass.done.1

pass.free.1:
  %228 = ptrtoint i8* %179 to i64
  %229 = add i64 %228, %181
  call void @nish_arena_release(i64 %229)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc.1

forof.inc.1:
  %230 = load i64, i64* %forof.idx.1, align 8
  %231 = add i64 %230, 1
  store i64 %231, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %232 = load i32, i32* %sender.addr, align 4
  %233 = call i32 @nish_net_close(i32 %232)
  %234 = load i32, i32* %gro.addr, align 4
  %235 = call i32 @nish_net_close(i32 %234)
  %236 = add nsw i32 %233, %235
  %237 = load i32, i32* %plain.addr, align 4
  %238 = call i32 @nish_net_close(i32 %237)
  %239 = add nsw i32 %236, %238
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %239
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
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
