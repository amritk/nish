%struct.Tally = type { i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"k=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef i64 @nish_arena_used() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4
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

define hidden noundef i32 @triple(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 3)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fill(i32 noundef %k) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %k
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 %8, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %22
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @leave(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #0 {
entry:
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca i64, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  %3 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !17
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  %12 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %10, i32* %12, align 4, !tbaa !17
  call void @nish_arena_release(i64 %1)
  %13 = call i64 @nish_arena_mark()
  store i64 %13, i64* %b.addr, align 8
  %14 = load i64, i64* %b.addr, align 8
  %15 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %15, %struct.nish_array** %ys.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = sdiv i32 %k, 2
  %21 = icmp sgt i32 %19, %20
  br i1 %21, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %14)
  ret %struct.Tally* %t

if.end:
  %22 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !17
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 1)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %27 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %25, i32* %27, align 4, !tbaa !17
  call void @nish_arena_release(i64 %14)
  ret %struct.Tally* %t

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @passes(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #0 {
entry:
  %top.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %top.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, 4
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = call i64 @nish_arena_mark()
  store i64 %3, i64* %a.addr, align 8
  %4 = load i64, i64* %a.addr, align 8
  %5 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %5, %struct.nish_array** %xs.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp eq i32 %6, 1
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %4)
  br label %for.inc

if.end:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp eq i32 %8, 2
  br i1 %9, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_arena_release(i64 %4)
  br label %for.end

if.end.1:
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !17
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %17, i32* %19, align 4, !tbaa !17
  call void @nish_arena_release(i64 %4)
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !17
  %24 = call i64 @nish_arena_mark()
  %25 = load i64, i64* %top.addr, align 8
  %26 = icmp eq i64 %24, %25
  br i1 %26, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %27 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %31 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %29, i32* %31, align 4, !tbaa !17
  ret %struct.Tally* %t

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @inPass(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #0 {
entry:
  %i.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %a.addr = alloca i64, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %6, %struct.nish_array** %ys.addr, align 8
  %7 = call i64 @nish_arena_mark()
  store i64 %7, i64* %a.addr, align 8
  %8 = load i64, i64* %a.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = call %struct.nish_array* @fill(i32 %12)
  store %struct.nish_array* %13, %struct.nish_array** %zs.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = icmp eq i32 %14, 1
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %17 = load i8*, i8** %16, align 8
  %18 = icmp eq i8* %17, %3
  br i1 %18, label %pass.rewind, label %pass.free

pass.rewind:
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %19, align 8
  br label %pass.done

pass.free:
  %20 = ptrtoint i8* %3 to i64
  %21 = add i64 %20, %5
  call void @nish_arena_release(i64 %21)
  br label %pass.done

pass.done:
  ret %struct.Tally* %t

if.end:
  %22 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !17
  %24 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok

ovf.ok:
  %31 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %29, i32* %31, align 4, !tbaa !17
  call void @nish_arena_release(i64 %8)
  %32 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %33 = load i8*, i8** %32, align 8
  %34 = icmp eq i8* %33, %3
  br i1 %34, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %35 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %35, align 8
  br label %pass.done.1

pass.free.1:
  %36 = ptrtoint i8* %3 to i64
  %37 = add i64 %36, %5
  call void @nish_arena_release(i64 %37)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %38 = load i32, i32* %i.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret %struct.Tally* %t

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @aroundPass(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #0 {
entry:
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %zs.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %6 = load i8*, i8** %5, align 8
  %7 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %8 = load i64, i64* %7, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = call %struct.nish_array* @fill(i32 %12)
  store %struct.nish_array* %13, %struct.nish_array** %zs.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = icmp eq i32 %14, 1
  br i1 %15, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %1)
  ret %struct.Tally* %t

if.end:
  %16 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %17 = load i32, i32* %16, align 4, !tbaa !17
  %18 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  %25 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %23, i32* %25, align 4, !tbaa !17
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %27 = load i8*, i8** %26, align 8
  %28 = icmp eq i8* %27, %6
  br i1 %28, label %pass.rewind, label %pass.free

pass.rewind:
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %8, i64* %29, align 8
  br label %pass.done

pass.free:
  %30 = ptrtoint i8* %6 to i64
  %31 = add i64 %30, %8
  call void @nish_arena_release(i64 %31)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @nish_arena_release(i64 %1)
  ret %struct.Tally* %t

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @switched(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t, i32 noundef %pick) #0 {
entry:
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca i64, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  switch i32 %pick, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %3 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !17
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  %12 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %10, i32* %12, align 4, !tbaa !17
  br label %sw.end

sw.case.1:
  call void @nish_arena_release(i64 %1)
  ret %struct.Tally* %t

sw.default:
  %13 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !17
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %18 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %16, i32* %18, align 4, !tbaa !17
  br label %sw.end

sw.end:
  call void @nish_arena_release(i64 %1)
  switch i32 %pick, label %sw.default.1 [
    i32 0, label %sw.case.2
  ]

sw.case.2:
  %19 = call i64 @nish_arena_mark()
  store i64 %19, i64* %b.addr, align 8
  %20 = load i64, i64* %b.addr, align 8
  %21 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %21, %struct.nish_array** %ys.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  %26 = icmp sgt i32 %25, 0
  br i1 %26, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %20)
  br label %sw.end.1

if.end:
  %27 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %28 = load i32, i32* %27, align 4, !tbaa !17
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %28, i32 1)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %32 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %30, i32* %32, align 4, !tbaa !17
  call void @nish_arena_release(i64 %20)
  br label %sw.end.1

sw.default.1:
  %33 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %34 = load i32, i32* %33, align 4, !tbaa !17
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %34, i32 2)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %38 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %36, i32* %38, align 4, !tbaa !17
  br label %sw.end.1

sw.end.1:
  ret %struct.Tally* %t

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @pair(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #0 {
entry:
  %a.addr = alloca i64, align 8
  %b.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %c.addr = alloca i64, align 8
  %d.addr = alloca i64, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = call i64 @nish_arena_mark()
  store i64 %1, i64* %b.addr, align 8
  %2 = load i64, i64* %a.addr, align 8
  %3 = load i64, i64* %b.addr, align 8
  %4 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %4, %struct.nish_array** %xs.addr, align 8
  %5 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !17
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %12, i32* %14, align 4, !tbaa !17
  call void @nish_arena_release(i64 %3)
  call void @nish_arena_release(i64 %2)
  %15 = call i64 @nish_arena_mark()
  store i64 %15, i64* %c.addr, align 8
  %16 = call i64 @nish_arena_mark()
  store i64 %16, i64* %d.addr, align 8
  %17 = load i64, i64* %c.addr, align 8
  %18 = load i64, i64* %d.addr, align 8
  %19 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %19, %struct.nish_array** %ys.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = icmp sgt i32 %23, %k
  br i1 %24, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %17)
  ret %struct.Tally* %t

if.end:
  %25 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %26 = load i32, i32* %25, align 4, !tbaa !17
  %27 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %30)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %34 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %32, i32* %34, align 4, !tbaa !17
  call void @nish_arena_release(i64 %17)
  ret %struct.Tally* %t

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @ownScope(i32 noundef %k) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %k)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %label.addr, align 8
  %2 = call i64 @nish_arena_mark()
  store i64 %2, i64* %a.addr, align 8
  %3 = load i64, i64* %a.addr, align 8
  %4 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %4, %struct.nish_array** %xs.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = icmp sgt i32 %8, %k
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = load i8*, i8** %label.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %13

if.end:
  call void @nish_arena_release(i64 %3)
  %14 = load i8*, i8** %label.addr, align 8
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %k)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @scopeThenArena(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t, i32 noundef %mode) #0 {
entry:
  %res.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
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
  store %struct.nish_array* %1, %struct.nish_array** %res.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, 2
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %11, %struct.ThreadScope** %s.addr, align 8
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = bitcast %struct.ThreadScope* %12 to i8*
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %k, %15
  %17 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %14, i32 %16, %struct.nish_array* %17, i32 %18)
  %19 = call i64 @nish_arena_mark()
  store i64 %19, i64* %a.addr, align 8
  %20 = load i64, i64* %a.addr, align 8
  %21 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %21, %struct.nish_array** %xs.addr, align 8
  %22 = icmp eq i32 %mode, 0
  br i1 %22, label %land.rhs, label %land.end

land.rhs:
  %23 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  %27 = icmp sgt i32 %26, 0
  br label %land.end

land.end:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs ]
  br i1 %28, label %if.then, label %if.end

if.then:
  call void @nish_scope_join(i8* %13)
  call void @nish_arena_release(i64 %20)
  ret %struct.Tally* %t

if.end:
  %29 = icmp eq i32 %mode, 1
  br i1 %29, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = icmp sgt i32 %33, 0
  br label %land.end.1

land.end.1:
  %35 = phi i1 [ false, %if.end ], [ %34, %land.rhs.1 ]
  br i1 %35, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_arena_release(i64 %20)
  call void @nish_scope_join(i8* %13)
  br label %for.end

if.end.1:
  call void @nish_arena_release(i64 %20)
  call void @nish_scope_join(i8* %13)
  br label %for.inc

for.inc:
  %36 = load i32, i32* %i.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %38 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %39 = load i32, i32* %38, align 4, !tbaa !17
  %40 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = icmp ult i64 0, %42
  br i1 %43, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %42)
  unreachable

bounds.ok:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 0
  %48 = load i32, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %39, i32 %48)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok

ovf.ok:
  %52 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp ult i64 1, %54
  br i1 %55, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %54)
  unreachable

bounds.ok.1:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 1
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 %60)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %64 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %62, i32* %64, align 4, !tbaa !17
  ret %struct.Tally* %t

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nested(i32 noundef %k) #0 {
entry:
  %res.addr = alloca %struct.nish_array*, align 8
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %i.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %a.addr.1 = alloca i64, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
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
  store %struct.nish_array* %1, %struct.nish_array** %res.addr, align 8
  %9 = call i64 @nish_arena_mark()
  store i64 %9, i64* %a.addr, align 8
  %10 = load i64, i64* %a.addr, align 8
  %11 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %11, %struct.nish_array** %xs.addr, align 8
  %12 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %12, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = bitcast %struct.ThreadScope* %13 to i8*
  %15 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %15, i32 %19, %struct.nish_array* %20, i32 0)
  call void @nish_scope_join(i8* %14)
  call void @nish_arena_release(i64 %10)
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %21 = load i32, i32* %i.addr, align 4
  %22 = icmp slt i32 %21, 3
  br i1 %22, label %for.body, label %for.end

for.body:
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %24 = load i8*, i8** %23, align 8
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %26 = load i64, i64* %25, align 8
  %27 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %27, %struct.nish_array** %ys.addr, align 8
  %28 = call i64 @nish_arena_mark()
  store i64 %28, i64* %a.addr.1, align 8
  %29 = load i64, i64* %a.addr.1, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = call %struct.nish_array* @fill(i32 %33)
  store %struct.nish_array* %34, %struct.nish_array** %zs.addr, align 8
  %35 = load i32, i32* %i.addr, align 4
  %36 = icmp eq i32 %35, 1
  br i1 %36, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %29)
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %38 = load i8*, i8** %37, align 8
  %39 = icmp eq i8* %38, %24
  br i1 %39, label %pass.rewind, label %pass.free

pass.rewind:
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %26, i64* %40, align 8
  br label %pass.done

pass.free:
  %41 = ptrtoint i8* %24 to i64
  %42 = add i64 %41, %26
  call void @nish_arena_release(i64 %42)
  br label %pass.done

pass.done:
  br label %for.inc

if.end:
  %43 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 1, %46
  br i1 %47, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %46)
  unreachable

bounds.ok:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 1
  %52 = load i32, i32* %51, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = trunc i64 %55 to i32
  %57 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 %56)
  %58 = extractvalue { i32, i1 } %57, 0
  %59 = extractvalue { i32, i1 } %57, 1
  br i1 %59, label %ovf.fail, label %ovf.ok

ovf.ok:
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 1
  store i32 %58, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish_arena_release(i64 %29)
  %64 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %65 = load i8*, i8** %64, align 8
  %66 = icmp eq i8* %65, %24
  br i1 %66, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %67 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %26, i64* %67, align 8
  br label %pass.done.1

pass.free.1:
  %68 = ptrtoint i8* %24 to i64
  %69 = add i64 %68, %26
  call void @nish_arena_release(i64 %69)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %70 = load i32, i32* %i.addr, align 4
  %71 = add nsw i32 %70, 1
  store i32 %71, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %72 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = icmp ult i64 0, %74
  br i1 %75, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %74)
  unreachable

bounds.ok.1:
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %78 = bitcast i8* %77 to i32*
  %79 = getelementptr inbounds i32, i32* %78, i64 0
  %80 = load i32, i32* %79, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = icmp ult i64 1, %83
  br i1 %84, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %83)
  unreachable

bounds.ok.2:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 1
  %89 = load i32, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %90 = call i8* @nish_alloc_struct(i64 24)
  %91 = bitcast i8* %90 to %struct.nish_array*
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  store i64 2, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 1
  store i64 2, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %94 = call i8* @nish_alloc_struct(i64 8)
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  store i8* %94, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %96 = bitcast i8* %94 to i32*
  %97 = getelementptr inbounds i32, i32* %96, i64 0
  store i32 %80, i32* %97, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %98 = getelementptr inbounds i32, i32* %96, i64 1
  store i32 %89, i32* %98, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.nish_array* %91

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %t.addr = alloca %struct.Tally*, align 8
  %b1.addr = alloca i64, align 8
  %r1.addr = alloca i32, align 4
  %r2.addr = alloca i32, align 4
  %d1.addr = alloca i64, align 8
  %b2.addr = alloca i64, align 8
  %r3.addr = alloca i32, align 4
  %d2.addr = alloca i64, align 8
  %b3.addr = alloca i64, align 8
  %r4.addr = alloca i32, align 4
  %r5.addr = alloca i32, align 4
  %d3.addr = alloca i64, align 8
  %b6.addr = alloca i64, align 8
  %r8.addr = alloca i32, align 4
  %r9.addr = alloca i32, align 4
  %r10.addr = alloca i32, align 4
  %r11.addr = alloca i32, align 4
  %d6.addr = alloca i64, align 8
  %b7.addr = alloca i64, align 8
  %r12.addr = alloca i32, align 4
  %d7.addr = alloca i64, align 8
  %u.addr = alloca %struct.Tally*, align 8
  %b8.addr = alloca i64, align 8
  %r13.addr = alloca i32, align 4
  %r14.addr = alloca i32, align 4
  %r15.addr = alloca i32, align 4
  %d8.addr = alloca i64, align 8
  %b9.addr = alloca i64, align 8
  %d9.addr = alloca i64, align 8
  %b4.addr = alloca i64, align 8
  %r6.addr = alloca %struct.nish_array*, align 8
  %d4.addr = alloca i64, align 8
  %b5.addr = alloca i64, align 8
  %r7.addr = alloca %struct.nish_array*, align 8
  %d5.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Tally*
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !17
  store %struct.Tally* %1, %struct.Tally** %t.addr, align 8
  %3 = call i64 @nish_arena_used()
  store i64 %3, i64* %b1.addr, align 8
  %4 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %5 = call %struct.Tally* @leave(i32 1000, %struct.Tally* %4)
  %6 = getelementptr inbounds %struct.Tally, %struct.Tally* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !17
  store i32 %7, i32* %r1.addr, align 4
  %8 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %9 = call %struct.Tally* @leave(i32 2, %struct.Tally* %8)
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !17
  store i32 %11, i32* %r2.addr, align 4
  %12 = call i64 @nish_arena_used()
  %13 = load i64, i64* %b1.addr, align 8
  %14 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %12, i64 %13)
  %15 = extractvalue { i64, i1 } %14, 0
  %16 = extractvalue { i64, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %15, i64* %d1.addr, align 8
  %17 = call i64 @nish_arena_used()
  store i64 %17, i64* %b2.addr, align 8
  %18 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %19 = call %struct.Tally* @passes(i32 1000, %struct.Tally* %18)
  %20 = getelementptr inbounds %struct.Tally, %struct.Tally* %19, i32 0, i32 0
  %21 = load i32, i32* %20, align 4, !tbaa !17
  store i32 %21, i32* %r3.addr, align 4
  %22 = call i64 @nish_arena_used()
  %23 = load i64, i64* %b2.addr, align 8
  %24 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %22, i64 %23)
  %25 = extractvalue { i64, i1 } %24, 0
  %26 = extractvalue { i64, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i64 %25, i64* %d2.addr, align 8
  %27 = call i64 @nish_arena_used()
  store i64 %27, i64* %b3.addr, align 8
  %28 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %29 = call %struct.Tally* @inPass(i32 1000, %struct.Tally* %28)
  %30 = getelementptr inbounds %struct.Tally, %struct.Tally* %29, i32 0, i32 0
  %31 = load i32, i32* %30, align 4, !tbaa !17
  store i32 %31, i32* %r4.addr, align 4
  %32 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %33 = call %struct.Tally* @aroundPass(i32 1000, %struct.Tally* %32)
  %34 = getelementptr inbounds %struct.Tally, %struct.Tally* %33, i32 0, i32 0
  %35 = load i32, i32* %34, align 4, !tbaa !17
  store i32 %35, i32* %r5.addr, align 4
  %36 = call i64 @nish_arena_used()
  %37 = load i64, i64* %b3.addr, align 8
  %38 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %36, i64 %37)
  %39 = extractvalue { i64, i1 } %38, 0
  %40 = extractvalue { i64, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i64 %39, i64* %d3.addr, align 8
  %41 = call i64 @nish_arena_used()
  store i64 %41, i64* %b6.addr, align 8
  %42 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %43 = call %struct.Tally* @switched(i32 1000, %struct.Tally* %42, i32 0)
  %44 = getelementptr inbounds %struct.Tally, %struct.Tally* %43, i32 0, i32 0
  %45 = load i32, i32* %44, align 4, !tbaa !17
  store i32 %45, i32* %r8.addr, align 4
  %46 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %47 = call %struct.Tally* @switched(i32 1000, %struct.Tally* %46, i32 1)
  %48 = getelementptr inbounds %struct.Tally, %struct.Tally* %47, i32 0, i32 0
  %49 = load i32, i32* %48, align 4, !tbaa !17
  store i32 %49, i32* %r9.addr, align 4
  %50 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %51 = call %struct.Tally* @switched(i32 1000, %struct.Tally* %50, i32 2)
  %52 = getelementptr inbounds %struct.Tally, %struct.Tally* %51, i32 0, i32 0
  %53 = load i32, i32* %52, align 4, !tbaa !17
  store i32 %53, i32* %r10.addr, align 4
  %54 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %55 = call %struct.Tally* @pair(i32 1000, %struct.Tally* %54)
  %56 = getelementptr inbounds %struct.Tally, %struct.Tally* %55, i32 0, i32 0
  %57 = load i32, i32* %56, align 4, !tbaa !17
  store i32 %57, i32* %r11.addr, align 4
  %58 = call i64 @nish_arena_used()
  %59 = load i64, i64* %b6.addr, align 8
  %60 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %58, i64 %59)
  %61 = extractvalue { i64, i1 } %60, 0
  %62 = extractvalue { i64, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i64 %61, i64* %d6.addr, align 8
  %63 = call i64 @nish_arena_used()
  store i64 %63, i64* %b7.addr, align 8
  %64 = call i32 @ownScope(i32 1000)
  %65 = call i32 @ownScope(i32 2)
  %66 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %64, i32 %65)
  %67 = extractvalue { i32, i1 } %66, 0
  %68 = extractvalue { i32, i1 } %66, 1
  br i1 %68, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %67, i32* %r12.addr, align 4
  %69 = call i64 @nish_arena_used()
  %70 = load i64, i64* %b7.addr, align 8
  %71 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %69, i64 %70)
  %72 = extractvalue { i64, i1 } %71, 0
  %73 = extractvalue { i64, i1 } %71, 1
  br i1 %73, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i64 %72, i64* %d7.addr, align 8
  %74 = call i8* @nish_alloc_struct(i64 4)
  %75 = bitcast i8* %74 to %struct.Tally*
  %76 = getelementptr inbounds %struct.Tally, %struct.Tally* %75, i32 0, i32 0
  store i32 0, i32* %76, align 4, !tbaa !17
  store %struct.Tally* %75, %struct.Tally** %u.addr, align 8
  %77 = call i64 @nish_arena_used()
  store i64 %77, i64* %b8.addr, align 8
  %78 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %79 = call %struct.Tally* @scopeThenArena(i32 1000, %struct.Tally* %78, i32 0)
  %80 = getelementptr inbounds %struct.Tally, %struct.Tally* %79, i32 0, i32 0
  %81 = load i32, i32* %80, align 4, !tbaa !17
  store i32 %81, i32* %r13.addr, align 4
  %82 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %83 = call %struct.Tally* @scopeThenArena(i32 1000, %struct.Tally* %82, i32 1)
  %84 = getelementptr inbounds %struct.Tally, %struct.Tally* %83, i32 0, i32 0
  %85 = load i32, i32* %84, align 4, !tbaa !17
  store i32 %85, i32* %r14.addr, align 4
  %86 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %87 = call %struct.Tally* @scopeThenArena(i32 1000, %struct.Tally* %86, i32 2)
  %88 = getelementptr inbounds %struct.Tally, %struct.Tally* %87, i32 0, i32 0
  %89 = load i32, i32* %88, align 4, !tbaa !17
  store i32 %89, i32* %r15.addr, align 4
  %90 = call i64 @nish_arena_used()
  %91 = load i64, i64* %b8.addr, align 8
  %92 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %90, i64 %91)
  %93 = extractvalue { i64, i1 } %92, 0
  %94 = extractvalue { i64, i1 } %92, 1
  br i1 %94, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i64 %93, i64* %d8.addr, align 8
  %95 = call i64 @nish_arena_used()
  store i64 %95, i64* %b9.addr, align 8
  %96 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %97 = call %struct.Tally* @scopeThenArena(i32 1, %struct.Tally* %96, i32 0)
  %98 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %99 = call %struct.Tally* @scopeThenArena(i32 1, %struct.Tally* %98, i32 1)
  %100 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %101 = call %struct.Tally* @scopeThenArena(i32 1, %struct.Tally* %100, i32 2)
  %102 = call i64 @nish_arena_used()
  %103 = load i64, i64* %b9.addr, align 8
  %104 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %102, i64 %103)
  %105 = extractvalue { i64, i1 } %104, 0
  %106 = extractvalue { i64, i1 } %104, 1
  br i1 %106, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i64 %105, i64* %d9.addr, align 8
  %107 = call i64 @nish_arena_used()
  store i64 %107, i64* %b4.addr, align 8
  %108 = call %struct.nish_array* @nested(i32 1000)
  store %struct.nish_array* %108, %struct.nish_array** %r6.addr, align 8
  %109 = call i64 @nish_arena_used()
  %110 = load i64, i64* %b4.addr, align 8
  %111 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %109, i64 %110)
  %112 = extractvalue { i64, i1 } %111, 0
  %113 = extractvalue { i64, i1 } %111, 1
  br i1 %113, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  store i64 %112, i64* %d4.addr, align 8
  %114 = call i64 @nish_arena_used()
  store i64 %114, i64* %b5.addr, align 8
  %115 = call %struct.nish_array* @nested(i32 1)
  store %struct.nish_array* %115, %struct.nish_array** %r7.addr, align 8
  %116 = call i64 @nish_arena_used()
  %117 = load i64, i64* %b5.addr, align 8
  %118 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %116, i64 %117)
  %119 = extractvalue { i64, i1 } %118, 0
  %120 = extractvalue { i64, i1 } %118, 1
  br i1 %120, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  store i64 %119, i64* %d5.addr, align 8
  %121 = load i32, i32* %r1.addr, align 4
  %122 = call i8* @nish_str_from_i32(i32 %121)
  %123 = call i8* @nish_str_concat(i8* %122, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %124 = load i32, i32* %r2.addr, align 4
  %125 = call i8* @nish_str_from_i32(i32 %124)
  %126 = call i8* @nish_str_concat(i8* %123, i8* %125)
  %127 = call i8* @nish_str_concat(i8* %126, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %128 = load i64, i64* %d1.addr, align 8
  %129 = call i8* @nish_str_from_i64(i64 %128)
  %130 = call i8* @nish_str_concat(i8* %127, i8* %129)
  call void @nish_print(i8* %130)
  %131 = load i32, i32* %r3.addr, align 4
  %132 = call i8* @nish_str_from_i32(i32 %131)
  %133 = call i8* @nish_str_concat(i8* %132, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %134 = load i64, i64* %d2.addr, align 8
  %135 = call i8* @nish_str_from_i64(i64 %134)
  %136 = call i8* @nish_str_concat(i8* %133, i8* %135)
  call void @nish_print(i8* %136)
  %137 = load i32, i32* %r4.addr, align 4
  %138 = call i8* @nish_str_from_i32(i32 %137)
  %139 = call i8* @nish_str_concat(i8* %138, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %140 = load i32, i32* %r5.addr, align 4
  %141 = call i8* @nish_str_from_i32(i32 %140)
  %142 = call i8* @nish_str_concat(i8* %139, i8* %141)
  %143 = call i8* @nish_str_concat(i8* %142, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %144 = load i64, i64* %d3.addr, align 8
  %145 = call i8* @nish_str_from_i64(i64 %144)
  %146 = call i8* @nish_str_concat(i8* %143, i8* %145)
  call void @nish_print(i8* %146)
  %147 = load i32, i32* %r8.addr, align 4
  %148 = call i8* @nish_str_from_i32(i32 %147)
  %149 = call i8* @nish_str_concat(i8* %148, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %150 = load i32, i32* %r9.addr, align 4
  %151 = call i8* @nish_str_from_i32(i32 %150)
  %152 = call i8* @nish_str_concat(i8* %149, i8* %151)
  %153 = call i8* @nish_str_concat(i8* %152, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %154 = load i32, i32* %r10.addr, align 4
  %155 = call i8* @nish_str_from_i32(i32 %154)
  %156 = call i8* @nish_str_concat(i8* %153, i8* %155)
  %157 = call i8* @nish_str_concat(i8* %156, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %158 = load i32, i32* %r11.addr, align 4
  %159 = call i8* @nish_str_from_i32(i32 %158)
  %160 = call i8* @nish_str_concat(i8* %157, i8* %159)
  %161 = call i8* @nish_str_concat(i8* %160, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %162 = load i64, i64* %d6.addr, align 8
  %163 = call i8* @nish_str_from_i64(i64 %162)
  %164 = call i8* @nish_str_concat(i8* %161, i8* %163)
  call void @nish_print(i8* %164)
  %165 = load i32, i32* %r12.addr, align 4
  %166 = call i8* @nish_str_from_i32(i32 %165)
  %167 = call i8* @nish_str_concat(i8* %166, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %168 = load i64, i64* %d7.addr, align 8
  %169 = call i8* @nish_str_from_i64(i64 %168)
  %170 = call i8* @nish_str_concat(i8* %167, i8* %169)
  call void @nish_print(i8* %170)
  %171 = load i32, i32* %r13.addr, align 4
  %172 = call i8* @nish_str_from_i32(i32 %171)
  %173 = call i8* @nish_str_concat(i8* %172, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %174 = load i32, i32* %r14.addr, align 4
  %175 = call i8* @nish_str_from_i32(i32 %174)
  %176 = call i8* @nish_str_concat(i8* %173, i8* %175)
  %177 = call i8* @nish_str_concat(i8* %176, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %178 = load i32, i32* %r15.addr, align 4
  %179 = call i8* @nish_str_from_i32(i32 %178)
  %180 = call i8* @nish_str_concat(i8* %177, i8* %179)
  %181 = call i8* @nish_str_concat(i8* %180, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %182 = load i64, i64* %d8.addr, align 8
  %183 = load i64, i64* %d9.addr, align 8
  %184 = icmp eq i64 %182, %183
  %185 = select i1 %184, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %186 = call i8* @nish_str_concat(i8* %181, i8* %185)
  call void @nish_print(i8* %186)
  %187 = load %struct.nish_array*, %struct.nish_array** %r6.addr, align 8
  %188 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %187, i64 0, i32 0
  %189 = load i64, i64* %188, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %190 = icmp ult i64 0, %189
  br i1 %190, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %189)
  unreachable

bounds.ok:
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %187, i64 0, i32 2
  %192 = load i8*, i8** %191, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %193 = bitcast i8* %192 to i32*
  %194 = getelementptr inbounds i32, i32* %193, i64 0
  %195 = load i32, i32* %194, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %196 = call i8* @nish_str_from_i32(i32 %195)
  %197 = call i8* @nish_str_concat(i8* %196, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %198 = load %struct.nish_array*, %struct.nish_array** %r6.addr, align 8
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %198, i64 0, i32 0
  %200 = load i64, i64* %199, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %201 = icmp ult i64 1, %200
  br i1 %201, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %200)
  unreachable

bounds.ok.1:
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %198, i64 0, i32 2
  %203 = load i8*, i8** %202, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %204 = bitcast i8* %203 to i32*
  %205 = getelementptr inbounds i32, i32* %204, i64 1
  %206 = load i32, i32* %205, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %207 = call i8* @nish_str_from_i32(i32 %206)
  %208 = call i8* @nish_str_concat(i8* %197, i8* %207)
  %209 = call i8* @nish_str_concat(i8* %208, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %210 = load %struct.nish_array*, %struct.nish_array** %r7.addr, align 8
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %210, i64 0, i32 0
  %212 = load i64, i64* %211, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %213 = icmp ult i64 0, %212
  br i1 %213, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %212)
  unreachable

bounds.ok.2:
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %210, i64 0, i32 2
  %215 = load i8*, i8** %214, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %216 = bitcast i8* %215 to i32*
  %217 = getelementptr inbounds i32, i32* %216, i64 0
  %218 = load i32, i32* %217, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %219 = call i8* @nish_str_from_i32(i32 %218)
  %220 = call i8* @nish_str_concat(i8* %209, i8* %219)
  %221 = call i8* @nish_str_concat(i8* %220, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %222 = load %struct.nish_array*, %struct.nish_array** %r7.addr, align 8
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %222, i64 0, i32 0
  %224 = load i64, i64* %223, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %225 = icmp ult i64 1, %224
  br i1 %225, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %224)
  unreachable

bounds.ok.3:
  %226 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %222, i64 0, i32 2
  %227 = load i8*, i8** %226, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %228 = bitcast i8* %227 to i32*
  %229 = getelementptr inbounds i32, i32* %228, i64 1
  %230 = load i32, i32* %229, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %231 = call i8* @nish_str_from_i32(i32 %230)
  %232 = call i8* @nish_str_concat(i8* %221, i8* %231)
  %233 = call i8* @nish_str_concat(i8* %232, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %234 = load i64, i64* %d4.addr, align 8
  %235 = load i64, i64* %d5.addr, align 8
  %236 = icmp eq i64 %234, %235
  %237 = select i1 %236, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %238 = call i8* @nish_str_concat(i8* %233, i8* %237)
  call void @nish_print(i8* %238)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 1, %entry ], [ 1, %ovf.ok ], [ 1, %ovf.ok.1 ], [ 1, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 1, %ovf.ok.4 ], [ 1, %ovf.ok.5 ], [ 1, %ovf.ok.6 ], [ 1, %ovf.ok.7 ], [ 1, %ovf.ok.8 ]
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
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"Tally", !15, i64 0}
!17 = !{!16, !15, i64 0}
