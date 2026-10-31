%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"@\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"nish-net-unix-calls-\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"ping\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"pong\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"cd\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"@a\00b\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"-nobody\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"build/test/x.sock\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare i64 @nish_monotonic_nanos() #1
declare noundef i32 @nish_net_read(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_shutdown(i32 noundef, i32 noundef) #1
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_poll_create() #1
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_wait(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef) #0
declare noundef i32 @nish_unix_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_unix_listen_mode(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_unix_connect(i8* noundef nonnull readonly align 8 nocapture) #1
declare noundef i32 @nish_unix_accept(i32 noundef) #0
declare noundef i32 @nish_unix_socket_pair(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @bytesOf(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = call i8* @nish_alloc_struct(i64 %3)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %3, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %6, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %11 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %16 = load i32, i32* %i.addr, align 4
  %17 = trunc i64 %13 to i32
  %18 = icmp slt i32 %16, %17
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load i32, i32* %i.addr, align 4
  %20 = bitcast i8* %s to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  %23 = icmp slt i32 %19, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %for.cond ], [ %23, %land.rhs ]
  br i1 %24, label %for.body, label %for.end

for.body:
  %25 = load i32, i32* %i.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = load i32, i32* %i.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = getelementptr inbounds i8, i8* %s, i64 8
  %30 = getelementptr inbounds i8, i8* %29, i64 %28
  %31 = load i8, i8* %30, align 1
  %32 = zext i8 %31 to i32
  %33 = trunc i32 %32 to i8
  %34 = bitcast i8* %15 to i8*
  %35 = getelementptr inbounds i8, i8* %34, i64 %26
  store i8 %33, i8* %35, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %36 = load i32, i32* %i.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %38 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %38
}

define internal noundef nonnull align 8 i8* @abstract(i8* noundef nonnull noalias readonly align 8 %tag, i32 noundef %n) #1 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8*], align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* %tag, i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  %7 = bitcast i8* %tag to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %n
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 8)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %14
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*) to i64*
  %30 = load i64, i64* %29, align 8
  %31 = sub i64 %28, 1
  %32 = mul i64 %30, %31
  %33 = icmp eq i64 %28, 0
  %34 = select i1 %33, i64 0, i64 %32
  store i64 %34, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %35 = load i64, i64* %join.at, align 8
  %36 = icmp ult i64 %35, %28
  br i1 %36, label %join.sum.body, label %join.copy

join.sum.body:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %38 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %35
  %41 = load i8*, i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %42 = load i64, i64* %join.total, align 8
  %43 = bitcast i8* %41 to i64*
  %44 = load i64, i64* %43, align 8
  %45 = add i64 %42, %44
  store i64 %45, i64* %join.total, align 8
  %46 = add i64 %35, 1
  store i64 %46, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %47 = load i64, i64* %join.total, align 8
  %48 = icmp ugt i64 %47, 2147483647
  %49 = add i64 %47, 9
  %50 = select i1 %48, i64 4611686018427387904, i64 %49
  %51 = call i8* @nish_alloc_struct(i64 %50)
  %52 = bitcast i8* %51 to i64*
  store i64 %47, i64* %52, align 8
  %53 = getelementptr inbounds i8, i8* %51, i64 8
  store i8* %53, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %54 = load i64, i64* %join.at, align 8
  %55 = icmp ult i64 %54, %28
  br i1 %55, label %join.part, label %join.end

join.part:
  %56 = load i8*, i8** %join.p, align 8
  %57 = icmp eq i64 %54, 0
  %58 = select i1 %57, i64 0, i64 %30
  %59 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %56, i8* %59, i64 %58, i1 false)
  %60 = getelementptr inbounds i8, i8* %56, i64 %58
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %54
  %65 = load i8*, i8** %64, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %66 = bitcast i8* %65 to i64*
  %67 = load i64, i64* %66, align 8
  %68 = getelementptr inbounds i8, i8* %65, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %60, i8* %68, i64 %67, i1 false)
  %69 = getelementptr inbounds i8, i8* %60, i64 %67
  store i8* %69, i8** %join.p, align 8
  %70 = add i64 %54, 1
  store i64 %70, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %71 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %71, align 1
  ret i8* %51
}

define internal noundef nonnull align 8 i8* @text(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %n) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %chr = alloca i8, align 1
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  ret i8* %1

if.end:
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = load i32, i32* %i.addr, align 4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp slt i32 %7, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %15
  %20 = load i8, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = zext i8 %20 to i64
  %22 = trunc i64 %21 to i8
  store i8 %22, i8* %chr, align 1
  %23 = call i8* @nish_str_new(i8* %chr, i64 1)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %13, i64 8)
  br label %push.store

push.store:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 %25
  store i8* %23, i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  br label %for.inc

for.inc:
  %35 = load i32, i32* %i.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %37 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*) to i64*
  %41 = load i64, i64* %40, align 8
  %42 = sub i64 %39, 1
  %43 = mul i64 %41, %42
  %44 = icmp eq i64 %39, 0
  %45 = select i1 %44, i64 0, i64 %43
  store i64 %45, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %46 = load i64, i64* %join.at, align 8
  %47 = icmp ult i64 %46, %39
  br i1 %47, label %join.sum.body, label %join.copy

join.sum.body:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to i8**
  %51 = getelementptr inbounds i8*, i8** %50, i64 %46
  %52 = load i8*, i8** %51, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %53 = load i64, i64* %join.total, align 8
  %54 = bitcast i8* %52 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = add i64 %53, %55
  store i64 %56, i64* %join.total, align 8
  %57 = add i64 %46, 1
  store i64 %57, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %58 = load i64, i64* %join.total, align 8
  %59 = icmp ugt i64 %58, 2147483647
  %60 = add i64 %58, 9
  %61 = select i1 %59, i64 4611686018427387904, i64 %60
  %62 = call i8* @nish_alloc_struct(i64 %61)
  %63 = bitcast i8* %62 to i64*
  store i64 %58, i64* %63, align 8
  %64 = getelementptr inbounds i8, i8* %62, i64 8
  store i8* %64, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %65 = load i64, i64* %join.at, align 8
  %66 = icmp ult i64 %65, %39
  br i1 %66, label %join.part, label %join.end

join.part:
  %67 = load i8*, i8** %join.p, align 8
  %68 = icmp eq i64 %65, 0
  %69 = select i1 %68, i64 0, i64 %41
  %70 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %67, i8* %70, i64 %69, i1 false)
  %71 = getelementptr inbounds i8, i8* %67, i64 %69
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %74 = bitcast i8* %73 to i8**
  %75 = getelementptr inbounds i8*, i8** %74, i64 %65
  %76 = load i8*, i8** %75, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %77 = bitcast i8* %76 to i64*
  %78 = load i64, i64* %77, align 8
  %79 = getelementptr inbounds i8, i8* %76, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %71, i8* %79, i64 %78, i1 false)
  %80 = getelementptr inbounds i8, i8* %71, i64 %78
  store i8* %80, i8** %join.p, align 8
  %81 = add i64 %65, 1
  store i64 %81, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %82 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %82, align 1
  ret i8* %62
}

define internal noundef i32 @send$(i32 noundef %fd, i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %b.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @bytesOf(i8* %s)
  store %struct.nish_array* %0, %struct.nish_array** %b.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %2 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = sext i32 %5 to i64
  %7 = add i64 0, %6
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %9 = load i64, i64* %8, align 8
  %10 = icmp ule i64 0, %7
  %11 = icmp ule i64 %7, %9
  %12 = and i1 %10, %11
  br i1 %12, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %7, i64 %9)
  unreachable

net.ok:
  %13 = call i32 @nish_net_write(i32 %fd, %struct.nish_array* %1, i64 0, i64 %6)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %13
}

define noundef i32 @nish_main() #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [64 x i8], align 8
  %tag.addr = alloca i8*, align 8
  %NAME.addr = alloca i8*, align 8
  %listener.addr = alloca i32, align 4
  %client.addr = alloca i32, align 4
  %loop.addr = alloca i32, align 4
  %ready.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %conn.addr = alloca i32, align 4
  %pair.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i32], align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [1 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [64 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 64, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %4 = call i64 @nish_monotonic_nanos()
  %5 = call i8* @nish_str_from_i64(i64 %4)
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [21 x i8] }* @.str.4 to i8*), i8* %5)
  store i8* %6, i8** %tag.addr, align 8
  %7 = load i8*, i8** %tag.addr, align 8
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %7)
  store i8* %8, i8** %NAME.addr, align 8
  %9 = load i8*, i8** %NAME.addr, align 8
  %10 = call i32 @nish_unix_listen(i8* %9, i32 4, i32 0)
  store i32 %10, i32* %listener.addr, align 4
  %11 = load i32, i32* %listener.addr, align 4
  %12 = icmp sge i32 %11, 0
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %13)
  %14 = load i32, i32* %listener.addr, align 4
  %15 = call i32 @nish_unix_accept(i32 %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = load i8*, i8** %NAME.addr, align 8
  %18 = call i32 @nish_unix_connect(i8* %17)
  store i32 %18, i32* %client.addr, align 4
  %19 = load i32, i32* %client.addr, align 4
  %20 = icmp sge i32 %19, 0
  %21 = select i1 %20, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %21)
  %22 = call i32 @nish_poll_create()
  store i32 %22, i32* %loop.addr, align 4
  %23 = load i32, i32* %loop.addr, align 4
  %24 = load i32, i32* %listener.addr, align 4
  %25 = call i32 @nish_poll_add(i32 %23, i32 %24, i32 1, i32 0)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = mul i64 2, 4
  %29 = bitcast [2 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %29, i8 0, i64 %28, i1 false), !alias.scope !4, !noalias !3
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ready.addr, align 8
  %31 = load i32, i32* %loop.addr, align 4
  %32 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %33 = call i32 @nish_poll_wait(i32 %31, %struct.nish_array* %32, i32 2000)
  %34 = icmp eq i32 %33, 1
  br i1 %34, label %cond.true, label %cond.false

cond.true:
  %35 = load i32, i32* %listener.addr, align 4
  %36 = call i32 @nish_unix_accept(i32 %35)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %37 = phi i32 [ %36, %cond.true ], [ -110, %cond.false ]
  store i32 %37, i32* %conn.addr, align 4
  %38 = load i32, i32* %conn.addr, align 4
  %39 = icmp sge i32 %38, 0
  %40 = select i1 %39, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %40)
  %41 = load i32, i32* %client.addr, align 4
  %42 = call i32 @send$(i32 %41, i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*))
  %43 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %43)
  %44 = load i32, i32* %loop.addr, align 4
  %45 = load i32, i32* %conn.addr, align 4
  %46 = call i32 @nish_poll_add(i32 %44, i32 %45, i32 1, i32 1)
  %47 = load i32, i32* %loop.addr, align 4
  %48 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %49 = call i32 @nish_poll_wait(i32 %47, %struct.nish_array* %48, i32 2000)
  %50 = call i8* @nish_str_from_i32(i32 %49)
  call void @nish_print(i8* %50)
  %51 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %52 = load i32, i32* %conn.addr, align 4
  %53 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %54 = add i64 0, 64
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %56 = load i64, i64* %55, align 8
  %57 = icmp ule i64 0, %54
  %58 = icmp ule i64 %54, %56
  %59 = and i1 %57, %58
  br i1 %59, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %54, i64 %56)
  unreachable

net.ok:
  %60 = call i32 @nish_net_read(i32 %52, %struct.nish_array* %53, i64 0, i64 64)
  %61 = call i64 @nish_arena_mark()
  %62 = call i8* @text(%struct.nish_array* %51, i32 %60)
  %63 = call i8* @nish_arena_keep(i64 %61, i8* %62)
  call void @nish_print(i8* %63)
  %64 = load i32, i32* %conn.addr, align 4
  %65 = call i32 @send$(i32 %64, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*))
  %66 = call i8* @nish_str_from_i32(i32 %65)
  call void @nish_print(i8* %66)
  %67 = load i32, i32* %conn.addr, align 4
  %68 = call i32 @nish_net_shutdown(i32 %67, i32 1)
  %69 = call i8* @nish_str_from_i32(i32 %68)
  call void @nish_print(i8* %69)
  %70 = load i32, i32* %loop.addr, align 4
  %71 = load i32, i32* %client.addr, align 4
  %72 = call i32 @nish_poll_add(i32 %70, i32 %71, i32 1, i32 2)
  %73 = load i32, i32* %loop.addr, align 4
  %74 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %75 = call i32 @nish_poll_wait(i32 %73, %struct.nish_array* %74, i32 2000)
  %76 = icmp sge i32 %75, 1
  %77 = select i1 %76, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %77)
  %78 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %79 = load i32, i32* %client.addr, align 4
  %80 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %81 = add i64 0, 64
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %83 = load i64, i64* %82, align 8
  %84 = icmp ule i64 0, %81
  %85 = icmp ule i64 %81, %83
  %86 = and i1 %84, %85
  br i1 %86, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %81, i64 %83)
  unreachable

net.ok.1:
  %87 = call i32 @nish_net_read(i32 %79, %struct.nish_array* %80, i64 0, i64 64)
  %88 = call i64 @nish_arena_mark()
  %89 = call i8* @text(%struct.nish_array* %78, i32 %87)
  %90 = call i8* @nish_arena_keep(i64 %88, i8* %89)
  call void @nish_print(i8* %90)
  %91 = load i32, i32* %client.addr, align 4
  %92 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %93 = add i64 0, 64
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  %95 = load i64, i64* %94, align 8
  %96 = icmp ule i64 0, %93
  %97 = icmp ule i64 %93, %95
  %98 = and i1 %96, %97
  br i1 %98, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %93, i64 %95)
  unreachable

net.ok.2:
  %99 = call i32 @nish_net_read(i32 %91, %struct.nish_array* %92, i64 0, i64 64)
  %100 = call i8* @nish_str_from_i32(i32 %99)
  call void @nish_print(i8* %100)
  %101 = load i8*, i8** %NAME.addr, align 8
  %102 = call i32 @nish_unix_listen(i8* %101, i32 4, i32 0)
  %103 = call i8* @nish_str_from_i32(i32 %102)
  call void @nish_print(i8* %103)
  %104 = load i32, i32* %loop.addr, align 4
  %105 = call i32 @nish_net_close(i32 %104)
  %106 = load i32, i32* %conn.addr, align 4
  %107 = call i32 @nish_net_close(i32 %106)
  %108 = load i32, i32* %client.addr, align 4
  %109 = call i32 @nish_net_close(i32 %108)
  %110 = load i32, i32* %listener.addr, align 4
  %111 = call i32 @nish_net_close(i32 %110)
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %114 = mul i64 2, 4
  %115 = bitcast [2 x i32]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %115, i8 0, i64 %114, i1 false), !alias.scope !4, !noalias !3
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %115, i8** %116, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %pair.addr, align 8
  %117 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %118 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %117)
  %119 = call i8* @nish_str_from_i32(i32 %118)
  call void @nish_print(i8* %119)
  %120 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 0
  %122 = load i64, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %123 = icmp ult i64 0, %122
  br i1 %123, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %122)
  unreachable

bounds.ok:
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %126 = bitcast i8* %125 to i32*
  %127 = getelementptr inbounds i32, i32* %126, i64 0
  %128 = load i32, i32* %127, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %129 = call i32 @send$(i32 %128, i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*))
  %130 = call i8* @nish_str_from_i32(i32 %129)
  call void @nish_print(i8* %130)
  %131 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 0
  %133 = load i64, i64* %132, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = icmp ult i64 0, %133
  br i1 %134, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %133)
  unreachable

bounds.ok.1:
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 2
  %136 = load i8*, i8** %135, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %137 = bitcast i8* %136 to i32*
  %138 = getelementptr inbounds i32, i32* %137, i64 0
  %139 = load i32, i32* %138, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %140 = call i32 @send$(i32 %139, i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*))
  %141 = call i8* @nish_str_from_i32(i32 %140)
  call void @nish_print(i8* %141)
  %142 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %143 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 0
  %145 = load i64, i64* %144, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = icmp ult i64 1, %145
  br i1 %146, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %145)
  unreachable

bounds.ok.2:
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 2
  %148 = load i8*, i8** %147, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %149 = bitcast i8* %148 to i32*
  %150 = getelementptr inbounds i32, i32* %149, i64 1
  %151 = load i32, i32* %150, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %152 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %153 = add i64 0, 64
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %152, i64 0, i32 0
  %155 = load i64, i64* %154, align 8
  %156 = icmp ule i64 0, %153
  %157 = icmp ule i64 %153, %155
  %158 = and i1 %156, %157
  br i1 %158, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %153, i64 %155)
  unreachable

net.ok.3:
  %159 = call i32 @nish_net_read(i32 %151, %struct.nish_array* %152, i64 0, i64 64)
  %160 = call i64 @nish_arena_mark()
  %161 = call i8* @text(%struct.nish_array* %142, i32 %159)
  %162 = call i8* @nish_arena_keep(i64 %160, i8* %161)
  call void @nish_print(i8* %162)
  %163 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 0
  %165 = load i64, i64* %164, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %166 = icmp ult i64 0, %165
  br i1 %166, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %165)
  unreachable

bounds.ok.3:
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 2
  %168 = load i8*, i8** %167, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %169 = bitcast i8* %168 to i32*
  %170 = getelementptr inbounds i32, i32* %169, i64 0
  %171 = load i32, i32* %170, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %172 = call i32 @nish_net_close(i32 %171)
  %173 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 0
  %175 = load i64, i64* %174, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %176 = icmp ult i64 1, %175
  br i1 %176, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %175)
  unreachable

bounds.ok.4:
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 2
  %178 = load i8*, i8** %177, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %179 = bitcast i8* %178 to i32*
  %180 = getelementptr inbounds i32, i32* %179, i64 1
  %181 = load i32, i32* %180, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %182 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %183 = add i64 0, 64
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 0
  %185 = load i64, i64* %184, align 8
  %186 = icmp ule i64 0, %183
  %187 = icmp ule i64 %183, %185
  %188 = and i1 %186, %187
  br i1 %188, label %net.ok.4, label %net.fail.4

net.fail.4:
  call void @nish_panic_slice(i64 0, i64 %183, i64 %185)
  unreachable

net.ok.4:
  %189 = call i32 @nish_net_read(i32 %181, %struct.nish_array* %182, i64 0, i64 64)
  %190 = call i8* @nish_str_from_i32(i32 %189)
  call void @nish_print(i8* %190)
  %191 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 0
  %193 = load i64, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %194 = icmp ult i64 1, %193
  br i1 %194, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %193)
  unreachable

bounds.ok.5:
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 2
  %196 = load i8*, i8** %195, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %197 = bitcast i8* %196 to i32*
  %198 = getelementptr inbounds i32, i32* %197, i64 1
  %199 = load i32, i32* %198, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %200 = call i32 @nish_net_close(i32 %199)
  %201 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %202 = call i32 @nish_unix_socket_pair(i32 2, %struct.nish_array* %201)
  %203 = call i8* @nish_str_from_i32(i32 %202)
  call void @nish_print(i8* %203)
  %204 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %204, i64 0, i32 0
  %206 = load i64, i64* %205, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %207 = icmp ult i64 0, %206
  br i1 %207, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %206)
  unreachable

bounds.ok.6:
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %204, i64 0, i32 2
  %209 = load i8*, i8** %208, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %210 = bitcast i8* %209 to i32*
  %211 = getelementptr inbounds i32, i32* %210, i64 0
  %212 = load i32, i32* %211, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %213 = call i32 @send$(i32 %212, i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*))
  %214 = call i8* @nish_str_from_i32(i32 %213)
  call void @nish_print(i8* %214)
  %215 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %216 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 0
  %217 = load i64, i64* %216, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %218 = icmp ult i64 0, %217
  br i1 %218, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 0, i64 %217)
  unreachable

bounds.ok.7:
  %219 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 2
  %220 = load i8*, i8** %219, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %221 = bitcast i8* %220 to i32*
  %222 = getelementptr inbounds i32, i32* %221, i64 0
  %223 = load i32, i32* %222, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %224 = call i32 @send$(i32 %223, i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*))
  %225 = call i8* @nish_str_from_i32(i32 %224)
  call void @nish_print(i8* %225)
  %226 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %227 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %228 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %227, i64 0, i32 0
  %229 = load i64, i64* %228, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %230 = icmp ult i64 1, %229
  br i1 %230, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 1, i64 %229)
  unreachable

bounds.ok.8:
  %231 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %227, i64 0, i32 2
  %232 = load i8*, i8** %231, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %233 = bitcast i8* %232 to i32*
  %234 = getelementptr inbounds i32, i32* %233, i64 1
  %235 = load i32, i32* %234, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %236 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %237 = add i64 0, 64
  %238 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %236, i64 0, i32 0
  %239 = load i64, i64* %238, align 8
  %240 = icmp ule i64 0, %237
  %241 = icmp ule i64 %237, %239
  %242 = and i1 %240, %241
  br i1 %242, label %net.ok.5, label %net.fail.5

net.fail.5:
  call void @nish_panic_slice(i64 0, i64 %237, i64 %239)
  unreachable

net.ok.5:
  %243 = call i32 @nish_net_read(i32 %235, %struct.nish_array* %236, i64 0, i64 64)
  %244 = call i64 @nish_arena_mark()
  %245 = call i8* @text(%struct.nish_array* %226, i32 %243)
  %246 = call i8* @nish_arena_keep(i64 %244, i8* %245)
  call void @nish_print(i8* %246)
  %247 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %248 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %249 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %248, i64 0, i32 0
  %250 = load i64, i64* %249, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %251 = icmp ult i64 1, %250
  br i1 %251, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 1, i64 %250)
  unreachable

bounds.ok.9:
  %252 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %248, i64 0, i32 2
  %253 = load i8*, i8** %252, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %254 = bitcast i8* %253 to i32*
  %255 = getelementptr inbounds i32, i32* %254, i64 1
  %256 = load i32, i32* %255, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %257 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %258 = add i64 0, 64
  %259 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %257, i64 0, i32 0
  %260 = load i64, i64* %259, align 8
  %261 = icmp ule i64 0, %258
  %262 = icmp ule i64 %258, %260
  %263 = and i1 %261, %262
  br i1 %263, label %net.ok.6, label %net.fail.6

net.fail.6:
  call void @nish_panic_slice(i64 0, i64 %258, i64 %260)
  unreachable

net.ok.6:
  %264 = call i32 @nish_net_read(i32 %256, %struct.nish_array* %257, i64 0, i64 64)
  %265 = call i64 @nish_arena_mark()
  %266 = call i8* @text(%struct.nish_array* %247, i32 %264)
  %267 = call i8* @nish_arena_keep(i64 %265, i8* %266)
  call void @nish_print(i8* %267)
  %268 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %269 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %268, i64 0, i32 0
  %270 = load i64, i64* %269, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %271 = icmp ult i64 1, %270
  br i1 %271, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 1, i64 %270)
  unreachable

bounds.ok.10:
  %272 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %268, i64 0, i32 2
  %273 = load i8*, i8** %272, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %274 = bitcast i8* %273 to i32*
  %275 = getelementptr inbounds i32, i32* %274, i64 1
  %276 = load i32, i32* %275, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %277 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %278 = add i64 0, 64
  %279 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 0
  %280 = load i64, i64* %279, align 8
  %281 = icmp ule i64 0, %278
  %282 = icmp ule i64 %278, %280
  %283 = and i1 %281, %282
  br i1 %283, label %net.ok.7, label %net.fail.7

net.fail.7:
  call void @nish_panic_slice(i64 0, i64 %278, i64 %280)
  unreachable

net.ok.7:
  %284 = call i32 @nish_net_read(i32 %276, %struct.nish_array* %277, i64 0, i64 64)
  %285 = call i8* @nish_str_from_i32(i32 %284)
  call void @nish_print(i8* %285)
  %286 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %287 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %286, i64 0, i32 0
  %288 = load i64, i64* %287, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %289 = icmp ult i64 0, %288
  br i1 %289, label %bounds.ok.11, label %bounds.fail.11

bounds.fail.11:
  call void @nish_panic_index(i64 0, i64 %288)
  unreachable

bounds.ok.11:
  %290 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %286, i64 0, i32 2
  %291 = load i8*, i8** %290, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %292 = bitcast i8* %291 to i32*
  %293 = getelementptr inbounds i32, i32* %292, i64 0
  %294 = load i32, i32* %293, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %295 = call i32 @nish_net_close(i32 %294)
  %296 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %297 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %296, i64 0, i32 0
  %298 = load i64, i64* %297, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %299 = icmp ult i64 1, %298
  br i1 %299, label %bounds.ok.12, label %bounds.fail.12

bounds.fail.12:
  call void @nish_panic_index(i64 1, i64 %298)
  unreachable

bounds.ok.12:
  %300 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %296, i64 0, i32 2
  %301 = load i8*, i8** %300, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %302 = bitcast i8* %301 to i32*
  %303 = getelementptr inbounds i32, i32* %302, i64 1
  %304 = load i32, i32* %303, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %305 = call i32 @nish_net_close(i32 %304)
  %306 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i32 4, i32 0)
  %307 = call i8* @nish_str_from_i32(i32 %306)
  call void @nish_print(i8* %307)
  %308 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 4, i32 0)
  %309 = call i8* @nish_str_from_i32(i32 %308)
  call void @nish_print(i8* %309)
  %310 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [5 x i8] }* @.str.11 to i8*), i32 4, i32 0)
  %311 = call i8* @nish_str_from_i32(i32 %310)
  call void @nish_print(i8* %311)
  %312 = load i8*, i8** %NAME.addr, align 8
  %313 = call i32 @nish_unix_listen(i8* %312, i32 4, i32 2)
  %314 = call i8* @nish_str_from_i32(i32 %313)
  call void @nish_print(i8* %314)
  %315 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %316 = call i32 @nish_unix_socket_pair(i32 3, %struct.nish_array* %315)
  %317 = call i8* @nish_str_from_i32(i32 %316)
  call void @nish_print(i8* %317)
  %318 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %319 = call i32 @nish_unix_socket_pair(i32 0, %struct.nish_array* %318)
  %320 = call i8* @nish_str_from_i32(i32 %319)
  call void @nish_print(i8* %320)
  %321 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 1, i64* %321, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %322 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 1, i64* %322, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %323 = mul i64 1, 4
  %324 = bitcast [1 x i32]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %324, i8 0, i64 %323, i1 false), !alias.scope !4, !noalias !3
  %325 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %324, i8** %325, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %326 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %arr.hdr.3)
  %327 = call i8* @nish_str_from_i32(i32 %326)
  call void @nish_print(i8* %327)
  %328 = load i8*, i8** %tag.addr, align 8
  %329 = call i64 @nish_arena_mark()
  %330 = call i8* @abstract(i8* %328, i32 107)
  %331 = call i8* @nish_arena_keep(i64 %329, i8* %330)
  %332 = call i32 @nish_unix_listen(i8* %331, i32 4, i32 0)
  %333 = icmp sge i32 %332, 0
  %334 = select i1 %333, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %334)
  %335 = load i8*, i8** %tag.addr, align 8
  %336 = call i64 @nish_arena_mark()
  %337 = call i8* @abstract(i8* %335, i32 108)
  %338 = call i8* @nish_arena_keep(i64 %336, i8* %337)
  %339 = call i32 @nish_unix_listen(i8* %338, i32 4, i32 0)
  %340 = call i8* @nish_str_from_i32(i32 %339)
  call void @nish_print(i8* %340)
  %341 = load i8*, i8** %tag.addr, align 8
  %342 = call i64 @nish_arena_mark()
  %343 = call i8* @abstract(i8* %341, i32 108)
  %344 = call i8* @nish_arena_keep(i64 %342, i8* %343)
  %345 = call i32 @nish_unix_connect(i8* %344)
  %346 = call i8* @nish_str_from_i32(i32 %345)
  call void @nish_print(i8* %346)
  %347 = load i8*, i8** %tag.addr, align 8
  %348 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %347)
  %349 = call i8* @nish_str_concat(i8* %348, i8* bitcast ({ i64, [8 x i8] }* @.str.12 to i8*))
  %350 = call i32 @nish_unix_connect(i8* %349)
  %351 = call i8* @nish_str_from_i32(i32 %350)
  call void @nish_print(i8* %351)
  %352 = load i8*, i8** %NAME.addr, align 8
  %353 = call i32 @nish_unix_listen_mode(i8* %352, i32 4, i32 0, i32 384)
  %354 = call i8* @nish_str_from_i32(i32 %353)
  call void @nish_print(i8* %354)
  %355 = call i32 @nish_unix_listen_mode(i8* bitcast ({ i64, [18 x i8] }* @.str.13 to i8*), i32 4, i32 0, i32 512)
  %356 = call i8* @nish_str_from_i32(i32 %355)
  call void @nish_print(i8* %356)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element i32", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
