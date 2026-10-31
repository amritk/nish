%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"SPAWN_FDS_SELF\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"child\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"build/test/sfd-not-a-program\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"pass\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef i32 @nish_spawn_child(%struct.nish_array* noundef nonnull align 8) #1
declare noundef i32 @nish_spawn_with_fds(%struct.nish_array* noundef nonnull align 8, %struct.nish_array* noundef nonnull align 8 nocapture readonly) #1
declare noalias noundef nonnull align 8 %struct.nish_array* @nish_wait_pid(i32 noundef, i32 noundef) #0
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #1
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_unix_socket_pair(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #1
declare noundef i32 @nish_send_fd(i32 noundef, i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_recv_fd(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare noundef i32 @nish_peer_credentials(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #4

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

define internal noundef i32 @run(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %argv, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %fds) #0 {
entry:
  %pid.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_spawn_with_fds(%struct.nish_array* %argv, %struct.nish_array* %fds)
  store i32 %0, i32* %pid.addr, align 4
  %1 = load i32, i32* %pid.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = load i32, i32* %pid.addr, align 4
  br label %cond.end

cond.false:
  %4 = load i32, i32* %pid.addr, align 4
  %5 = call %struct.nish_array* @nish_wait_pid(i32 %4, i32 0)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 1, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 1
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %cond.end

cond.end:
  %14 = phi i32 [ %3, %cond.true ], [ %13, %bounds.ok ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %14
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @self(i8* noundef nonnull noalias readonly align 8 %mode) #1 {
entry:
  %path.addr = alloca i8*, align 8
  %0 = call i8* @nish_getenv(i8* bitcast ({ i64, [15 x i8] }* @.str.0 to i8*))
  store i8* %0, i8** %path.addr, align 8
  %1 = load i8*, i8** %path.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %3 = load i8*, i8** %path.addr, align 8
  br label %cond.end

cond.end:
  %4 = phi i8* [ bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), %cond.true ], [ %3, %cond.false ]
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 2, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 2, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %9 = call i8* @nish_alloc_struct(i64 16)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %9 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 0
  store i8* %4, i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %13 = getelementptr inbounds i8*, i8** %11, i64 1
  store i8* %mode, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  ret %struct.nish_array* %6
}

define noundef i32 @attempts() #2 {
entry:
  ret i32 12
}

define noundef i32 @attempt(i32 noundef %k) #0 {
entry:
  %fds.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %pair.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %made.addr = alloca i32, align 4
  %answer.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 3, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %6 = call i8* @nish_alloc_struct(i64 12)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %8, i64 1
  store i32 4, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = getelementptr inbounds i32, i32* %8, i64 2
  store i32 5, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = call i32 @run(%struct.nish_array* %1, %struct.nish_array* %3)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %12

if.end:
  %13 = icmp eq i32 %k, 1
  br i1 %13, label %if.then.1, label %if.end.1

if.then.1:
  %14 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 3, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 3, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %19 = call i8* @nish_alloc_struct(i64 12)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %19 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  store i32 5, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = getelementptr inbounds i32, i32* %21, i64 1
  store i32 3, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %24 = getelementptr inbounds i32, i32* %21, i64 2
  store i32 4, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = call i32 @run(%struct.nish_array* %14, %struct.nish_array* %16)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %25

if.end.1:
  %26 = icmp eq i32 %k, 2
  br i1 %26, label %if.then.2, label %if.end.2

if.then.2:
  %27 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.nish_array*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  store i64 2, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  store i64 2, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = call i8* @nish_alloc_struct(i64 8)
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %32 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  store i32 4, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %36 = getelementptr inbounds i32, i32* %34, i64 1
  store i32 4, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %37 = call i32 @run(%struct.nish_array* %27, %struct.nish_array* %29)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %37

if.end.2:
  %38 = icmp eq i32 %k, 3
  br i1 %38, label %if.then.3, label %if.end.3

if.then.3:
  %39 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %40 = call i8* @nish_alloc_struct(i64 24)
  %41 = bitcast i8* %40 to %struct.nish_array*
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  store i64 0, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 1
  store i64 0, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  store i8* null, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = call i32 @run(%struct.nish_array* %39, %struct.nish_array* %41)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %45

if.end.3:
  %46 = icmp eq i32 %k, 4
  br i1 %46, label %lor.end, label %lor.rhs

lor.rhs:
  %47 = icmp eq i32 %k, 5
  br label %lor.end

lor.end:
  %48 = phi i1 [ true, %if.end.3 ], [ %47, %lor.rhs ]
  br i1 %48, label %if.then.4, label %if.end.4

if.then.4:
  %49 = icmp eq i32 %k, 4
  br i1 %49, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %50 = phi i32 [ 64, %cond.true ], [ 65, %cond.false ]
  %51 = sext i32 %50 to i64
  %52 = icmp ule i64 %51, 2147483647
  br i1 %52, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*))
  unreachable

len.ok:
  %53 = call i8* @nish_alloc_struct(i64 24)
  %54 = bitcast i8* %53 to %struct.nish_array*
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  store i64 %51, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 1
  store i64 %51, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %57 = mul i64 %51, 4
  %58 = call i8* @nish_alloc_struct(i64 %57)
  call void @llvm.memset.p0i8.i64(i8* align 8 %58, i8 0, i64 %57, i1 false), !alias.scope !4, !noalias !3
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  store i8* %58, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %54, %struct.nish_array** %fds.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %60 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %65 = load i32, i32* %i.addr, align 4
  %66 = trunc i64 %62 to i32
  %67 = icmp slt i32 %65, %66
  br i1 %67, label %for.body, label %for.end

for.body:
  %68 = load i32, i32* %i.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = load i32, i32* %i.addr, align 4
  %71 = srem i32 %70, 3
  %72 = add nsw i32 3, %71
  %73 = bitcast i8* %64 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 %69
  store i32 %72, i32* %74, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %75 = load i32, i32* %i.addr, align 4
  %76 = add nsw i32 %75, 1
  store i32 %76, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %77 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %78 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %79 = call i32 @run(%struct.nish_array* %77, %struct.nish_array* %78)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %79

if.end.4:
  %80 = icmp eq i32 %k, 6
  br i1 %80, label %if.then.5, label %if.end.5

if.then.5:
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %83 = mul i64 2, 4
  %84 = bitcast [2 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %84, i8 0, i64 %83, i1 false), !alias.scope !4, !noalias !3
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %84, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %pair.addr, align 8
  %86 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %87 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %86)
  store i32 %87, i32* %made.addr, align 4
  %88 = load i32, i32* %made.addr, align 4
  %89 = icmp slt i32 %88, 0
  br i1 %89, label %cond.true.1, label %cond.false.1

cond.true.1:
  %90 = load i32, i32* %made.addr, align 4
  br label %cond.end.1

cond.false.1:
  %91 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %92 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = icmp ult i64 1, %94
  br i1 %95, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %94)
  unreachable

bounds.ok:
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %98 = bitcast i8* %97 to i32*
  %99 = getelementptr inbounds i32, i32* %98, i64 1
  %100 = load i32, i32* %99, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %101 = call i8* @nish_alloc_struct(i64 24)
  %102 = bitcast i8* %101 to %struct.nish_array*
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 0
  store i64 1, i64* %103, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 1
  store i64 1, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %105 = call i8* @nish_alloc_struct(i64 4)
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 2
  store i8* %105, i8** %106, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %107 = bitcast i8* %105 to i32*
  %108 = getelementptr inbounds i32, i32* %107, i64 0
  store i32 %100, i32* %108, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %109 = call i32 @run(%struct.nish_array* %91, %struct.nish_array* %102)
  br label %cond.end.1

cond.end.1:
  %110 = phi i32 [ %90, %cond.true.1 ], [ %109, %bounds.ok ]
  store i32 %110, i32* %answer.addr, align 4
  %111 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %113 = load i64, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %114 = icmp ult i64 0, %113
  br i1 %114, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %113)
  unreachable

bounds.ok.1:
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  %116 = load i8*, i8** %115, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %117 = bitcast i8* %116 to i32*
  %118 = getelementptr inbounds i32, i32* %117, i64 0
  %119 = load i32, i32* %118, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %120 = call i32 @nish_net_close(i32 %119)
  %121 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 0
  %123 = load i64, i64* %122, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %124 = icmp ult i64 1, %123
  br i1 %124, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %123)
  unreachable

bounds.ok.2:
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %127 = bitcast i8* %126 to i32*
  %128 = getelementptr inbounds i32, i32* %127, i64 1
  %129 = load i32, i32* %128, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %130 = call i32 @nish_net_close(i32 %129)
  %131 = load i32, i32* %answer.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %131

if.end.5:
  %132 = icmp eq i32 %k, 7
  br i1 %132, label %if.then.6, label %if.end.6

if.then.6:
  %133 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %134 = call i8* @nish_alloc_struct(i64 24)
  %135 = bitcast i8* %134 to %struct.nish_array*
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 0
  store i64 2, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 1
  store i64 2, i64* %137, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %138 = call i8* @nish_alloc_struct(i64 8)
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 2
  store i8* %138, i8** %139, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %140 = bitcast i8* %138 to i32*
  %141 = getelementptr inbounds i32, i32* %140, i64 0
  store i32 3, i32* %141, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %142 = getelementptr inbounds i32, i32* %140, i64 1
  store i32 -1, i32* %142, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %143 = call i32 @run(%struct.nish_array* %133, %struct.nish_array* %135)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %143

if.end.6:
  %144 = icmp eq i32 %k, 8
  br i1 %144, label %if.then.7, label %if.end.7

if.then.7:
  %145 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %146 = call i8* @nish_alloc_struct(i64 24)
  %147 = bitcast i8* %146 to %struct.nish_array*
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 0
  store i64 2, i64* %148, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 1
  store i64 2, i64* %149, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %150 = call i8* @nish_alloc_struct(i64 8)
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 2
  store i8* %150, i8** %151, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %152 = bitcast i8* %150 to i32*
  %153 = getelementptr inbounds i32, i32* %152, i64 0
  store i32 3, i32* %153, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %154 = getelementptr inbounds i32, i32* %152, i64 1
  store i32 1000, i32* %154, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %155 = call i32 @run(%struct.nish_array* %145, %struct.nish_array* %147)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %155

if.end.7:
  %156 = icmp eq i32 %k, 9
  br i1 %156, label %if.then.8, label %if.end.8

if.then.8:
  %157 = call i8* @nish_alloc_struct(i64 24)
  %158 = bitcast i8* %157 to %struct.nish_array*
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 0
  store i64 0, i64* %159, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 1
  store i64 0, i64* %160, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 2
  store i8* null, i8** %161, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %162 = call i8* @nish_alloc_struct(i64 24)
  %163 = bitcast i8* %162 to %struct.nish_array*
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 0
  store i64 1, i64* %164, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 1
  store i64 1, i64* %165, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %166 = call i8* @nish_alloc_struct(i64 4)
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 2
  store i8* %166, i8** %167, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %168 = bitcast i8* %166 to i32*
  %169 = getelementptr inbounds i32, i32* %168, i64 0
  store i32 3, i32* %169, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %170 = call i32 @run(%struct.nish_array* %158, %struct.nish_array* %163)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %170

if.end.8:
  %171 = icmp eq i32 %k, 10
  br i1 %171, label %if.then.9, label %if.end.9

if.then.9:
  %172 = call i8* @nish_alloc_struct(i64 24)
  %173 = bitcast i8* %172 to %struct.nish_array*
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 0
  store i64 1, i64* %174, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 1
  store i64 1, i64* %175, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %176 = call i8* @nish_alloc_struct(i64 8)
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 2
  store i8* %176, i8** %177, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %178 = bitcast i8* %176 to i8**
  %179 = getelementptr inbounds i8*, i8** %178, i64 0
  store i8* bitcast ({ i64, [29 x i8] }* @.str.4 to i8*), i8** %179, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %180 = call i8* @nish_alloc_struct(i64 24)
  %181 = bitcast i8* %180 to %struct.nish_array*
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %181, i64 0, i32 0
  store i64 1, i64* %182, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %181, i64 0, i32 1
  store i64 1, i64* %183, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %184 = call i8* @nish_alloc_struct(i64 4)
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %181, i64 0, i32 2
  store i8* %184, i8** %185, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %186 = bitcast i8* %184 to i32*
  %187 = getelementptr inbounds i32, i32* %186, i64 0
  store i32 3, i32* %187, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %188 = call i32 @run(%struct.nish_array* %173, %struct.nish_array* %181)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %188

if.end.9:
  %189 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %190 = call i8* @nish_alloc_struct(i64 24)
  %191 = bitcast i8* %190 to %struct.nish_array*
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 0
  store i64 1, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %193 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 1
  store i64 1, i64* %193, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %194 = call i8* @nish_alloc_struct(i64 4)
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 2
  store i8* %194, i8** %195, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %196 = bitcast i8* %194 to i32*
  %197 = getelementptr inbounds i32, i32* %196, i64 0
  store i32 -5, i32* %197, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %198 = call i32 @run(%struct.nish_array* %189, %struct.nish_array* %191)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %198
}

define noundef i32 @pass(i32 noundef %file) #0 {
entry:
  %pair.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %made.addr = alloca i32, align 4
  %pid.addr = alloca i32, align 4
  %sent.addr = alloca i32, align 4
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i8], align 8
  %status.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 2, 4
  %3 = bitcast [2 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %pair.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %6 = call i32 @nish_unix_socket_pair(i32 1, %struct.nish_array* %5)
  store i32 %6, i32* %made.addr, align 4
  %7 = load i32, i32* %made.addr, align 4
  %8 = icmp slt i32 %7, 0
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = load i32, i32* %made.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9

if.end:
  %10 = call %struct.nish_array* @self(i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*))
  %11 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ult i64 1, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 1
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 1, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 1, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %24 = call i8* @nish_alloc_struct(i64 4)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %24, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %24 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 0
  store i32 %19, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = call i32 @nish_spawn_with_fds(%struct.nish_array* %10, %struct.nish_array* %21)
  store i32 %28, i32* %pid.addr, align 4
  %29 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = icmp ult i64 1, %31
  br i1 %32, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %31)
  unreachable

bounds.ok.1:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 1
  %37 = load i32, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %38 = call i32 @nish_net_close(i32 %37)
  %39 = load i32, i32* %pid.addr, align 4
  %40 = icmp slt i32 %39, 0
  br i1 %40, label %cond.true, label %cond.false

cond.true:
  %41 = load i32, i32* %pid.addr, align 4
  br label %cond.end

cond.false:
  %42 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 0
  %47 = load i32, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %50 = bitcast [1 x i8]* %arr.data.1 to i8*
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %50, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %52 = bitcast i8* %50 to i8*
  %53 = getelementptr inbounds i8, i8* %52, i64 0
  store i8 33, i8* %53, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %54 = add i64 0, 1
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  %56 = load i64, i64* %55, align 8
  %57 = icmp ule i64 0, %54
  %58 = icmp ule i64 %54, %56
  %59 = and i1 %57, %58
  br i1 %59, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %54, i64 %56)
  unreachable

net.ok:
  %60 = call i32 @nish_send_fd(i32 %47, i32 %file, %struct.nish_array* %arr.hdr.1, i64 0, i64 1)
  br label %cond.end

cond.end:
  %61 = phi i32 [ %41, %cond.true ], [ %60, %net.ok ]
  store i32 %61, i32* %sent.addr, align 4
  %62 = load i32, i32* %pid.addr, align 4
  %63 = icmp slt i32 %62, 0
  br i1 %63, label %cond.true.1, label %cond.false.1

cond.true.1:
  %64 = load i32, i32* %pid.addr, align 4
  br label %cond.end.1

cond.false.1:
  %65 = load i32, i32* %pid.addr, align 4
  %66 = call %struct.nish_array* @nish_wait_pid(i32 %65, i32 0)
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = icmp ult i64 1, %68
  br i1 %69, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %68)
  unreachable

bounds.ok.2:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = bitcast i8* %71 to i32*
  %73 = getelementptr inbounds i32, i32* %72, i64 1
  %74 = load i32, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %cond.end.1

cond.end.1:
  %75 = phi i32 [ %64, %cond.true.1 ], [ %74, %bounds.ok.2 ]
  store i32 %75, i32* %status.addr, align 4
  %76 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = icmp ult i64 0, %78
  br i1 %79, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %78)
  unreachable

bounds.ok.3:
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %82 = bitcast i8* %81 to i32*
  %83 = getelementptr inbounds i32, i32* %82, i64 0
  %84 = load i32, i32* %83, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %85 = call i32 @nish_net_close(i32 %84)
  %86 = load i32, i32* %sent.addr, align 4
  %87 = icmp slt i32 %86, 0
  br i1 %87, label %cond.true.2, label %cond.false.2

cond.true.2:
  %88 = load i32, i32* %sent.addr, align 4
  br label %cond.end.2

cond.false.2:
  %89 = load i32, i32* %status.addr, align 4
  br label %cond.end.2

cond.end.2:
  %90 = phi i32 [ %88, %cond.true.2 ], [ %89, %cond.false.2 ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %90
}

define noundef i32 @take(i32 noundef %sock) #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %fd.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i32], align 8
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [8 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %6 = bitcast [1 x i32]* %arr.data.1 to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %fd.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %12 = add i64 0, 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %14 = load i64, i64* %13, align 8
  %15 = icmp ule i64 0, %12
  %16 = icmp ule i64 %12, %14
  %17 = and i1 %15, %16
  br i1 %17, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %12, i64 %14)
  unreachable

net.ok:
  %18 = call i32 @nish_recv_fd(i32 %sock, %struct.nish_array* %10, i64 0, i64 8, %struct.nish_array* %11)
  store i32 %18, i32* %n.addr, align 4
  %19 = load i32, i32* %n.addr, align 4
  %20 = icmp eq i32 %19, 1
  br i1 %20, label %land.rhs, label %land.end

land.rhs:
  %21 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 0, %23
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %23)
  unreachable

bounds.ok:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast i8* %26 to i8*
  %28 = getelementptr inbounds i8, i8* %27, i64 0
  %29 = load i8, i8* %28, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %30 = icmp eq i8 %29, 33
  br label %land.end

land.end:
  %31 = phi i1 [ false, %net.ok ], [ %30, %bounds.ok ]
  br i1 %31, label %cond.true, label %cond.false

cond.true:
  %32 = load %struct.nish_array*, %struct.nish_array** %fd.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = icmp ult i64 0, %34
  br i1 %35, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %34)
  unreachable

bounds.ok.1:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 0
  %40 = load i32, i32* %39, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %cond.end

cond.false:
  %41 = load i32, i32* %n.addr, align 4
  %42 = icmp slt i32 %41, 0
  br i1 %42, label %cond.true.1, label %cond.false.1

cond.true.1:
  %43 = load i32, i32* %n.addr, align 4
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %44 = phi i32 [ %43, %cond.true.1 ], [ -1000, %cond.false.1 ]
  br label %cond.end

cond.end:
  %45 = phi i32 [ %40, %bounds.ok.1 ], [ %44, %cond.end.1 ]
  ret i32 %45
}

define noundef i32 @peer(i32 noundef %sock, i32 noundef %k) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %answer.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 0, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 0, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = call i32 @nish_peer_credentials(i32 %sock, %struct.nish_array* %8)
  store i32 %9, i32* %answer.addr, align 4
  %10 = load i32, i32* %answer.addr, align 4
  %11 = icmp slt i32 %10, 0
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %answer.addr, align 4
  br label %cond.end

cond.false:
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %14 = sext i32 %k to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %14, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %cond.end

cond.end:
  %23 = phi i32 [ %12, %cond.true ], [ %22, %bounds.ok ]
  ret i32 %23
}

define noundef i32 @report() #0 {
entry:
  %pid.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @self(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %1 = call i32 @nish_spawn_child(%struct.nish_array* %0)
  store i32 %1, i32* %pid.addr, align 4
  %2 = load i32, i32* %pid.addr, align 4
  %3 = icmp slt i32 %2, 0
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  %4 = load i32, i32* %pid.addr, align 4
  br label %cond.end

cond.false:
  %5 = load i32, i32* %pid.addr, align 4
  %6 = call %struct.nish_array* @nish_wait_pid(i32 %5, i32 0)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = icmp ult i64 1, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 1
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %cond.end

cond.end:
  %15 = phi i32 [ %4, %cond.true ], [ %14, %bounds.ok ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %15
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element i8", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
