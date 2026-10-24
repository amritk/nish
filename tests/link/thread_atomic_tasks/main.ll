%struct.Counters = type { %struct.AtomicI32*, %struct.AtomicI64*, %struct.AtomicI32*, %struct.AtomicI32*, i64 }
%struct.Shard = type { i32, i32, %struct.Counters* }
%struct.AtomicI32 = type { i32 }
%struct.AtomicI64 = type { i64 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @nish.AtomicI32.constructor(%struct.AtomicI32* noundef nonnull noalias align 8 dereferenceable(4) nocapture, i32 noundef) #0
declare noundef i32 @nish.AtomicI32.load(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture) #0
declare void @nish.AtomicI32.store(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #0
declare noundef i32 @nish.AtomicI32.add(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #0
declare noundef i32 @nish.AtomicI32.sub(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #0
declare noundef i32 @nish.AtomicI32.min(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #0
declare noundef i32 @nish.AtomicI32.max(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #0
declare noundef i32 @nish.AtomicI32.exchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #0
declare noundef i32 @nish.AtomicI32.compareExchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.AtomicI64.constructor(%struct.AtomicI64* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i64 noundef) #0
declare noundef i64 @nish.AtomicI64.load(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture) #0
declare void @nish.AtomicI64.store(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #0
declare noundef i64 @nish.AtomicI64.add(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #0
declare noundef i64 @nish.AtomicI64.sub(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #0
declare noundef i64 @nish.AtomicI64.min(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #0
declare noundef i64 @nish.AtomicI64.max(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #0
declare noundef i64 @nish.AtomicI64.exchange(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #0
declare noundef i64 @nish.AtomicI64.compareExchange(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef, i64 noundef) #0
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Shard$i32$fn.5.count(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Shard* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.16.nish_main$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, %struct.AtomicI32* noundef) #1
declare void @nish.ThreadScope.spawnWith$$Shard$void$fn.4.undo(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Shard* noundef nonnull align 8 dereferenceable(16)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
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

define internal void @Counters.constructor(%struct.Counters* noundef nonnull noalias align 8 dereferenceable(40) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counters, %struct.Counters* %this, i32 0, i32 4
  store i64 3000000000, i64* %0, align 8, !tbaa !5
  %1 = call i8* @nish_alloc_struct(i64 4)
  %2 = bitcast i8* %1 to %struct.AtomicI32*
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %2, i32 0)
  %3 = getelementptr inbounds %struct.Counters, %struct.Counters* %this, i32 0, i32 0
  store %struct.AtomicI32* %2, %struct.AtomicI32** %3, align 8, !tbaa !6
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.AtomicI64*
  call void @nish.AtomicI64.constructor(%struct.AtomicI64* %5, i64 0)
  %6 = getelementptr inbounds %struct.Counters, %struct.Counters* %this, i32 0, i32 1
  store %struct.AtomicI64* %5, %struct.AtomicI64** %6, align 8, !tbaa !7
  %7 = call i8* @nish_alloc_struct(i64 4)
  %8 = bitcast i8* %7 to %struct.AtomicI32*
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %8, i32 1000000)
  %9 = getelementptr inbounds %struct.Counters, %struct.Counters* %this, i32 0, i32 2
  store %struct.AtomicI32* %8, %struct.AtomicI32** %9, align 8, !tbaa !8
  %10 = call i8* @nish_alloc_struct(i64 4)
  %11 = bitcast i8* %10 to %struct.AtomicI32*
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %11, i32 0)
  %12 = getelementptr inbounds %struct.Counters, %struct.Counters* %this, i32 0, i32 3
  store %struct.AtomicI32* %11, %struct.AtomicI32** %12, align 8, !tbaa !9
  ret void
}

define internal void @Shard.constructor(%struct.Shard* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %seed, i32 noundef %n, %struct.Counters* noundef nonnull align 8 dereferenceable(40) %c) #0 {
entry:
  %0 = getelementptr inbounds %struct.Shard, %struct.Shard* %this, i32 0, i32 0
  store i32 %seed, i32* %0, align 4, !tbaa !12
  %1 = getelementptr inbounds %struct.Shard, %struct.Shard* %this, i32 0, i32 1
  store i32 %n, i32* %1, align 4, !tbaa !13
  %2 = getelementptr inbounds %struct.Shard, %struct.Shard* %this, i32 0, i32 2
  store %struct.Counters* %c, %struct.Counters** %2, align 8, !tbaa !14
  ret void
}

define internal void @raise$(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %a, i32 noundef %v) #1 {
entry:
  %seen.addr = alloca i32, align 4
  %was.addr = alloca i32, align 4
  %0 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %a)
  store i32 %0, i32* %seen.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %seen.addr, align 4
  %2 = icmp slt i32 %1, %v
  br i1 %2, label %while.body, label %while.end

while.body:
  %3 = load i32, i32* %seen.addr, align 4
  %4 = call i32 @nish.AtomicI32.compareExchange(%struct.AtomicI32* %a, i32 %3, i32 %v)
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

define hidden noundef i32 @count$(%struct.Shard* noundef nonnull readonly align 8 dereferenceable(16) nocapture %s) #1 {
entry:
  %v.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !12
  store i32 %1, i32* %v.addr, align 4
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
  %14 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %15 = load %struct.Counters*, %struct.Counters** %14, align 8, !tbaa !14
  %16 = getelementptr inbounds %struct.Counters, %struct.Counters* %15, i32 0, i32 0
  %17 = load %struct.AtomicI32*, %struct.AtomicI32** %16, align 8, !tbaa !6
  %18 = call i32 @nish.AtomicI32.add(%struct.AtomicI32* %17, i32 1)
  %19 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %20 = load %struct.Counters*, %struct.Counters** %19, align 8, !tbaa !14
  %21 = getelementptr inbounds %struct.Counters, %struct.Counters* %20, i32 0, i32 1
  %22 = load %struct.AtomicI64*, %struct.AtomicI64** %21, align 8, !tbaa !7
  %23 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %24 = load %struct.Counters*, %struct.Counters** %23, align 8, !tbaa !14
  %25 = getelementptr inbounds %struct.Counters, %struct.Counters* %24, i32 0, i32 4
  %26 = load i64, i64* %25, align 8, !tbaa !5
  %27 = call i64 @nish.AtomicI64.add(%struct.AtomicI64* %22, i64 %26)
  %28 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %29 = load %struct.Counters*, %struct.Counters** %28, align 8, !tbaa !14
  %30 = getelementptr inbounds %struct.Counters, %struct.Counters* %29, i32 0, i32 2
  %31 = load %struct.AtomicI32*, %struct.AtomicI32** %30, align 8, !tbaa !8
  %32 = load i32, i32* %v.addr, align 4
  %33 = call i32 @nish.AtomicI32.min(%struct.AtomicI32* %31, i32 %32)
  %34 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %35 = load %struct.Counters*, %struct.Counters** %34, align 8, !tbaa !14
  %36 = getelementptr inbounds %struct.Counters, %struct.Counters* %35, i32 0, i32 3
  %37 = load %struct.AtomicI32*, %struct.AtomicI32** %36, align 8, !tbaa !9
  %38 = load i32, i32* %v.addr, align 4
  call void @raise$(%struct.AtomicI32* %37, i32 %38)
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %41 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 1
  %42 = load i32, i32* %41, align 4, !tbaa !13
  ret i32 %42

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden void @undo$(%struct.Shard* noundef nonnull readonly align 8 dereferenceable(16) nocapture %s) #1 {
entry:
  %i.addr = alloca i32, align 4
  %one.addr = alloca i64, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 1
  %2 = load i32, i32* %1, align 4, !tbaa !13
  %3 = icmp slt i32 %0, %2
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %5 = load %struct.Counters*, %struct.Counters** %4, align 8, !tbaa !14
  %6 = getelementptr inbounds %struct.Counters, %struct.Counters* %5, i32 0, i32 0
  %7 = load %struct.AtomicI32*, %struct.AtomicI32** %6, align 8, !tbaa !6
  %8 = call i32 @nish.AtomicI32.sub(%struct.AtomicI32* %7, i32 1)
  store i64 1, i64* %one.addr, align 8
  %9 = getelementptr inbounds %struct.Shard, %struct.Shard* %s, i32 0, i32 2
  %10 = load %struct.Counters*, %struct.Counters** %9, align 8, !tbaa !14
  %11 = getelementptr inbounds %struct.Counters, %struct.Counters* %10, i32 0, i32 1
  %12 = load %struct.AtomicI64*, %struct.AtomicI64** %11, align 8, !tbaa !7
  %13 = load i64, i64* %one.addr, align 8
  %14 = call i64 @nish.AtomicI64.sub(%struct.AtomicI64* %12, i64 %13)
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %c.addr = alloca %struct.Counters*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %extra.addr = alloca %struct.AtomicI32*, align 8
  %AtomicI32.obj = alloca %struct.AtomicI32, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %was.addr = alloca i32, align 4
  %failed.addr = alloca i32, align 4
  %swapped.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 40)
  %1 = bitcast i8* %0 to %struct.Counters*
  call void @Counters.constructor(%struct.Counters* %1)
  store %struct.Counters* %1, %struct.Counters** %c.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 3, i64* %4, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 3, i64* %5, align 8, !alias.scope !18, !noalias !19, !tbaa !24
  %6 = call i8* @nish_alloc_struct(i64 12)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 0, i32* %9, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %10 = getelementptr inbounds i32, i32* %8, i64 1
  store i32 0, i32* %10, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %11 = getelementptr inbounds i32, i32* %8, i64 2
  store i32 0, i32* %11, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  store %struct.nish_array* %3, %struct.nish_array** %done.addr, align 8
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %AtomicI32.obj, i32 0)
  store %struct.AtomicI32* %AtomicI32.obj, %struct.AtomicI32** %extra.addr, align 8
  %12 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %12, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = bitcast %struct.ThreadScope* %13 to i8*
  %15 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %16 = call i8* @nish_alloc_struct(i64 16)
  %17 = bitcast i8* %16 to %struct.Shard*
  %18 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  call void @Shard.constructor(%struct.Shard* %17, i32 1, i32 20000, %struct.Counters* %18)
  %19 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Shard$i32$fn.5.count(%struct.ThreadScope* %15, %struct.Shard* %17, %struct.nish_array* %19, i32 0)
  %20 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %21 = call i8* @nish_alloc_struct(i64 16)
  %22 = bitcast i8* %21 to %struct.Shard*
  %23 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  call void @Shard.constructor(%struct.Shard* %22, i32 2, i32 20000, %struct.Counters* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Shard$i32$fn.5.count(%struct.ThreadScope* %20, %struct.Shard* %22, %struct.nish_array* %24, i32 1)
  %25 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %26 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %27 = load %struct.AtomicI32*, %struct.AtomicI32** %extra.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.16.nish_main$arrow0(%struct.ThreadScope* %25, i32 300, %struct.nish_array* %26, i32 2, %struct.AtomicI32* %27)
  %28 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %29 = call i8* @nish_alloc_struct(i64 16)
  %30 = bitcast i8* %29 to %struct.Shard*
  %31 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  call void @Shard.constructor(%struct.Shard* %30, i32 3, i32 500, %struct.Counters* %31)
  call void @nish.ThreadScope.spawnWith$$Shard$void$fn.4.undo(%struct.ThreadScope* %28, %struct.Shard* %30)
  call void @nish_scope_join(i8* %14)
  %32 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %33 = getelementptr inbounds %struct.Counters, %struct.Counters* %32, i32 0, i32 0
  %34 = load %struct.AtomicI32*, %struct.AtomicI32** %33, align 8, !tbaa !6
  %35 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %34)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %38 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %39 = getelementptr inbounds %struct.Counters, %struct.Counters* %38, i32 0, i32 1
  %40 = load %struct.AtomicI64*, %struct.AtomicI64** %39, align 8, !tbaa !7
  %41 = call i64 @nish.AtomicI64.load(%struct.AtomicI64* %40)
  %42 = call i8* @nish_str_from_i64(i64 %41)
  %43 = call i8* @nish_str_concat(i8* %37, i8* %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %45 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %46 = getelementptr inbounds %struct.Counters, %struct.Counters* %45, i32 0, i32 2
  %47 = load %struct.AtomicI32*, %struct.AtomicI32** %46, align 8, !tbaa !8
  %48 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %47)
  %49 = call i8* @nish_str_from_i32(i32 %48)
  %50 = call i8* @nish_str_concat(i8* %44, i8* %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %52 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %53 = getelementptr inbounds %struct.Counters, %struct.Counters* %52, i32 0, i32 3
  %54 = load %struct.AtomicI32*, %struct.AtomicI32** %53, align 8, !tbaa !9
  %55 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %54)
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* %51, i8* %56)
  call void @nish_print(i8* %57)
  %58 = load %struct.AtomicI32*, %struct.AtomicI32** %extra.addr, align 8
  %59 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %58)
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %62 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %65 = icmp ult i64 0, %64
  br i1 %65, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %64)
  unreachable

bounds.ok:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %68 = bitcast i8* %67 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 0
  %70 = load i32, i32* %69, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %71 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %74 = icmp ult i64 1, %73
  br i1 %74, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %73)
  unreachable

bounds.ok.1:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %77 = bitcast i8* %76 to i32*
  %78 = getelementptr inbounds i32, i32* %77, i64 1
  %79 = load i32, i32* %78, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %80 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %70, i32 %79)
  %81 = extractvalue { i32, i1 } %80, 0
  %82 = extractvalue { i32, i1 } %80, 1
  br i1 %82, label %ovf.fail, label %ovf.ok

ovf.ok:
  %83 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %86 = icmp ult i64 2, %85
  br i1 %86, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %85)
  unreachable

bounds.ok.2:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %89 = bitcast i8* %88 to i32*
  %90 = getelementptr inbounds i32, i32* %89, i64 2
  %91 = load i32, i32* %90, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %92 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %81, i32 %91)
  %93 = extractvalue { i32, i1 } %92, 0
  %94 = extractvalue { i32, i1 } %92, 1
  br i1 %94, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %95 = call i8* @nish_str_from_i32(i32 %93)
  %96 = call i8* @nish_str_concat(i8* %61, i8* %95)
  call void @nish_print(i8* %96)
  %97 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %98 = getelementptr inbounds %struct.Counters, %struct.Counters* %97, i32 0, i32 0
  %99 = load %struct.AtomicI32*, %struct.AtomicI32** %98, align 8, !tbaa !6
  %100 = call i32 @nish.AtomicI32.exchange(%struct.AtomicI32* %99, i32 7)
  store i32 %100, i32* %was.addr, align 4
  %101 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %102 = getelementptr inbounds %struct.Counters, %struct.Counters* %101, i32 0, i32 0
  %103 = load %struct.AtomicI32*, %struct.AtomicI32** %102, align 8, !tbaa !6
  %104 = call i32 @nish.AtomicI32.compareExchange(%struct.AtomicI32* %103, i32 8, i32 1)
  store i32 %104, i32* %failed.addr, align 4
  %105 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %106 = getelementptr inbounds %struct.Counters, %struct.Counters* %105, i32 0, i32 0
  %107 = load %struct.AtomicI32*, %struct.AtomicI32** %106, align 8, !tbaa !6
  %108 = call i32 @nish.AtomicI32.compareExchange(%struct.AtomicI32* %107, i32 7, i32 2)
  store i32 %108, i32* %swapped.addr, align 4
  %109 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %110 = getelementptr inbounds %struct.Counters, %struct.Counters* %109, i32 0, i32 2
  %111 = load %struct.AtomicI32*, %struct.AtomicI32** %110, align 8, !tbaa !8
  call void @nish.AtomicI32.store(%struct.AtomicI32* %111, i32 -5)
  %112 = load i32, i32* %was.addr, align 4
  %113 = call i8* @nish_str_from_i32(i32 %112)
  %114 = call i8* @nish_str_concat(i8* %113, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %115 = load i32, i32* %failed.addr, align 4
  %116 = call i8* @nish_str_from_i32(i32 %115)
  %117 = call i8* @nish_str_concat(i8* %114, i8* %116)
  %118 = call i8* @nish_str_concat(i8* %117, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %119 = load i32, i32* %swapped.addr, align 4
  %120 = call i8* @nish_str_from_i32(i32 %119)
  %121 = call i8* @nish_str_concat(i8* %118, i8* %120)
  %122 = call i8* @nish_str_concat(i8* %121, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %123 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %124 = getelementptr inbounds %struct.Counters, %struct.Counters* %123, i32 0, i32 0
  %125 = load %struct.AtomicI32*, %struct.AtomicI32** %124, align 8, !tbaa !6
  %126 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %125)
  %127 = call i8* @nish_str_from_i32(i32 %126)
  %128 = call i8* @nish_str_concat(i8* %122, i8* %127)
  %129 = call i8* @nish_str_concat(i8* %128, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %130 = load %struct.Counters*, %struct.Counters** %c.addr, align 8
  %131 = getelementptr inbounds %struct.Counters, %struct.Counters* %130, i32 0, i32 2
  %132 = load %struct.AtomicI32*, %struct.AtomicI32** %131, align 8, !tbaa !8
  %133 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %132)
  %134 = call i8* @nish_str_from_i32(i32 %133)
  %135 = call i8* @nish_str_concat(i8* %129, i8* %134)
  call void @nish_print(i8* %135)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %n, %struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %extra) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i32 @nish.AtomicI32.add(%struct.AtomicI32* %extra, i32 %2)
  %4 = call i32 @nish.AtomicI32.max(%struct.AtomicI32* %extra, i32 0)
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 %n
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
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i64", !1, i64 0}
!4 = !{!"Counters", !2, i64 0, !2, i64 8, !2, i64 16, !2, i64 24, !3, i64 32}
!5 = !{!4, !3, i64 32}
!6 = !{!4, !2, i64 0}
!7 = !{!4, !2, i64 8}
!8 = !{!4, !2, i64 16}
!9 = !{!4, !2, i64 24}
!10 = !{!"i32", !1, i64 0}
!11 = !{!"Shard", !10, i64 0, !10, i64 4, !2, i64 8}
!12 = !{!11, !10, i64 0}
!13 = !{!11, !10, i64 4}
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
