%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"peer \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c", end of stream \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"short \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"not a descriptor \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"one: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c" intact, many: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" intact\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"grows: \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" then \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"refused \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"read once \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_arena_used() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
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
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
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
  %29 = call i8* @nish_alloc_struct(i64 24)
  %30 = bitcast i8* %29 to %struct.nish_array*
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  store i64 %28, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 1
  store i64 %28, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %33 = call i8* @nish_alloc_struct(i64 %28)
  call void @llvm.memset.p0i8.i64(i8* align 8 %33, i8 0, i64 %28, i1 false), !alias.scope !4, !noalias !3
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %30, %struct.nish_array** %sent.addr, align 8
  %35 = sext i32 %size to i64
  %36 = call i8* @nish_alloc_struct(i64 24)
  %37 = bitcast i8* %36 to %struct.nish_array*
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  store i64 %35, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 1
  store i64 %35, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %40 = call i8* @nish_alloc_struct(i64 %35)
  call void @llvm.memset.p0i8.i64(i8* align 8 %40, i8 0, i64 %35, i1 false), !alias.scope !4, !noalias !3
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  store i8* %40, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %37, %struct.nish_array** %relay.addr, align 8
  %42 = sext i32 %size to i64
  %43 = call i8* @nish_alloc_struct(i64 24)
  %44 = bitcast i8* %43 to %struct.nish_array*
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  store i64 %42, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 1
  store i64 %42, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %47 = call i8* @nish_alloc_struct(i64 %42)
  call void @llvm.memset.p0i8.i64(i8* align 8 %47, i8 0, i64 %42, i1 false), !alias.scope !4, !noalias !3
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  store i8* %47, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %44, %struct.nish_array** %back.addr, align 8
  store i32 0, i32* %intact.addr, align 4
  store i32 0, i32* %m.addr, align 4
  %49 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %59 = load i32, i32* %m.addr, align 4
  %60 = icmp slt i32 %59, %messages
  br i1 %60, label %for.body, label %for.end

for.body:
  store i32 0, i32* %k.addr, align 4
  %61 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %66 = load i32, i32* %k.addr, align 4
  %67 = trunc i64 %63 to i32
  %68 = icmp slt i32 %66, %67
  br i1 %68, label %for.body.1, label %for.end.1

for.body.1:
  %69 = load i32, i32* %k.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = load i32, i32* %m.addr, align 4
  %72 = mul nsw i32 %71, 7
  %73 = load i32, i32* %k.addr, align 4
  %74 = add nsw i32 %72, %73
  %75 = and i32 %74, 255
  %76 = trunc i32 %75 to i8
  %77 = bitcast i8* %65 to i8*
  %78 = getelementptr inbounds i8, i8* %77, i64 %70
  store i8 %76, i8* %78, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc.1

for.inc.1:
  %79 = load i32, i32* %k.addr, align 4
  %80 = add nsw i32 %79, 1
  store i32 %80, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  %81 = load i32, i32* %client.addr, align 4
  %82 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %83 = sext i32 %size to i64
  %84 = add i64 0, %83
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %86 = load i64, i64* %85, align 8
  %87 = icmp ule i64 0, %84
  %88 = icmp ule i64 %84, %86
  %89 = and i1 %87, %88
  br i1 %89, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %84, i64 %86)
  unreachable

net.ok:
  %90 = call i32 @nish_net_write(i32 %81, %struct.nish_array* %82, i64 0, i64 %83)
  %91 = icmp ne i32 %90, %size
  br i1 %91, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %92 = load i32, i32* %conn.addr, align 4
  %93 = load %struct.nish_array*, %struct.nish_array** %relay.addr, align 8
  %94 = call i32 @readAll(i32 %loop, %struct.nish_array* %ready, i32 3, i32 %92, %struct.nish_array* %93, i32 %size)
  %95 = icmp ne i32 %94, 0
  br label %lor.end.2

lor.end.2:
  %96 = phi i1 [ true, %net.ok ], [ %95, %lor.rhs.2 ]
  br i1 %96, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %97 = load i32, i32* %conn.addr, align 4
  %98 = load %struct.nish_array*, %struct.nish_array** %relay.addr, align 8
  %99 = sext i32 %size to i64
  %100 = add i64 0, %99
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 0
  %102 = load i64, i64* %101, align 8
  %103 = icmp ule i64 0, %100
  %104 = icmp ule i64 %100, %102
  %105 = and i1 %103, %104
  br i1 %105, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %100, i64 %102)
  unreachable

net.ok.1:
  %106 = call i32 @nish_net_write(i32 %97, %struct.nish_array* %98, i64 0, i64 %99)
  %107 = icmp ne i32 %106, %size
  br label %lor.end.1

lor.end.1:
  %108 = phi i1 [ true, %lor.end.2 ], [ %107, %net.ok.1 ]
  br i1 %108, label %lor.end, label %lor.rhs

lor.rhs:
  %109 = load i32, i32* %client.addr, align 4
  %110 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %111 = call i32 @readAll(i32 %loop, %struct.nish_array* %ready, i32 2, i32 %109, %struct.nish_array* %110, i32 %size)
  %112 = icmp ne i32 %111, 0
  br label %lor.end

lor.end:
  %113 = phi i1 [ true, %lor.end.1 ], [ %112, %lor.rhs ]
  br i1 %113, label %if.then.5, label %if.end.5

if.then.5:
  br label %for.end

if.end.5:
  store i1 true, i1* %same.addr, align 1
  store i32 0, i32* %k.addr.1, align 4
  %114 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 0
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 2
  %118 = load i8*, i8** %117, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %119 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %124 = load i32, i32* %k.addr.1, align 4
  %125 = trunc i64 %116 to i32
  %126 = icmp slt i32 %124, %125
  br i1 %126, label %land.rhs, label %land.end

land.rhs:
  %127 = load i32, i32* %k.addr.1, align 4
  %128 = trunc i64 %121 to i32
  %129 = icmp slt i32 %127, %128
  br label %land.end

land.end:
  %130 = phi i1 [ false, %for.cond.2 ], [ %129, %land.rhs ]
  br i1 %130, label %for.body.2, label %for.end.2

for.body.2:
  %131 = load i32, i32* %k.addr.1, align 4
  %132 = sext i32 %131 to i64
  %133 = bitcast i8* %118 to i8*
  %134 = getelementptr inbounds i8, i8* %133, i64 %132
  %135 = load i8, i8* %134, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %136 = load i32, i32* %k.addr.1, align 4
  %137 = sext i32 %136 to i64
  %138 = bitcast i8* %123 to i8*
  %139 = getelementptr inbounds i8, i8* %138, i64 %137
  %140 = load i8, i8* %139, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %141 = icmp ne i8 %135, %140
  br i1 %141, label %if.then.6, label %if.end.6

if.then.6:
  store i1 false, i1* %same.addr, align 1
  br label %if.end.6

if.end.6:
  br label %for.inc.2

for.inc.2:
  %142 = load i32, i32* %k.addr.1, align 4
  %143 = add nsw i32 %142, 1
  store i32 %143, i32* %k.addr.1, align 4
  br label %for.cond.2

for.end.2:
  %144 = load i1, i1* %same.addr, align 1
  br i1 %144, label %if.then.7, label %if.end.7

if.then.7:
  %145 = load i32, i32* %intact.addr, align 4
  %146 = add nsw i32 %145, 1
  store i32 %146, i32* %intact.addr, align 4
  br label %if.end.7

if.end.7:
  br label %for.inc

for.inc:
  %147 = load i32, i32* %m.addr, align 4
  %148 = add nsw i32 %147, 1
  store i32 %148, i32* %m.addr, align 4
  br label %for.cond

for.end:
  %149 = load i32, i32* %client.addr, align 4
  %150 = call i32 @nish_net_close(i32 %149)
  %151 = call i32 @waitFor(i32 %loop, %struct.nish_array* %ready, i32 3)
  %152 = icmp slt i32 %151, 0
  br i1 %152, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %153 = load i32, i32* %conn.addr, align 4
  %154 = load %struct.nish_array*, %struct.nish_array** %relay.addr, align 8
  %155 = add i64 0, 1
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 0
  %157 = load i64, i64* %156, align 8
  %158 = icmp ule i64 0, %155
  %159 = icmp ule i64 %155, %157
  %160 = and i1 %158, %159
  br i1 %160, label %net.ok.2, label %net.fail.2

net.fail.2:
  call void @nish_panic_slice(i64 0, i64 %155, i64 %157)
  unreachable

net.ok.2:
  %161 = call i32 @nish_net_read(i32 %153, %struct.nish_array* %154, i64 0, i64 1)
  br label %cond.end

cond.end:
  %162 = phi i32 [ -1, %cond.true ], [ %161, %net.ok.2 ]
  store i32 %162, i32* %end.addr, align 4
  %163 = load i32, i32* %conn.addr, align 4
  %164 = call i32 @nish_net_close(i32 %163)
  %165 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %165, i64 0, i32 0
  %167 = load i64, i64* %166, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %168 = icmp ult i64 12, %167
  br i1 %168, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 12, i64 %167)
  unreachable

bounds.ok:
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %165, i64 0, i32 2
  %170 = load i8*, i8** %169, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %171 = bitcast i8* %170 to i8*
  %172 = getelementptr inbounds i8, i8* %171, i64 12
  %173 = load i8, i8* %172, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %174 = zext i8 %173 to i64
  %175 = call i8* @nish_str_from_u64(i64 %174)
  %176 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %175)
  %177 = call i8* @nish_str_concat(i8* %176, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %178 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %178, i64 0, i32 0
  %180 = load i64, i64* %179, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %181 = icmp ult i64 13, %180
  br i1 %181, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 13, i64 %180)
  unreachable

bounds.ok.1:
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %178, i64 0, i32 2
  %183 = load i8*, i8** %182, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %184 = bitcast i8* %183 to i8*
  %185 = getelementptr inbounds i8, i8* %184, i64 13
  %186 = load i8, i8* %185, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %187 = zext i8 %186 to i64
  %188 = call i8* @nish_str_from_u64(i64 %187)
  %189 = call i8* @nish_str_concat(i8* %177, i8* %188)
  %190 = call i8* @nish_str_concat(i8* %189, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %191 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 0
  %193 = load i64, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %194 = icmp ult i64 14, %193
  br i1 %194, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 14, i64 %193)
  unreachable

bounds.ok.2:
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 2
  %196 = load i8*, i8** %195, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %197 = bitcast i8* %196 to i8*
  %198 = getelementptr inbounds i8, i8* %197, i64 14
  %199 = load i8, i8* %198, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %200 = zext i8 %199 to i64
  %201 = call i8* @nish_str_from_u64(i64 %200)
  %202 = call i8* @nish_str_concat(i8* %190, i8* %201)
  %203 = call i8* @nish_str_concat(i8* %202, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %204 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %204, i64 0, i32 0
  %206 = load i64, i64* %205, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %207 = icmp ult i64 15, %206
  br i1 %207, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 15, i64 %206)
  unreachable

bounds.ok.3:
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %204, i64 0, i32 2
  %209 = load i8*, i8** %208, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %210 = bitcast i8* %209 to i8*
  %211 = getelementptr inbounds i8, i8* %210, i64 15
  %212 = load i8, i8* %211, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %213 = zext i8 %212 to i64
  %214 = call i8* @nish_str_from_u64(i64 %213)
  %215 = call i8* @nish_str_concat(i8* %203, i8* %214)
  %216 = call i8* @nish_str_concat(i8* %215, i8* bitcast ({ i64, [17 x i8] }* @.str.2 to i8*))
  %217 = load i32, i32* %end.addr, align 4
  %218 = call i8* @nish_str_from_i32(i32 %217)
  %219 = call i8* @nish_str_concat(i8* %216, i8* %218)
  call void @nish_print(i8* %219)
  %220 = load i32, i32* %intact.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %220
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
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*), i8* %6)
  call void @nish_print(i8* %7)
  %8 = call i32 @nish_connect_result(i32 -1)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [18 x i8] }* @.str.4 to i8*), i8* %9)
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
  %17 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i32 0, i32 8)
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
  %25 = call i32 @nish_net_address(%struct.nish_array* %22, i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i32 %24)
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
  %50 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), i8* %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [16 x i8] }* @.str.7 to i8*))
  %52 = load i32, i32* %second.addr, align 4
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %51, i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [8 x i8] }* @.str.8 to i8*))
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
  %61 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.10 to i8*), i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [7 x i8] }* @.str.11 to i8*))
  %63 = load i64, i64* %many.addr, align 8
  %64 = call i8* @nish_str_from_i64(i64 %63)
  %65 = call i8* @nish_str_concat(i8* %62, i8* %64)
  br label %cond.end

cond.end:
  %66 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.9 to i8*), %cond.true ], [ %65, %cond.false ]
  call void @nish_print(i8* %66)
  %67 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i32 0, i32 1)
  store i32 %67, i32* %gone.addr, align 4
  %68 = load %struct.nish_array*, %struct.nish_array** %addr.addr, align 8
  %69 = load i32, i32* %gone.addr, align 4
  %70 = call i32 @nish_net_local_port(i32 %69)
  %71 = call i32 @nish_net_address(%struct.nish_array* %68, i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i32 %70)
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
  %91 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.12 to i8*), i8* %90)
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
  %98 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.13 to i8*), i8* %97)
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
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
