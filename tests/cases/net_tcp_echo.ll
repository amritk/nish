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
  %5 = sub nsw i32 %n, %4
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
  %13 = call i32 @nish_net_write(i32 %fd, %struct.nish_array* %buf, i64 %3, i64 %6)
  store i32 %13, i32* %w.addr, align 4
  %14 = load i32, i32* %w.addr, align 4
  %15 = icmp sge i32 %14, 0
  br i1 %15, label %if.then, label %if.else

if.then:
  %16 = load i32, i32* %sent.addr, align 4
  %17 = load i32, i32* %w.addr, align 4
  %18 = add nsw i32 %16, %17
  store i32 %18, i32* %sent.addr, align 4
  br label %if.end

if.else:
  %19 = load i32, i32* %w.addr, align 4
  %20 = icmp ne i32 %19, -11
  br i1 %20, label %if.then.1, label %if.end.1

if.then.1:
  ret i1 false

if.end.1:
  br label %if.end

if.end:
  br label %while.cond

while.end:
  ret i1 true
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
  %8 = add i64 0, %7
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %10 = load i64, i64* %9, align 8
  %11 = icmp ule i64 0, %8
  %12 = icmp ule i64 %8, %10
  %13 = and i1 %11, %12
  br i1 %13, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %8, i64 %10)
  unreachable

net.ok:
  %14 = call i32 @nish_net_read(i32 %conn, %struct.nish_array* %buf, i64 0, i64 %7)
  store i32 %14, i32* %n.addr, align 4
  %15 = load i32, i32* %n.addr, align 4
  %16 = icmp eq i32 %15, 0
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %18 = load i8*, i8** %17, align 8
  %19 = icmp eq i8* %18, %3
  br i1 %19, label %pass.rewind, label %pass.free

pass.rewind:
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %20, align 8
  br label %pass.done

pass.free:
  %21 = ptrtoint i8* %3 to i64
  %22 = add i64 %21, %5
  call void @nish_arena_release(i64 %22)
  br label %pass.done

pass.done:
  br label %while.end

if.end:
  %23 = load i32, i32* %n.addr, align 4
  %24 = icmp eq i32 %23, -11
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %26 = load i8*, i8** %25, align 8
  %27 = icmp eq i8* %26, %3
  br i1 %27, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %28 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %28, align 8
  br label %pass.done.1

pass.free.1:
  %29 = ptrtoint i8* %3 to i64
  %30 = add i64 %29, %5
  call void @nish_arena_release(i64 %30)
  br label %pass.done.1

pass.done.1:
  br label %while.cond

if.end.1:
  %31 = load i32, i32* %n.addr, align 4
  %32 = icmp slt i32 %31, 0
  br i1 %32, label %lor.end, label %lor.rhs

lor.rhs:
  %33 = load i32, i32* %n.addr, align 4
  %34 = call i1 @sendAll(i32 %conn, %struct.nish_array* %buf, i32 %33)
  %35 = xor i1 %34, true
  br label %lor.end

lor.end:
  %36 = phi i1 [ true, %if.end.1 ], [ %35, %lor.rhs ]
  br i1 %36, label %if.then.2, label %if.end.2

if.then.2:
  store i1 true, i1* %failed.addr, align 1
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %38 = load i8*, i8** %37, align 8
  %39 = icmp eq i8* %38, %3
  br i1 %39, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %40, align 8
  br label %pass.done.2

pass.free.2:
  %41 = ptrtoint i8* %3 to i64
  %42 = add i64 %41, %5
  call void @nish_arena_release(i64 %42)
  br label %pass.done.2

pass.done.2:
  br label %while.end

if.end.2:
  %43 = load i32, i32* %bytes.addr, align 4
  %44 = call i8* @nish_str_from_i32(i32 %43)
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %46 = load i32, i32* %n.addr, align 4
  %47 = call i8* @nish_str_from_i32(i32 %46)
  %48 = call i8* @nish_str_concat(i8* %45, i8* %47)
  store i8* %48, i8** %note.addr, align 8
  %49 = load i32, i32* %notes.addr, align 4
  %50 = load i8*, i8** %note.addr, align 8
  %51 = bitcast i8* %50 to i64*
  %52 = load i64, i64* %51, align 8
  %53 = trunc i64 %52 to i32
  %54 = add nsw i32 %49, %53
  store i32 %54, i32* %notes.addr, align 4
  %55 = load i32, i32* %bytes.addr, align 4
  %56 = load i32, i32* %n.addr, align 4
  %57 = add nsw i32 %55, %56
  store i32 %57, i32* %bytes.addr, align 4
  %58 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %59 = load i8*, i8** %58, align 8
  %60 = icmp eq i8* %59, %3
  br i1 %60, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %61 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %61, align 8
  br label %pass.done.3

pass.free.3:
  %62 = ptrtoint i8* %3 to i64
  %63 = add i64 %62, %5
  call void @nish_arena_release(i64 %63)
  br label %pass.done.3

pass.done.3:
  br label %while.cond

while.end:
  %64 = call i8* @nish_alloc_struct(i64 8)
  %65 = bitcast i8* %64 to %struct.Served*
  %66 = load i1, i1* %failed.addr, align 1
  br i1 %66, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %67 = load i32, i32* %bytes.addr, align 4
  br label %cond.end

cond.end:
  %68 = phi i32 [ -1, %cond.true ], [ %67, %cond.false ]
  %69 = load i32, i32* %notes.addr, align 4
  call void @Served.constructor(%struct.Served* %65, i32 %68, i32 %69)
  ret %struct.Served* %65
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
  %58 = sub nsw i64 %56, %57
  store i64 %58, i64* %grown.addr, align 8
  %59 = load %struct.Served*, %struct.Served** %served.addr, align 8
  %60 = getelementptr inbounds %struct.Served, %struct.Served* %59, i32 0, i32 0
  %61 = load i32, i32* %60, align 4, !tbaa !4
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*), i8* %62)
  %64 = call i8* @nish_str_concat(i8* %63, i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*))
  call void @nish_print(i8* %64)
  %65 = load i32, i32* %conn.addr, align 4
  %66 = call i32 @nish_net_close(i32 %65)
  %67 = call i8* @nish_str_from_i32(i32 %66)
  %68 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*), i8* %67)
  call void @nish_print(i8* %68)
  %69 = load i64, i64* %grown.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret i64 %69
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

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
