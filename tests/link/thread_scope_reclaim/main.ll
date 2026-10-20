%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.24.mappedThenSpawned$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$arr.i32$i32$fn.6.digest(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

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

define hidden noundef i32 @digest$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %t.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %t.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %t.addr, align 4
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %9, i32 31)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %x.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = srem i32 %15, 1000003
  store i32 %17, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %18 = load i64, i64* %forof.idx, align 8
  %19 = add i64 %18, 1
  store i64 %19, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %20 = load i32, i32* %t.addr, align 4
  ret i32 %20

ovf.fail:
  %ovf.op = phi i32 [ 2, %forof.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fill(i32 noundef %n, i32 noundef %seed) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %3, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %14 = load i32, i32* %i.addr, align 4
  %15 = trunc i64 %11 to i32
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %19, i32 7)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %seed)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %26 = srem i32 %24, 1009
  %27 = bitcast i8* %13 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %18
  store i32 %26, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  ret %struct.nish_array* %31

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @mappedThenSpawned(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %seed) #0 {
entry:
  %k.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = srem i32 %seed, 5
  %1 = add nsw i32 %0, 3
  store i32 %1, i32* %k.addr, align 4
  %2 = load i32, i32* %k.addr, align 4
  %3 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.24.mappedThenSpawned$arrow0(%struct.nish_array* %xs, i32 %2)
  store %struct.nish_array* %3, %struct.nish_array** %ys.addr, align 8
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 2, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 2, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %8 = call i8* @nish_alloc_struct(i64 8)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %8 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 0
  store i32 0, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = getelementptr inbounds i32, i32* %10, i64 1
  store i32 0, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %5, %struct.nish_array** %out.addr, align 8
  %13 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %13, %struct.ThreadScope** %s.addr, align 8
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = bitcast %struct.ThreadScope* %14 to i8*
  %16 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.6.digest(%struct.ThreadScope* %16, %struct.nish_array* %17, %struct.nish_array* %18, i32 0)
  %19 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.6.digest(%struct.ThreadScope* %19, %struct.nish_array* %xs, %struct.nish_array* %20, i32 1)
  call void @nish_scope_join(i8* %15)
  %21 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 0, %23
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %23)
  unreachable

bounds.ok:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 0
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %30 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %29, i32 7)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  %33 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ult i64 1, %35
  br i1 %36, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %35)
  unreachable

bounds.ok.1:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 1
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %42 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %41)
  %43 = extractvalue { i32, i1 } %42, 0
  %44 = extractvalue { i32, i1 } %42, 1
  br i1 %44, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %45 = srem i32 %43, 1000003
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %45

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok ], [ 0, %bounds.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %check.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %passes.addr = alloca %struct.nish_array*, align 8
  %r.addr.1 = alloca i32, align 4
  %m.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %r.addr.2 = alloca i32, align 4
  %blocks.addr = alloca %struct.nish_array*, align 8
  %r.addr.3 = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %ys.addr.1 = alloca %struct.nish_array*, align 8
  %s.addr.1 = alloca %struct.ThreadScope*, align 8
  %r.addr.4 = alloca i32, align 4
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
  %5 = load i32, i32* %check.addr, align 4
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %5, i32 31)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = load i32, i32* %r.addr, align 4
  %11 = call i32 @mappedThenSpawned(%struct.nish_array* %9, i32 %10)
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %15 = srem i32 %13, 1000003
  store i32 %15, i32* %check.addr, align 4
  br label %for.inc

for.inc:
  %16 = load i32, i32* %r.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 24, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 24, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %22 = mul i64 24, 4
  %23 = call i8* @nish_alloc_struct(i64 %22)
  call void @llvm.memset.p0i8.i64(i8* align 8 %23, i8 0, i64 %22, i1 false), !alias.scope !4, !noalias !3
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %19, %struct.nish_array** %passes.addr, align 8
  store i32 0, i32* %r.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %25 = load i32, i32* %r.addr.1, align 4
  %26 = icmp slt i32 %25, 24
  br i1 %26, label %for.body.1, label %for.end.1

for.body.1:
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %28 = load i8*, i8** %27, align 8
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %30 = load i64, i64* %29, align 8
  %31 = load i32, i32* %r.addr.1, align 4
  store i32 %31, i32* %m.addr, align 4
  %32 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %33 = load i32, i32* %m.addr, align 4
  %34 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* %32, i32 %33)
  store %struct.nish_array* %34, %struct.nish_array** %ys.addr, align 8
  %35 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %35, %struct.ThreadScope** %s.addr, align 8
  %36 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %37 = bitcast %struct.ThreadScope* %36 to i8*
  %38 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %39 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %40 = load %struct.nish_array*, %struct.nish_array** %passes.addr, align 8
  %41 = load i32, i32* %r.addr.1, align 4
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.6.digest(%struct.ThreadScope* %38, %struct.nish_array* %39, %struct.nish_array* %40, i32 %41)
  call void @nish_scope_join(i8* %37)
  %42 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %43 = load i8*, i8** %42, align 8
  %44 = icmp eq i8* %43, %28
  br i1 %44, label %pass.rewind, label %pass.free

pass.rewind:
  %45 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %30, i64* %45, align 8
  br label %pass.done

pass.free:
  %46 = ptrtoint i8* %28 to i64
  %47 = add i64 %46, %30
  call void @nish_arena_release(i64 %47)
  br label %pass.done

pass.done:
  br label %for.inc.1

for.inc.1:
  %48 = load i32, i32* %r.addr.1, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %r.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %r.addr.2, align 4
  %50 = load %struct.nish_array*, %struct.nish_array** %passes.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %55 = load i32, i32* %r.addr.2, align 4
  %56 = trunc i64 %52 to i32
  %57 = icmp slt i32 %55, %56
  br i1 %57, label %for.body.2, label %for.end.2

for.body.2:
  %58 = load i32, i32* %check.addr, align 4
  %59 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %58, i32 31)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %62 = load i32, i32* %r.addr.2, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %54 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %63
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 %66)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %70 = srem i32 %68, 1000003
  store i32 %70, i32* %check.addr, align 4
  br label %for.inc.2

for.inc.2:
  %71 = load i32, i32* %r.addr.2, align 4
  %72 = add nsw i32 %71, 1
  store i32 %72, i32* %r.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %73 = call i8* @nish_alloc_struct(i64 24)
  %74 = bitcast i8* %73 to %struct.nish_array*
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  store i64 24, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 1
  store i64 24, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %77 = mul i64 24, 4
  %78 = call i8* @nish_alloc_struct(i64 %77)
  call void @llvm.memset.p0i8.i64(i8* align 8 %78, i8 0, i64 %77, i1 false), !alias.scope !4, !noalias !3
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 2
  store i8* %78, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %74, %struct.nish_array** %blocks.addr, align 8
  store i32 0, i32* %r.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %80 = load i32, i32* %r.addr.3, align 4
  %81 = icmp slt i32 %80, 24
  br i1 %81, label %for.body.3, label %for.end.3

for.body.3:
  %82 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %83 = load i8*, i8** %82, align 8
  %84 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %85 = load i64, i64* %84, align 8
  %86 = call i64 @nish_arena_mark()
  store i64 %86, i64* %a.addr, align 8
  %87 = load i64, i64* %a.addr, align 8
  %88 = load i32, i32* %n.addr, align 4
  %89 = load i32, i32* %r.addr.3, align 4
  %90 = add nsw i32 %89, 100
  %91 = call %struct.nish_array* @fill(i32 %88, i32 %90)
  store %struct.nish_array* %91, %struct.nish_array** %ys.addr.1, align 8
  %92 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %92, %struct.ThreadScope** %s.addr.1, align 8
  %93 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %94 = bitcast %struct.ThreadScope* %93 to i8*
  %95 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %96 = load %struct.nish_array*, %struct.nish_array** %ys.addr.1, align 8
  %97 = load %struct.nish_array*, %struct.nish_array** %blocks.addr, align 8
  %98 = load i32, i32* %r.addr.3, align 4
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.6.digest(%struct.ThreadScope* %95, %struct.nish_array* %96, %struct.nish_array* %97, i32 %98)
  call void @nish_scope_join(i8* %94)
  call void @nish_arena_release(i64 %87)
  %99 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %100 = load i8*, i8** %99, align 8
  %101 = icmp eq i8* %100, %83
  br i1 %101, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %102 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %85, i64* %102, align 8
  br label %pass.done.1

pass.free.1:
  %103 = ptrtoint i8* %83 to i64
  %104 = add i64 %103, %85
  call void @nish_arena_release(i64 %104)
  br label %pass.done.1

pass.done.1:
  br label %for.inc.3

for.inc.3:
  %105 = load i32, i32* %r.addr.3, align 4
  %106 = add nsw i32 %105, 1
  store i32 %106, i32* %r.addr.3, align 4
  br label %for.cond.3

for.end.3:
  store i32 0, i32* %r.addr.4, align 4
  %107 = load %struct.nish_array*, %struct.nish_array** %blocks.addr, align 8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %111 = load i8*, i8** %110, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.4

for.cond.4:
  %112 = load i32, i32* %r.addr.4, align 4
  %113 = trunc i64 %109 to i32
  %114 = icmp slt i32 %112, %113
  br i1 %114, label %for.body.4, label %for.end.4

for.body.4:
  %115 = load i32, i32* %check.addr, align 4
  %116 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %115, i32 31)
  %117 = extractvalue { i32, i1 } %116, 0
  %118 = extractvalue { i32, i1 } %116, 1
  br i1 %118, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %119 = load i32, i32* %r.addr.4, align 4
  %120 = sext i32 %119 to i64
  %121 = bitcast i8* %111 to i32*
  %122 = getelementptr inbounds i32, i32* %121, i64 %120
  %123 = load i32, i32* %122, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %124 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %117, i32 %123)
  %125 = extractvalue { i32, i1 } %124, 0
  %126 = extractvalue { i32, i1 } %124, 1
  br i1 %126, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %127 = srem i32 %125, 1000003
  store i32 %127, i32* %check.addr, align 4
  br label %for.inc.4

for.inc.4:
  %128 = load i32, i32* %r.addr.4, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %r.addr.4, align 4
  br label %for.cond.4

for.end.4:
  %130 = load i32, i32* %check.addr, align 4
  %131 = call i8* @nish_str_from_i32(i32 %130)
  call void @nish_print(i8* %131)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ], [ 2, %for.body.2 ], [ 0, %ovf.ok.2 ], [ 2, %for.body.4 ], [ 0, %ovf.ok.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @mappedThenSpawned$arrow0(i32 noundef %x, i32 noundef %k) #0 {
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

define hidden noundef i32 @nish_main$arrow0(i32 noundef %i) #1 {
entry:
  %0 = srem i32 %i, 8191
  %1 = mul nsw i32 %0, 7919
  %2 = srem i32 %1, 65536
  ret i32 %2
}

define hidden noundef i32 @nish_main$arrow1(i32 noundef %x, i32 noundef %m) #0 {
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
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
