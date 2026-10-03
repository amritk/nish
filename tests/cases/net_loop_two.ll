%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"setup \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"watch \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"ports \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"pollWait \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"woke \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c" bytes, events \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"signal \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"the arena moved\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef i64 @nish_arena_used() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noundef i32 @nish_signal_fd() #1
declare noundef i32 @nish_read_signal(i32 noundef) #0
declare noundef i32 @nish_net_local_port(i32 noundef) #1
declare noundef i32 @nish_net_close(i32 noundef) #0
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #0
declare noundef i32 @nish_poll_create() #1
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_modify(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_remove(i32 noundef, i32 noundef) #1
declare noundef i32 @nish_poll_wait(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @drain(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %from, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %meta) #0 {
entry:
  %bytes.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  store i32 0, i32* %bytes.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = add i64 0, %3
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = icmp ule i64 0, %4
  %8 = icmp ule i64 %4, %6
  %9 = and i1 %7, %8
  br i1 %9, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %4, i64 %6)
  unreachable

net.ok:
  %10 = call i32 @nish_udp_recv_from(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %3, %struct.nish_array* %from, %struct.nish_array* %meta)
  store i32 %10, i32* %n.addr, align 4
  %11 = load i32, i32* %n.addr, align 4
  %12 = icmp eq i32 %11, -11
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i32, i32* %bytes.addr, align 4
  ret i32 %13

if.end:
  %14 = load i32, i32* %n.addr, align 4
  %15 = icmp slt i32 %14, 0
  br i1 %15, label %if.then.1, label %if.end.1

if.then.1:
  %16 = load i32, i32* %n.addr, align 4
  ret i32 %16

if.end.1:
  %17 = load i32, i32* %bytes.addr, align 4
  %18 = load i32, i32* %n.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %20, i32* %bytes.addr, align 4
  br label %while.cond

while.end:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %signals.addr = alloca i32, align 4
  %loop.addr = alloca i32, align 4
  %added.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %r.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %ready.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [6 x i32], align 8
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [64 x i8], align 8
  %from.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [18 x i8], align 8
  %meta.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [2 x i32], align 8
  %top.addr = alloca i64, align 8
  %flat.addr = alloca i1, align 1
  %signal.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %token.addr = alloca i32, align 4
  %name.addr = alloca i8*, align 8
  %bytes.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %0, i32* %a.addr, align 4
  %1 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  store i32 %1, i32* %b.addr, align 4
  %2 = call i32 @nish_signal_fd()
  store i32 %2, i32* %signals.addr, align 4
  %3 = call i32 @nish_poll_create()
  store i32 %3, i32* %loop.addr, align 4
  %4 = load i32, i32* %a.addr, align 4
  %5 = icmp slt i32 %4, 0
  br i1 %5, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %6 = load i32, i32* %b.addr, align 4
  %7 = icmp slt i32 %6, 0
  br label %lor.end.2

lor.end.2:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs.2 ]
  br i1 %8, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %9 = load i32, i32* %signals.addr, align 4
  %10 = icmp slt i32 %9, 0
  br label %lor.end.1

lor.end.1:
  %11 = phi i1 [ true, %lor.end.2 ], [ %10, %lor.rhs.1 ]
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = load i32, i32* %loop.addr, align 4
  %13 = icmp slt i32 %12, 0
  br label %lor.end

lor.end:
  %14 = phi i1 [ true, %lor.end.1 ], [ %13, %lor.rhs ]
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load i32, i32* %a.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*), i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %19 = load i32, i32* %b.addr, align 4
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %18, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %23 = load i32, i32* %signals.addr, align 4
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %22, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %27 = load i32, i32* %loop.addr, align 4
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %26, i8* %28)
  call void @nish_print(i8* %29)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %30 = load i32, i32* %loop.addr, align 4
  %31 = load i32, i32* %a.addr, align 4
  %32 = call i32 @nish_poll_add(i32 %30, i32 %31, i32 0, i32 1)
  %33 = load i32, i32* %loop.addr, align 4
  %34 = load i32, i32* %a.addr, align 4
  %35 = call i32 @nish_poll_modify(i32 %33, i32 %34, i32 1, i32 1)
  %36 = load i32, i32* %loop.addr, align 4
  %37 = load i32, i32* %b.addr, align 4
  %38 = call i32 @nish_poll_add(i32 %36, i32 %37, i32 1, i32 2)
  %39 = load i32, i32* %loop.addr, align 4
  %40 = load i32, i32* %signals.addr, align 4
  %41 = call i32 @nish_poll_add(i32 %39, i32 %40, i32 1, i32 3)
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %44 = bitcast [4 x i32]* %arr.data to i8*
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %44, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %44 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 0
  store i32 %32, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = getelementptr inbounds i32, i32* %46, i64 1
  store i32 %35, i32* %48, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = getelementptr inbounds i32, i32* %46, i64 2
  store i32 %38, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = getelementptr inbounds i32, i32* %46, i64 3
  store i32 %41, i32* %50, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %added.addr, align 8
  %51 = load %struct.nish_array*, %struct.nish_array** %added.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %52 = load i64, i64* %forof.idx, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp ult i64 %52, %54
  br i1 %55, label %forof.body, label %forof.end

forof.body:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %52
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %60, i32* %r.addr, align 4
  %61 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %62 = load i8*, i8** %61, align 8
  %63 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %64 = load i64, i64* %63, align 8
  %65 = load i32, i32* %r.addr, align 4
  %66 = icmp ne i32 %65, 0
  br i1 %66, label %if.then.1, label %if.end.1

if.then.1:
  %67 = load i32, i32* %r.addr, align 4
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*), i8* %68)
  call void @nish_print(i8* %69)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end.1:
  %70 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %71 = load i8*, i8** %70, align 8
  %72 = icmp eq i8* %71, %62
  br i1 %72, label %pass.rewind, label %pass.free

pass.rewind:
  %73 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %64, i64* %73, align 8
  br label %pass.done

pass.free:
  %74 = ptrtoint i8* %62 to i64
  %75 = add i64 %74, %64
  call void @nish_arena_release(i64 %75)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %76 = load i64, i64* %forof.idx, align 8
  %77 = add i64 %76, 1
  store i64 %77, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %78 = load i32, i32* %a.addr, align 4
  %79 = call i32 @nish_net_local_port(i32 %78)
  %80 = call i8* @nish_str_from_i32(i32 %79)
  %81 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %83 = load i32, i32* %b.addr, align 4
  %84 = call i32 @nish_net_local_port(i32 %83)
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* %82, i8* %85)
  call void @nish_print(i8* %86)
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 6, i64* %87, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 6, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %89 = bitcast [6 x i32]* %arr.data.1 to i8*
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %89, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %89 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 0
  store i32 0, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %93 = getelementptr inbounds i32, i32* %91, i64 1
  store i32 0, i32* %93, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %94 = getelementptr inbounds i32, i32* %91, i64 2
  store i32 0, i32* %94, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %95 = getelementptr inbounds i32, i32* %91, i64 3
  store i32 0, i32* %95, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %96 = getelementptr inbounds i32, i32* %91, i64 4
  store i32 0, i32* %96, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %97 = getelementptr inbounds i32, i32* %91, i64 5
  store i32 0, i32* %97, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ready.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 64, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %100 = bitcast [64 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %100, i8 0, i64 64, i1 false), !alias.scope !4, !noalias !3
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %100, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %buf.addr, align 8
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 18, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 18, i64* %103, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %104 = bitcast [18 x i8]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %104, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %104, i8** %105, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %from.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 2, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 2, i64* %107, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %108 = bitcast [2 x i32]* %arr.data.4 to i8*
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %108, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %110 = bitcast i8* %108 to i32*
  %111 = getelementptr inbounds i32, i32* %110, i64 0
  store i32 0, i32* %111, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %112 = getelementptr inbounds i32, i32* %110, i64 1
  store i32 0, i32* %112, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %meta.addr, align 8
  %113 = call i64 @nish_arena_used()
  store i64 %113, i64* %top.addr, align 8
  store i1 true, i1* %flat.addr, align 1
  store i32 0, i32* %signal.addr, align 4
  %114 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 0
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 2
  %118 = load i8*, i8** %117, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %119 = load i32, i32* %signal.addr, align 4
  %120 = icmp eq i32 %119, 0
  br i1 %120, label %while.body, label %while.end

while.body:
  %121 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %122 = load i8*, i8** %121, align 8
  %123 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %124 = load i64, i64* %123, align 8
  %125 = call i64 @nish_arena_used()
  %126 = load i64, i64* %top.addr, align 8
  %127 = icmp ne i64 %125, %126
  br i1 %127, label %if.then.2, label %if.end.2

if.then.2:
  store i1 false, i1* %flat.addr, align 1
  br label %if.end.2

if.end.2:
  %128 = load i32, i32* %loop.addr, align 4
  %129 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %130 = call i32 @nish_poll_wait(i32 %128, %struct.nish_array* %129, i32 -1)
  store i32 %130, i32* %n.addr, align 4
  %131 = load i32, i32* %n.addr, align 4
  %132 = icmp slt i32 %131, 0
  br i1 %132, label %if.then.3, label %if.end.3

if.then.3:
  %133 = load i32, i32* %n.addr, align 4
  %134 = call i8* @nish_str_from_i32(i32 %133)
  %135 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i8* %134)
  call void @nish_print(i8* %135)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end.3:
  store i32 0, i32* %k.addr, align 4
  %136 = load %struct.nish_array*, %struct.nish_array** %ready.addr, align 8
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 0
  %138 = load i64, i64* %137, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 2
  %140 = load i8*, i8** %139, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %141 = load i32, i32* %k.addr, align 4
  %142 = load i32, i32* %n.addr, align 4
  %143 = icmp slt i32 %141, %142
  br i1 %143, label %for.body, label %for.end

for.body:
  %144 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %145 = load i8*, i8** %144, align 8
  %146 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %147 = load i64, i64* %146, align 8
  %148 = load i32, i32* %k.addr, align 4
  %149 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %148)
  %150 = extractvalue { i32, i1 } %149, 0
  %151 = extractvalue { i32, i1 } %149, 1
  br i1 %151, label %ovf.fail, label %ovf.ok

ovf.ok:
  %152 = sext i32 %150 to i64
  %153 = icmp ult i64 %152, %138
  br i1 %153, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %152, i64 %138)
  unreachable

bounds.ok:
  %154 = bitcast i8* %140 to i32*
  %155 = getelementptr inbounds i32, i32* %154, i64 %152
  %156 = load i32, i32* %155, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %156, i32* %token.addr, align 4
  %157 = load i32, i32* %token.addr, align 4
  %158 = icmp eq i32 %157, 3
  br i1 %158, label %if.then.4, label %if.else

if.then.4:
  %159 = load i32, i32* %signals.addr, align 4
  %160 = call i32 @nish_read_signal(i32 %159)
  store i32 %160, i32* %signal.addr, align 4
  br label %if.end.4

if.else:
  %161 = load i32, i32* %token.addr, align 4
  %162 = icmp eq i32 %161, 1
  br i1 %162, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %163 = phi i8* [ bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), %cond.true ], [ bitcast ({ i64, [2 x i8] }* @.str.7 to i8*), %cond.false ]
  store i8* %163, i8** %name.addr, align 8
  %164 = load i32, i32* %token.addr, align 4
  %165 = icmp eq i32 %164, 1
  br i1 %165, label %cond.true.1, label %cond.false.1

cond.true.1:
  %166 = load i32, i32* %a.addr, align 4
  br label %cond.end.1

cond.false.1:
  %167 = load i32, i32* %b.addr, align 4
  br label %cond.end.1

cond.end.1:
  %168 = phi i32 [ %166, %cond.true.1 ], [ %167, %cond.false.1 ]
  %169 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %170 = load %struct.nish_array*, %struct.nish_array** %from.addr, align 8
  %171 = load %struct.nish_array*, %struct.nish_array** %meta.addr, align 8
  %172 = call i32 @drain(i32 %168, %struct.nish_array* %169, %struct.nish_array* %170, %struct.nish_array* %171)
  store i32 %172, i32* %bytes.addr, align 4
  %173 = load i8*, i8** %name.addr, align 8
  %174 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), i8* %173)
  %175 = call i8* @nish_str_concat(i8* %174, i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*))
  %176 = load i32, i32* %bytes.addr, align 4
  %177 = call i8* @nish_str_from_i32(i32 %176)
  %178 = call i8* @nish_str_concat(i8* %175, i8* %177)
  %179 = call i8* @nish_str_concat(i8* %178, i8* bitcast ({ i64, [16 x i8] }* @.str.10 to i8*))
  %180 = load i32, i32* %k.addr, align 4
  %181 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %180)
  %182 = extractvalue { i32, i1 } %181, 0
  %183 = extractvalue { i32, i1 } %181, 1
  br i1 %183, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %184 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %182, i32 1)
  %185 = extractvalue { i32, i1 } %184, 0
  %186 = extractvalue { i32, i1 } %184, 1
  br i1 %186, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %187 = sext i32 %185 to i64
  %188 = icmp ult i64 %187, %138
  br i1 %188, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %187, i64 %138)
  unreachable

bounds.ok.1:
  %189 = bitcast i8* %140 to i32*
  %190 = getelementptr inbounds i32, i32* %189, i64 %187
  %191 = load i32, i32* %190, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %192 = call i8* @nish_str_from_i32(i32 %191)
  %193 = call i8* @nish_str_concat(i8* %179, i8* %192)
  call void @nish_print(i8* %193)
  br label %if.end.4

if.end.4:
  %194 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %195 = load i8*, i8** %194, align 8
  %196 = icmp eq i8* %195, %145
  br i1 %196, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %197 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %147, i64* %197, align 8
  br label %pass.done.1

pass.free.1:
  %198 = ptrtoint i8* %145 to i64
  %199 = add i64 %198, %147
  call void @nish_arena_release(i64 %199)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %200 = load i32, i32* %k.addr, align 4
  %201 = add nsw i32 %200, 1
  store i32 %201, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %202 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %203 = load i8*, i8** %202, align 8
  %204 = icmp eq i8* %203, %122
  br i1 %204, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %205 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %124, i64* %205, align 8
  br label %pass.done.2

pass.free.2:
  %206 = ptrtoint i8* %122 to i64
  %207 = add i64 %206, %124
  call void @nish_arena_release(i64 %207)
  br label %pass.done.2

pass.done.2:
  br label %while.cond

while.end:
  %208 = load i32, i32* %signal.addr, align 4
  %209 = call i8* @nish_str_from_i32(i32 %208)
  %210 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %209)
  call void @nish_print(i8* %210)
  %211 = load i1, i1* %flat.addr, align 1
  br i1 %211, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %212 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.12 to i8*), %cond.true.2 ], [ bitcast ({ i64, [16 x i8] }* @.str.13 to i8*), %cond.false.2 ]
  call void @nish_print(i8* %212)
  %213 = load i32, i32* %loop.addr, align 4
  %214 = load i32, i32* %a.addr, align 4
  %215 = call i32 @nish_poll_remove(i32 %213, i32 %214)
  %216 = load i32, i32* %loop.addr, align 4
  %217 = load i32, i32* %b.addr, align 4
  %218 = call i32 @nish_poll_remove(i32 %216, i32 %217)
  %219 = load i32, i32* %a.addr, align 4
  %220 = call i32 @nish_net_close(i32 %219)
  %221 = load i32, i32* %b.addr, align 4
  %222 = call i32 @nish_net_close(i32 %221)
  %223 = load i32, i32* %loop.addr, align 4
  %224 = call i32 @nish_net_close(i32 %223)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %224

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 2, %cond.end.1 ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
