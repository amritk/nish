%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"peer \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c", end of stream \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"short \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"not a descriptor \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"one: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c" intact, many: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" intact\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"grows: \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" then \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"refused \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"read once \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_arena_used() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare noundef i32 @nish_net_local_port(i32 noundef) #2
declare noundef i32 @nish_tcp_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_tcp_accept(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare noundef i32 @nish_net_read(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_tcp_connect(%struct.nish_array* noundef nonnull align 8 nocapture readonly) #2
declare noundef i32 @nish_connect_result(i32 noundef) #2
declare noundef i32 @nish_poll_create() #2
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_poll_modify(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_poll_wait(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef) #0
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

define internal noundef i32 @waitFor(i32 noundef %loop, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ready, i32 noundef %token) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ready, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ready, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %4 = call i32 @nish_poll_wait(i32 %loop, %struct.nish_array* %ready, i32 5000)
  store i32 %4, i32* %n.addr, align 4
  %5 = load i32, i32* %n.addr, align 4
  %6 = icmp sle i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  store i32 0, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ready, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ready, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %11 = load i32, i32* %i.addr, align 4
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = mul nsw i32 2, %14
  %16 = sext i32 %15 to i64
  %17 = icmp ult i64 %16, %8
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %16, i64 %8)
  unreachable

bounds.ok:
  %18 = bitcast i8* %10 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %16
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = icmp eq i32 %20, %token
  br i1 %21, label %if.then.1, label %if.end.1

if.then.1:
  %22 = load i32, i32* %i.addr, align 4
  %23 = mul nsw i32 2, %22
  %24 = add nsw i32 %23, 1
  %25 = sext i32 %24 to i64
  %26 = icmp ult i64 %25, %8
  br i1 %26, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %25, i64 %8)
  unreachable

bounds.ok.1:
  %27 = bitcast i8* %10 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %25
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %29

if.end.1:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.end:
  unreachable
}

define internal noundef i32 @readAll(i32 noundef %loop, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ready, i32 noundef %token, i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf, i32 noundef %len) #0 {
entry:
  %got.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  store i32 0, i32* %got.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %got.addr, align 4
  %1 = icmp slt i32 %0, %len
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %got.addr, align 4
  %3 = sext i32 %2 to i64
  %4 = load i32, i32* %got.addr, align 4
  %5 = sub nsw i32 %len, %4
  %6 = sext i32 %5 to i64
  %7 = add i64 %3, %6
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %9 = load i64, i64* %8, align 8
  %10 = icmp ule i64 %3, %7
  %11 = icmp ule i64 %7, %9
  %12 = and i1 %10, %11
  br i1 %12, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 %3, i64 %7, i64 %9)
  unreachable

net.ok:
  %13 = call i32 @nish_net_read(i32 %fd, %struct.nish_array* %buf, i64 %3, i64 %6)
  store i32 %13, i32* %n.addr, align 4
  %14 = load i32, i32* %n.addr, align 4
  %15 = icmp eq i32 %14, -11
  br i1 %15, label %if.then, label %if.else

if.then:
  %16 = call i32 @waitFor(i32 %loop, %struct.nish_array* %ready, i32 %token)
  %17 = icmp slt i32 %16, 0
  br i1 %17, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 -1

if.end.1:
  br label %if.end

if.else:
  %18 = load i32, i32* %n.addr, align 4
  %19 = icmp sle i32 %18, 0
  br i1 %19, label %if.then.2, label %if.else.1

if.then.2:
  %20 = load i32, i32* %n.addr, align 4
  %21 = icmp eq i32 %20, 0
  br i1 %21, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %22 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %23 = phi i32 [ -1, %cond.true ], [ %22, %cond.false ]
  ret i32 %23

if.else.1:
  %24 = load i32, i32* %got.addr, align 4
  %25 = load i32, i32* %n.addr, align 4
  %26 = add nsw i32 %24, %25
  store i32 %26, i32* %got.addr, align 4
  br label %if.end.2

if.end.2:
  br label %if.end

if.end:
  br label %while.cond

while.end:
  ret i32 0
}

define internal noundef i32 @exchange(i32 noundef %loop, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ready, i32 noundef %listener, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %addr, i32 noundef %messages, i32 noundef %size) #0 {
entry:
  %client.addr = alloca i32, align 4
  %made.addr = alloca i32, align 4
  %peer.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %conn.addr = alloca i32, align 4
  %sent.addr = alloca %struct.nish_array*, align 8
  %relay.addr = alloca %struct.nish_array*, align 8
  %back.addr = alloca %struct.nish_array*, align 8
  %intact.addr = alloca i32, align 4
  %m.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %same.addr = alloca i1, align 1
  %k.addr.1 = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_tcp_connect(%struct.nish_array* %addr)
  store i32 %0, i32* %client.addr, align 4
  %1 = load i32, i32* %client.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %client.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3

if.end:
  %4 = load i32, i32* %client.addr, align 4
  %5 = call i32 @nish_poll_add(i32 %loop, i32 %4, i32 2, i32 2)
  %6 = call i32 @waitFor(i32 %loop, %struct.nish_array* %ready, i32 2)
  %7 = icmp slt i32 %6, 0
  br i1 %7, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -1

if.end.1:
  %8 = load i32, i32* %client.addr, align 4
  %9 = call i32 @nish_connect_result(i32 %8)
  store i32 %9, i32* %made.addr, align 4
  %10 = load i32, i32* %made.addr, align 4
  %11 = icmp ne i32 %10, 0
  br i1 %11, label %if.then.2, label %if.end.2

if.then.2:
  %12 = load i32, i32* %made.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %12

if.end.2:
  %13 = call i32 @waitFor(i32 %loop, %struct.nish_array* %ready, i32 1)
  %14 = icmp slt i32 %13, 0
  br i1 %14, label %if.then.3, label %if.end.3

if.then.3:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -1

if.end.3:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %17, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %peer.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %20 = call i32 @nish_tcp_accept(i32 %listener, %struct.nish_array* %19)
  store i32 %20, i32* %conn.addr, align 4
  %21 = load i32, i32* %conn.addr, align 4
  %22 = icmp slt i32 %21, 0
  br i1 %22, label %if.then.4, label %if.end.4

if.then.4:
  %23 = load i32, i32* %conn.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %23

if.end.4:
  %24 = load i32, i32* %client.addr, align 4
  %25 = call i32 @nish_poll_modify(i32 %loop, i32 %24, i32 1, i32 2)
  %26 = load i32, i32* %conn.addr, align 4
  %27 = call i32 @nish_poll_add(i32 %loop, i32 %26, i32 1, i32 3)
  %28 = sext i32 %size to i64
  %29 = icmp ule i64 %28, 2147483647
  br i1 %29, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %30 = call i8* @nish_alloc_struct(i64 24)
  %31 = bitcast i8* %30 to %struct.nish_array*
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  store i64 %28, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 1
  store i64 %28, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %34 = call i8* @nish_alloc_struct(i64 %28)
  call void @llvm.memset.p0i8.i64(i8* align 8 %34, i8 0, i64 %28, i1 false), !alias.scope !4, !noalias !3
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  store i8* %34, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %31, %struct.nish_array** %sent.addr, align 8
  %36 = sext i32 %size to i64
  %37 = icmp ule i64 %36, 2147483647
  br i1 %37, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.1:
  %38 = call i8* @nish_alloc_struct(i64 24)
  %39 = bitcast i8* %38 to %struct.nish_array*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  store i64 %36, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  store i64 %36, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %42 = call i8* @nish_alloc_struct(i64 %36)
  call void @llvm.memset.p0i8.i64(i8* align 8 %42, i8 0, i64 %36, i1 false), !alias.scope !4, !noalias !3
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  store i8* %42, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %39, %struct.nish_array** %relay.addr, align 8
  %44 = sext i32 %size to i64
  %45 = icmp ule i64 %44, 2147483647
  br i1 %45, label %len.ok.2, label %len.fail.2

len.fail.2:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.2:
  %46 = call i8* @nish_alloc_struct(i64 24)
  %47 = bitcast i8* %46 to %struct.nish_array*
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  store i64 %44, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  store i64 %44, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %50 = call i8* @nish_alloc_struct(i64 %44)
  call void @llvm.memset.p0i8.i64(i8* align 8 %50, i8 0, i64 %44, i1 false), !alias.scope !4, !noalias !3
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  store i8* %50, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %47, %struct.nish_array** %back.addr, align 8
  store i32 0, i32* %intact.addr, align 4
  store i32 0, i32* %m.addr, align 4
  %52 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %57 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %62 = load i32, i32* %m.addr, align 4
  %63 = icmp slt i32 %62, %messages
  br i1 %63, label %for.body, label %for.end

for.body:
  store i32 0, i32* %k.addr, align 4
  %64 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %69 = load i32, i32* %k.addr, align 4
  %70 = trunc i64 %66 to i32
  %71 = icmp slt i32 %69, %70
  br i1 %71, label %for.body.1, label %for.end.1

for.body.1:
  %72 = load i32, i32* %k.addr, align 4
  %73 = sext i32 %72 to i64
  %74 = load i32, i32* %m.addr, align 4
  %75 = mul nsw i32 %74, 7
  %76 = load i32, i32* %k.addr, align 4
  %77 = add nsw i32 %75, %76
  %78 = and i32 %77, 255
  %79 = trunc i32 %78 to i8
  %80 = bitcast i8* %68 to i8*
  %81 = getelementptr inbounds i8, i8* %80, i64 %73
  store i8 %79, i8* %81, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc.1

for.inc.1:
  %82 = load i32, i32* %k.addr, align 4
  %83 = add nsw i32 %82, 1
  store i32 %83, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  %84 = load i32, i32* %client.addr, align 4
  %85 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %86 = sext i32 %size to i64
  %87 = add i64 0, %86
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %89 = load i64, i64* %88, align 8
  %90 = icmp ule i64 0, %87
  %91 = icmp ule i64 %87, %89
  %92 = and i1 %90, %91
  br i1 %92, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %87, i64 %89)
  unreachable

net.ok:
  %93 = call i32 @nish_net_write(i32 %84, %struct.nish_array* %85, i64 0, i64 %86)
  %94 = icmp ne i32 %93, %size
  br i1 %94, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %95 = load i32, i32* %conn.addr, align 4
  %96 = load %struct.nish_array*, %struct.nish_array** %relay.addr, align 8
  %97 = call i32 @readAll(i32 %loop, %struct.nish_array* %ready, i32 3, i32 %95, %struct.nish_array* %96, i32 %size)
  %98 = icmp ne i32 %97, 0
  br label %lor.end.2

lor.end.2:
  %99 = phi i1 [ true, %net.ok ], [ %98, %lor.rhs.2 ]
  br i1 %99, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %100 = load i32, i32* %conn.addr, align 4
  %101 = load %struct.nish_array*, %struct.nish_array** %relay.addr, align 8
  %102 = sext i32 %size to i64
  %103 = add i64 0, %102
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %105 = load i64, i64* %104, align 8
  %106 = icmp ule i64 0, %103
  %107 = icmp ule i64 %103, %105
  %108 = and i1 %106, %107
  br i1 %108, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %103, i64 %105)
  unreachable

net.ok.1:
  %109 = call i32 @nish_net_write(i32 %100, %struct.nish_array* %101, i64 0, i64 %102)
  %110 = icmp ne i32 %109, %size
  br label %lor.end.1

lor.end.1:
  %111 = phi i1 [ true, %lor.end.2 ], [ %110, %net.ok.1 ]
  br i1 %111, label %lor.end, label %lor.rhs

lor.rhs:
  %112 = load i32, i32* %client.addr, align 4
  %113 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %114 = call i32 @readAll(i32 %loop, %struct.nish_array* %ready, i32 2, i32 %112, %struct.nish_array* %113, i32 %size)
  %115 = icmp ne i32 %114, 0
  br label %lor.end

lor.end:
  %116 = phi i1 [ true, %lor.end.1 ], [ %115, %lor.rhs ]
  br i1 %116, label %if.then.5, label %if.end.5

if.then.5:
  br label %for.end

if.end.5:
  store i1 true, i1* %same.addr, align 1
  store i32 0, i32* %k.addr.1, align 4
  %117 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %122 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 0
  %124 = load i64, i64* %123, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %127 = load i32, i32* %k.addr.1, align 4
  %128 = trunc i64 %119 to i32
  %129 = icmp slt i32 %127, %128
  br i1 %129, label %land.rhs, label %land.end

land.rhs:
  %130 = load i32, i32* %k.addr.1, align 4
  %131 = trunc i64 %124 to i32
  %132 = icmp slt i32 %130, %131
  br label %land.end

land.end:
  %133 = phi i1 [ false, %for.cond.2 ], [ %132, %land.rhs ]
  br i1 %133, label %for.body.2, label %for.end.2

for.body.2:
  %134 = load i32, i32* %k.addr.1, align 4
  %135 = sext i32 %134 to i64
  %136 = bitcast i8* %121 to i8*
  %137 = getelementptr inbounds i8, i8* %136, i64 %135
  %138 = load i8, i8* %137, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %139 = load i32, i32* %k.addr.1, align 4
  %140 = sext i32 %139 to i64
  %141 = bitcast i8* %126 to i8*
  %142 = getelementptr inbounds i8, i8* %141, i64 %140
  %143 = load i8, i8* %142, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %144 = icmp ne i8 %138, %143
  br i1 %144, label %if.then.6, label %if.end.6

if.then.6:
  store i1 false, i1* %same.addr, align 1
  br label %if.end.6

if.end.6:
  br label %for.inc.2

for.inc.2:
  %145 = load i32, i32* %k.addr.1, align 4
  %146 = add nsw i32 %145, 1
  store i32 %146, i32* %k.addr.1, align 4
  br label %for.cond.2

for.end.2:
  %147 = load i1, i1* %same.addr, align 1
  br i1 %147, label %if.then.7, label %if.end.7

if.then.7:
  %148 = load i32, i32* %intact.addr, align 4
  %149 = add nsw i32 %148, 1
  store i32 %149, i32* %intact.addr, align 4
  br label %if.end.7

if.end.7:
  br label %for.inc

for.inc:
  %150 = load i32, i32* %m.addr, align 4
  %151 = add nsw i32 %150, 1
  store i32 %151, i32* %m.addr, align 4
  br label %for.cond

for.end:
  %152 = load i32, i32* %client.addr, align 4
  %153 = call i32 @nish_net_close(i32 %152)
  %154 = call i32 @waitFor(i32 %loop, %struct.nish_array* %ready, i32 3)
  %155 = icmp slt i32 %154, 0
  br i1 %155, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %156 = load i32, i32* %conn.addr, align 4
  %157 = load %struct.nish_array*, %struct.nish_array** %relay.addr, align 8
  %158 = add i64 0, 1
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 0
  %160 = load i64, i64* %159, align 8
  %161 = icmp ule i64 0, %158
  %162 = icmp ule i64 %158, %160
  %163 = and i1 %161, %162
  br i1 %163, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %158, i64 %160)
  unreachable

net.ok.2:
  %164 = call i32 @nish_net_read(i32 %156, %struct.nish_array* %157, i64 0, i64 1)
  br label %cond.end

cond.end:
  %165 = phi i32 [ -1, %cond.true ], [ %164, %net.ok.2 ]
  store i32 %165, i32* %end.addr, align 4
  %166 = load i32, i32* %conn.addr, align 4
  %167 = call i32 @nish_net_close(i32 %166)
  %168 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %168, i64 0, i32 0
  %170 = load i64, i64* %169, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %171 = icmp ult i64 12, %170
  br i1 %171, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 12, i64 %170)
  unreachable

bounds.ok:
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %168, i64 0, i32 2
  %173 = load i8*, i8** %172, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %174 = bitcast i8* %173 to i8*
  %175 = getelementptr inbounds i8, i8* %174, i64 12
  %176 = load i8, i8* %175, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %177 = zext i8 %176 to i64
  %178 = call i8* @nish_str_from_u64(i64 %177)
  %179 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %178)
  %180 = call i8* @nish_str_concat(i8* %179, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %181 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %181, i64 0, i32 0
  %183 = load i64, i64* %182, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %184 = icmp ult i64 13, %183
  br i1 %184, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 13, i64 %183)
  unreachable

bounds.ok.1:
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %181, i64 0, i32 2
  %186 = load i8*, i8** %185, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %187 = bitcast i8* %186 to i8*
  %188 = getelementptr inbounds i8, i8* %187, i64 13
  %189 = load i8, i8* %188, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %190 = zext i8 %189 to i64
  %191 = call i8* @nish_str_from_u64(i64 %190)
  %192 = call i8* @nish_str_concat(i8* %180, i8* %191)
  %193 = call i8* @nish_str_concat(i8* %192, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %194 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %194, i64 0, i32 0
  %196 = load i64, i64* %195, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %197 = icmp ult i64 14, %196
  br i1 %197, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 14, i64 %196)
  unreachable

bounds.ok.2:
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %194, i64 0, i32 2
  %199 = load i8*, i8** %198, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %200 = bitcast i8* %199 to i8*
  %201 = getelementptr inbounds i8, i8* %200, i64 14
  %202 = load i8, i8* %201, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %203 = zext i8 %202 to i64
  %204 = call i8* @nish_str_from_u64(i64 %203)
  %205 = call i8* @nish_str_concat(i8* %193, i8* %204)
  %206 = call i8* @nish_str_concat(i8* %205, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %207 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 0
  %209 = load i64, i64* %208, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %210 = icmp ult i64 15, %209
  br i1 %210, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 15, i64 %209)
  unreachable

bounds.ok.3:
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 2
  %212 = load i8*, i8** %211, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %213 = bitcast i8* %212 to i8*
  %214 = getelementptr inbounds i8, i8* %213, i64 15
  %215 = load i8, i8* %214, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %216 = zext i8 %215 to i64
  %217 = call i8* @nish_str_from_u64(i64 %216)
  %218 = call i8* @nish_str_concat(i8* %206, i8* %217)
  %219 = call i8* @nish_str_concat(i8* %218, i8* bitcast ({ i64, [17 x i8] }* @.str.3 to i8*))
  %220 = load i32, i32* %end.addr, align 4
  %221 = call i8* @nish_str_from_i32(i32 %220)
  %222 = call i8* @nish_str_concat(i8* %219, i8* %221)
  call void @nish_print(i8* %222)
  %223 = load i32, i32* %intact.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %223
}

define noundef i32 @nish_main() #0 {
entry:
  %short.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [17 x i8], align 8
  %loop.addr = alloca i32, align 4
  %ready.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i32], align 8
  %listener.addr = alloca i32, align 4
  %addr.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [18 x i8], align 8
  %before.addr = alloca i64, align 8
  %first.addr = alloca i32, align 4
  %one.addr = alloca i64, align 8
  %second.addr = alloca i32, align 4
  %many.addr = alloca i64, align 8
  %gone.addr = alloca i32, align 4
  %refused.addr = alloca i32, align 4
  %answer.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 17, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 17, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [17 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 17, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %short.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %5 = call i32 @nish_tcp_connect(%struct.nish_array* %4)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8* %6)
  call void @nish_print(i8* %7)
  %8 = call i32 @nish_connect_result(i32 -1)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [18 x i8] }* @.str.5 to i8*), i8* %9)
  call void @nish_print(i8* %10)
  %11 = call i32 @nish_poll_create()
  store i32 %11, i32* %loop.addr, align 4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %14 = mul i64 8, 4
  %15 = bitcast [8 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %15, i8 0, i64 %14, i1 false), !alias.scope !4, !noalias !3
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ready.addr, align 8
  %17 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*), i32 0, i32 8)
  store i32 %17, i32* %listener.addr, align 4
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 18, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 18, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %20 = bitcast [18 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %20, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %addr.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %23 = load i32, i32* %listener.addr, align 4
  %24 = call i32 @nish_net_local_port(i32 %23)
  %25 = call i32 @nish_net_address(%struct.nish_array* %22, i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*), i32 %24)
  %26 = load i32, i32* %loop.addr, align 4
  %27 = load i32, i32* %listener.addr, align 4
  %28 = call i32 @nish_poll_add(i32 %26, i32 %27, i32 1, i32 1)
  %29 = call i64 @nish_arena_used()
  store i64 %29, i64* %before.addr, align 8
  %30 = load i32, i32* %loop.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %32 = load i32, i32* %listener.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %34 = call i32 @exchange(i32 %30, %struct.nish_array* %31, i32 %32, %struct.nish_array* %33, i32 1, i32 64)
  store i32 %34, i32* %first.addr, align 4
  %35 = call i64 @nish_arena_used()
  %36 = load i64, i64* %before.addr, align 8
  %37 = sub nsw i64 %35, %36
  store i64 %37, i64* %one.addr, align 8
  %38 = load i32, i32* %loop.addr, align 4
  %39 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %40 = load i32, i32* %listener.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %42 = call i32 @exchange(i32 %38, %struct.nish_array* %39, i32 %40, %struct.nish_array* %41, i32 200, i32 64)
  store i32 %42, i32* %second.addr, align 4
  %43 = call i64 @nish_arena_used()
  %44 = load i64, i64* %before.addr, align 8
  %45 = sub nsw i64 %43, %44
  %46 = load i64, i64* %one.addr, align 8
  %47 = sub nsw i64 %45, %46
  store i64 %47, i64* %many.addr, align 8
  %48 = load i32, i32* %first.addr, align 4
  %49 = call i8* @nish_str_from_i32(i32 %48)
  %50 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), i8* %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [16 x i8] }* @.str.8 to i8*))
  %52 = load i32, i32* %second.addr, align 4
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %51, i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*))
  call void @nish_print(i8* %55)
  %56 = load i64, i64* %one.addr, align 8
  %57 = load i64, i64* %many.addr, align 8
  %58 = icmp eq i64 %56, %57
  br i1 %58, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %59 = load i64, i64* %one.addr, align 8
  %60 = call i8* @nish_str_from_i64(i64 %59)
  %61 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [7 x i8] }* @.str.12 to i8*))
  %63 = load i64, i64* %many.addr, align 8
  %64 = call i8* @nish_str_from_i64(i64 %63)
  %65 = call i8* @nish_str_concat(i8* %62, i8* %64)
  br label %cond.end

cond.end:
  %66 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), %cond.true ], [ %65, %cond.false ]
  call void @nish_print(i8* %66)
  %67 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*), i32 0, i32 1)
  store i32 %67, i32* %gone.addr, align 4
  %68 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %69 = load i32, i32* %gone.addr, align 4
  %70 = call i32 @nish_net_local_port(i32 %69)
  %71 = call i32 @nish_net_address(%struct.nish_array* %68, i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*), i32 %70)
  %72 = load i32, i32* %gone.addr, align 4
  %73 = call i32 @nish_net_close(i32 %72)
  %74 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %75 = call i32 @nish_tcp_connect(%struct.nish_array* %74)
  store i32 %75, i32* %refused.addr, align 4
  %76 = load i32, i32* %refused.addr, align 4
  store i32 %76, i32* %answer.addr, align 4
  %77 = load i32, i32* %refused.addr, align 4
  %78 = icmp sge i32 %77, 0
  br i1 %78, label %if.then, label %if.end

if.then:
  %79 = load i32, i32* %loop.addr, align 4
  %80 = load i32, i32* %refused.addr, align 4
  %81 = call i32 @nish_poll_add(i32 %79, i32 %80, i32 2, i32 4)
  %82 = load i32, i32* %loop.addr, align 4
  %83 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %84 = call i32 @waitFor(i32 %82, %struct.nish_array* %83, i32 4)
  %85 = icmp slt i32 %84, 0
  br i1 %85, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %86 = load i32, i32* %refused.addr, align 4
  %87 = call i32 @nish_connect_result(i32 %86)
  br label %cond.end.1

cond.end.1:
  %88 = phi i32 [ -1, %cond.true.1 ], [ %87, %cond.false.1 ]
  store i32 %88, i32* %answer.addr, align 4
  br label %if.end

if.end:
  %89 = load i32, i32* %answer.addr, align 4
  %90 = call i8* @nish_str_from_i32(i32 %89)
  %91 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.13 to i8*), i8* %90)
  call void @nish_print(i8* %91)
  %92 = load i32, i32* %refused.addr, align 4
  %93 = icmp sge i32 %92, 0
  br i1 %93, label %cond.true.2, label %cond.false.2

cond.true.2:
  %94 = load i32, i32* %refused.addr, align 4
  %95 = call i32 @nish_connect_result(i32 %94)
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %96 = phi i32 [ %95, %cond.true.2 ], [ 0, %cond.false.2 ]
  %97 = call i8* @nish_str_from_i32(i32 %96)
  %98 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.14 to i8*), i8* %97)
  call void @nish_print(i8* %98)
  %99 = load i32, i32* %refused.addr, align 4
  %100 = call i32 @nish_net_close(i32 %99)
  %101 = load i32, i32* %listener.addr, align 4
  %102 = call i32 @nish_net_close(i32 %101)
  %103 = load i32, i32* %loop.addr, align 4
  %104 = call i32 @nish_net_close(i32 %103)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %104
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
