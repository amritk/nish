%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"s\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.13.scaled$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.worded$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.13.tagged$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
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

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %check.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %small.addr = alloca %struct.nish_array*, align 8
  %r.addr.1 = alloca i32, align 4
  %tiny.addr = alloca %struct.nish_array*, align 8
  %r.addr.2 = alloca i32, align 4
  %below.addr = alloca %struct.nish_array*, align 8
  %r.addr.3 = alloca i32, align 4
  %at.addr.1 = alloca i32, align 4
  %r.addr.4 = alloca i32, align 4
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
  %45 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow2(i32 512)
  store %struct.nish_array* %45, %struct.nish_array** %tiny.addr, align 8
  store i32 0, i32* %r.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %46 = load i32, i32* %r.addr.2, align 4
  %47 = icmp slt i32 %46, 8000
  br i1 %47, label %for.body.2, label %for.end.2

for.body.2:
  %48 = load i32, i32* %check.addr, align 4
  %49 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %48, i32 31)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %52 = load %struct.nish_array*, %struct.nish_array** %tiny.addr, align 8
  %53 = load i32, i32* %r.addr.2, align 4
  %54 = call i32 @tagged(%struct.nish_array* %52, i32 %53)
  %55 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 %54)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %58 = srem i32 %56, 1000003
  store i32 %58, i32* %check.addr, align 4
  br label %for.inc.2

for.inc.2:
  %59 = load i32, i32* %r.addr.2, align 4
  %60 = add nsw i32 %59, 1
  store i32 %60, i32* %r.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %61 = shl i32 1, 19
  %62 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow3(i32 %61)
  store %struct.nish_array* %62, %struct.nish_array** %below.addr, align 8
  store i32 0, i32* %r.addr.3, align 4
  %63 = load %struct.nish_array*, %struct.nish_array** %below.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond.3

for.cond.3:
  %66 = load i32, i32* %r.addr.3, align 4
  %67 = icmp slt i32 %66, 64
  br i1 %67, label %for.body.3, label %for.end.3

for.body.3:
  %68 = load i32, i32* %r.addr.3, align 4
  %69 = mul nsw i32 %68, 7919
  %70 = trunc i64 %65 to i32
  %71 = icmp eq i32 %70, 0
  %72 = icmp eq i32 %69, -2147483648
  %73 = icmp eq i32 %70, -1
  %74 = and i1 %72, %73
  %75 = or i1 %71, %74
  br i1 %75, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %71)
  unreachable

div.ok.1:
  %76 = srem i32 %69, %70
  store i32 %76, i32* %at.addr.1, align 4
  %77 = load i32, i32* %check.addr, align 4
  %78 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %77, i32 31)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %81 = load %struct.nish_array*, %struct.nish_array** %below.addr, align 8
  %82 = load i32, i32* %r.addr.3, align 4
  %83 = load i32, i32* %at.addr.1, align 4
  %84 = call i32 @scaled(%struct.nish_array* %81, i32 %82, i32 %83)
  %85 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %79, i32 %84)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %88 = srem i32 %86, 1000003
  store i32 %88, i32* %check.addr, align 4
  br label %for.inc.3

for.inc.3:
  %89 = load i32, i32* %r.addr.3, align 4
  %90 = add nsw i32 %89, 1
  store i32 %90, i32* %r.addr.3, align 4
  br label %for.cond.3

for.end.3:
  store i32 0, i32* %r.addr.4, align 4
  br label %for.cond.4

for.cond.4:
  %91 = load i32, i32* %r.addr.4, align 4
  %92 = icmp slt i32 %91, 24
  br i1 %92, label %for.body.4, label %for.end.4

for.body.4:
  %93 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %94 = load i8*, i8** %93, align 8
  %95 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %96 = load i64, i64* %95, align 8
  %97 = call i64 @nish_arena_mark()
  store i64 %97, i64* %a.addr, align 8
  %98 = load i64, i64* %a.addr, align 8
  %99 = load i32, i32* %r.addr.4, align 4
  store i32 %99, i32* %m.addr, align 4
  %100 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %101 = load i32, i32* %m.addr, align 4
  %102 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow4(%struct.nish_array* %100, i32 %101)
  store %struct.nish_array* %102, %struct.nish_array** %ys.addr, align 8
  %103 = load i32, i32* %check.addr, align 4
  %104 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %103, i32 31)
  %105 = extractvalue { i32, i1 } %104, 0
  %106 = extractvalue { i32, i1 } %104, 1
  br i1 %106, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %107 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %108 = load i32, i32* %r.addr.4, align 4
  %109 = mul nsw i32 %108, 7919
  %110 = sext i32 %109 to i64
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %112 = load i64, i64* %111, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %113 = icmp ult i64 %110, %112
  br i1 %113, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %110, i64 %112)
  unreachable

bounds.ok:
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %116 = bitcast i8* %115 to i32*
  %117 = getelementptr inbounds i32, i32* %116, i64 %110
  %118 = load i32, i32* %117, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %119 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %105, i32 %118)
  %120 = extractvalue { i32, i1 } %119, 0
  %121 = extractvalue { i32, i1 } %119, 1
  br i1 %121, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %122 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 0
  %124 = load i64, i64* %123, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %125 = trunc i64 %124 to i32
  %126 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %120, i32 %125)
  %127 = extractvalue { i32, i1 } %126, 0
  %128 = extractvalue { i32, i1 } %126, 1
  br i1 %128, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  %129 = srem i32 %127, 1000003
  store i32 %129, i32* %check.addr, align 4
  call void @nish_arena_release(i64 %98)
  %130 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %131 = load i8*, i8** %130, align 8
  %132 = icmp eq i8* %131, %94
  br i1 %132, label %pass.rewind, label %pass.free

pass.rewind:
  %133 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %96, i64* %133, align 8
  br label %pass.done

pass.free:
  %134 = ptrtoint i8* %94 to i64
  %135 = add i64 %134, %96
  call void @nish_arena_release(i64 %135)
  br label %pass.done

pass.done:
  br label %for.inc.4

for.inc.4:
  %136 = load i32, i32* %r.addr.4, align 4
  %137 = add nsw i32 %136, 1
  store i32 %137, i32* %r.addr.4, align 4
  br label %for.cond.4

for.end.4:
  %138 = load i32, i32* %check.addr, align 4
  %139 = call i8* @nish_str_from_i32(i32 %138)
  call void @nish_print(i8* %139)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 2, %div.ok ], [ 0, %ovf.ok ], [ 2, %for.body.1 ], [ 0, %ovf.ok.2 ], [ 2, %for.body.2 ], [ 0, %ovf.ok.4 ], [ 2, %div.ok.1 ], [ 0, %ovf.ok.6 ], [ 2, %for.body.4 ], [ 0, %bounds.ok ], [ 0, %ovf.ok.9 ]
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

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
