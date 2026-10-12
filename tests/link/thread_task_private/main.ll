%struct.Point = type { i32, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.5.sieve(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.5.total(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.5.evens(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.parallelMapInto$i32$i32$fn.8.digitSum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_exit(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

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

define hidden noundef i32 @sieve(i32 noundef %n) #0 {
entry:
  %marks.addr = alloca %struct.nish_array*, align 8
  %fill.at = alloca i64, align 8
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %marks.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %marks.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %12 = load i64, i64* %fill.at, align 8
  %13 = icmp slt i64 %12, %11
  br i1 %13, label %fill.body, label %fill.end

fill.body:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %12
  store i32 0, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %12, 1
  store i64 %18, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  store i32 0, i32* %count.addr, align 4
  store i32 2, i32* %i.addr, align 4
  %19 = load %struct.nish_array*, %struct.nish_array** %marks.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %24 = load i32, i32* %i.addr, align 4
  %25 = trunc i64 %21 to i32
  %26 = icmp slt i32 %24, %25
  br i1 %26, label %for.body, label %for.end

for.body:
  %27 = load i32, i32* %i.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = bitcast i8* %23 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %28
  %31 = load i32, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = icmp eq i32 %31, 0
  br i1 %32, label %if.then, label %if.end

if.then:
  %33 = load i32, i32* %count.addr, align 4
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 1)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %35, i32* %count.addr, align 4
  %37 = load i32, i32* %i.addr, align 4
  %38 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %37, i32 2)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %39, i32* %j.addr, align 4
  %41 = load %struct.nish_array*, %struct.nish_array** %marks.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %46 = load i32, i32* %j.addr, align 4
  %47 = trunc i64 %43 to i32
  %48 = icmp slt i32 %46, %47
  br i1 %48, label %for.body.1, label %for.end.1

for.body.1:
  %49 = load i32, i32* %j.addr, align 4
  %50 = sext i32 %49 to i64
  %51 = icmp ult i64 %50, %43
  br i1 %51, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %50, i64 %43)
  unreachable

bounds.ok:
  %52 = bitcast i8* %45 to i32*
  %53 = getelementptr inbounds i32, i32* %52, i64 %50
  store i32 1, i32* %53, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc.1

for.inc.1:
  %54 = load i32, i32* %j.addr, align 4
  %55 = load i32, i32* %i.addr, align 4
  %56 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %54, i32 %55)
  %57 = extractvalue { i32, i1 } %56, 0
  %58 = extractvalue { i32, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %57, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %59 = load i32, i32* %i.addr, align 4
  %60 = add nsw i32 %59, 1
  store i32 %60, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %61 = load i32, i32* %count.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %61

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then ], [ 2, %ovf.ok ], [ 0, %for.inc.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %v) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = load i32, i32* %i.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %v, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = bitcast i8* %3 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %8
  store i32 %11, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @total(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %t.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %xs.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @fill(%struct.nish_array* %9, i32 3)
  store i32 0, i32* %t.addr, align 4
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %11 = load i64, i64* %forof.idx, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %forof.body, label %forof.end

forof.body:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %11
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %19, i32* %x.addr, align 4
  %20 = load i32, i32* %t.addr, align 4
  %21 = load i32, i32* %x.addr, align 4
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %23, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %25 = load i64, i64* %forof.idx, align 8
  %26 = add i64 %25, 1
  store i64 %26, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %27 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %27

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @evens(i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = srem i32 %5, 2
  %7 = icmp eq i32 %6, 0
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 4)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %11
  store i32 %9, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %23 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %26
}

define hidden noundef i32 @digitSum(i32 noundef %x) #0 {
entry:
  %ds.addr = alloca %struct.nish_array*, align 8
  %fill.at = alloca i64, align 8
  %v.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = srem i32 %x, 7
  %1 = add nsw i32 %0, 4
  %2 = sext i32 %1 to i64
  %3 = icmp ule i64 %2, 2147483647
  br i1 %3, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 %2, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 %2, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = mul i64 %2, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %5, %struct.nish_array** %ds.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %ds.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %14 = load i64, i64* %fill.at, align 8
  %15 = icmp slt i64 %14, %13
  br i1 %15, label %fill.body, label %fill.end

fill.body:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %14
  store i32 0, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = add i64 %14, 1
  store i64 %20, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  store i32 %x, i32* %v.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %21 = load %struct.nish_array*, %struct.nish_array** %ds.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %26 = load i32, i32* %v.addr, align 4
  %27 = icmp sgt i32 %26, 0
  br i1 %27, label %land.rhs, label %land.end

land.rhs:
  %28 = load i32, i32* %k.addr, align 4
  %29 = trunc i64 %23 to i32
  %30 = icmp slt i32 %28, %29
  br label %land.end

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ]
  br i1 %31, label %while.body, label %while.end

while.body:
  %32 = load i32, i32* %k.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i32, i32* %v.addr, align 4
  %35 = srem i32 %34, 10
  %36 = bitcast i8* %25 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %33
  store i32 %35, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %38 = load i32, i32* %v.addr, align 4
  %39 = sdiv i32 %38, 10
  store i32 %39, i32* %v.addr, align 4
  %40 = load i32, i32* %k.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %k.addr, align 4
  br label %while.cond

while.end:
  store i32 0, i32* %t.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %ds.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %43 = load i64, i64* %forof.idx, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = icmp ult i64 %43, %45
  br i1 %46, label %forof.body, label %forof.end

forof.body:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to i32*
  %50 = getelementptr inbounds i32, i32* %49, i64 %43
  %51 = load i32, i32* %50, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %51, i32* %d.addr, align 4
  %52 = load i32, i32* %t.addr, align 4
  %53 = load i32, i32* %d.addr, align 4
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 %53)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %55, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %57 = load i64, i64* %forof.idx, align 8
  %58 = add i64 %57, 1
  store i64 %58, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %59 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %59

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !17
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !18
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %primes.addr = alloca %struct.nish_array*, align 8
  %sums.addr = alloca %struct.nish_array*, align 8
  %counts.addr = alloca %struct.nish_array*, align 8
  %far.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %src.addr = alloca %struct.nish_array*, align 8
  %dst.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %primes.addr, align 8
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 1, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 1, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = call i8* @nish_alloc_struct(i64 4)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %13 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 0, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %10, %struct.nish_array** %sums.addr, align 8
  %17 = call i8* @nish_alloc_struct(i64 24)
  %18 = bitcast i8* %17 to %struct.nish_array*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 1, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 1, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = call i8* @nish_alloc_struct(i64 4)
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %21 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 0
  store i32 0, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %18, %struct.nish_array** %counts.addr, align 8
  store i32 0, i32* %far.addr, align 4
  %25 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %25, %struct.ThreadScope** %s.addr, align 8
  %26 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %27 = bitcast %struct.ThreadScope* %26 to i8*
  %28 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %29 = load %struct.nish_array*, %struct.nish_array** %primes.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.5.sieve(%struct.ThreadScope* %28, i32 100, %struct.nish_array* %29, i32 0)
  %30 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %primes.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.5.sieve(%struct.ThreadScope* %30, i32 10000, %struct.nish_array* %31, i32 1)
  %32 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %33 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.5.total(%struct.ThreadScope* %32, i32 10, %struct.nish_array* %33, i32 0)
  %34 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %35 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.5.evens(%struct.ThreadScope* %34, i32 101, %struct.nish_array* %35, i32 0)
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %36 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %37 = getelementptr inbounds %struct.Point, %struct.Point* %36, i32 0, i32 0
  %38 = load i32, i32* %37, align 4, !tbaa !17
  %39 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %40 = getelementptr inbounds %struct.Point, %struct.Point* %39, i32 0, i32 0
  %41 = load i32, i32* %40, align 4, !tbaa !17
  %42 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %38, i32 %41)
  %43 = extractvalue { i32, i1 } %42, 0
  %44 = extractvalue { i32, i1 } %42, 1
  br i1 %44, label %ovf.fail, label %ovf.ok

ovf.ok:
  %45 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %46 = getelementptr inbounds %struct.Point, %struct.Point* %45, i32 0, i32 1
  %47 = load i32, i32* %46, align 4, !tbaa !18
  %48 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %49 = getelementptr inbounds %struct.Point, %struct.Point* %48, i32 0, i32 1
  %50 = load i32, i32* %49, align 4, !tbaa !18
  %51 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %47, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 %52)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %55, i32* %far.addr, align 4
  call void @nish_scope_join(i8* %27)
  %57 = call i8* @nish_alloc_struct(i64 24)
  %58 = bitcast i8* %57 to %struct.nish_array*
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  store i64 6, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 1
  store i64 6, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %61 = call i8* @nish_alloc_struct(i64 24)
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  store i8* %61, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %61 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 0
  store i32 12, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %65 = getelementptr inbounds i32, i32* %63, i64 1
  store i32 345, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %66 = getelementptr inbounds i32, i32* %63, i64 2
  store i32 6789, i32* %66, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %67 = getelementptr inbounds i32, i32* %63, i64 3
  store i32 10, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %68 = getelementptr inbounds i32, i32* %63, i64 4
  store i32 99999, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %69 = getelementptr inbounds i32, i32* %63, i64 5
  store i32 7, i32* %69, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %58, %struct.nish_array** %src.addr, align 8
  %70 = call i8* @nish_alloc_struct(i64 24)
  %71 = bitcast i8* %70 to %struct.nish_array*
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  store i64 6, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 1
  store i64 6, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %74 = call i8* @nish_alloc_struct(i64 24)
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  store i8* %74, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %74 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 0
  store i32 0, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %78 = getelementptr inbounds i32, i32* %76, i64 1
  store i32 0, i32* %78, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %79 = getelementptr inbounds i32, i32* %76, i64 2
  store i32 0, i32* %79, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %80 = getelementptr inbounds i32, i32* %76, i64 3
  store i32 0, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = getelementptr inbounds i32, i32* %76, i64 4
  store i32 0, i32* %81, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %82 = getelementptr inbounds i32, i32* %76, i64 5
  store i32 0, i32* %82, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %71, %struct.nish_array** %dst.addr, align 8
  %83 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %84 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.8.digitSum(%struct.nish_array* %83, %struct.nish_array* %84)
  %85 = load %struct.nish_array*, %struct.nish_array** %primes.addr, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = icmp ult i64 0, %87
  br i1 %88, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %87)
  unreachable

bounds.ok:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 0
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %94 = call i8* @nish_str_from_i32(i32 %93)
  %95 = call i8* @nish_str_concat(i8* %94, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %96 = load %struct.nish_array*, %struct.nish_array** %primes.addr, align 8
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = icmp ult i64 1, %98
  br i1 %99, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %98)
  unreachable

bounds.ok.1:
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 2
  %101 = load i8*, i8** %100, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %102 = bitcast i8* %101 to i32*
  %103 = getelementptr inbounds i32, i32* %102, i64 1
  %104 = load i32, i32* %103, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %105 = call i8* @nish_str_from_i32(i32 %104)
  %106 = call i8* @nish_str_concat(i8* %95, i8* %105)
  %107 = call i8* @nish_str_concat(i8* %106, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %108 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = icmp ult i64 0, %110
  br i1 %111, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %110)
  unreachable

bounds.ok.2:
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 2
  %113 = load i8*, i8** %112, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %114 = bitcast i8* %113 to i32*
  %115 = getelementptr inbounds i32, i32* %114, i64 0
  %116 = load i32, i32* %115, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %117 = call i8* @nish_str_from_i32(i32 %116)
  %118 = call i8* @nish_str_concat(i8* %107, i8* %117)
  %119 = call i8* @nish_str_concat(i8* %118, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %120 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 0
  %122 = load i64, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %123 = icmp ult i64 0, %122
  br i1 %123, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %122)
  unreachable

bounds.ok.3:
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %126 = bitcast i8* %125 to i32*
  %127 = getelementptr inbounds i32, i32* %126, i64 0
  %128 = load i32, i32* %127, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %129 = call i8* @nish_str_from_i32(i32 %128)
  %130 = call i8* @nish_str_concat(i8* %119, i8* %129)
  %131 = call i8* @nish_str_concat(i8* %130, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %132 = load i32, i32* %far.addr, align 4
  %133 = call i8* @nish_str_from_i32(i32 %132)
  %134 = call i8* @nish_str_concat(i8* %131, i8* %133)
  call void @nish_print(i8* %134)
  %135 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 0
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %138 = icmp ult i64 0, %137
  br i1 %138, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %137)
  unreachable

bounds.ok.4:
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 2
  %140 = load i8*, i8** %139, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %141 = bitcast i8* %140 to i32*
  %142 = getelementptr inbounds i32, i32* %141, i64 0
  %143 = load i32, i32* %142, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %144 = call i8* @nish_str_from_i32(i32 %143)
  %145 = call i8* @nish_str_concat(i8* %144, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %146 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %146, i64 0, i32 0
  %148 = load i64, i64* %147, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %149 = icmp ult i64 1, %148
  br i1 %149, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %148)
  unreachable

bounds.ok.5:
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %146, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %152 = bitcast i8* %151 to i32*
  %153 = getelementptr inbounds i32, i32* %152, i64 1
  %154 = load i32, i32* %153, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %155 = call i8* @nish_str_from_i32(i32 %154)
  %156 = call i8* @nish_str_concat(i8* %145, i8* %155)
  %157 = call i8* @nish_str_concat(i8* %156, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %158 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 0
  %160 = load i64, i64* %159, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %161 = icmp ult i64 2, %160
  br i1 %161, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 2, i64 %160)
  unreachable

bounds.ok.6:
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 2
  %163 = load i8*, i8** %162, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %164 = bitcast i8* %163 to i32*
  %165 = getelementptr inbounds i32, i32* %164, i64 2
  %166 = load i32, i32* %165, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %167 = call i8* @nish_str_from_i32(i32 %166)
  %168 = call i8* @nish_str_concat(i8* %157, i8* %167)
  %169 = call i8* @nish_str_concat(i8* %168, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %170 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 0
  %172 = load i64, i64* %171, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %173 = icmp ult i64 3, %172
  br i1 %173, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 3, i64 %172)
  unreachable

bounds.ok.7:
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 2
  %175 = load i8*, i8** %174, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %176 = bitcast i8* %175 to i32*
  %177 = getelementptr inbounds i32, i32* %176, i64 3
  %178 = load i32, i32* %177, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %179 = call i8* @nish_str_from_i32(i32 %178)
  %180 = call i8* @nish_str_concat(i8* %169, i8* %179)
  %181 = call i8* @nish_str_concat(i8* %180, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %182 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 0
  %184 = load i64, i64* %183, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %185 = icmp ult i64 4, %184
  br i1 %185, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 4, i64 %184)
  unreachable

bounds.ok.8:
  %186 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 2
  %187 = load i8*, i8** %186, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %188 = bitcast i8* %187 to i32*
  %189 = getelementptr inbounds i32, i32* %188, i64 4
  %190 = load i32, i32* %189, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %191 = call i8* @nish_str_from_i32(i32 %190)
  %192 = call i8* @nish_str_concat(i8* %181, i8* %191)
  %193 = call i8* @nish_str_concat(i8* %192, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %194 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %194, i64 0, i32 0
  %196 = load i64, i64* %195, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %197 = icmp ult i64 5, %196
  br i1 %197, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 5, i64 %196)
  unreachable

bounds.ok.9:
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %194, i64 0, i32 2
  %199 = load i8*, i8** %198, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %200 = bitcast i8* %199 to i32*
  %201 = getelementptr inbounds i32, i32* %200, i64 5
  %202 = load i32, i32* %201, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %203 = call i8* @nish_str_from_i32(i32 %202)
  %204 = call i8* @nish_str_concat(i8* %193, i8* %203)
  call void @nish_print(i8* %204)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"Point", !15, i64 0, !15, i64 4}
!17 = !{!16, !15, i64 0}
!18 = !{!16, !15, i64 4}
