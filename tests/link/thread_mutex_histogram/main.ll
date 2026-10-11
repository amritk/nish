%struct.Hist = type { { %struct.nish_array, [8 x i32] } }
%struct.Shard = type { %struct.nish_array*, %struct.Mutex$$Hist* }
%struct.Mutex$$Hist = type { %struct.MutexGuard$$Hist* }
%struct.MutexGuard$$Hist = type { %struct.Hist*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Shard$i32$fn.8.binShard(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Shard* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.Mutex$$Hist.constructor(%struct.Mutex$$Hist* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Hist* noundef nonnull align 8 dereferenceable(56)) #0
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Hist* @nish.Mutex$$Hist.lock(%struct.Mutex$$Hist* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #1
declare void @nish.MutexGuard$$Hist.constructor(%struct.MutexGuard$$Hist* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Hist* noundef nonnull align 8 dereferenceable(56)) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define internal void @Hist.constructor(%struct.Hist* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Hist, %struct.Hist* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.Hist, %struct.Hist* %this, i32 0, i32 0, i32 1, i64 0
  %2 = bitcast i32* %1 to i8*
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 0
  store i32 0, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %5 = getelementptr inbounds i32, i32* %3, i64 1
  store i32 0, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %6 = getelementptr inbounds i32, i32* %3, i64 2
  store i32 0, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %7 = getelementptr inbounds i32, i32* %3, i64 3
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %8 = getelementptr inbounds i32, i32* %3, i64 4
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %9 = getelementptr inbounds i32, i32* %3, i64 5
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %10 = getelementptr inbounds i32, i32* %3, i64 6
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %11 = getelementptr inbounds i32, i32* %3, i64 7
  store i32 0, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 8, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret void
}

define internal void @Shard.constructor(%struct.Shard* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.Mutex$$Hist* noundef nonnull align 8 dereferenceable(8) %hist) #0 {
entry:
  %0 = getelementptr inbounds %struct.Shard, %struct.Shard* %this, i32 0, i32 0
  store %struct.nish_array* %xs, %struct.nish_array** %0, align 8, !tbaa !15
  %1 = getelementptr inbounds %struct.Shard, %struct.Shard* %this, i32 0, i32 1
  store %struct.Mutex$$Hist* %hist, %struct.Mutex$$Hist** %1, align 8, !tbaa !16
  ret void
}

define hidden noundef i32 @binShard(%struct.Shard* noundef nonnull readonly align 8 dereferenceable(16) nocapture %s) #1 {
entry:
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %bin.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Hist*, align 8
  %0 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %2 = load i64, i64* %forof.idx, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %forof.body, label %forof.end

forof.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %10, i32* %x.addr, align 4
  %11 = load i32, i32* %x.addr, align 4
  %12 = and i32 %11, 7
  store i32 %12, i32* %bin.addr, align 4
  %13 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 1
  %14 = load %struct.Mutex$$Hist*, %struct.Mutex$$Hist** %13, align 8, !tbaa !16
  %15 = call %struct.MutexGuard$$Hist* @nish.Mutex$$Hist.lock(%struct.Mutex$$Hist* %14)
  store %struct.MutexGuard$$Hist* %15, %struct.MutexGuard$$Hist** %g.addr, align 8
  %16 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %17 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %16, i32 0, i32 1
  %18 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %19 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %18, i32 0, i32 0
  %20 = load %struct.Hist*, %struct.Hist** %19, align 8, !tbaa !20
  %21 = getelementptr inbounds %struct.Hist, %struct.Hist* %20, i32 0, i32 0, i32 0
  %22 = load i32, i32* %bin.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %25 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %24, i32 0, i32 0
  %26 = load %struct.Hist*, %struct.Hist** %25, align 8, !tbaa !20
  %27 = getelementptr inbounds %struct.Hist, %struct.Hist* %26, i32 0, i32 0, i32 0
  %28 = load i32, i32* %bin.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = icmp ult i64 %29, %31
  br i1 %32, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %29, i64 %31)
  unreachable

bounds.ok:
  %33 = getelementptr inbounds %struct.Hist, %struct.Hist* %26, i32 0, i32 0, i32 1, i64 0
  %34 = bitcast i32* %33 to i8*
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %29
  %37 = load i32, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %37, i32 1)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok

ovf.ok:
  %41 = getelementptr inbounds %struct.Hist, %struct.Hist* %20, i32 0, i32 0, i32 1, i64 0
  %42 = bitcast i32* %41 to i8*
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %23
  store i32 %39, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store atomic i32 0, i32* %17 release, align 4
  br label %forof.inc

forof.inc:
  %45 = load i64, i64* %forof.idx, align 8
  %46 = add i64 %45, 1
  store i64 %46, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %47 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 0
  %48 = load %struct.nish_array*, %struct.nish_array** %47, align 8, !tbaa !15
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = trunc i64 %50 to i32
  ret i32 %51

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @shard(i32 noundef %seed, i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %v.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 %seed, i32* %v.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %v.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 75)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 74)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %14 = srem i32 %12, 65537
  store i32 %14, i32* %v.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = load i32, i32* %v.addr, align 4
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %18
  store i32 %16, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = trunc i64 %26 to i32
  br label %for.inc

for.inc:
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %30

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %hist.addr = alloca %struct.Mutex$$Hist*, align 8
  %counted.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %t.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Hist*, align 8
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %sum.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Mutex$$Hist*
  %2 = call i8* @nish_alloc_struct(i64 56)
  %3 = bitcast i8* %2 to %struct.Hist*
  %4 = getelementptr inbounds %struct.Hist, %struct.Hist* %3, i32 0, i32 0, i32 0
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 8, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  %7 = getelementptr inbounds %struct.Hist, %struct.Hist* %3, i32 0, i32 0, i32 1, i64 0
  %8 = bitcast i32* %7 to i8*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  call void @Hist.constructor(%struct.Hist* %3)
  call void @nish.Mutex$$Hist.constructor(%struct.Mutex$$Hist* %1, %struct.Hist* %3)
  store %struct.Mutex$$Hist* %1, %struct.Mutex$$Hist** %hist.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 4, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 4, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  %14 = call i8* @nish_alloc_struct(i64 16)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 0, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 0, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %19 = getelementptr inbounds i32, i32* %16, i64 2
  store i32 0, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %20 = getelementptr inbounds i32, i32* %16, i64 3
  store i32 0, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store %struct.nish_array* %11, %struct.nish_array** %counted.addr, align 8
  %21 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %21, %struct.ThreadScope** %s.addr, align 8
  %22 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %23 = bitcast %struct.ThreadScope* %22 to i8*
  store i32 0, i32* %t.addr, align 4
  br label %for.cond

for.cond:
  %24 = load i32, i32* %t.addr, align 4
  %25 = icmp slt i32 %24, 4
  br i1 %25, label %for.body, label %for.end

for.body:
  %26 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %27 = call i8* @nish_alloc_struct(i64 16)
  %28 = bitcast i8* %27 to %struct.Shard*
  %29 = load i32, i32* %t.addr, align 4
  %30 = add nsw i32 %29, 1
  %31 = call %struct.nish_array* @shard(i32 %30, i32 50000)
  %32 = load %struct.Mutex$$Hist*, %struct.Mutex$$Hist** %hist.addr, align 8
  call void @Shard.constructor(%struct.Shard* %28, %struct.nish_array* %31, %struct.Mutex$$Hist* %32)
  %33 = load %struct.nish_array*, %struct.nish_array** %counted.addr, align 8
  %34 = load i32, i32* %t.addr, align 4
  call void @nish.ThreadScope.spawn$$Shard$i32$fn.8.binShard(%struct.ThreadScope* %26, %struct.Shard* %28, %struct.nish_array* %33, i32 %34)
  br label %for.inc

for.inc:
  %35 = load i32, i32* %t.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %t.addr, align 4
  br label %for.cond

for.end:
  call void @nish_scope_join(i8* %23)
  %37 = load %struct.Mutex$$Hist*, %struct.Mutex$$Hist** %hist.addr, align 8
  %38 = call %struct.MutexGuard$$Hist* @nish.Mutex$$Hist.lock(%struct.Mutex$$Hist* %37)
  store %struct.MutexGuard$$Hist* %38, %struct.MutexGuard$$Hist** %g.addr, align 8
  %39 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %40 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %39, i32 0, i32 1
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %b.addr, align 4
  br label %for.cond.1

for.cond.1:
  %44 = load i32, i32* %b.addr, align 4
  %45 = icmp slt i32 %44, 8
  br i1 %45, label %for.body.1, label %for.end.1

for.body.1:
  %46 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %47 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %48 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %47, i32 0, i32 0
  %49 = load %struct.Hist*, %struct.Hist** %48, align 8, !tbaa !20
  %50 = getelementptr inbounds %struct.Hist, %struct.Hist* %49, i32 0, i32 0, i32 0
  %51 = load i32, i32* %b.addr, align 4
  %52 = sext i32 %51 to i64
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = icmp ult i64 %52, %54
  br i1 %55, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %52, i64 %54)
  unreachable

bounds.ok:
  %56 = getelementptr inbounds %struct.Hist, %struct.Hist* %49, i32 0, i32 0, i32 1, i64 0
  %57 = bitcast i32* %56 to i8*
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %52
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  %66 = icmp eq i64 %63, %65
  br i1 %66, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %46, i64 8)
  br label %push.store

push.store:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %69 = bitcast i8* %68 to i8**
  %70 = getelementptr inbounds i8*, i8** %69, i64 %63
  store i8* %61, i8** %70, align 8, !alias.scope !4, !noalias !3, !tbaa !23
  %71 = add i64 %63, 1
  store i64 %71, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = trunc i64 %71 to i32
  %73 = load i32, i32* %sum.addr, align 4
  %74 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %75 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %74, i32 0, i32 0
  %76 = load %struct.Hist*, %struct.Hist** %75, align 8, !tbaa !20
  %77 = getelementptr inbounds %struct.Hist, %struct.Hist* %76, i32 0, i32 0, i32 0
  %78 = load i32, i32* %b.addr, align 4
  %79 = sext i32 %78 to i64
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %82 = icmp ult i64 %79, %81
  br i1 %82, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %79, i64 %81)
  unreachable

bounds.ok.1:
  %83 = getelementptr inbounds %struct.Hist, %struct.Hist* %76, i32 0, i32 0, i32 1, i64 0
  %84 = bitcast i32* %83 to i8*
  %85 = bitcast i8* %84 to i32*
  %86 = getelementptr inbounds i32, i32* %85, i64 %79
  %87 = load i32, i32* %86, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %88 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %73, i32 %87)
  %89 = extractvalue { i32, i1 } %88, 0
  %90 = extractvalue { i32, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %89, i32* %sum.addr, align 4
  br label %for.inc.1

for.inc.1:
  %91 = load i32, i32* %b.addr, align 4
  %92 = add nsw i32 %91, 1
  store i32 %92, i32* %b.addr, align 4
  br label %for.cond.1

for.end.1:
  %93 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %96 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*) to i64*
  %97 = load i64, i64* %96, align 8
  %98 = sub i64 %95, 1
  %99 = mul i64 %97, %98
  %100 = icmp eq i64 %95, 0
  %101 = select i1 %100, i64 0, i64 %99
  store i64 %101, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %102 = load i64, i64* %join.at, align 8
  %103 = icmp ult i64 %102, %95
  br i1 %103, label %join.sum.body, label %join.copy

join.sum.body:
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %105 = load i8*, i8** %104, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %106 = bitcast i8* %105 to i8**
  %107 = getelementptr inbounds i8*, i8** %106, i64 %102
  %108 = load i8*, i8** %107, align 8, !alias.scope !4, !noalias !3, !tbaa !23
  %109 = load i64, i64* %join.total, align 8
  %110 = bitcast i8* %108 to i64*
  %111 = load i64, i64* %110, align 8
  %112 = add i64 %109, %111
  store i64 %112, i64* %join.total, align 8
  %113 = add i64 %102, 1
  store i64 %113, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %114 = load i64, i64* %join.total, align 8
  %115 = icmp ugt i64 %114, 2147483647
  %116 = add i64 %114, 9
  %117 = select i1 %115, i64 4611686018427387904, i64 %116
  %118 = call i8* @nish_alloc_struct(i64 %117)
  %119 = bitcast i8* %118 to i64*
  store i64 %114, i64* %119, align 8
  %120 = getelementptr inbounds i8, i8* %118, i64 8
  store i8* %120, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %121 = load i64, i64* %join.at, align 8
  %122 = icmp ult i64 %121, %95
  br i1 %122, label %join.part, label %join.end

join.part:
  %123 = load i8*, i8** %join.p, align 8
  %124 = icmp eq i64 %121, 0
  %125 = select i1 %124, i64 0, i64 %97
  %126 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %123, i8* %126, i64 %125, i1 false)
  %127 = getelementptr inbounds i8, i8* %123, i64 %125
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %129 = load i8*, i8** %128, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %130 = bitcast i8* %129 to i8**
  %131 = getelementptr inbounds i8*, i8** %130, i64 %121
  %132 = load i8*, i8** %131, align 8, !alias.scope !4, !noalias !3, !tbaa !23
  %133 = bitcast i8* %132 to i64*
  %134 = load i64, i64* %133, align 8
  %135 = getelementptr inbounds i8, i8* %132, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %127, i8* %135, i64 %134, i1 false)
  %136 = getelementptr inbounds i8, i8* %127, i64 %134
  store i8* %136, i8** %join.p, align 8
  %137 = add i64 %121, 1
  store i64 %137, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %138 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %138, align 1
  call void @nish_print(i8* %118)
  %139 = load i32, i32* %sum.addr, align 4
  %140 = call i8* @nish_str_from_i32(i32 %139)
  %141 = call i8* @nish_str_concat(i8* %140, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %142 = load %struct.nish_array*, %struct.nish_array** %counted.addr, align 8
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %145 = icmp ult i64 0, %144
  br i1 %145, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %144)
  unreachable

bounds.ok.2:
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 2
  %147 = load i8*, i8** %146, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %148 = bitcast i8* %147 to i32*
  %149 = getelementptr inbounds i32, i32* %148, i64 0
  %150 = load i32, i32* %149, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %151 = load %struct.nish_array*, %struct.nish_array** %counted.addr, align 8
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 0
  %153 = load i64, i64* %152, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %154 = icmp ult i64 1, %153
  br i1 %154, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %153)
  unreachable

bounds.ok.3:
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %157 = bitcast i8* %156 to i32*
  %158 = getelementptr inbounds i32, i32* %157, i64 1
  %159 = load i32, i32* %158, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %160 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %150, i32 %159)
  %161 = extractvalue { i32, i1 } %160, 0
  %162 = extractvalue { i32, i1 } %160, 1
  br i1 %162, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %163 = load %struct.nish_array*, %struct.nish_array** %counted.addr, align 8
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 0
  %165 = load i64, i64* %164, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %166 = icmp ult i64 2, %165
  br i1 %166, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 2, i64 %165)
  unreachable

bounds.ok.4:
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 2
  %168 = load i8*, i8** %167, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %169 = bitcast i8* %168 to i32*
  %170 = getelementptr inbounds i32, i32* %169, i64 2
  %171 = load i32, i32* %170, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %172 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %161, i32 %171)
  %173 = extractvalue { i32, i1 } %172, 0
  %174 = extractvalue { i32, i1 } %172, 1
  br i1 %174, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %175 = load %struct.nish_array*, %struct.nish_array** %counted.addr, align 8
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 0
  %177 = load i64, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %178 = icmp ult i64 3, %177
  br i1 %178, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 3, i64 %177)
  unreachable

bounds.ok.5:
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 2
  %180 = load i8*, i8** %179, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %181 = bitcast i8* %180 to i32*
  %182 = getelementptr inbounds i32, i32* %181, i64 3
  %183 = load i32, i32* %182, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %184 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %173, i32 %183)
  %185 = extractvalue { i32, i1 } %184, 0
  %186 = extractvalue { i32, i1 } %184, 1
  br i1 %186, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %187 = call i8* @nish_str_from_i32(i32 %185)
  %188 = call i8* @nish_str_concat(i8* %141, i8* %187)
  call void @nish_print(i8* %188)
  store atomic i32 0, i32* %40 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}
!9 = !{!"header i64", !6, i64 0}
!10 = !{!"header ptr", !6, i64 0}
!11 = !{!"array header", !9, i64 0, !9, i64 8, !10, i64 16}
!12 = !{!11, !9, i64 0}
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Shard", !13, i64 0, !13, i64 8}
!15 = !{!14, !13, i64 0}
!16 = !{!14, !13, i64 8}
!17 = !{!11, !10, i64 16}
!18 = !{!"i32", !6, i64 0}
!19 = !{!"MutexGuard$$Hist", !13, i64 0, !18, i64 8}
!20 = !{!19, !13, i64 0}
!21 = !{!11, !9, i64 8}
!22 = !{!"element ptr", !6, i64 0}
!23 = !{!22, !22, i64 0}
