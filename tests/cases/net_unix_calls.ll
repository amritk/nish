%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"@\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"@nish-net-unix-calls\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"ping\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"pong\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"cd\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"@a\00b\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"@nish-net-unix-nobody\00" }, align 8
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
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
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

define internal noundef nonnull align 8 i8* @abstract(i32 noundef %n) #1 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i8*], align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [1 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %n
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i8**
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %17, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*) to i64*
  %26 = load i64, i64* %25, align 8
  %27 = sub i64 %24, 1
  %28 = mul i64 %26, %27
  %29 = icmp eq i64 %24, 0
  %30 = select i1 %29, i64 0, i64 %28
  store i64 %30, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %31 = load i64, i64* %join.at, align 8
  %32 = icmp ult i64 %31, %24
  br i1 %32, label %join.sum.body, label %join.copy

join.sum.body:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to i8**
  %36 = getelementptr inbounds i8*, i8** %35, i64 %31
  %37 = load i8*, i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %38 = load i64, i64* %join.total, align 8
  %39 = bitcast i8* %37 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = add i64 %38, %40
  store i64 %41, i64* %join.total, align 8
  %42 = add i64 %31, 1
  store i64 %42, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %43 = load i64, i64* %join.total, align 8
  %44 = icmp ugt i64 %43, 2147483647
  %45 = add i64 %43, 9
  %46 = select i1 %44, i64 4611686018427387904, i64 %45
  %47 = call i8* @nish_alloc_struct(i64 %46)
  %48 = bitcast i8* %47 to i64*
  store i64 %43, i64* %48, align 8
  %49 = getelementptr inbounds i8, i8* %47, i64 8
  store i8* %49, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %50 = load i64, i64* %join.at, align 8
  %51 = icmp ult i64 %50, %24
  br i1 %51, label %join.part, label %join.end

join.part:
  %52 = load i8*, i8** %join.p, align 8
  %53 = icmp eq i64 %50, 0
  %54 = select i1 %53, i64 0, i64 %26
  %55 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %52, i8* %55, i64 %54, i1 false)
  %56 = getelementptr inbounds i8, i8* %52, i64 %54
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %50
  %61 = load i8*, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %62 = bitcast i8* %61 to i64*
  %63 = load i64, i64* %62, align 8
  %64 = getelementptr inbounds i8, i8* %61, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %56, i8* %64, i64 %63, i1 false)
  %65 = getelementptr inbounds i8, i8* %56, i64 %63
  store i8* %65, i8** %join.p, align 8
  %66 = add i64 %50, 1
  store i64 %66, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %67 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %67, align 1
  ret i8* %47
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
  %4 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [21 x i8] }* @.str.4 to i8*), i32 4, i32 0)
  store i32 %4, i32* %listener.addr, align 4
  %5 = load i32, i32* %listener.addr, align 4
  %6 = icmp sge i32 %5, 0
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %7)
  %8 = load i32, i32* %listener.addr, align 4
  %9 = call i32 @nish_unix_accept(i32 %8)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = call i32 @nish_unix_connect(i8* bitcast ({ i64, [21 x i8] }* @.str.4 to i8*))
  store i32 %11, i32* %client.addr, align 4
  %12 = load i32, i32* %client.addr, align 4
  %13 = icmp sge i32 %12, 0
  %14 = select i1 %13, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %14)
  %15 = call i32 @nish_poll_create()
  store i32 %15, i32* %loop.addr, align 4
  %16 = load i32, i32* %loop.addr, align 4
  %17 = load i32, i32* %listener.addr, align 4
  %18 = call i32 @nish_poll_add(i32 %16, i32 %17, i32 1, i32 0)
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = mul i64 2, 4
  %22 = bitcast [2 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %22, i8 0, i64 %21, i1 false), !alias.scope !4, !noalias !3
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ready.addr, align 8
  %24 = load i32, i32* %loop.addr, align 4
  %25 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %26 = call i32 @nish_poll_wait(i32 %24, %struct.nish_array* %25, i32 2000)
  %27 = icmp eq i32 %26, 1
  br i1 %27, label %cond.true, label %cond.false

cond.true:
  %28 = load i32, i32* %listener.addr, align 4
  %29 = call i32 @nish_unix_accept(i32 %28)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %30 = phi i32 [ %29, %cond.true ], [ -110, %cond.false ]
  store i32 %30, i32* %conn.addr, align 4
  %31 = load i32, i32* %conn.addr, align 4
  %32 = icmp sge i32 %31, 0
  %33 = select i1 %32, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %33)
  %34 = load i32, i32* %client.addr, align 4
  %35 = call i32 @send$(i32 %34, i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*))
  %36 = call i8* @nish_str_from_i32(i32 %35)
  call void @nish_print(i8* %36)
  %37 = load i32, i32* %loop.addr, align 4
  %38 = load i32, i32* %conn.addr, align 4
  %39 = call i32 @nish_poll_add(i32 %37, i32 %38, i32 1, i32 1)
  %40 = load i32, i32* %loop.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %42 = call i32 @nish_poll_wait(i32 %40, %struct.nish_array* %41, i32 2000)
  %43 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %43)
  %44 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %45 = load i32, i32* %conn.addr, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %47 = add i64 0, 64
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8
  %50 = icmp ule i64 0, %47
  %51 = icmp ule i64 %47, %49
  %52 = and i1 %50, %51
  br i1 %52, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %47, i64 %49)
  unreachable

net.ok:
  %53 = call i32 @nish_net_read(i32 %45, %struct.nish_array* %46, i64 0, i64 64)
  %54 = call i64 @nish_arena_mark()
  %55 = call i8* @text(%struct.nish_array* %44, i32 %53)
  %56 = call i8* @nish_arena_keep(i64 %54, i8* %55)
  call void @nish_print(i8* %56)
  %57 = load i32, i32* %conn.addr, align 4
  %58 = call i32 @send$(i32 %57, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*))
  %59 = call i8* @nish_str_from_i32(i32 %58)
  call void @nish_print(i8* %59)
  %60 = load i32, i32* %conn.addr, align 4
  %61 = call i32 @nish_net_shutdown(i32 %60, i32 1)
  %62 = call i8* @nish_str_from_i32(i32 %61)
  call void @nish_print(i8* %62)
  %63 = load i32, i32* %loop.addr, align 4
  %64 = load i32, i32* %client.addr, align 4
  %65 = call i32 @nish_poll_add(i32 %63, i32 %64, i32 1, i32 2)
  %66 = load i32, i32* %loop.addr, align 4
  %67 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %68 = call i32 @nish_poll_wait(i32 %66, %struct.nish_array* %67, i32 2000)
  %69 = icmp sge i32 %68, 1
  %70 = select i1 %69, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %70)
  %71 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %72 = load i32, i32* %client.addr, align 4
  %73 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %74 = add i64 0, 64
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %76 = load i64, i64* %75, align 8
  %77 = icmp ule i64 0, %74
  %78 = icmp ule i64 %74, %76
  %79 = and i1 %77, %78
  br i1 %79, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %74, i64 %76)
  unreachable

net.ok.1:
  %80 = call i32 @nish_net_read(i32 %72, %struct.nish_array* %73, i64 0, i64 64)
  %81 = call i64 @nish_arena_mark()
  %82 = call i8* @text(%struct.nish_array* %71, i32 %80)
  %83 = call i8* @nish_arena_keep(i64 %81, i8* %82)
  call void @nish_print(i8* %83)
  %84 = load i32, i32* %client.addr, align 4
  %85 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %86 = add i64 0, 64
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %88 = load i64, i64* %87, align 8
  %89 = icmp ule i64 0, %86
  %90 = icmp ule i64 %86, %88
  %91 = and i1 %89, %90
  br i1 %91, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %86, i64 %88)
  unreachable

net.ok.2:
  %92 = call i32 @nish_net_read(i32 %84, %struct.nish_array* %85, i64 0, i64 64)
  %93 = call i8* @nish_str_from_i32(i32 %92)
  call void @nish_print(i8* %93)
  %94 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [21 x i8] }* @.str.4 to i8*), i32 4, i32 0)
  %95 = call i8* @nish_str_from_i32(i32 %94)
  call void @nish_print(i8* %95)
  %96 = load i32, i32* %loop.addr, align 4
  %97 = call i32 @nish_net_close(i32 %96)
  %98 = load i32, i32* %conn.addr, align 4
  %99 = call i32 @nish_net_close(i32 %98)
  %100 = load i32, i32* %client.addr, align 4
  %101 = call i32 @nish_net_close(i32 %100)
  %102 = load i32, i32* %listener.addr, align 4
  %103 = call i32 @nish_net_close(i32 %102)
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %106 = mul i64 2, 4
  %107 = bitcast [2 x i32]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %107, i8 0, i64 %106, i1 false), !alias.scope !4, !noalias !3
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %107, i8** %108, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %pair.addr, align 8
  %109 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %110 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %109)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  call void @nish_print(i8* %111)
  %112 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 0
  %114 = load i64, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = icmp ult i64 0, %114
  br i1 %115, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %114)
  unreachable

bounds.ok:
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 2
  %117 = load i8*, i8** %116, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %118 = bitcast i8* %117 to i32*
  %119 = getelementptr inbounds i32, i32* %118, i64 0
  %120 = load i32, i32* %119, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %121 = call i32 @send$(i32 %120, i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*))
  %122 = call i8* @nish_str_from_i32(i32 %121)
  call void @nish_print(i8* %122)
  %123 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %123, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = icmp ult i64 0, %125
  br i1 %126, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %125)
  unreachable

bounds.ok.1:
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %123, i64 0, i32 2
  %128 = load i8*, i8** %127, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %129 = bitcast i8* %128 to i32*
  %130 = getelementptr inbounds i32, i32* %129, i64 0
  %131 = load i32, i32* %130, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %132 = call i32 @send$(i32 %131, i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*))
  %133 = call i8* @nish_str_from_i32(i32 %132)
  call void @nish_print(i8* %133)
  %134 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %135 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 0
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %138 = icmp ult i64 1, %137
  br i1 %138, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %137)
  unreachable

bounds.ok.2:
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 2
  %140 = load i8*, i8** %139, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %141 = bitcast i8* %140 to i32*
  %142 = getelementptr inbounds i32, i32* %141, i64 1
  %143 = load i32, i32* %142, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %144 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %145 = add i64 0, 64
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %144, i64 0, i32 0
  %147 = load i64, i64* %146, align 8
  %148 = icmp ule i64 0, %145
  %149 = icmp ule i64 %145, %147
  %150 = and i1 %148, %149
  br i1 %150, label %net.ok.3, label %net.fail.3

net.fail.3:
  call void @nish_panic_slice(i64 0, i64 %145, i64 %147)
  unreachable

net.ok.3:
  %151 = call i32 @nish_net_read(i32 %143, %struct.nish_array* %144, i64 0, i64 64)
  %152 = call i64 @nish_arena_mark()
  %153 = call i8* @text(%struct.nish_array* %134, i32 %151)
  %154 = call i8* @nish_arena_keep(i64 %152, i8* %153)
  call void @nish_print(i8* %154)
  %155 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 0
  %157 = load i64, i64* %156, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %158 = icmp ult i64 0, %157
  br i1 %158, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %157)
  unreachable

bounds.ok.3:
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 2
  %160 = load i8*, i8** %159, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %161 = bitcast i8* %160 to i32*
  %162 = getelementptr inbounds i32, i32* %161, i64 0
  %163 = load i32, i32* %162, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %164 = call i32 @nish_net_close(i32 %163)
  %165 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %165, i64 0, i32 0
  %167 = load i64, i64* %166, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %168 = icmp ult i64 1, %167
  br i1 %168, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %167)
  unreachable

bounds.ok.4:
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %165, i64 0, i32 2
  %170 = load i8*, i8** %169, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %171 = bitcast i8* %170 to i32*
  %172 = getelementptr inbounds i32, i32* %171, i64 1
  %173 = load i32, i32* %172, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %174 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %175 = add i64 0, 64
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %174, i64 0, i32 0
  %177 = load i64, i64* %176, align 8
  %178 = icmp ule i64 0, %175
  %179 = icmp ule i64 %175, %177
  %180 = and i1 %178, %179
  br i1 %180, label %net.ok.4, label %net.fail.4

net.fail.4:
  call void @nish_panic_slice(i64 0, i64 %175, i64 %177)
  unreachable

net.ok.4:
  %181 = call i32 @nish_net_read(i32 %173, %struct.nish_array* %174, i64 0, i64 64)
  %182 = call i8* @nish_str_from_i32(i32 %181)
  call void @nish_print(i8* %182)
  %183 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 0
  %185 = load i64, i64* %184, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %186 = icmp ult i64 1, %185
  br i1 %186, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %185)
  unreachable

bounds.ok.5:
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 2
  %188 = load i8*, i8** %187, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %189 = bitcast i8* %188 to i32*
  %190 = getelementptr inbounds i32, i32* %189, i64 1
  %191 = load i32, i32* %190, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %192 = call i32 @nish_net_close(i32 %191)
  %193 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %194 = call i32 @nish_unix_socket_pair(i32 2, %struct.nish_array* %193)
  %195 = call i8* @nish_str_from_i32(i32 %194)
  call void @nish_print(i8* %195)
  %196 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 0
  %198 = load i64, i64* %197, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %199 = icmp ult i64 0, %198
  br i1 %199, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %198)
  unreachable

bounds.ok.6:
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 2
  %201 = load i8*, i8** %200, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %202 = bitcast i8* %201 to i32*
  %203 = getelementptr inbounds i32, i32* %202, i64 0
  %204 = load i32, i32* %203, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %205 = call i32 @send$(i32 %204, i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*))
  %206 = call i8* @nish_str_from_i32(i32 %205)
  call void @nish_print(i8* %206)
  %207 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 0
  %209 = load i64, i64* %208, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %210 = icmp ult i64 0, %209
  br i1 %210, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 0, i64 %209)
  unreachable

bounds.ok.7:
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 2
  %212 = load i8*, i8** %211, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %213 = bitcast i8* %212 to i32*
  %214 = getelementptr inbounds i32, i32* %213, i64 0
  %215 = load i32, i32* %214, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %216 = call i32 @send$(i32 %215, i8* bitcast ({ i64, [3 x i8] }* @.str.10 to i8*))
  %217 = call i8* @nish_str_from_i32(i32 %216)
  call void @nish_print(i8* %217)
  %218 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %219 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %220 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %219, i64 0, i32 0
  %221 = load i64, i64* %220, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %222 = icmp ult i64 1, %221
  br i1 %222, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 1, i64 %221)
  unreachable

bounds.ok.8:
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %219, i64 0, i32 2
  %224 = load i8*, i8** %223, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %225 = bitcast i8* %224 to i32*
  %226 = getelementptr inbounds i32, i32* %225, i64 1
  %227 = load i32, i32* %226, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %228 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %229 = add i64 0, 64
  %230 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %228, i64 0, i32 0
  %231 = load i64, i64* %230, align 8
  %232 = icmp ule i64 0, %229
  %233 = icmp ule i64 %229, %231
  %234 = and i1 %232, %233
  br i1 %234, label %net.ok.5, label %net.fail.5

net.fail.5:
  call void @nish_panic_slice(i64 0, i64 %229, i64 %231)
  unreachable

net.ok.5:
  %235 = call i32 @nish_net_read(i32 %227, %struct.nish_array* %228, i64 0, i64 64)
  %236 = call i64 @nish_arena_mark()
  %237 = call i8* @text(%struct.nish_array* %218, i32 %235)
  %238 = call i8* @nish_arena_keep(i64 %236, i8* %237)
  call void @nish_print(i8* %238)
  %239 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %240 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %241 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %240, i64 0, i32 0
  %242 = load i64, i64* %241, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %243 = icmp ult i64 1, %242
  br i1 %243, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 1, i64 %242)
  unreachable

bounds.ok.9:
  %244 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %240, i64 0, i32 2
  %245 = load i8*, i8** %244, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %246 = bitcast i8* %245 to i32*
  %247 = getelementptr inbounds i32, i32* %246, i64 1
  %248 = load i32, i32* %247, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %249 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %250 = add i64 0, 64
  %251 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %249, i64 0, i32 0
  %252 = load i64, i64* %251, align 8
  %253 = icmp ule i64 0, %250
  %254 = icmp ule i64 %250, %252
  %255 = and i1 %253, %254
  br i1 %255, label %net.ok.6, label %net.fail.6

net.fail.6:
  call void @nish_panic_slice(i64 0, i64 %250, i64 %252)
  unreachable

net.ok.6:
  %256 = call i32 @nish_net_read(i32 %248, %struct.nish_array* %249, i64 0, i64 64)
  %257 = call i64 @nish_arena_mark()
  %258 = call i8* @text(%struct.nish_array* %239, i32 %256)
  %259 = call i8* @nish_arena_keep(i64 %257, i8* %258)
  call void @nish_print(i8* %259)
  %260 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %261 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %260, i64 0, i32 0
  %262 = load i64, i64* %261, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %263 = icmp ult i64 1, %262
  br i1 %263, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 1, i64 %262)
  unreachable

bounds.ok.10:
  %264 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %260, i64 0, i32 2
  %265 = load i8*, i8** %264, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %266 = bitcast i8* %265 to i32*
  %267 = getelementptr inbounds i32, i32* %266, i64 1
  %268 = load i32, i32* %267, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %269 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %270 = add i64 0, 64
  %271 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %269, i64 0, i32 0
  %272 = load i64, i64* %271, align 8
  %273 = icmp ule i64 0, %270
  %274 = icmp ule i64 %270, %272
  %275 = and i1 %273, %274
  br i1 %275, label %net.ok.7, label %net.fail.7

net.fail.7:
  call void @nish_panic_slice(i64 0, i64 %270, i64 %272)
  unreachable

net.ok.7:
  %276 = call i32 @nish_net_read(i32 %268, %struct.nish_array* %269, i64 0, i64 64)
  %277 = call i8* @nish_str_from_i32(i32 %276)
  call void @nish_print(i8* %277)
  %278 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %279 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %278, i64 0, i32 0
  %280 = load i64, i64* %279, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %281 = icmp ult i64 0, %280
  br i1 %281, label %bounds.ok.11, label %bounds.fail.11

bounds.fail.11:
  call void @nish_panic_index(i64 0, i64 %280)
  unreachable

bounds.ok.11:
  %282 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %278, i64 0, i32 2
  %283 = load i8*, i8** %282, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %284 = bitcast i8* %283 to i32*
  %285 = getelementptr inbounds i32, i32* %284, i64 0
  %286 = load i32, i32* %285, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %287 = call i32 @nish_net_close(i32 %286)
  %288 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %289 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %288, i64 0, i32 0
  %290 = load i64, i64* %289, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %291 = icmp ult i64 1, %290
  br i1 %291, label %bounds.ok.12, label %bounds.fail.12

bounds.fail.12:
  call void @nish_panic_index(i64 1, i64 %290)
  unreachable

bounds.ok.12:
  %292 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %288, i64 0, i32 2
  %293 = load i8*, i8** %292, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %294 = bitcast i8* %293 to i32*
  %295 = getelementptr inbounds i32, i32* %294, i64 1
  %296 = load i32, i32* %295, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %297 = call i32 @nish_net_close(i32 %296)
  %298 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i32 4, i32 0)
  %299 = call i8* @nish_str_from_i32(i32 %298)
  call void @nish_print(i8* %299)
  %300 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 4, i32 0)
  %301 = call i8* @nish_str_from_i32(i32 %300)
  call void @nish_print(i8* %301)
  %302 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [5 x i8] }* @.str.11 to i8*), i32 4, i32 0)
  %303 = call i8* @nish_str_from_i32(i32 %302)
  call void @nish_print(i8* %303)
  %304 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [21 x i8] }* @.str.4 to i8*), i32 4, i32 2)
  %305 = call i8* @nish_str_from_i32(i32 %304)
  call void @nish_print(i8* %305)
  %306 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %307 = call i32 @nish_unix_socket_pair(i32 3, %struct.nish_array* %306)
  %308 = call i8* @nish_str_from_i32(i32 %307)
  call void @nish_print(i8* %308)
  %309 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %310 = call i32 @nish_unix_socket_pair(i32 0, %struct.nish_array* %309)
  %311 = call i8* @nish_str_from_i32(i32 %310)
  call void @nish_print(i8* %311)
  %312 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 1, i64* %312, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %313 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 1, i64* %313, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %314 = mul i64 1, 4
  %315 = bitcast [1 x i32]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %315, i8 0, i64 %314, i1 false), !alias.scope !4, !noalias !3
  %316 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %315, i8** %316, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %317 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %arr.hdr.3)
  %318 = call i8* @nish_str_from_i32(i32 %317)
  call void @nish_print(i8* %318)
  %319 = call i64 @nish_arena_mark()
  %320 = call i8* @abstract(i32 107)
  %321 = call i8* @nish_arena_keep(i64 %319, i8* %320)
  %322 = call i32 @nish_unix_listen(i8* %321, i32 4, i32 0)
  %323 = icmp sge i32 %322, 0
  %324 = select i1 %323, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @nish_print(i8* %324)
  %325 = call i64 @nish_arena_mark()
  %326 = call i8* @abstract(i32 108)
  %327 = call i8* @nish_arena_keep(i64 %325, i8* %326)
  %328 = call i32 @nish_unix_listen(i8* %327, i32 4, i32 0)
  %329 = call i8* @nish_str_from_i32(i32 %328)
  call void @nish_print(i8* %329)
  %330 = call i64 @nish_arena_mark()
  %331 = call i8* @abstract(i32 108)
  %332 = call i8* @nish_arena_keep(i64 %330, i8* %331)
  %333 = call i32 @nish_unix_connect(i8* %332)
  %334 = call i8* @nish_str_from_i32(i32 %333)
  call void @nish_print(i8* %334)
  %335 = call i32 @nish_unix_connect(i8* bitcast ({ i64, [22 x i8] }* @.str.12 to i8*))
  %336 = call i8* @nish_str_from_i32(i32 %335)
  call void @nish_print(i8* %336)
  %337 = call i32 @nish_unix_listen_mode(i8* bitcast ({ i64, [21 x i8] }* @.str.4 to i8*), i32 4, i32 0, i32 384)
  %338 = call i8* @nish_str_from_i32(i32 %337)
  call void @nish_print(i8* %338)
  %339 = call i32 @nish_unix_listen_mode(i8* bitcast ({ i64, [18 x i8] }* @.str.13 to i8*), i32 4, i32 0, i32 512)
  %340 = call i8* @nish_str_from_i32(i32 %339)
  call void @nish_print(i8* %340)
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
