%struct.Served = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" + \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"tcpAccept \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"peer \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"echoed \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"closed \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"tcpListen \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"port \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"grows: \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" then \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0
declare noundef i32 @nish_net_local_port(i32 noundef) #0
declare noundef i32 @nish_tcp_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_tcp_accept(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #1
declare noundef i32 @nish_net_read(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #1
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #1
declare noundef i32 @nish_net_close(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #4

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

define internal void @Served.constructor(%struct.Served* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %bytes, i32 noundef %notes) #0 {
entry:
  %0 = getelementptr inbounds %struct.Served, %struct.Served* %this, i32 0, i32 0
  store i32 %bytes, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Served, %struct.Served* %this, i32 0, i32 1
  store i32 %notes, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef zeroext i1 @sendAll(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %n) #1 {
entry:
  %sent.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  store i32 0, i32* %sent.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %sent.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %sent.addr, align 4
  %3 = sext i32 %2 to i64
  %4 = load i32, i32* %sent.addr, align 4
  %5 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 %4)
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
  %15 = call i32 @nish_net_write(i32 %fd, %struct.nish_array* %buf, i64 %3, i64 %8)
  store i32 %15, i32* %w.addr, align 4
  %16 = load i32, i32* %w.addr, align 4
  %17 = icmp sge i32 %16, 0
  br i1 %17, label %if.then, label %if.else

if.then:
  %18 = load i32, i32* %sent.addr, align 4
  %19 = load i32, i32* %w.addr, align 4
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %21, i32* %sent.addr, align 4
  br label %if.end

if.else:
  %23 = load i32, i32* %w.addr, align 4
  %24 = icmp ne i32 %23, -11
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  ret i1 false

if.end.1:
  br label %if.end

if.end:
  br label %while.cond

while.end:
  ret i1 true

ovf.fail:
  %ovf.op = phi i32 [ 1, %while.body ], [ 0, %if.then ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Served* @serve(i32 noundef %conn, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf) #1 {
entry:
  %bytes.addr = alloca i32, align 4
  %notes.addr = alloca i32, align 4
  %failed.addr = alloca i1, align 1
  %n.addr = alloca i32, align 4
  %note.addr = alloca i8*, align 8
  store i32 0, i32* %bytes.addr, align 4
  store i32 0, i32* %notes.addr, align 4
  store i1 false, i1* %failed.addr, align 1
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %1 to i32
  %7 = sext i32 %6 to i64
  %8 = call i32 @nish_net_read(i32 %conn, %struct.nish_array* %buf, i64 0, i64 %7)
  store i32 %8, i32* %n.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp eq i32 %9, 0
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %12 = load i8*, i8** %11, align 8
  %13 = icmp eq i8* %12, %3
  br i1 %13, label %pass.rewind, label %pass.free

pass.rewind:
  %14 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %14, align 8
  br label %pass.done

pass.free:
  %15 = ptrtoint i8* %3 to i64
  %16 = add i64 %15, %5
  call void @nish_arena_release(i64 %16)
  br label %pass.done

pass.done:
  br label %while.end

if.end:
  %17 = load i32, i32* %n.addr, align 4
  %18 = icmp eq i32 %17, -11
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %20 = load i8*, i8** %19, align 8
  %21 = icmp eq i8* %20, %3
  br i1 %21, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %22, align 8
  br label %pass.done.1

pass.free.1:
  %23 = ptrtoint i8* %3 to i64
  %24 = add i64 %23, %5
  call void @nish_arena_release(i64 %24)
  br label %pass.done.1

pass.done.1:
  br label %while.cond

if.end.1:
  %25 = load i32, i32* %n.addr, align 4
  %26 = icmp slt i32 %25, 0
  br i1 %26, label %lor.end, label %lor.rhs

lor.rhs:
  %27 = load i32, i32* %n.addr, align 4
  %28 = call i1 @sendAll(i32 %conn, %struct.nish_array* %buf, i32 %27)
  %29 = xor i1 %28, true
  br label %lor.end

lor.end:
  %30 = phi i1 [ true, %if.end.1 ], [ %29, %lor.rhs ]
  br i1 %30, label %if.then.2, label %if.end.2

if.then.2:
  store i1 true, i1* %failed.addr, align 1
  %31 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %32 = load i8*, i8** %31, align 8
  %33 = icmp eq i8* %32, %3
  br i1 %33, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %34 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %34, align 8
  br label %pass.done.2

pass.free.2:
  %35 = ptrtoint i8* %3 to i64
  %36 = add i64 %35, %5
  call void @nish_arena_release(i64 %36)
  br label %pass.done.2

pass.done.2:
  br label %while.end

if.end.2:
  %37 = load i32, i32* %bytes.addr, align 4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %40 = load i32, i32* %n.addr, align 4
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %39, i8* %41)
  store i8* %42, i8** %note.addr, align 8
  %43 = load i32, i32* %notes.addr, align 4
  %44 = load i8*, i8** %note.addr, align 8
  %45 = bitcast i8* %44 to i64*
  %46 = load i64, i64* %45, align 8
  %47 = trunc i64 %46 to i32
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 %47)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %49, i32* %notes.addr, align 4
  %51 = load i32, i32* %bytes.addr, align 4
  %52 = load i32, i32* %n.addr, align 4
  %53 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %51, i32 %52)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %54, i32* %bytes.addr, align 4
  %56 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %57 = load i8*, i8** %56, align 8
  %58 = icmp eq i8* %57, %3
  br i1 %58, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %59 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %59, align 8
  br label %pass.done.3

pass.free.3:
  %60 = ptrtoint i8* %3 to i64
  %61 = add i64 %60, %5
  call void @nish_arena_release(i64 %61)
  br label %pass.done.3

pass.done.3:
  br label %while.cond

while.end:
  %62 = call i8* @nish_alloc_struct(i64 8)
  %63 = bitcast i8* %62 to %struct.Served*
  %64 = load i1, i1* %failed.addr, align 1
  br i1 %64, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %65 = load i32, i32* %bytes.addr, align 4
  br label %cond.end

cond.end:
  %66 = phi i32 [ -1, %cond.true ], [ %65, %cond.false ]
  %67 = load i32, i32* %notes.addr, align 4
  call void @Served.constructor(%struct.Served* %63, i32 %66, i32 %67)
  ret %struct.Served* %63

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @acceptOne(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %peer) #1 {
entry:
  %conn.addr = alloca i32, align 4
  %0 = call i32 @nish_tcp_accept(i32 %fd, %struct.nish_array* %peer)
  store i32 %0, i32* %conn.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %conn.addr, align 4
  %2 = icmp eq i32 %1, -11
  br i1 %2, label %while.body, label %while.end

while.body:
  %3 = call i32 @nish_tcp_accept(i32 %fd, %struct.nish_array* %peer)
  store i32 %3, i32* %conn.addr, align 4
  br label %while.cond

while.end:
  %4 = load i32, i32* %conn.addr, align 4
  ret i32 %4
}

define internal noundef i64 @oneConnection(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %peer, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf) #1 {
entry:
  %conn.addr = alloca i32, align 4
  %before.addr = alloca i64, align 8
  %served.addr = alloca %struct.Served*, align 8
  %grown.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @acceptOne(i32 %fd, %struct.nish_array* %peer)
  store i32 %0, i32* %conn.addr, align 4
  %1 = load i32, i32* %conn.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %conn.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i64 -1

if.end:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %peer, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = icmp ult i64 12, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 12, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %peer, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 12
  %13 = load i8, i8* %12, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %14 = zext i8 %13 to i64
  %15 = call i8* @nish_str_from_u64(i64 %14)
  %16 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %peer, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %20 = icmp ult i64 13, %19
  br i1 %20, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 13, i64 %19)
  unreachable

bounds.ok.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %peer, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %23 = bitcast i8* %22 to i8*
  %24 = getelementptr inbounds i8, i8* %23, i64 13
  %25 = load i8, i8* %24, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %26 = zext i8 %25 to i64
  %27 = call i8* @nish_str_from_u64(i64 %26)
  %28 = call i8* @nish_str_concat(i8* %17, i8* %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %peer, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %32 = icmp ult i64 14, %31
  br i1 %32, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 14, i64 %31)
  unreachable

bounds.ok.2:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %peer, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %35 = bitcast i8* %34 to i8*
  %36 = getelementptr inbounds i8, i8* %35, i64 14
  %37 = load i8, i8* %36, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %38 = zext i8 %37 to i64
  %39 = call i8* @nish_str_from_u64(i64 %38)
  %40 = call i8* @nish_str_concat(i8* %29, i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %peer, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %44 = icmp ult i64 15, %43
  br i1 %44, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 15, i64 %43)
  unreachable

bounds.ok.3:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %peer, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %47 = bitcast i8* %46 to i8*
  %48 = getelementptr inbounds i8, i8* %47, i64 15
  %49 = load i8, i8* %48, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %50 = zext i8 %49 to i64
  %51 = call i8* @nish_str_from_u64(i64 %50)
  %52 = call i8* @nish_str_concat(i8* %41, i8* %51)
  call void @nish_print(i8* %52)
  %53 = call i64 @nish_arena_used()
  store i64 %53, i64* %before.addr, align 8
  %54 = load i32, i32* %conn.addr, align 4
  %55 = call %struct.Served* @serve(i32 %54, %struct.nish_array* %buf)
  store %struct.Served* %55, %struct.Served** %served.addr, align 8
  %56 = call i64 @nish_arena_used()
  %57 = load i64, i64* %before.addr, align 8
  %58 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %56, i64 %57)
  %59 = extractvalue { i64, i1 } %58, 0
  %60 = extractvalue { i64, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %59, i64* %grown.addr, align 8
  %61 = load %struct.Served*, %struct.Served** %served.addr, align 8
  %62 = getelementptr inbounds %struct.Served, %struct.Served* %61, i32 0, i32 0
  %63 = load i32, i32* %62, align 4, !tbaa !4
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8* %64)
  %66 = call i8* @nish_str_concat(i8* %65, i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*))
  call void @nish_print(i8* %66)
  %67 = load i32, i32* %conn.addr, align 4
  %68 = call i32 @nish_net_close(i32 %67)
  %69 = call i8* @nish_str_from_i32(i32 %68)
  %70 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*), i8* %69)
  call void @nish_print(i8* %70)
  %71 = load i64, i64* %grown.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret i64 %71

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %fd.addr = alloca i32, align 4
  %peer.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [512 x i8], align 8
  %one.addr = alloca i64, align 8
  %many.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*), i32 0, i32 8)
  store i32 %0, i32* %fd.addr, align 4
  %1 = load i32, i32* %fd.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %fd.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.8 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %6 = load i32, i32* %fd.addr, align 4
  %7 = call i32 @nish_net_local_port(i32 %6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*), i8* %8)
  call void @nish_print(i8* %9)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %12 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %12, i8 0, i64 18, i1 false), !alias.scope !10, !noalias !9
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %peer.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 512, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 512, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %16 = bitcast [512 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 512, i1 false), !alias.scope !10, !noalias !9
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %buf.addr, align 8
  %18 = load i32, i32* %fd.addr, align 4
  %19 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %21 = call i64 @oneConnection(i32 %18, %struct.nish_array* %19, %struct.nish_array* %20)
  store i64 %21, i64* %one.addr, align 8
  %22 = load i32, i32* %fd.addr, align 4
  %23 = load %struct.nish_array*, %struct.nish_array** %peer.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %25 = call i64 @oneConnection(i32 %22, %struct.nish_array* %23, %struct.nish_array* %24)
  store i64 %25, i64* %many.addr, align 8
  %26 = load i64, i64* %one.addr, align 8
  %27 = load i64, i64* %many.addr, align 8
  %28 = icmp eq i64 %26, %27
  br i1 %28, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %29 = load i64, i64* %one.addr, align 8
  %30 = call i8* @nish_str_from_i64(i64 %29)
  %31 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [7 x i8] }* @.str.12 to i8*))
  %33 = load i64, i64* %many.addr, align 8
  %34 = call i8* @nish_str_from_i64(i64 %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  br label %cond.end

cond.end:
  %36 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), %cond.true ], [ %35, %cond.false ]
  call void @nish_print(i8* %36)
  %37 = load i32, i32* %fd.addr, align 4
  %38 = call i32 @nish_net_close(i32 %37)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %38
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!19, !20, !21, !22, !23}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Served", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !12, i64 16}
!16 = !{!"element i8", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!13, !11, i64 8}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
