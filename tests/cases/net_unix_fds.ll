%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"build/test/\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-live.sock\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-dead.sock\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"build/test/nuf-cycle.sock\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-idle.sock\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-file.sock\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"keep\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"build/test/nuf-missing.sock\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"@nish-net-unix-fds\00\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-mode.sock\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"build/test/nuf-nowhere/x.sock\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"@\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"build/test/nuf-flags.sock\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"@nish-net-unix-fds\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"build/test/nuf-chmodfail.sock\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/nuf-held.sock\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare noundef i32 @nish_unlink(i8* noundef nonnull readonly align 8 nocapture) #1
declare noundef i32 @nish_net_close(i32 noundef) #1
declare noundef i32 @nish_unix_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_unix_listen_mode(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_unix_connect(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_unix_accept(i32 noundef) #1
declare noundef i32 @nish_unix_socket_pair(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2

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

define internal noundef nonnull align 8 i8* @longPath(i32 noundef %n) #0 {
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
  store i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  %6 = bitcast i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*) to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, %n
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = icmp eq i64 %13, %15
  br i1 %16, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 8)
  br label %push.store

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %13
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = add i64 %13, 1
  store i64 %21, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %29 = load i64, i64* %28, align 8
  %30 = sub i64 %27, 1
  %31 = mul i64 %29, %30
  %32 = icmp eq i64 %27, 0
  %33 = select i1 %32, i64 0, i64 %31
  store i64 %33, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %34 = load i64, i64* %join.at, align 8
  %35 = icmp ult i64 %34, %27
  br i1 %35, label %join.sum.body, label %join.copy

join.sum.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = bitcast i8* %37 to i8**
  %39 = getelementptr inbounds i8*, i8** %38, i64 %34
  %40 = load i8*, i8** %39, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = load i64, i64* %join.total, align 8
  %42 = bitcast i8* %40 to i64*
  %43 = load i64, i64* %42, align 8
  %44 = add i64 %41, %43
  store i64 %44, i64* %join.total, align 8
  %45 = add i64 %34, 1
  store i64 %45, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %46 = load i64, i64* %join.total, align 8
  %47 = icmp ugt i64 %46, 2147483647
  %48 = add i64 %46, 9
  %49 = select i1 %47, i64 4611686018427387904, i64 %48
  %50 = call i8* @nish_alloc_struct(i64 %49)
  %51 = bitcast i8* %50 to i64*
  store i64 %46, i64* %51, align 8
  %52 = getelementptr inbounds i8, i8* %50, i64 8
  store i8* %52, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %53 = load i64, i64* %join.at, align 8
  %54 = icmp ult i64 %53, %27
  br i1 %54, label %join.part, label %join.end

join.part:
  %55 = load i8*, i8** %join.p, align 8
  %56 = icmp eq i64 %53, 0
  %57 = select i1 %56, i64 0, i64 %29
  %58 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %55, i8* %58, i64 %57, i1 false)
  %59 = getelementptr inbounds i8, i8* %55, i64 %57
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to i8**
  %63 = getelementptr inbounds i8*, i8** %62, i64 %53
  %64 = load i8*, i8** %63, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %65 = bitcast i8* %64 to i64*
  %66 = load i64, i64* %65, align 8
  %67 = getelementptr inbounds i8, i8* %64, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %59, i8* %67, i64 %66, i1 false)
  %68 = getelementptr inbounds i8, i8* %59, i64 %66
  store i8* %68, i8** %join.p, align 8
  %69 = add i64 %53, 1
  store i64 %69, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %70 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %70, align 1
  ret i8* %50
}

define noundef i32 @setUp() #1 {
entry:
  %live.addr = alloca i32, align 4
  %dead.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.3 to i8*))
  %1 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.4 to i8*))
  %2 = call i32 @nish_unlink(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  %3 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.6 to i8*))
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @longPath(i32 107)
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  %7 = call i32 @nish_unlink(i8* %6)
  call void @nish_write_file(i8* bitcast ({ i64, [25 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*))
  %8 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.3 to i8*), i32 4, i32 0)
  store i32 %8, i32* %live.addr, align 4
  %9 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.4 to i8*), i32 4, i32 0)
  store i32 %9, i32* %dead.addr, align 4
  %10 = load i32, i32* %dead.addr, align 4
  %11 = call i32 @nish_net_close(i32 %10)
  %12 = load i32, i32* %dead.addr, align 4
  %13 = icmp sge i32 %12, 0
  br i1 %13, label %cond.true, label %cond.false

cond.true:
  %14 = load i32, i32* %live.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %15 = phi i32 [ %14, %cond.true ], [ -1, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %15
}

define internal noundef i32 @cycle() #1 {
entry:
  %listener.addr = alloca i32, align 4
  %client.addr = alloca i32, align 4
  %served.addr = alloca i32, align 4
  %0 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 4, i32 0)
  store i32 %0, i32* %listener.addr, align 4
  %1 = load i32, i32* %listener.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %listener.addr, align 4
  ret i32 %3

if.end:
  %4 = call i32 @nish_unix_connect(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  store i32 %4, i32* %client.addr, align 4
  %5 = load i32, i32* %client.addr, align 4
  %6 = icmp sge i32 %5, 0
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %listener.addr, align 4
  %8 = call i32 @nish_unix_accept(i32 %7)
  br label %cond.end

cond.false:
  %9 = load i32, i32* %client.addr, align 4
  br label %cond.end

cond.end:
  %10 = phi i32 [ %8, %cond.true ], [ %9, %cond.false ]
  store i32 %10, i32* %served.addr, align 4
  %11 = load i32, i32* %served.addr, align 4
  %12 = icmp sge i32 %11, 0
  br i1 %12, label %if.then.1, label %if.end.1

if.then.1:
  %13 = load i32, i32* %served.addr, align 4
  %14 = call i32 @nish_net_close(i32 %13)
  br label %if.end.1

if.end.1:
  %15 = load i32, i32* %client.addr, align 4
  %16 = icmp sge i32 %15, 0
  br i1 %16, label %if.then.2, label %if.end.2

if.then.2:
  %17 = load i32, i32* %client.addr, align 4
  %18 = call i32 @nish_net_close(i32 %17)
  br label %if.end.2

if.end.2:
  %19 = load i32, i32* %listener.addr, align 4
  %20 = call i32 @nish_net_close(i32 %19)
  %21 = call i32 @nish_unlink(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  %22 = load i32, i32* %served.addr, align 4
  %23 = icmp sge i32 %22, 0
  br i1 %23, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %24 = load i32, i32* %served.addr, align 4
  br label %cond.end.1

cond.end.1:
  %25 = phi i32 [ 0, %cond.true.1 ], [ %24, %cond.false.1 ]
  ret i32 %25
}

define internal noundef i32 @idle() #1 {
entry:
  %listener.addr = alloca i32, align 4
  %answer.addr = alloca i32, align 4
  %0 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.6 to i8*), i32 4, i32 0)
  store i32 %0, i32* %listener.addr, align 4
  %1 = load i32, i32* %listener.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %listener.addr, align 4
  ret i32 %3

if.end:
  %4 = load i32, i32* %listener.addr, align 4
  %5 = call i32 @nish_unix_accept(i32 %4)
  store i32 %5, i32* %answer.addr, align 4
  %6 = load i32, i32* %listener.addr, align 4
  %7 = call i32 @nish_net_close(i32 %6)
  %8 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.6 to i8*))
  %9 = load i32, i32* %answer.addr, align 4
  ret i32 %9
}

define internal noundef i32 @pair() #1 {
entry:
  %fds.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %answer.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 2, 4
  %3 = bitcast [2 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %fds.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %6 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %5)
  store i32 %6, i32* %answer.addr, align 4
  %7 = load i32, i32* %answer.addr, align 4
  %8 = icmp eq i32 %7, 0
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ult i64 0, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %18 = call i32 @nish_net_close(i32 %17)
  %19 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 1, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 1
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %28 = call i32 @nish_net_close(i32 %27)
  br label %if.end

if.end:
  %29 = load i32, i32* %answer.addr, align 4
  ret i32 %29
}

define internal noundef i32 @rebind() #1 {
entry:
  %fd.addr = alloca i32, align 4
  %0 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.4 to i8*), i32 4, i32 1)
  store i32 %0, i32* %fd.addr, align 4
  %1 = load i32, i32* %fd.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %fd.addr, align 4
  ret i32 %3

if.end:
  %4 = load i32, i32* %fd.addr, align 4
  %5 = call i32 @nish_net_close(i32 %4)
  ret i32 0
}

define noundef i32 @attempts() #2 {
entry:
  ret i32 23
}

define noundef i32 @attempt(i32 noundef %k) #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.3 to i8*), i32 4, i32 0)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %1

if.end:
  %2 = icmp eq i32 %k, 1
  br i1 %2, label %if.then.1, label %if.end.1

if.then.1:
  %3 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.3 to i8*), i32 4, i32 1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3

if.end.1:
  %4 = icmp eq i32 %k, 2
  br i1 %4, label %if.then.2, label %if.end.2

if.then.2:
  %5 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.4 to i8*), i32 4, i32 0)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %5

if.end.2:
  %6 = icmp eq i32 %k, 3
  br i1 %6, label %if.then.3, label %if.end.3

if.then.3:
  %7 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.7 to i8*), i32 4, i32 1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7

if.end.3:
  %8 = icmp eq i32 %k, 4
  br i1 %8, label %if.then.4, label %if.end.4

if.then.4:
  %9 = call i32 @nish_unix_connect(i8* bitcast ({ i64, [25 x i8] }* @.str.4 to i8*))
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9

if.end.4:
  %10 = icmp eq i32 %k, 5
  br i1 %10, label %if.then.5, label %if.end.5

if.then.5:
  %11 = call i32 @nish_unix_connect(i8* bitcast ({ i64, [28 x i8] }* @.str.9 to i8*))
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %11

if.end.5:
  %12 = icmp eq i32 %k, 6
  br i1 %12, label %if.then.6, label %if.end.6

if.then.6:
  %13 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [20 x i8] }* @.str.10 to i8*), i32 4, i32 0)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %13

if.end.6:
  %14 = icmp eq i32 %k, 7
  br i1 %14, label %if.then.7, label %if.end.7

if.then.7:
  %15 = call i32 @nish_unix_listen_mode(i8* bitcast ({ i64, [25 x i8] }* @.str.11 to i8*), i32 4, i32 0, i32 512)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %15

if.end.7:
  %16 = icmp eq i32 %k, 8
  br i1 %16, label %if.then.8, label %if.end.8

if.then.8:
  %17 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [30 x i8] }* @.str.12 to i8*), i32 4, i32 0)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %17

if.end.8:
  %18 = icmp eq i32 %k, 9
  br i1 %18, label %if.then.9, label %if.end.9

if.then.9:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = mul i64 2, 4
  %22 = bitcast [2 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %22, i8 0, i64 %21, i1 false), !alias.scope !4, !noalias !3
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = call i32 @nish_unix_socket_pair(i32 3, %struct.nish_array* %arr.hdr)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %24

if.end.9:
  %25 = icmp eq i32 %k, 10
  br i1 %25, label %if.then.10, label %if.end.10

if.then.10:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = mul i64 1, 4
  %29 = bitcast [1 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %29, i8 0, i64 %28, i1 false), !alias.scope !4, !noalias !3
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %arr.hdr.1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %31

if.end.10:
  %32 = icmp eq i32 %k, 11
  br i1 %32, label %if.then.11, label %if.end.11

if.then.11:
  %33 = call i64 @nish_arena_mark()
  %34 = call i8* @longPath(i32 108)
  %35 = call i8* @nish_arena_keep(i64 %33, i8* %34)
  %36 = call i32 @nish_unix_listen(i8* %35, i32 4, i32 0)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %36

if.end.11:
  %37 = icmp eq i32 %k, 12
  br i1 %37, label %if.then.12, label %if.end.12

if.then.12:
  %38 = call i64 @nish_arena_mark()
  %39 = call i8* @longPath(i32 108)
  %40 = call i8* @nish_arena_keep(i64 %38, i8* %39)
  %41 = call i32 @nish_unix_connect(i8* %40)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %41

if.end.12:
  %42 = icmp eq i32 %k, 13
  br i1 %42, label %if.then.13, label %if.end.13

if.then.13:
  %43 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i32 4, i32 0)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %43

if.end.13:
  %44 = icmp eq i32 %k, 14
  br i1 %44, label %if.then.14, label %if.end.14

if.then.14:
  %45 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [2 x i8] }* @.str.13 to i8*), i32 4, i32 0)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %45

if.end.14:
  %46 = icmp eq i32 %k, 15
  br i1 %46, label %if.then.15, label %if.end.15

if.then.15:
  %47 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*), i32 4, i32 2)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %47

if.end.15:
  %48 = icmp eq i32 %k, 16
  br i1 %48, label %if.then.16, label %if.end.16

if.then.16:
  %49 = call i32 @nish_unix_listen_mode(i8* bitcast ({ i64, [19 x i8] }* @.str.15 to i8*), i32 4, i32 0, i32 384)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %49

if.end.16:
  %50 = icmp eq i32 %k, 17
  br i1 %50, label %if.then.17, label %if.end.17

if.then.17:
  %51 = call i32 @nish_unix_listen_mode(i8* bitcast ({ i64, [30 x i8] }* @.str.16 to i8*), i32 4, i32 0, i32 384)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %51

if.end.17:
  %52 = icmp eq i32 %k, 18
  br i1 %52, label %if.then.18, label %if.end.18

if.then.18:
  %53 = call i32 @nish_unix_accept(i32 1000)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %53

if.end.18:
  %54 = icmp eq i32 %k, 19
  br i1 %54, label %if.then.19, label %if.end.19

if.then.19:
  call void @nish_arena_release(i64 %arena.mark)
  %55 = tail call i32 @idle()
  ret i32 %55

if.end.19:
  %56 = icmp eq i32 %k, 20
  br i1 %56, label %if.then.20, label %if.end.20

if.then.20:
  call void @nish_arena_release(i64 %arena.mark)
  %57 = tail call i32 @cycle()
  ret i32 %57

if.end.20:
  %58 = icmp eq i32 %k, 21
  br i1 %58, label %if.then.21, label %if.end.21

if.then.21:
  call void @nish_arena_release(i64 %arena.mark)
  %59 = tail call i32 @pair()
  ret i32 %59

if.end.21:
  call void @nish_arena_release(i64 %arena.mark)
  %60 = tail call i32 @rebind()
  ret i32 %60
}

define noundef i32 @hold(i32 noundef %k, i32 noundef %listener) #1 {
entry:
  %fds.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %answer.addr = alloca i32, align 4
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.17 to i8*))
  %2 = call i32 @nish_unix_listen(i8* bitcast ({ i64, [25 x i8] }* @.str.17 to i8*), i32 4, i32 0)
  ret i32 %2

if.end:
  %3 = icmp eq i32 %k, 1
  br i1 %3, label %if.then.1, label %if.end.1

if.then.1:
  %4 = call i32 @nish_unix_connect(i8* bitcast ({ i64, [25 x i8] }* @.str.17 to i8*))
  ret i32 %4

if.end.1:
  %5 = icmp eq i32 %k, 2
  br i1 %5, label %if.then.2, label %if.end.2

if.then.2:
  %6 = call i32 @nish_unix_accept(i32 %listener)
  ret i32 %6

if.end.2:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = mul i64 2, 4
  %10 = bitcast [2 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !4, !noalias !3
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %fds.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %13 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %12)
  store i32 %13, i32* %answer.addr, align 4
  %14 = load i32, i32* %answer.addr, align 4
  %15 = icmp slt i32 %14, 0
  br i1 %15, label %if.then.3, label %if.end.3

if.then.3:
  %16 = load i32, i32* %answer.addr, align 4
  ret i32 %16

if.end.3:
  %17 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %18 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 4, i32 %k)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  %21 = sext i32 %19 to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 %21, %23
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %21, i64 %23)
  unreachable

bounds.ok:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %21
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %30 = call i32 @nish_net_close(i32 %29)
  %31 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %32 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %k, i32 3)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %35 = sext i32 %33 to i64
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = icmp ult i64 %35, %37
  br i1 %38, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %35, i64 %37)
  unreachable

bounds.ok.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %35
  %43 = load i32, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret i32 %43

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @release() #1 {
entry:
  %0 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.17 to i8*))
  ret i32 %0
}

define noundef i32 @tearDown(i32 noundef %live) #1 {
entry:
  %0 = call i32 @nish_net_close(i32 %live)
  %1 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.3 to i8*))
  %2 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.4 to i8*))
  %3 = call i32 @nish_unlink(i8* bitcast ({ i64, [25 x i8] }* @.str.7 to i8*))
  ret i32 %3
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
