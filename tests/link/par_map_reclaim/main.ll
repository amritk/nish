%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"s\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"h\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.13.scaled$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.worded$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.tagged$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.handed$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow1(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow2(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow3(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow4(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal noundef i32 @scaled(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %seed, i32 noundef %at) #0 {
entry:
  %k.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = srem i32 %seed, 5
  %1 = add nsw i32 %0, 3
  store i32 %1, i32* %k.addr, align 4
  %2 = load i32, i32* %k.addr, align 4
  %3 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.13.scaled$arrow0(%struct.nish_array* %xs, i32 %2)
  store %struct.nish_array* %3, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %s.addr, align 4
  %4 = icmp sge i32 %at, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %at, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %entry ], [ %9, %land.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %12 = sext i32 %at to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %12
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %17, i32* %s.addr, align 4
  br label %if.end

if.end:
  %18 = load i32, i32* %s.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %18
}

define internal noundef i32 @worded(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %seed) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %t.addr = alloca i32, align 4
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.worded$arrow0(%struct.nish_array* %xs, i32 %seed)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  store i32 0, i32* %t.addr, align 4
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %2 = load i64, i64* %forof.idx, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %forof.body, label %forof.end

forof.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i8**
  %9 = getelementptr inbounds i8*, i8** %8, i64 %2
  %10 = load i8*, i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  store i8* %10, i8** %w.addr, align 8
  %11 = load i32, i32* %t.addr, align 4
  %12 = load i8*, i8** %w.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = srem i32 %17, 1000003
  store i32 %19, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %20 = load i64, i64* %forof.idx, align 8
  %21 = add i64 %20, 1
  store i64 %21, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %22 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %22

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @tagged(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %seed) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.tagged$arrow0(%struct.nish_array* %xs, i32 %seed)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp eq i32 %5, 0
  %7 = icmp eq i32 %seed, -2147483648
  %8 = icmp eq i32 %5, -1
  %9 = and i1 %7, %8
  %10 = or i1 %6, %9
  br i1 %10, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %6)
  unreachable

div.ok:
  %11 = srem i32 %seed, %5
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %12, i64 %14)
  unreachable

bounds.ok:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %12
  %20 = load i8*, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  %21 = bitcast i8* %20 to i64*
  %22 = load i64, i64* %21, align 8
  %23 = trunc i64 %22 to i32
  %24 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %29

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @lengths(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %t.addr = alloca i32, align 4
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %t.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %0
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  store i8* %8, i8** %w.addr, align 8
  %9 = load i32, i32* %t.addr, align 4
  %10 = load i8*, i8** %w.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = load i8*, i8** %w.addr, align 8
  %18 = bitcast i8* %17 to i64*
  %19 = load i64, i64* %18, align 8
  %20 = icmp ult i64 0, %19
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %19)
  unreachable

bounds.ok:
  %21 = getelementptr inbounds i8, i8* %17, i64 8
  %22 = getelementptr inbounds i8, i8* %21, i64 0
  %23 = load i8, i8* %22, align 1
  %24 = zext i8 %23 to i32
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %28 = srem i32 %26, 1000003
  store i32 %28, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %29 = load i64, i64* %forof.idx, align 8
  %30 = add i64 %29, 1
  store i64 %30, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %31 = load i32, i32* %t.addr, align 4
  ret i32 %31

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %0 = call i32 @lengths(%struct.nish_array* %ws)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = srem i32 %5, 1000003
  ret i32 %7

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @handed(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %seed) #0 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.13.handed$arrow0(%struct.nish_array* %xs, i32 %seed)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = call i32 @total(%struct.nish_array* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %2
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %check.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %small.addr = alloca %struct.nish_array*, align 8
  %r.addr.1 = alloca i32, align 4
  %r.addr.2 = alloca i32, align 4
  %tiny.addr = alloca %struct.nish_array*, align 8
  %r.addr.3 = alloca i32, align 4
  %below.addr = alloca %struct.nish_array*, align 8
  %r.addr.4 = alloca i32, align 4
  %at.addr.1 = alloca i32, align 4
  %r.addr.5 = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %m.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = shl i32 1, 21
  store i32 %0, i32* %n.addr, align 4
  %1 = load i32, i32* %n.addr, align 4
  %2 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 %1)
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %check.addr, align 4
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %r.addr, align 4
  %4 = icmp slt i32 %3, 24
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %r.addr, align 4
  %6 = mul nsw i32 %5, 7919
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp eq i32 %7, 0
  %9 = icmp eq i32 %6, -2147483648
  %10 = icmp eq i32 %7, -1
  %11 = and i1 %9, %10
  %12 = or i1 %8, %11
  br i1 %12, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %8)
  unreachable

div.ok:
  %13 = srem i32 %6, %7
  store i32 %13, i32* %at.addr, align 4
  %14 = load i32, i32* %check.addr, align 4
  %15 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %14, i32 31)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %19 = load i32, i32* %r.addr, align 4
  %20 = load i32, i32* %at.addr, align 4
  %21 = call i32 @scaled(%struct.nish_array* %18, i32 %19, i32 %20)
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %25 = srem i32 %23, 1000003
  store i32 %25, i32* %check.addr, align 4
  br label %for.inc

for.inc:
  %26 = load i32, i32* %r.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %28 = shl i32 1, 17
  %29 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow1(i32 %28)
  store %struct.nish_array* %29, %struct.nish_array** %small.addr, align 8
  store i32 0, i32* %r.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %30 = load i32, i32* %r.addr.1, align 4
  %31 = icmp slt i32 %30, 72
  br i1 %31, label %for.body.1, label %for.end.1

for.body.1:
  %32 = load i32, i32* %check.addr, align 4
  %33 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %32, i32 31)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %36 = load %struct.nish_array*, %struct.nish_array** %small.addr, align 8
  %37 = load i32, i32* %r.addr.1, align 4
  %38 = call i32 @worded(%struct.nish_array* %36, i32 %37)
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %34, i32 %38)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %42 = srem i32 %40, 1000003
  store i32 %42, i32* %check.addr, align 4
  br label %for.inc.1

for.inc.1:
  %43 = load i32, i32* %r.addr.1, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %r.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %r.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %45 = load i32, i32* %r.addr.2, align 4
  %46 = icmp slt i32 %45, 72
  br i1 %46, label %for.body.2, label %for.end.2

for.body.2:
  %47 = load i32, i32* %check.addr, align 4
  %48 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %47, i32 31)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %51 = load %struct.nish_array*, %struct.nish_array** %small.addr, align 8
  %52 = load i32, i32* %r.addr.2, align 4
  %53 = call i32 @handed(%struct.nish_array* %51, i32 %52)
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %49, i32 %53)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %57 = srem i32 %55, 1000003
  store i32 %57, i32* %check.addr, align 4
  br label %for.inc.2

for.inc.2:
  %58 = load i32, i32* %r.addr.2, align 4
  %59 = add nsw i32 %58, 1
  store i32 %59, i32* %r.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %60 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow2(i32 512)
  store %struct.nish_array* %60, %struct.nish_array** %tiny.addr, align 8
  store i32 0, i32* %r.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %61 = load i32, i32* %r.addr.3, align 4
  %62 = icmp slt i32 %61, 8000
  br i1 %62, label %for.body.3, label %for.end.3

for.body.3:
  %63 = load i32, i32* %check.addr, align 4
  %64 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %63, i32 31)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %67 = load %struct.nish_array*, %struct.nish_array** %tiny.addr, align 8
  %68 = load i32, i32* %r.addr.3, align 4
  %69 = call i32 @tagged(%struct.nish_array* %67, i32 %68)
  %70 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %65, i32 %69)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %73 = srem i32 %71, 1000003
  store i32 %73, i32* %check.addr, align 4
  br label %for.inc.3

for.inc.3:
  %74 = load i32, i32* %r.addr.3, align 4
  %75 = add nsw i32 %74, 1
  store i32 %75, i32* %r.addr.3, align 4
  br label %for.cond.3

for.end.3:
  %76 = shl i32 1, 19
  %77 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow3(i32 %76)
  store %struct.nish_array* %77, %struct.nish_array** %below.addr, align 8
  store i32 0, i32* %r.addr.4, align 4
  %78 = load %struct.nish_array*, %struct.nish_array** %below.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond.4

for.cond.4:
  %81 = load i32, i32* %r.addr.4, align 4
  %82 = icmp slt i32 %81, 64
  br i1 %82, label %for.body.4, label %for.end.4

for.body.4:
  %83 = load i32, i32* %r.addr.4, align 4
  %84 = mul nsw i32 %83, 7919
  %85 = trunc i64 %80 to i32
  %86 = icmp eq i32 %85, 0
  %87 = icmp eq i32 %84, -2147483648
  %88 = icmp eq i32 %85, -1
  %89 = and i1 %87, %88
  %90 = or i1 %86, %89
  br i1 %90, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %86)
  unreachable

div.ok.1:
  %91 = srem i32 %84, %85
  store i32 %91, i32* %at.addr.1, align 4
  %92 = load i32, i32* %check.addr, align 4
  %93 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %92, i32 31)
  %94 = extractvalue { i32, i1 } %93, 0
  %95 = extractvalue { i32, i1 } %93, 1
  br i1 %95, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %96 = load %struct.nish_array*, %struct.nish_array** %below.addr, align 8
  %97 = load i32, i32* %r.addr.4, align 4
  %98 = load i32, i32* %at.addr.1, align 4
  %99 = call i32 @scaled(%struct.nish_array* %96, i32 %97, i32 %98)
  %100 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %94, i32 %99)
  %101 = extractvalue { i32, i1 } %100, 0
  %102 = extractvalue { i32, i1 } %100, 1
  br i1 %102, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %103 = srem i32 %101, 1000003
  store i32 %103, i32* %check.addr, align 4
  br label %for.inc.4

for.inc.4:
  %104 = load i32, i32* %r.addr.4, align 4
  %105 = add nsw i32 %104, 1
  store i32 %105, i32* %r.addr.4, align 4
  br label %for.cond.4

for.end.4:
  store i32 0, i32* %r.addr.5, align 4
  br label %for.cond.5

for.cond.5:
  %106 = load i32, i32* %r.addr.5, align 4
  %107 = icmp slt i32 %106, 24
  br i1 %107, label %for.body.5, label %for.end.5

for.body.5:
  %108 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %109 = load i8*, i8** %108, align 8
  %110 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %111 = load i64, i64* %110, align 8
  %112 = call i64 @nish_arena_mark()
  store i64 %112, i64* %a.addr, align 8
  %113 = load i64, i64* %a.addr, align 8
  %114 = load i32, i32* %r.addr.5, align 4
  store i32 %114, i32* %m.addr, align 4
  %115 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %116 = load i32, i32* %m.addr, align 4
  %117 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow4(%struct.nish_array* %115, i32 %116)
  store %struct.nish_array* %117, %struct.nish_array** %ys.addr, align 8
  %118 = load i32, i32* %check.addr, align 4
  %119 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %118, i32 31)
  %120 = extractvalue { i32, i1 } %119, 0
  %121 = extractvalue { i32, i1 } %119, 1
  br i1 %121, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  %122 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %123 = load i32, i32* %r.addr.5, align 4
  %124 = mul nsw i32 %123, 7919
  %125 = sext i32 %124 to i64
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 0
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %128 = icmp ult i64 %125, %127
  br i1 %128, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %125, i64 %127)
  unreachable

bounds.ok:
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 2
  %130 = load i8*, i8** %129, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %131 = bitcast i8* %130 to i32*
  %132 = getelementptr inbounds i32, i32* %131, i64 %125
  %133 = load i32, i32* %132, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %134 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %120, i32 %133)
  %135 = extractvalue { i32, i1 } %134, 0
  %136 = extractvalue { i32, i1 } %134, 1
  br i1 %136, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  %137 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 0
  %139 = load i64, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %140 = trunc i64 %139 to i32
  %141 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %135, i32 %140)
  %142 = extractvalue { i32, i1 } %141, 0
  %143 = extractvalue { i32, i1 } %141, 1
  br i1 %143, label %ovf.fail, label %ovf.ok.12

ovf.ok.12:
  %144 = srem i32 %142, 1000003
  store i32 %144, i32* %check.addr, align 4
  call void @nish_arena_release(i64 %113)
  %145 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %146 = load i8*, i8** %145, align 8
  %147 = icmp eq i8* %146, %109
  br i1 %147, label %pass.rewind, label %pass.free

pass.rewind:
  %148 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %111, i64* %148, align 8
  br label %pass.done

pass.free:
  %149 = ptrtoint i8* %109 to i64
  %150 = add i64 %149, %111
  call void @nish_arena_release(i64 %150)
  br label %pass.done

pass.done:
  br label %for.inc.5

for.inc.5:
  %151 = load i32, i32* %r.addr.5, align 4
  %152 = add nsw i32 %151, 1
  store i32 %152, i32* %r.addr.5, align 4
  br label %for.cond.5

for.end.5:
  %153 = load i32, i32* %check.addr, align 4
  %154 = call i8* @nish_str_from_i32(i32 %153)
  call void @nish_print(i8* %154)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 2, %div.ok ], [ 0, %ovf.ok ], [ 2, %for.body.1 ], [ 0, %ovf.ok.2 ], [ 2, %for.body.2 ], [ 0, %ovf.ok.4 ], [ 2, %for.body.3 ], [ 0, %ovf.ok.6 ], [ 2, %div.ok.1 ], [ 0, %ovf.ok.8 ], [ 2, %for.body.5 ], [ 0, %bounds.ok ], [ 0, %ovf.ok.11 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @scaled$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef nonnull align 8 i8* @worded$arrow0(i32 noundef %x, i32 noundef %seed) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %seed)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i8* @nish_str_from_i32(i32 %1)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %3)
  ret i8* %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @tagged$arrow0(i32 noundef %x, i32 noundef %seed) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %seed)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i8* @nish_str_from_i32(i32 %1)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %3)
  ret i8* %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @handed$arrow0(i32 noundef %x, i32 noundef %seed) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %seed)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i8* @nish_str_from_i32(i32 %1)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %3)
  ret i8* %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %i) #1 {
entry:
  %0 = srem i32 %i, 8191
  %1 = mul nsw i32 %0, 7919
  %2 = srem i32 %1, 65536
  ret i32 %2
}

define hidden noundef i32 @nish_main$arrow1(i32 noundef %i) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %i, i32 31)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = srem i32 %1, 100000
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @nish_main$arrow2(i32 noundef %i) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %i, i32 131)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = srem i32 %1, 1000
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @nish_main$arrow3(i32 noundef %i) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %i, i32 17)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = srem i32 %1, 65536
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @nish_main$arrow4(i32 noundef %x, i32 noundef %m) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %m)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %4

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!16, !17, !18, !19, !20}
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
!14 = !{!"element ptr", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{i32 8, !"cf-protection-branch", i32 1}
!17 = !{i32 8, !"cf-protection-return", i32 1}
!18 = !{i32 8, !"branch-target-enforcement", i32 1}
!19 = !{i32 8, !"sign-return-address", i32 1}
!20 = !{i32 4, !"probe-stack", !"inline-asm"}
