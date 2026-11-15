%struct.Bins = type { %struct.AtomicI32Array*, %struct.AtomicI64Array*, %struct.AtomicI32Array*, %struct.AtomicI32Array* }
%struct.Shard = type { i32, i32, %struct.Bins* }
%struct.AtomicI32Array = type { i32, %struct.nish_array* }
%struct.AtomicI64Array = type { i32, %struct.nish_array* }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @nish.AtomicI32Array.constructor(%struct.AtomicI32Array* noundef nonnull noalias align 8 dereferenceable(16) nocapture, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef) #0
declare void @nish.AtomicI32Array.store(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.add(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.sub(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.min(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.max(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.exchange(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.compareExchange(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare void @nish.AtomicI64Array.constructor(%struct.AtomicI64Array* noundef nonnull noalias align 8 dereferenceable(16) nocapture, i32 noundef) #0
declare noundef i64 @nish.AtomicI64Array.load(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef) #0
declare void @nish.AtomicI64Array.store(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.add(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.sub(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.min(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.max(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.exchange(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.compareExchange(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef, i64 noundef) #0
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$$Shard$i32$fn.8.binShard(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Shard* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #4

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

define internal void @Bins.constructor(%struct.Bins* noundef nonnull noalias align 8 dereferenceable(32) nocapture %this) #0 {
entry:
  %b.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.AtomicI32Array*
  call void @nish.AtomicI32Array.constructor(%struct.AtomicI32Array* %1, i32 16)
  %2 = getelementptr inbounds %struct.Bins, %struct.Bins* %this, i32 0, i32 0
  store %struct.AtomicI32Array* %1, %struct.AtomicI32Array** %2, align 8, !tbaa !4
  %3 = call i8* @nish_alloc_struct(i64 16)
  %4 = bitcast i8* %3 to %struct.AtomicI64Array*
  call void @nish.AtomicI64Array.constructor(%struct.AtomicI64Array* %4, i32 16)
  %5 = getelementptr inbounds %struct.Bins, %struct.Bins* %this, i32 0, i32 1
  store %struct.AtomicI64Array* %4, %struct.AtomicI64Array** %5, align 8, !tbaa !5
  %6 = call i8* @nish_alloc_struct(i64 16)
  %7 = bitcast i8* %6 to %struct.AtomicI32Array*
  call void @nish.AtomicI32Array.constructor(%struct.AtomicI32Array* %7, i32 16)
  %8 = getelementptr inbounds %struct.Bins, %struct.Bins* %this, i32 0, i32 2
  store %struct.AtomicI32Array* %7, %struct.AtomicI32Array** %8, align 8, !tbaa !6
  %9 = call i8* @nish_alloc_struct(i64 16)
  %10 = bitcast i8* %9 to %struct.AtomicI32Array*
  call void @nish.AtomicI32Array.constructor(%struct.AtomicI32Array* %10, i32 16)
  %11 = getelementptr inbounds %struct.Bins, %struct.Bins* %this, i32 0, i32 3
  store %struct.AtomicI32Array* %10, %struct.AtomicI32Array** %11, align 8, !tbaa !7
  store i32 0, i32* %b.addr, align 4
  br label %for.cond

for.cond:
  %12 = load i32, i32* %b.addr, align 4
  %13 = getelementptr inbounds %struct.Bins, %struct.Bins* %this, i32 0, i32 2
  %14 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %13, align 8, !tbaa !6
  %15 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %14, i32 0, i32 0
  %16 = load i32, i32* %15, align 4, !tbaa !10
  %17 = icmp slt i32 %12, %16
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = getelementptr inbounds %struct.Bins, %struct.Bins* %this, i32 0, i32 2
  %19 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %18, align 8, !tbaa !6
  %20 = load i32, i32* %b.addr, align 4
  call void @nish.AtomicI32Array.store(%struct.AtomicI32Array* %19, i32 %20, i32 1000000)
  br label %for.inc

for.inc:
  %21 = load i32, i32* %b.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %b.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @Shard.constructor(%struct.Shard* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %seed, i32 noundef %n, %struct.Bins* noundef nonnull align 8 dereferenceable(32) %bins) #1 {
entry:
  %0 = getelementptr inbounds %struct.Shard, %struct.Shard* %this, i32 0, i32 0
  store i32 %seed, i32* %0, align 4, !tbaa !12
  %1 = getelementptr inbounds %struct.Shard, %struct.Shard* %this, i32 0, i32 1
  store i32 %n, i32* %1, align 4, !tbaa !13
  %2 = getelementptr inbounds %struct.Shard, %struct.Shard* %this, i32 0, i32 2
  store %struct.Bins* %bins, %struct.Bins** %2, align 8, !tbaa !14
  ret void
}

define internal void @raise$(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %a, i32 noundef %b, i32 noundef %v) #0 {
entry:
  %seen.addr = alloca i32, align 4
  %was.addr = alloca i32, align 4
  %0 = call i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* %a, i32 %b)
  store i32 %0, i32* %seen.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %seen.addr, align 4
  %2 = icmp slt i32 %1, %v
  br i1 %2, label %while.body, label %while.end

while.body:
  %3 = load i32, i32* %seen.addr, align 4
  %4 = call i32 @nish.AtomicI32Array.compareExchange(%struct.AtomicI32Array* %a, i32 %b, i32 %3, i32 %v)
  store i32 %4, i32* %was.addr, align 4
  %5 = load i32, i32* %was.addr, align 4
  %6 = load i32, i32* %seen.addr, align 4
  %7 = icmp eq i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %8 = load i32, i32* %was.addr, align 4
  store i32 %8, i32* %seen.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define hidden noundef i32 @binShard$(%struct.Shard* noundef nonnull readonly align 8 dereferenceable(16) nocapture %s) #0 {
entry:
  %v.addr = alloca i32, align 4
  %block.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %one.addr = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !12
  store i32 %1, i32* %v.addr, align 4
  store i64 3000000000, i64* %block.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !13
  %5 = icmp slt i32 %2, %4
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %v.addr, align 4
  %7 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %6, i32 75)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 74)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %13 = srem i32 %11, 65537
  store i32 %13, i32* %v.addr, align 4
  %14 = load i32, i32* %v.addr, align 4
  %15 = srem i32 %14, 16
  store i32 %15, i32* %b.addr, align 4
  %16 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %17 = load %struct.Bins*, %struct.Bins** %16, align 8, !tbaa !14
  %18 = getelementptr inbounds %struct.Bins, %struct.Bins* %17, i32 0, i32 0
  %19 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %18, align 8, !tbaa !4
  %20 = load i32, i32* %b.addr, align 4
  %21 = call i32 @nish.AtomicI32Array.add(%struct.AtomicI32Array* %19, i32 %20, i32 1)
  %22 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %23 = load %struct.Bins*, %struct.Bins** %22, align 8, !tbaa !14
  %24 = getelementptr inbounds %struct.Bins, %struct.Bins* %23, i32 0, i32 1
  %25 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %24, align 8, !tbaa !5
  %26 = load i32, i32* %b.addr, align 4
  %27 = load i64, i64* %block.addr, align 8
  %28 = call i64 @nish.AtomicI64Array.add(%struct.AtomicI64Array* %25, i32 %26, i64 %27)
  store i64 1, i64* %one.addr, align 8
  %29 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %30 = load %struct.Bins*, %struct.Bins** %29, align 8, !tbaa !14
  %31 = getelementptr inbounds %struct.Bins, %struct.Bins* %30, i32 0, i32 1
  %32 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %31, align 8, !tbaa !5
  %33 = load i32, i32* %b.addr, align 4
  %34 = load i64, i64* %one.addr, align 8
  %35 = call i64 @nish.AtomicI64Array.sub(%struct.AtomicI64Array* %32, i32 %33, i64 %34)
  %36 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %37 = load %struct.Bins*, %struct.Bins** %36, align 8, !tbaa !14
  %38 = getelementptr inbounds %struct.Bins, %struct.Bins* %37, i32 0, i32 2
  %39 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %38, align 8, !tbaa !6
  %40 = load i32, i32* %b.addr, align 4
  %41 = load i32, i32* %v.addr, align 4
  %42 = call i32 @nish.AtomicI32Array.min(%struct.AtomicI32Array* %39, i32 %40, i32 %41)
  %43 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %44 = load %struct.Bins*, %struct.Bins** %43, align 8, !tbaa !14
  %45 = getelementptr inbounds %struct.Bins, %struct.Bins* %44, i32 0, i32 3
  %46 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %45, align 8, !tbaa !7
  %47 = load i32, i32* %b.addr, align 4
  %48 = load i32, i32* %v.addr, align 4
  call void @raise$(%struct.AtomicI32Array* %46, i32 %47, i32 %48)
  br label %for.inc

for.inc:
  %49 = load i32, i32* %i.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %51 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 1
  %52 = load i32, i32* %51, align 4, !tbaa !13
  ret i32 %52

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %bins.addr = alloca %struct.Bins*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %total.addr = alloca i32, align 4
  %bytes.addr = alloca i64, align 8
  %low.addr = alloca i32, align 4
  %high.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %was.addr = alloca i32, align 4
  %seen.addr = alloca i32, align 4
  %big.addr = alloca i64, align 8
  %small.addr = alloca i64, align 8
  %before.addr = alloca i64, align 8
  %lowest.addr = alloca i64, align 8
  %swapped.addr = alloca i64, align 8
  %kept.addr = alloca i64, align 8
  %missed.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 32)
  %1 = bitcast i8* %0 to %struct.Bins*
  call void @Bins.constructor(%struct.Bins* %1)
  store %struct.Bins* %1, %struct.Bins** %bins.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 4, i64* %4, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 4, i64* %5, align 8, !alias.scope !18, !noalias !19, !tbaa !24
  %6 = call i8* @nish_alloc_struct(i64 16)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 0, i32* %9, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %10 = getelementptr inbounds i32, i32* %8, i64 1
  store i32 0, i32* %10, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %11 = getelementptr inbounds i32, i32* %8, i64 2
  store i32 0, i32* %11, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %12 = getelementptr inbounds i32, i32* %8, i64 3
  store i32 0, i32* %12, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  store %struct.nish_array* %3, %struct.nish_array** %done.addr, align 8
  %13 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %13, %struct.ThreadScope** %s.addr, align 8
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = bitcast %struct.ThreadScope* %14 to i8*
  %16 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %17 = call i8* @nish_alloc_struct(i64 16)
  %18 = bitcast i8* %17 to %struct.Shard*
  %19 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  call void @Shard.constructor(%struct.Shard* %18, i32 1, i32 25000, %struct.Bins* %19)
  %20 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Shard$i32$fn.8.binShard(%struct.ThreadScope* %16, %struct.Shard* %18, %struct.nish_array* %20, i32 0)
  %21 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %22 = call i8* @nish_alloc_struct(i64 16)
  %23 = bitcast i8* %22 to %struct.Shard*
  %24 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  call void @Shard.constructor(%struct.Shard* %23, i32 2, i32 25000, %struct.Bins* %24)
  %25 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Shard$i32$fn.8.binShard(%struct.ThreadScope* %21, %struct.Shard* %23, %struct.nish_array* %25, i32 1)
  %26 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %27 = call i8* @nish_alloc_struct(i64 16)
  %28 = bitcast i8* %27 to %struct.Shard*
  %29 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  call void @Shard.constructor(%struct.Shard* %28, i32 3, i32 25000, %struct.Bins* %29)
  %30 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Shard$i32$fn.8.binShard(%struct.ThreadScope* %26, %struct.Shard* %28, %struct.nish_array* %30, i32 2)
  %31 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %32 = call i8* @nish_alloc_struct(i64 16)
  %33 = bitcast i8* %32 to %struct.Shard*
  %34 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  call void @Shard.constructor(%struct.Shard* %33, i32 4, i32 25000, %struct.Bins* %34)
  %35 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Shard$i32$fn.8.binShard(%struct.ThreadScope* %31, %struct.Shard* %33, %struct.nish_array* %35, i32 3)
  call void @nish_scope_join(i8* %15)
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %bytes.addr, align 8
  store i32 1000000, i32* %low.addr, align 4
  store i32 0, i32* %high.addr, align 4
  store i32 0, i32* %b.addr, align 4
  br label %for.cond

for.cond:
  %36 = load i32, i32* %b.addr, align 4
  %37 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %38 = getelementptr inbounds %struct.Bins, %struct.Bins* %37, i32 0, i32 0
  %39 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %38, align 8, !tbaa !4
  %40 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %39, i32 0, i32 0
  %41 = load i32, i32* %40, align 4, !tbaa !10
  %42 = icmp slt i32 %36, %41
  br i1 %42, label %for.body, label %for.end

for.body:
  %43 = load i32, i32* %total.addr, align 4
  %44 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %45 = getelementptr inbounds %struct.Bins, %struct.Bins* %44, i32 0, i32 0
  %46 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %45, align 8, !tbaa !4
  %47 = load i32, i32* %b.addr, align 4
  %48 = call i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* %46, i32 %47)
  %49 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 %48)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %50, i32* %total.addr, align 4
  %52 = load i64, i64* %bytes.addr, align 8
  %53 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %54 = getelementptr inbounds %struct.Bins, %struct.Bins* %53, i32 0, i32 1
  %55 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %54, align 8, !tbaa !5
  %56 = load i32, i32* %b.addr, align 4
  %57 = call i64 @nish.AtomicI64Array.load(%struct.AtomicI64Array* %55, i32 %56)
  %58 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %52, i64 %57)
  %59 = extractvalue { i64, i1 } %58, 0
  %60 = extractvalue { i64, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i64 %59, i64* %bytes.addr, align 8
  %61 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %62 = getelementptr inbounds %struct.Bins, %struct.Bins* %61, i32 0, i32 2
  %63 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %62, align 8, !tbaa !6
  %64 = load i32, i32* %b.addr, align 4
  %65 = call i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* %63, i32 %64)
  %66 = load i32, i32* %low.addr, align 4
  %67 = icmp slt i32 %65, %66
  br i1 %67, label %cond.true, label %cond.false

cond.true:
  %68 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %69 = getelementptr inbounds %struct.Bins, %struct.Bins* %68, i32 0, i32 2
  %70 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %69, align 8, !tbaa !6
  %71 = load i32, i32* %b.addr, align 4
  %72 = call i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* %70, i32 %71)
  br label %cond.end

cond.false:
  %73 = load i32, i32* %low.addr, align 4
  br label %cond.end

cond.end:
  %74 = phi i32 [ %72, %cond.true ], [ %73, %cond.false ]
  store i32 %74, i32* %low.addr, align 4
  %75 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %76 = getelementptr inbounds %struct.Bins, %struct.Bins* %75, i32 0, i32 3
  %77 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %76, align 8, !tbaa !7
  %78 = load i32, i32* %b.addr, align 4
  %79 = call i32 @nish.AtomicI32Array.max(%struct.AtomicI32Array* %77, i32 %78, i32 0)
  %80 = load i32, i32* %high.addr, align 4
  %81 = icmp sgt i32 %79, %80
  br i1 %81, label %cond.true.1, label %cond.false.1

cond.true.1:
  %82 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %83 = getelementptr inbounds %struct.Bins, %struct.Bins* %82, i32 0, i32 3
  %84 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %83, align 8, !tbaa !7
  %85 = load i32, i32* %b.addr, align 4
  %86 = call i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* %84, i32 %85)
  br label %cond.end.1

cond.false.1:
  %87 = load i32, i32* %high.addr, align 4
  br label %cond.end.1

cond.end.1:
  %88 = phi i32 [ %86, %cond.true.1 ], [ %87, %cond.false.1 ]
  store i32 %88, i32* %high.addr, align 4
  br label %for.inc

for.inc:
  %89 = load i32, i32* %b.addr, align 4
  %90 = add nsw i32 %89, 1
  store i32 %90, i32* %b.addr, align 4
  br label %for.cond

for.end:
  %91 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %94 = icmp ult i64 0, %93
  br i1 %94, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %93)
  unreachable

bounds.ok:
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %97 = bitcast i8* %96 to i32*
  %98 = getelementptr inbounds i32, i32* %97, i64 0
  %99 = load i32, i32* %98, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %100 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 0
  %102 = load i64, i64* %101, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %103 = icmp ult i64 1, %102
  br i1 %103, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %102)
  unreachable

bounds.ok.1:
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 2
  %105 = load i8*, i8** %104, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %106 = bitcast i8* %105 to i32*
  %107 = getelementptr inbounds i32, i32* %106, i64 1
  %108 = load i32, i32* %107, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %109 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %99, i32 %108)
  %110 = extractvalue { i32, i1 } %109, 0
  %111 = extractvalue { i32, i1 } %109, 1
  br i1 %111, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %112 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 0
  %114 = load i64, i64* %113, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %115 = icmp ult i64 2, %114
  br i1 %115, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %114)
  unreachable

bounds.ok.2:
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 2
  %117 = load i8*, i8** %116, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %118 = bitcast i8* %117 to i32*
  %119 = getelementptr inbounds i32, i32* %118, i64 2
  %120 = load i32, i32* %119, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %121 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %110, i32 %120)
  %122 = extractvalue { i32, i1 } %121, 0
  %123 = extractvalue { i32, i1 } %121, 1
  br i1 %123, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %124 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 0
  %126 = load i64, i64* %125, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %127 = icmp ult i64 3, %126
  br i1 %127, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %126)
  unreachable

bounds.ok.3:
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 2
  %129 = load i8*, i8** %128, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %130 = bitcast i8* %129 to i32*
  %131 = getelementptr inbounds i32, i32* %130, i64 3
  %132 = load i32, i32* %131, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %133 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %122, i32 %132)
  %134 = extractvalue { i32, i1 } %133, 0
  %135 = extractvalue { i32, i1 } %133, 1
  br i1 %135, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %136 = call i8* @nish_str_from_i32(i32 %134)
  %137 = call i8* @nish_str_concat(i8* %136, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %138 = load i32, i32* %total.addr, align 4
  %139 = call i8* @nish_str_from_i32(i32 %138)
  %140 = call i8* @nish_str_concat(i8* %137, i8* %139)
  %141 = call i8* @nish_str_concat(i8* %140, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %142 = load i64, i64* %bytes.addr, align 8
  %143 = call i8* @nish_str_from_i64(i64 %142)
  %144 = call i8* @nish_str_concat(i8* %141, i8* %143)
  %145 = call i8* @nish_str_concat(i8* %144, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %146 = load i32, i32* %low.addr, align 4
  %147 = call i8* @nish_str_from_i32(i32 %146)
  %148 = call i8* @nish_str_concat(i8* %145, i8* %147)
  %149 = call i8* @nish_str_concat(i8* %148, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %150 = load i32, i32* %high.addr, align 4
  %151 = call i8* @nish_str_from_i32(i32 %150)
  %152 = call i8* @nish_str_concat(i8* %149, i8* %151)
  call void @nish_print(i8* %152)
  %153 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %154 = getelementptr inbounds %struct.Bins, %struct.Bins* %153, i32 0, i32 0
  %155 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %154, align 8, !tbaa !4
  %156 = call i32 @nish.AtomicI32Array.exchange(%struct.AtomicI32Array* %155, i32 0, i32 7)
  store i32 %156, i32* %was.addr, align 4
  %157 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %158 = getelementptr inbounds %struct.Bins, %struct.Bins* %157, i32 0, i32 0
  %159 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %158, align 8, !tbaa !4
  %160 = call i32 @nish.AtomicI32Array.compareExchange(%struct.AtomicI32Array* %159, i32 0, i32 7, i32 9)
  store i32 %160, i32* %seen.addr, align 4
  %161 = load i32, i32* %was.addr, align 4
  %162 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %163 = getelementptr inbounds %struct.Bins, %struct.Bins* %162, i32 0, i32 0
  %164 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %163, align 8, !tbaa !4
  %165 = call i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* %164, i32 0)
  %166 = icmp eq i32 %161, %165
  br i1 %166, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %167 = phi i32 [ 1, %cond.true.2 ], [ 0, %cond.false.2 ]
  %168 = call i8* @nish_str_from_i32(i32 %167)
  %169 = call i8* @nish_str_concat(i8* %168, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %170 = load i32, i32* %seen.addr, align 4
  %171 = call i8* @nish_str_from_i32(i32 %170)
  %172 = call i8* @nish_str_concat(i8* %169, i8* %171)
  %173 = call i8* @nish_str_concat(i8* %172, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %174 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %175 = getelementptr inbounds %struct.Bins, %struct.Bins* %174, i32 0, i32 0
  %176 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %175, align 8, !tbaa !4
  %177 = call i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* %176, i32 0)
  %178 = call i8* @nish_str_from_i32(i32 %177)
  %179 = call i8* @nish_str_concat(i8* %173, i8* %178)
  %180 = call i8* @nish_str_concat(i8* %179, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %181 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %182 = getelementptr inbounds %struct.Bins, %struct.Bins* %181, i32 0, i32 0
  %183 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %182, align 8, !tbaa !4
  %184 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %183, i32 0, i32 0
  %185 = load i32, i32* %184, align 4, !tbaa !10
  %186 = call i8* @nish_str_from_i32(i32 %185)
  %187 = call i8* @nish_str_concat(i8* %180, i8* %186)
  call void @nish_print(i8* %187)
  store i64 5000000000, i64* %big.addr, align 8
  store i64 -7, i64* %small.addr, align 8
  %188 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %189 = getelementptr inbounds %struct.Bins, %struct.Bins* %188, i32 0, i32 1
  %190 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %189, align 8, !tbaa !5
  %191 = load i64, i64* %big.addr, align 8
  call void @nish.AtomicI64Array.store(%struct.AtomicI64Array* %190, i32 1, i64 %191)
  %192 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %193 = getelementptr inbounds %struct.Bins, %struct.Bins* %192, i32 0, i32 1
  %194 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %193, align 8, !tbaa !5
  %195 = load i64, i64* %small.addr, align 8
  %196 = call i64 @nish.AtomicI64Array.min(%struct.AtomicI64Array* %194, i32 1, i64 %195)
  store i64 %196, i64* %before.addr, align 8
  %197 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %198 = getelementptr inbounds %struct.Bins, %struct.Bins* %197, i32 0, i32 1
  %199 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %198, align 8, !tbaa !5
  %200 = load i64, i64* %big.addr, align 8
  %201 = call i64 @nish.AtomicI64Array.max(%struct.AtomicI64Array* %199, i32 1, i64 %200)
  store i64 %201, i64* %lowest.addr, align 8
  %202 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %203 = getelementptr inbounds %struct.Bins, %struct.Bins* %202, i32 0, i32 1
  %204 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %203, align 8, !tbaa !5
  %205 = load i64, i64* %small.addr, align 8
  %206 = call i64 @nish.AtomicI64Array.exchange(%struct.AtomicI64Array* %204, i32 1, i64 %205)
  store i64 %206, i64* %swapped.addr, align 8
  %207 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %208 = getelementptr inbounds %struct.Bins, %struct.Bins* %207, i32 0, i32 1
  %209 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %208, align 8, !tbaa !5
  %210 = load i64, i64* %small.addr, align 8
  %211 = load i64, i64* %big.addr, align 8
  %212 = call i64 @nish.AtomicI64Array.compareExchange(%struct.AtomicI64Array* %209, i32 1, i64 %210, i64 %211)
  store i64 %212, i64* %kept.addr, align 8
  %213 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %214 = getelementptr inbounds %struct.Bins, %struct.Bins* %213, i32 0, i32 1
  %215 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %214, align 8, !tbaa !5
  %216 = load i64, i64* %small.addr, align 8
  %217 = load i64, i64* %small.addr, align 8
  %218 = call i64 @nish.AtomicI64Array.compareExchange(%struct.AtomicI64Array* %215, i32 1, i64 %216, i64 %217)
  store i64 %218, i64* %missed.addr, align 8
  %219 = load i64, i64* %before.addr, align 8
  %220 = call i8* @nish_str_from_i64(i64 %219)
  %221 = call i8* @nish_str_concat(i8* %220, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %222 = load i64, i64* %lowest.addr, align 8
  %223 = call i8* @nish_str_from_i64(i64 %222)
  %224 = call i8* @nish_str_concat(i8* %221, i8* %223)
  %225 = call i8* @nish_str_concat(i8* %224, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %226 = load i64, i64* %swapped.addr, align 8
  %227 = call i8* @nish_str_from_i64(i64 %226)
  %228 = call i8* @nish_str_concat(i8* %225, i8* %227)
  %229 = call i8* @nish_str_concat(i8* %228, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %230 = load i64, i64* %kept.addr, align 8
  %231 = call i8* @nish_str_from_i64(i64 %230)
  %232 = call i8* @nish_str_concat(i8* %229, i8* %231)
  %233 = call i8* @nish_str_concat(i8* %232, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %234 = load i64, i64* %missed.addr, align 8
  %235 = call i8* @nish_str_from_i64(i64 %234)
  %236 = call i8* @nish_str_concat(i8* %233, i8* %235)
  %237 = call i8* @nish_str_concat(i8* %236, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %238 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %239 = getelementptr inbounds %struct.Bins, %struct.Bins* %238, i32 0, i32 1
  %240 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %239, align 8, !tbaa !5
  %241 = call i64 @nish.AtomicI64Array.load(%struct.AtomicI64Array* %240, i32 1)
  %242 = call i8* @nish_str_from_i64(i64 %241)
  %243 = call i8* @nish_str_concat(i8* %237, i8* %242)
  %244 = call i8* @nish_str_concat(i8* %243, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %245 = load %struct.Bins*, %struct.Bins** %bins.addr, align 8
  %246 = getelementptr inbounds %struct.Bins, %struct.Bins* %245, i32 0, i32 1
  %247 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %246, align 8, !tbaa !5
  %248 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %247, i32 0, i32 0
  %249 = load i32, i32* %248, align 4, !tbaa !29
  %250 = call i8* @nish_str_from_i32(i32 %249)
  %251 = call i8* @nish_str_concat(i8* %244, i8* %250)
  call void @nish_print(i8* %251)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!30, !31, !32, !33, !34}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Bins", !2, i64 0, !2, i64 8, !2, i64 16, !2, i64 24}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 8}
!6 = !{!3, !2, i64 16}
!7 = !{!3, !2, i64 24}
!8 = !{!"i32", !1, i64 0}
!9 = !{!"AtomicI32Array", !8, i64 0, !2, i64 8}
!10 = !{!9, !8, i64 0}
!11 = !{!"Shard", !8, i64 0, !8, i64 4, !2, i64 8}
!12 = !{!11, !8, i64 0}
!13 = !{!11, !8, i64 4}
!14 = !{!11, !2, i64 8}
!15 = !{!"nish array"}
!16 = !{!"header", !15}
!17 = !{!"elements", !15}
!18 = !{!16}
!19 = !{!17}
!20 = !{!"header i64", !1, i64 0}
!21 = !{!"header ptr", !1, i64 0}
!22 = !{!"array header", !20, i64 0, !20, i64 8, !21, i64 16}
!23 = !{!22, !20, i64 0}
!24 = !{!22, !20, i64 8}
!25 = !{!22, !21, i64 16}
!26 = !{!"element i32", !1, i64 0}
!27 = !{!26, !26, i64 0}
!28 = !{!"AtomicI64Array", !8, i64 0, !2, i64 8}
!29 = !{!28, !8, i64 0}
!30 = !{i32 8, !"cf-protection-branch", i32 1}
!31 = !{i32 8, !"cf-protection-return", i32 1}
!32 = !{i32 8, !"branch-target-enforcement", i32 1}
!33 = !{i32 8, !"sign-return-address", i32 1}
!34 = !{i32 4, !"probe-stack", !"inline-asm"}
