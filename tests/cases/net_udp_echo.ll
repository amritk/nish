%struct.Served = type { i32, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" + \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"echoed \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" datagrams, \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"udpBind \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"port \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"grows: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" then \00" }, align 8
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
declare noundef i32 @nish_net_local_port(i32 noundef) #0
declare noundef i32 @nish_net_close(i32 noundef) #1
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
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

define internal void @Served.constructor(%struct.Served* noundef nonnull noalias align 8 dereferenceable(12) nocapture %this, i32 noundef %datagrams, i32 noundef %bytes, i32 noundef %notes) #0 {
entry:
  %0 = getelementptr inbounds %struct.Served, %struct.Served* %this, i32 0, i32 0
  store i32 %datagrams, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Served, %struct.Served* %this, i32 0, i32 1
  store i32 %bytes, i32* %1, align 4, !tbaa !5
  %2 = getelementptr inbounds %struct.Served, %struct.Served* %this, i32 0, i32 2
  store i32 %notes, i32* %2, align 4, !tbaa !6
  ret void
}

define internal noundef nonnull align 8 dereferenceable(12) %struct.Served* @serve(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %from, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %meta) #1 {
entry:
  %datagrams.addr = alloca i32, align 4
  %bytes.addr = alloca i32, align 4
  %notes.addr = alloca i32, align 4
  %failed.addr = alloca i1, align 1
  %n.addr = alloca i32, align 4
  %note.addr = alloca i8*, align 8
  store i32 0, i32* %datagrams.addr, align 4
  store i32 0, i32* %bytes.addr, align 4
  store i32 0, i32* %notes.addr, align 4
  store i1 false, i1* %failed.addr, align 1
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
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
  %14 = call i32 @nish_udp_recv_from(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %7, %struct.nish_array* %from, %struct.nish_array* %meta)
  store i32 %14, i32* %n.addr, align 4
  %15 = load i32, i32* %n.addr, align 4
  %16 = icmp eq i32 %15, -11
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
  br label %while.cond

if.end:
  %23 = load i32, i32* %n.addr, align 4
  %24 = icmp eq i32 %23, 0
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
  br label %while.end

if.end.1:
  %31 = load i32, i32* %n.addr, align 4
  %32 = icmp slt i32 %31, 0
  br i1 %32, label %lor.end, label %lor.rhs

lor.rhs:
  %33 = load i32, i32* %n.addr, align 4
  %34 = sext i32 %33 to i64
  %35 = add i64 0, %34
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %37 = load i64, i64* %36, align 8
  %38 = icmp ule i64 0, %35
  %39 = icmp ule i64 %35, %37
  %40 = and i1 %38, %39
  br i1 %40, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %35, i64 %37)
  unreachable

net.ok.1:
  %41 = call i32 @nish_udp_send_to(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %34, %struct.nish_array* %from, i32 0, i32 0)
  %42 = load i32, i32* %n.addr, align 4
  %43 = icmp ne i32 %41, %42
  br label %lor.end

lor.end:
  %44 = phi i1 [ true, %if.end.1 ], [ %43, %net.ok.1 ]
  br i1 %44, label %if.then.2, label %if.end.2

if.then.2:
  store i1 true, i1* %failed.addr, align 1
  %45 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %46 = load i8*, i8** %45, align 8
  %47 = icmp eq i8* %46, %3
  br i1 %47, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %48 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %48, align 8
  br label %pass.done.2

pass.free.2:
  %49 = ptrtoint i8* %3 to i64
  %50 = add i64 %49, %5
  call void @nish_arena_release(i64 %50)
  br label %pass.done.2

pass.done.2:
  br label %while.end

if.end.2:
  %51 = load i32, i32* %bytes.addr, align 4
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %54 = load i32, i32* %n.addr, align 4
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %53, i8* %55)
  store i8* %56, i8** %note.addr, align 8
  %57 = load i32, i32* %notes.addr, align 4
  %58 = load i8*, i8** %note.addr, align 8
  %59 = bitcast i8* %58 to i64*
  %60 = load i64, i64* %59, align 8
  %61 = trunc i64 %60 to i32
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %57, i32 %61)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %63, i32* %notes.addr, align 4
  %65 = load i32, i32* %datagrams.addr, align 4
  %66 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %65, i32 1)
  %67 = extractvalue { i32, i1 } %66, 0
  %68 = extractvalue { i32, i1 } %66, 1
  br i1 %68, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %67, i32* %datagrams.addr, align 4
  %69 = load i32, i32* %bytes.addr, align 4
  %70 = load i32, i32* %n.addr, align 4
  %71 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %69, i32 %70)
  %72 = extractvalue { i32, i1 } %71, 0
  %73 = extractvalue { i32, i1 } %71, 1
  br i1 %73, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %72, i32* %bytes.addr, align 4
  %74 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %75 = load i8*, i8** %74, align 8
  %76 = icmp eq i8* %75, %3
  br i1 %76, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %77 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %77, align 8
  br label %pass.done.3

pass.free.3:
  %78 = ptrtoint i8* %3 to i64
  %79 = add i64 %78, %5
  call void @nish_arena_release(i64 %79)
  br label %pass.done.3

pass.done.3:
  br label %while.cond

while.end:
  %80 = call i8* @nish_alloc_struct(i64 12)
  %81 = bitcast i8* %80 to %struct.Served*
  %82 = load i32, i32* %datagrams.addr, align 4
  %83 = load i1, i1* %failed.addr, align 1
  br i1 %83, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %84 = load i32, i32* %bytes.addr, align 4
  br label %cond.end

cond.end:
  %85 = phi i32 [ -1, %cond.true ], [ %84, %cond.false ]
  %86 = load i32, i32* %notes.addr, align 4
  call void @Served.constructor(%struct.Served* %81, i32 %82, i32 %85, i32 %86)
  ret %struct.Served* %81

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @oneRound(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %from, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %meta) #1 {
entry:
  %before.addr = alloca i64, align 8
  %served.addr = alloca %struct.Served*, align 8
  %grown.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_used()
  store i64 %0, i64* %before.addr, align 8
  %1 = call %struct.Served* @serve(i32 %fd, %struct.nish_array* %buf, %struct.nish_array* %from, %struct.nish_array* %meta)
  store %struct.Served* %1, %struct.Served** %served.addr, align 8
  %2 = call i64 @nish_arena_used()
  %3 = load i64, i64* %before.addr, align 8
  %4 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %2, i64 %3)
  %5 = extractvalue { i64, i1 } %4, 0
  %6 = extractvalue { i64, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %5, i64* %grown.addr, align 8
  %7 = load %struct.Served*, %struct.Served** %served.addr, align 8
  %8 = getelementptr inbounds %struct.Served, %struct.Served* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4, !tbaa !4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [13 x i8] }* @.str.2 to i8*))
  %13 = load %struct.Served*, %struct.Served** %served.addr, align 8
  %14 = getelementptr inbounds %struct.Served, %struct.Served* %13, i32 0, i32 1
  %15 = load i32, i32* %14, align 4, !tbaa !5
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %12, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*))
  call void @nish_print(i8* %18)
  %19 = load i64, i64* %grown.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret i64 %19

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %fd.addr = alloca i32, align 4
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2048 x i8], align 8
  %from.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [18 x i8], align 8
  %meta.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i32], align 8
  %one.addr = alloca i64, align 8
  %many.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*), i32 0, i32 0)
  store i32 %0, i32* %fd.addr, align 4
  %1 = load i32, i32* %fd.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %fd.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %6 = load i32, i32* %fd.addr, align 4
  %7 = call i32 @nish_net_local_port(i32 %6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), i8* %8)
  call void @nish_print(i8* %9)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2048, i64* %10, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2048, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %12 = bitcast [2048 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %12, i8 0, i64 2048, i1 false), !alias.scope !11, !noalias !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 18, i64* %14, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 18, i64* %15, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %16 = bitcast [18 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 18, i1 false), !alias.scope !11, !noalias !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %from.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %18, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %20 = bitcast [2 x i32]* %arr.data.2 to i8*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %22 = bitcast i8* %20 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 0
  store i32 0, i32* %23, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %24 = getelementptr inbounds i32, i32* %22, i64 1
  store i32 0, i32* %24, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %meta.addr, align 8
  %25 = load i32, i32* %fd.addr, align 4
  %26 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %29 = call i64 @oneRound(i32 %25, %struct.nish_array* %26, %struct.nish_array* %27, %struct.nish_array* %28)
  store i64 %29, i64* %one.addr, align 8
  %30 = load i32, i32* %fd.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %32 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %33 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %34 = call i64 @oneRound(i32 %30, %struct.nish_array* %31, %struct.nish_array* %32, %struct.nish_array* %33)
  store i64 %34, i64* %many.addr, align 8
  %35 = load i64, i64* %one.addr, align 8
  %36 = load i64, i64* %many.addr, align 8
  %37 = icmp eq i64 %35, %36
  br i1 %37, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %38 = load i64, i64* %one.addr, align 8
  %39 = call i8* @nish_str_from_i64(i64 %38)
  %40 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.8 to i8*), i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [7 x i8] }* @.str.9 to i8*))
  %42 = load i64, i64* %many.addr, align 8
  %43 = call i8* @nish_str_from_i64(i64 %42)
  %44 = call i8* @nish_str_concat(i8* %41, i8* %43)
  br label %cond.end

cond.end:
  %45 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.7 to i8*), %cond.true ], [ %44, %cond.false ]
  call void @nish_print(i8* %45)
  %46 = load i32, i32* %fd.addr, align 4
  %47 = call i32 @nish_net_close(i32 %46)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %47
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
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Served", !2, i64 0, !2, i64 4, !2, i64 8}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!3, !2, i64 8}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
