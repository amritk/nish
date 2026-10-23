%struct.Tally = type { i32, i32 }
%struct.Weights = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"nish\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.24.Weights.scaledSum$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, %struct.nish_array* noundef, %struct.Weights* noundef) #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.18.scaledParts$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, %struct.nish_array* noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.18.scaledParts$arrow1(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, %struct.nish_array* noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.15.weighted$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, %struct.nish_array* noundef, %struct.Weights* noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, %struct.nish_array* noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, %struct.nish_array* noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i8* noundef, %struct.Mutex$$Tally* noundef, i32 noundef) #0
declare void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(8)) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(8)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #0
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

define internal noundef i32 @Weights.scaledSum(%struct.Weights* noundef nonnull align 8 dereferenceable(4) %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %self.addr = alloca %struct.Weights*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store %struct.Weights* %this, %struct.Weights** %self.addr, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %8 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %8, %struct.ThreadScope** %s.addr, align 8
  %9 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %10 = bitcast %struct.ThreadScope* %9 to i8*
  %11 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %13 = load %struct.Weights*, %struct.Weights** %self.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.24.Weights.scaledSum$arrow0(%struct.ThreadScope* %11, i32 1, %struct.nish_array* %12, i32 0, %struct.nish_array* %xs, %struct.Weights* %13)
  call void @nish_scope_join(i8* %10)
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 0, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 0
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %22
}

define internal noundef i32 @sumOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
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
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %t.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %t.addr, align 4
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @addTo(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %n) #0 {
entry:
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %0 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %tally)
  store %struct.MutexGuard$$Tally* %0, %struct.MutexGuard$$Tally** %g.addr, align 8
  %1 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %2 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %1, i32 0, i32 1
  %3 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %4 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %3, i32 0, i32 0
  %5 = load %struct.Tally*, %struct.Tally** %4, align 8, !tbaa !18
  %6 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %7 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %6, i32 0, i32 0
  %8 = load %struct.Tally*, %struct.Tally** %7, align 8, !tbaa !18
  %9 = getelementptr inbounds %struct.Tally, %struct.Tally* %8, i32 0, i32 0
  %10 = load i32, i32* %9, align 4, !tbaa !20
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %n)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = getelementptr inbounds %struct.Tally, %struct.Tally* %5, i32 0, i32 0
  store i32 %12, i32* %14, align 4, !tbaa !20
  %15 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %16 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %15, i32 0, i32 0
  %17 = load %struct.Tally*, %struct.Tally** %16, align 8, !tbaa !18
  %18 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %19 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %18, i32 0, i32 0
  %20 = load %struct.Tally*, %struct.Tally** %19, align 8, !tbaa !18
  %21 = getelementptr inbounds %struct.Tally, %struct.Tally* %20, i32 0, i32 1
  %22 = load i32, i32* %21, align 4, !tbaa !21
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 1)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %26 = getelementptr inbounds %struct.Tally, %struct.Tally* %17, i32 0, i32 1
  store i32 %24, i32* %26, align 4, !tbaa !21
  store atomic i32 0, i32* %2 release, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @scaledParts(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ys, i32 noundef %scale) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
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
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.18.scaledParts$arrow0(%struct.ThreadScope* %12, i32 0, %struct.nish_array* %13, i32 0, %struct.nish_array* %xs, i32 %scale)
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.18.scaledParts$arrow1(%struct.ThreadScope* %14, i32 1, %struct.nish_array* %15, i32 1, %struct.nish_array* %ys, i32 %scale)
  call void @nish_scope_join(i8* %11)
  %16 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 0, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 0
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = icmp ult i64 1, %27
  br i1 %28, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %27)
  unreachable

bounds.ok.1:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 1
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %35

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @weighted(%struct.Weights* noundef readonly align 8 nocapture %w, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp ne %struct.Weights* %w, null
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %2, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.15.weighted$arrow0(%struct.ThreadScope* %12, i32 0, %struct.nish_array* %13, i32 0, %struct.nish_array* %xs, %struct.Weights* %w)
  call void @nish_scope_join(i8* %11)
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 0, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 0
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %22

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -1
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %word.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  %tally.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj = alloca %struct.Mutex$$Tally, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %w.addr = alloca %struct.Weights*, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 4, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast [2 x i32]* %arr.data.1 to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %11 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  store i32 10, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i32, i32* %13, i64 1
  store i32 20, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ys.addr, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  store i32 7, i32* %k.addr, align 4
  %16 = call i8* @nish_alloc_struct(i64 8)
  %17 = bitcast i8* %16 to %struct.Tally*
  %18 = getelementptr inbounds %struct.Tally, %struct.Tally* %17, i32 0, i32 0
  store i32 0, i32* %18, align 4, !tbaa !20
  %19 = getelementptr inbounds %struct.Tally, %struct.Tally* %17, i32 0, i32 1
  store i32 0, i32* %19, align 4, !tbaa !21
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Tally* %17)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Mutex$$Tally** %tally.addr, align 8
  %20 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %20, %struct.ThreadScope** %s.addr, align 8
  %21 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %22 = bitcast %struct.ThreadScope* %21 to i8*
  %23 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %24 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0(%struct.ThreadScope* %23, %struct.Mutex$$Tally* %24, %struct.nish_array* %25)
  %26 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %27 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %29 = load i32, i32* %k.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1(%struct.ThreadScope* %26, %struct.Mutex$$Tally* %27, %struct.nish_array* %28, i32 %29)
  %30 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %31 = load i8*, i8** %word.addr, align 8
  %32 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %33 = load i32, i32* %k.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2(%struct.ThreadScope* %30, i8* %31, %struct.Mutex$$Tally* %32, i32 %33)
  call void @nish_scope_join(i8* %22)
  %34 = call i8* @nish_alloc_struct(i64 4)
  %35 = bitcast i8* %34 to %struct.Weights*
  %36 = getelementptr inbounds %struct.Weights, %struct.Weights* %35, i32 0, i32 0
  store i32 3, i32* %36, align 4, !tbaa !23
  store %struct.Weights* %35, %struct.Weights** %w.addr, align 8
  %37 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %39 = call i32 @scaledParts(%struct.nish_array* %37, %struct.nish_array* %38, i32 2)
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %42 = load %struct.Weights*, %struct.Weights** %w.addr, align 8
  %43 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %44 = call i32 @weighted(%struct.Weights* %42, %struct.nish_array* %43)
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %41, i8* %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %48 = load %struct.Weights*, %struct.Weights** %w.addr, align 8
  %49 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %50 = call i32 @Weights.scaledSum(%struct.Weights* %48, %struct.nish_array* %49)
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* %47, i8* %51)
  call void @nish_print(i8* %52)
  %53 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %54 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %53)
  store %struct.MutexGuard$$Tally* %54, %struct.MutexGuard$$Tally** %g.addr, align 8
  %55 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %56 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %55, i32 0, i32 1
  %57 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %58 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %57, i32 0, i32 0
  %59 = load %struct.Tally*, %struct.Tally** %58, align 8, !tbaa !18
  %60 = getelementptr inbounds %struct.Tally, %struct.Tally* %59, i32 0, i32 0
  %61 = load i32, i32* %60, align 4, !tbaa !20
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %64 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %65 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %64, i32 0, i32 0
  %66 = load %struct.Tally*, %struct.Tally** %65, align 8, !tbaa !18
  %67 = getelementptr inbounds %struct.Tally, %struct.Tally* %66, i32 0, i32 1
  %68 = load i32, i32* %67, align 4, !tbaa !21
  %69 = call i8* @nish_str_from_i32(i32 %68)
  %70 = call i8* @nish_str_concat(i8* %63, i8* %69)
  call void @nish_print(i8* %70)
  store atomic i32 0, i32* %56 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @Weights.scaledSum$arrow0(i32 noundef %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.Weights* noundef nonnull readonly align 8 dereferenceable(4) nocapture %self) #0 {
entry:
  %0 = call i32 @sumOf(%struct.nish_array* %xs)
  %1 = getelementptr inbounds %struct.Weights, %struct.Weights* %self, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !23
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %k)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %7

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @scaledParts$arrow0(i32 noundef %n, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %scale) #0 {
entry:
  %0 = call i32 @sumOf(%struct.nish_array* %xs)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 %scale)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %n)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %5

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @scaledParts$arrow1(i32 noundef %n, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ys, i32 noundef %scale) #0 {
entry:
  %0 = call i32 @sumOf(%struct.nish_array* %ys)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 %scale)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %n)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %5

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @weighted$arrow0(i32 noundef %n, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.Weights* noundef nonnull readonly align 8 dereferenceable(4) nocapture %w) #0 {
entry:
  %0 = call i32 @sumOf(%struct.nish_array* %xs)
  %1 = getelementptr inbounds %struct.Weights, %struct.Weights* %w, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !23
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %n)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %7

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden void @nish_main$arrow0(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %0 = call i32 @sumOf(%struct.nish_array* %xs)
  call void @addTo(%struct.Mutex$$Tally* %tally, i32 %0)
  ret void
}

define hidden void @nish_main$arrow1(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ys, i32 noundef %k) #0 {
entry:
  %0 = call i32 @sumOf(%struct.nish_array* %ys)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %k)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @addTo(%struct.Mutex$$Tally* %tally, i32 %2)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden void @nish_main$arrow2(i8* noundef nonnull noalias readonly align 8 nocapture %word, %struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %k) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = bitcast i8* %word to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = load i32, i32* %n.addr, align 4
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %3, i32 %k)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @addTo(%struct.Mutex$$Tally* %tally, i32 %5)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
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
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"i32", !6, i64 0}
!17 = !{!"MutexGuard$$Tally", !15, i64 0, !16, i64 8}
!18 = !{!17, !15, i64 0}
!19 = !{!"Tally", !16, i64 0, !16, i64 4}
!20 = !{!19, !16, i64 0}
!21 = !{!19, !16, i64 4}
!22 = !{!"Weights", !16, i64 0}
!23 = !{!22, !16, i64 0}
