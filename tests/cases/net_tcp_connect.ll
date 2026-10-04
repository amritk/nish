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
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #5

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
  %15 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = sext i32 %16 to i64
  %19 = icmp ult i64 %18, %8
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %18, i64 %8)
  unreachable

bounds.ok:
  %20 = bitcast i8* %10 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %18
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = icmp eq i32 %22, %token
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  %24 = load i32, i32* %i.addr, align 4
  %25 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 1)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %31 = sext i32 %29 to i64
  %32 = icmp ult i64 %31, %8
  br i1 %32, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %31, i64 %8)
  unreachable

bounds.ok.1:
  %33 = bitcast i8* %10 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %31
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %35

if.end.1:
  br label %for.inc

for.inc:
  %36 = load i32, i32* %i.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.end:
  unreachable

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 2, %if.then.1 ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
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
  %5 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %len, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = sext i32 %6 to i64
  %9 = add i64 %3, %8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %11 = load i64, i64* %10, align 8
  %12 = icmp ule i64 %3, %9
  %13 = icmp ule i64 %9, %11
  %14 = and i1 %12, %13
  br i1 %14, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 %3, i64 %9, i64 %11)
  unreachable

net.ok:
  %15 = call i32 @nish_net_read(i32 %fd, %struct.nish_array* %buf, i64 %3, i64 %8)
  store i32 %15, i32* %n.addr, align 4
  %16 = load i32, i32* %n.addr, align 4
  %17 = icmp eq i32 %16, -11
  br i1 %17, label %if.then, label %if.else

if.then:
  %18 = call i32 @waitFor(i32 %loop, %struct.nish_array* %ready, i32 %token)
  %19 = icmp slt i32 %18, 0
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 -1

if.end.1:
  br label %if.end

if.else:
  %20 = load i32, i32* %n.addr, align 4
  %21 = icmp sle i32 %20, 0
  br i1 %21, label %if.then.2, label %if.else.1

if.then.2:
  %22 = load i32, i32* %n.addr, align 4
  %23 = icmp eq i32 %22, 0
  br i1 %23, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %24 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %25 = phi i32 [ -1, %cond.true ], [ %24, %cond.false ]
  ret i32 %25

if.else.1:
  %26 = load i32, i32* %got.addr, align 4
  %27 = load i32, i32* %n.addr, align 4
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %29, i32* %got.addr, align 4
  br label %if.end.2

if.end.2:
  br label %if.end

if.end:
  br label %while.cond

while.end:
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 1, %while.body ], [ 0, %if.else.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
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
  %77 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %75, i32 %76)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok

ovf.ok:
  %80 = and i32 %78, 255
  %81 = trunc i32 %80 to i8
  %82 = bitcast i8* %68 to i8*
  %83 = getelementptr inbounds i8, i8* %82, i64 %73
  store i8 %81, i8* %83, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc.1

for.inc.1:
  %84 = load i32, i32* %k.addr, align 4
  %85 = add nsw i32 %84, 1
  store i32 %85, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  %86 = load i32, i32* %client.addr, align 4
  %87 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %88 = sext i32 %size to i64
  %89 = add i64 0, %88
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 0
  %91 = load i64, i64* %90, align 8
  %92 = icmp ule i64 0, %89
  %93 = icmp ule i64 %89, %91
  %94 = and i1 %92, %93
  br i1 %94, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %89, i64 %91)
  unreachable

net.ok:
  %95 = call i32 @nish_net_write(i32 %86, %struct.nish_array* %87, i64 0, i64 %88)
  %96 = icmp ne i32 %95, %size
  br i1 %96, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %97 = load i32, i32* %conn.addr, align 4
  %98 = load %struct.nish_array*, %struct.nish_array** %relay.addr, align 8
  %99 = call i32 @readAll(i32 %loop, %struct.nish_array* %ready, i32 3, i32 %97, %struct.nish_array* %98, i32 %size)
  %100 = icmp ne i32 %99, 0
  br label %lor.end.2

lor.end.2:
  %101 = phi i1 [ true, %net.ok ], [ %100, %lor.rhs.2 ]
  br i1 %101, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %102 = load i32, i32* %conn.addr, align 4
  %103 = load %struct.nish_array*, %struct.nish_array** %relay.addr, align 8
  %104 = sext i32 %size to i64
  %105 = add i64 0, %104
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 0
  %107 = load i64, i64* %106, align 8
  %108 = icmp ule i64 0, %105
  %109 = icmp ule i64 %105, %107
  %110 = and i1 %108, %109
  br i1 %110, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %105, i64 %107)
  unreachable

net.ok.1:
  %111 = call i32 @nish_net_write(i32 %102, %struct.nish_array* %103, i64 0, i64 %104)
  %112 = icmp ne i32 %111, %size
  br label %lor.end.1

lor.end.1:
  %113 = phi i1 [ true, %lor.end.2 ], [ %112, %net.ok.1 ]
  br i1 %113, label %lor.end, label %lor.rhs

lor.rhs:
  %114 = load i32, i32* %client.addr, align 4
  %115 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %116 = call i32 @readAll(i32 %loop, %struct.nish_array* %ready, i32 2, i32 %114, %struct.nish_array* %115, i32 %size)
  %117 = icmp ne i32 %116, 0
  br label %lor.end

lor.end:
  %118 = phi i1 [ true, %lor.end.1 ], [ %117, %lor.rhs ]
  br i1 %118, label %if.then.5, label %if.end.5

if.then.5:
  br label %for.end

if.end.5:
  store i1 true, i1* %same.addr, align 1
  store i32 0, i32* %k.addr.1, align 4
  %119 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %124 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 0
  %126 = load i64, i64* %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 2
  %128 = load i8*, i8** %127, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %129 = load i32, i32* %k.addr.1, align 4
  %130 = trunc i64 %121 to i32
  %131 = icmp slt i32 %129, %130
  br i1 %131, label %land.rhs, label %land.end

land.rhs:
  %132 = load i32, i32* %k.addr.1, align 4
  %133 = trunc i64 %126 to i32
  %134 = icmp slt i32 %132, %133
  br label %land.end

land.end:
  %135 = phi i1 [ false, %for.cond.2 ], [ %134, %land.rhs ]
  br i1 %135, label %for.body.2, label %for.end.2

for.body.2:
  %136 = load i32, i32* %k.addr.1, align 4
  %137 = sext i32 %136 to i64
  %138 = bitcast i8* %123 to i8*
  %139 = getelementptr inbounds i8, i8* %138, i64 %137
  %140 = load i8, i8* %139, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %141 = load i32, i32* %k.addr.1, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %128 to i8*
  %144 = getelementptr inbounds i8, i8* %143, i64 %142
  %145 = load i8, i8* %144, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %146 = icmp ne i8 %140, %145
  br i1 %146, label %if.then.6, label %if.end.6

if.then.6:
  store i1 false, i1* %same.addr, align 1
  br label %if.end.6

if.end.6:
  br label %for.inc.2

for.inc.2:
  %147 = load i32, i32* %k.addr.1, align 4
  %148 = add nsw i32 %147, 1
  store i32 %148, i32* %k.addr.1, align 4
  br label %for.cond.2

for.end.2:
  %149 = load i1, i1* %same.addr, align 1
  br i1 %149, label %if.then.7, label %if.end.7

if.then.7:
  %150 = load i32, i32* %intact.addr, align 4
  %151 = add nsw i32 %150, 1
  store i32 %151, i32* %intact.addr, align 4
  br label %if.end.7

if.end.7:
  br label %for.inc

for.inc:
  %152 = load i32, i32* %m.addr, align 4
  %153 = add nsw i32 %152, 1
  store i32 %153, i32* %m.addr, align 4
  br label %for.cond

for.end:
  %154 = load i32, i32* %client.addr, align 4
  %155 = call i32 @nish_net_close(i32 %154)
  %156 = call i32 @waitFor(i32 %loop, %struct.nish_array* %ready, i32 3)
  %157 = icmp slt i32 %156, 0
  br i1 %157, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %158 = load i32, i32* %conn.addr, align 4
  %159 = load %struct.nish_array*, %struct.nish_array** %relay.addr, align 8
  %160 = add i64 0, 1
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %159, i64 0, i32 0
  %162 = load i64, i64* %161, align 8
  %163 = icmp ule i64 0, %160
  %164 = icmp ule i64 %160, %162
  %165 = and i1 %163, %164
  br i1 %165, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %160, i64 %162)
  unreachable

net.ok.2:
  %166 = call i32 @nish_net_read(i32 %158, %struct.nish_array* %159, i64 0, i64 1)
  br label %cond.end

cond.end:
  %167 = phi i32 [ -1, %cond.true ], [ %166, %net.ok.2 ]
  store i32 %167, i32* %end.addr, align 4
  %168 = load i32, i32* %conn.addr, align 4
  %169 = call i32 @nish_net_close(i32 %168)
  %170 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 0
  %172 = load i64, i64* %171, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %173 = icmp ult i64 12, %172
  br i1 %173, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 12, i64 %172)
  unreachable

bounds.ok:
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 2
  %175 = load i8*, i8** %174, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %176 = bitcast i8* %175 to i8*
  %177 = getelementptr inbounds i8, i8* %176, i64 12
  %178 = load i8, i8* %177, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %179 = zext i8 %178 to i64
  %180 = call i8* @nish_str_from_u64(i64 %179)
  %181 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %180)
  %182 = call i8* @nish_str_concat(i8* %181, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %183 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 0
  %185 = load i64, i64* %184, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %186 = icmp ult i64 13, %185
  br i1 %186, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 13, i64 %185)
  unreachable

bounds.ok.1:
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 2
  %188 = load i8*, i8** %187, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %189 = bitcast i8* %188 to i8*
  %190 = getelementptr inbounds i8, i8* %189, i64 13
  %191 = load i8, i8* %190, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %192 = zext i8 %191 to i64
  %193 = call i8* @nish_str_from_u64(i64 %192)
  %194 = call i8* @nish_str_concat(i8* %182, i8* %193)
  %195 = call i8* @nish_str_concat(i8* %194, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %196 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 0
  %198 = load i64, i64* %197, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %199 = icmp ult i64 14, %198
  br i1 %199, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 14, i64 %198)
  unreachable

bounds.ok.2:
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 2
  %201 = load i8*, i8** %200, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %202 = bitcast i8* %201 to i8*
  %203 = getelementptr inbounds i8, i8* %202, i64 14
  %204 = load i8, i8* %203, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %205 = zext i8 %204 to i64
  %206 = call i8* @nish_str_from_u64(i64 %205)
  %207 = call i8* @nish_str_concat(i8* %195, i8* %206)
  %208 = call i8* @nish_str_concat(i8* %207, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %209 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %210 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %209, i64 0, i32 0
  %211 = load i64, i64* %210, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %212 = icmp ult i64 15, %211
  br i1 %212, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 15, i64 %211)
  unreachable

bounds.ok.3:
  %213 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %209, i64 0, i32 2
  %214 = load i8*, i8** %213, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %215 = bitcast i8* %214 to i8*
  %216 = getelementptr inbounds i8, i8* %215, i64 15
  %217 = load i8, i8* %216, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %218 = zext i8 %217 to i64
  %219 = call i8* @nish_str_from_u64(i64 %218)
  %220 = call i8* @nish_str_concat(i8* %208, i8* %219)
  %221 = call i8* @nish_str_concat(i8* %220, i8* bitcast ({ i64, [17 x i8] }* @.str.3 to i8*))
  %222 = load i32, i32* %end.addr, align 4
  %223 = call i8* @nish_str_from_i32(i32 %222)
  %224 = call i8* @nish_str_concat(i8* %221, i8* %223)
  call void @nish_print(i8* %224)
  %225 = load i32, i32* %intact.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %225

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
  %37 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %35, i64 %36)
  %38 = extractvalue { i64, i1 } %37, 0
  %39 = extractvalue { i64, i1 } %37, 1
  br i1 %39, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %38, i64* %one.addr, align 8
  %40 = load i32, i32* %loop.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %42 = load i32, i32* %listener.addr, align 4
  %43 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %44 = call i32 @exchange(i32 %40, %struct.nish_array* %41, i32 %42, %struct.nish_array* %43, i32 200, i32 64)
  store i32 %44, i32* %second.addr, align 4
  %45 = call i64 @nish_arena_used()
  %46 = load i64, i64* %before.addr, align 8
  %47 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %45, i64 %46)
  %48 = extractvalue { i64, i1 } %47, 0
  %49 = extractvalue { i64, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %50 = load i64, i64* %one.addr, align 8
  %51 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %48, i64 %50)
  %52 = extractvalue { i64, i1 } %51, 0
  %53 = extractvalue { i64, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i64 %52, i64* %many.addr, align 8
  %54 = load i32, i32* %first.addr, align 4
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), i8* %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [16 x i8] }* @.str.8 to i8*))
  %58 = load i32, i32* %second.addr, align 4
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %57, i8* %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*))
  call void @nish_print(i8* %61)
  %62 = load i64, i64* %one.addr, align 8
  %63 = load i64, i64* %many.addr, align 8
  %64 = icmp eq i64 %62, %63
  br i1 %64, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %65 = load i64, i64* %one.addr, align 8
  %66 = call i8* @nish_str_from_i64(i64 %65)
  %67 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %66)
  %68 = call i8* @nish_str_concat(i8* %67, i8* bitcast ({ i64, [7 x i8] }* @.str.12 to i8*))
  %69 = load i64, i64* %many.addr, align 8
  %70 = call i8* @nish_str_from_i64(i64 %69)
  %71 = call i8* @nish_str_concat(i8* %68, i8* %70)
  br label %cond.end

cond.end:
  %72 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), %cond.true ], [ %71, %cond.false ]
  call void @nish_print(i8* %72)
  %73 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*), i32 0, i32 1)
  store i32 %73, i32* %gone.addr, align 4
  %74 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %75 = load i32, i32* %gone.addr, align 4
  %76 = call i32 @nish_net_local_port(i32 %75)
  %77 = call i32 @nish_net_address(%struct.nish_array* %74, i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*), i32 %76)
  %78 = load i32, i32* %gone.addr, align 4
  %79 = call i32 @nish_net_close(i32 %78)
  %80 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %81 = call i32 @nish_tcp_connect(%struct.nish_array* %80)
  store i32 %81, i32* %refused.addr, align 4
  %82 = load i32, i32* %refused.addr, align 4
  store i32 %82, i32* %answer.addr, align 4
  %83 = load i32, i32* %refused.addr, align 4
  %84 = icmp sge i32 %83, 0
  br i1 %84, label %if.then, label %if.end

if.then:
  %85 = load i32, i32* %loop.addr, align 4
  %86 = load i32, i32* %refused.addr, align 4
  %87 = call i32 @nish_poll_add(i32 %85, i32 %86, i32 2, i32 4)
  %88 = load i32, i32* %loop.addr, align 4
  %89 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %90 = call i32 @waitFor(i32 %88, %struct.nish_array* %89, i32 4)
  %91 = icmp slt i32 %90, 0
  br i1 %91, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %92 = load i32, i32* %refused.addr, align 4
  %93 = call i32 @nish_connect_result(i32 %92)
  br label %cond.end.1

cond.end.1:
  %94 = phi i32 [ -1, %cond.true.1 ], [ %93, %cond.false.1 ]
  store i32 %94, i32* %answer.addr, align 4
  br label %if.end

if.end:
  %95 = load i32, i32* %answer.addr, align 4
  %96 = call i8* @nish_str_from_i32(i32 %95)
  %97 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.13 to i8*), i8* %96)
  call void @nish_print(i8* %97)
  %98 = load i32, i32* %refused.addr, align 4
  %99 = icmp sge i32 %98, 0
  br i1 %99, label %cond.true.2, label %cond.false.2

cond.true.2:
  %100 = load i32, i32* %refused.addr, align 4
  %101 = call i32 @nish_connect_result(i32 %100)
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %102 = phi i32 [ %101, %cond.true.2 ], [ 0, %cond.false.2 ]
  %103 = call i8* @nish_str_from_i32(i32 %102)
  %104 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.14 to i8*), i8* %103)
  call void @nish_print(i8* %104)
  %105 = load i32, i32* %refused.addr, align 4
  %106 = call i32 @nish_net_close(i32 %105)
  %107 = load i32, i32* %listener.addr, align 4
  %108 = call i32 @nish_net_close(i32 %107)
  %109 = load i32, i32* %loop.addr, align 4
  %110 = call i32 @nish_net_close(i32 %109)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %110

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
