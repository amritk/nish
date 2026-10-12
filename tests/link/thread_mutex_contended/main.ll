%struct.Hist = type { { %struct.nish_array, [8 x i32] } }
%struct.Job = type { i32, i32, %struct.Mutex$$Hist* }
%struct.Mutex$$Hist = type { %struct.MutexGuard$$Hist* }
%struct.MutexGuard$$Hist = type { %struct.Hist*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Job$i32$fn.9.binStream(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Job* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
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
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #0
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #1
declare void @nish_mutex_wake(i32* noundef nonnull) #1
declare i32 @llvm.fptosi.sat.i32.f64(double) #4
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

define internal void @Job.constructor(%struct.Job* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %seed, i32 noundef %count, %struct.Mutex$$Hist* noundef nonnull align 8 dereferenceable(8) %hist) #0 {
entry:
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 0
  store i32 %seed, i32* %0, align 4, !tbaa !16
  %1 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 1
  store i32 %count, i32* %1, align 4, !tbaa !17
  %2 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 2
  store %struct.Mutex$$Hist* %hist, %struct.Mutex$$Hist** %2, align 8, !tbaa !18
  ret void
}

define hidden noundef i32 @binStream(%struct.Job* noundef nonnull readonly align 8 dereferenceable(16) nocapture %j) #1 {
entry:
  %v.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %bin.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Hist*, align 8
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %j, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !16
  store i32 %1, i32* %v.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.Job, %struct.Job* %j, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !17
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
  %15 = and i32 %14, 7
  store i32 %15, i32* %bin.addr, align 4
  %16 = getelementptr inbounds %struct.Job, %struct.Job* %j, i32 0, i32 2
  %17 = load %struct.Mutex$$Hist*, %struct.Mutex$$Hist** %16, align 8, !tbaa !18
  %18 = call %struct.MutexGuard$$Hist* @nish.Mutex$$Hist.lock(%struct.Mutex$$Hist* %17)
  store %struct.MutexGuard$$Hist* %18, %struct.MutexGuard$$Hist** %g.addr, align 8
  %19 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %20 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %19, i32 0, i32 1
  %21 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %22 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %21, i32 0, i32 0
  %23 = load %struct.Hist*, %struct.Hist** %22, align 8, !tbaa !20
  %24 = getelementptr inbounds %struct.Hist, %struct.Hist* %23, i32 0, i32 0, i32 0
  %25 = load i32, i32* %bin.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %28 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %27, i32 0, i32 0
  %29 = load %struct.Hist*, %struct.Hist** %28, align 8, !tbaa !20
  %30 = getelementptr inbounds %struct.Hist, %struct.Hist* %29, i32 0, i32 0, i32 0
  %31 = load i32, i32* %bin.addr, align 4
  %32 = sext i32 %31 to i64
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = icmp ult i64 %32, %34
  br i1 %35, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %32, i64 %34)
  unreachable

bounds.ok:
  %36 = getelementptr inbounds %struct.Hist, %struct.Hist* %29, i32 0, i32 0, i32 1, i64 0
  %37 = bitcast i32* %36 to i8*
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %32
  %40 = load i32, i32* %39, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %40, i32 1)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %44 = getelementptr inbounds %struct.Hist, %struct.Hist* %23, i32 0, i32 0, i32 1, i64 0
  %45 = bitcast i32* %44 to i8*
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %26
  store i32 %42, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %48 = atomicrmw xchg i32* %20, i32 0 release
  %49 = icmp eq i32 %48, 2
  br i1 %49, label %unlock.wake, label %unlock.done

unlock.wake:
  call void @nish_mutex_wake(i32* %20)
  br label %unlock.done

unlock.done:
  br label %for.inc

for.inc:
  %50 = load i32, i32* %i.addr, align 4
  %51 = add nsw i32 %50, 1
  store i32 %51, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %52 = getelementptr inbounds %struct.Job, %struct.Job* %j, i32 0, i32 1
  %53 = load i32, i32* %52, align 4, !tbaa !17
  ret i32 %53

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ], [ 0, %bounds.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %rounds.addr = alloca i32, align 4
  %tasks.addr = alloca i32, align 4
  %count.addr = alloca i32, align 4
  %hist.addr = alloca %struct.Mutex$$Hist*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %check.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %binned.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %t.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Hist*, align 8
  %b.addr = alloca i32, align 4
  %t.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = icmp ult i64 1, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 1
  %13 = load i8*, i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !23
  %14 = call double @nish_parse_number(i8* %13, i32 2)
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %16 = phi i32 [ %15, %bounds.ok ], [ 4, %cond.false ]
  store i32 %16, i32* %rounds.addr, align 4
  store i32 8, i32* %tasks.addr, align 4
  store i32 20000, i32* %count.addr, align 4
  %17 = call i8* @nish_alloc_struct(i64 8)
  %18 = bitcast i8* %17 to %struct.Mutex$$Hist*
  %19 = call i8* @nish_alloc_struct(i64 56)
  %20 = bitcast i8* %19 to %struct.Hist*
  %21 = getelementptr inbounds %struct.Hist, %struct.Hist* %20, i32 0, i32 0, i32 0
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 8, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !24
  %24 = getelementptr inbounds %struct.Hist, %struct.Hist* %20, i32 0, i32 0, i32 1, i64 0
  %25 = bitcast i32* %24 to i8*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %25, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  call void @Hist.constructor(%struct.Hist* %20)
  call void @nish.Mutex$$Hist.constructor(%struct.Mutex$$Hist* %18, %struct.Hist* %20)
  store %struct.Mutex$$Hist* %18, %struct.Mutex$$Hist** %hist.addr, align 8
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 8, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 8, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !24
  %31 = call i8* @nish_alloc_struct(i64 32)
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* %31, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  %33 = bitcast i8* %31 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 0
  store i32 0, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %35 = getelementptr inbounds i32, i32* %33, i64 1
  store i32 0, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %36 = getelementptr inbounds i32, i32* %33, i64 2
  store i32 0, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %37 = getelementptr inbounds i32, i32* %33, i64 3
  store i32 0, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %38 = getelementptr inbounds i32, i32* %33, i64 4
  store i32 0, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %39 = getelementptr inbounds i32, i32* %33, i64 5
  store i32 0, i32* %39, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %40 = getelementptr inbounds i32, i32* %33, i64 6
  store i32 0, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %41 = getelementptr inbounds i32, i32* %33, i64 7
  store i32 0, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store %struct.nish_array* %28, %struct.nish_array** %done.addr, align 8
  store i32 0, i32* %check.addr, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %binned.addr, align 4
  store i32 0, i32* %r.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  br label %for.cond

for.cond:
  %47 = load i32, i32* %r.addr, align 4
  %48 = load i32, i32* %rounds.addr, align 4
  %49 = icmp slt i32 %47, %48
  br i1 %49, label %for.body, label %for.end

for.body:
  %50 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %50, %struct.ThreadScope** %s.addr, align 8
  %51 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %52 = bitcast %struct.ThreadScope* %51 to i8*
  store i32 0, i32* %t.addr, align 4
  br label %for.cond.1

for.cond.1:
  %53 = load i32, i32* %t.addr, align 4
  %54 = load i32, i32* %tasks.addr, align 4
  %55 = icmp slt i32 %53, %54
  br i1 %55, label %for.body.1, label %for.end.1

for.body.1:
  %56 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %57 = call i8* @nish_alloc_struct(i64 16)
  %58 = bitcast i8* %57 to %struct.Job*
  %59 = load i32, i32* %r.addr, align 4
  %60 = load i32, i32* %tasks.addr, align 4
  %61 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %59, i32 %60)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = load i32, i32* %t.addr, align 4
  %65 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %62, i32 %64)
  %66 = extractvalue { i32, i1 } %65, 0
  %67 = extractvalue { i32, i1 } %65, 1
  br i1 %67, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %68 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %69 = extractvalue { i32, i1 } %68, 0
  %70 = extractvalue { i32, i1 } %68, 1
  br i1 %70, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %71 = load i32, i32* %count.addr, align 4
  %72 = load %struct.Mutex$$Hist*, %struct.Mutex$$Hist** %hist.addr, align 8
  call void @Job.constructor(%struct.Job* %58, i32 %69, i32 %71, %struct.Mutex$$Hist* %72)
  %73 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %74 = load i32, i32* %t.addr, align 4
  call void @nish.ThreadScope.spawn$$Job$i32$fn.9.binStream(%struct.ThreadScope* %56, %struct.Job* %58, %struct.nish_array* %73, i32 %74)
  br label %for.inc.1

for.inc.1:
  %75 = load i32, i32* %t.addr, align 4
  %76 = add nsw i32 %75, 1
  store i32 %76, i32* %t.addr, align 4
  br label %for.cond.1

for.end.1:
  call void @nish_scope_join(i8* %52)
  %77 = load %struct.Mutex$$Hist*, %struct.Mutex$$Hist** %hist.addr, align 8
  %78 = call %struct.MutexGuard$$Hist* @nish.Mutex$$Hist.lock(%struct.Mutex$$Hist* %77)
  store %struct.MutexGuard$$Hist* %78, %struct.MutexGuard$$Hist** %g.addr, align 8
  %79 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %80 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %79, i32 0, i32 1
  store i32 0, i32* %b.addr, align 4
  %81 = load %struct.MutexGuard$$Hist*, %struct.MutexGuard$$Hist** %g.addr, align 8
  %82 = getelementptr inbounds %struct.MutexGuard$$Hist, %struct.MutexGuard$$Hist* %81, i32 0, i32 0
  %83 = load %struct.Hist*, %struct.Hist** %82, align 8, !tbaa !20
  %84 = getelementptr inbounds %struct.Hist, %struct.Hist* %83, i32 0, i32 0, i32 0
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = getelementptr inbounds %struct.Hist, %struct.Hist* %83, i32 0, i32 0, i32 1, i64 0
  %88 = bitcast i32* %87 to i8*
  br label %for.cond.2

for.cond.2:
  %89 = load i32, i32* %b.addr, align 4
  %90 = icmp slt i32 %89, 8
  br i1 %90, label %for.body.2, label %for.end.2

for.body.2:
  %91 = load i32, i32* %check.addr, align 4
  %92 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %91, i32 31)
  %93 = extractvalue { i32, i1 } %92, 0
  %94 = extractvalue { i32, i1 } %92, 1
  br i1 %94, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %95 = load i32, i32* %b.addr, align 4
  %96 = sext i32 %95 to i64
  %97 = icmp ult i64 %96, %86
  br i1 %97, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %96, i64 %86)
  unreachable

bounds.ok.1:
  %98 = bitcast i8* %88 to i32*
  %99 = getelementptr inbounds i32, i32* %98, i64 %96
  %100 = load i32, i32* %99, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %101 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %93, i32 %100)
  %102 = extractvalue { i32, i1 } %101, 0
  %103 = extractvalue { i32, i1 } %101, 1
  br i1 %103, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %104 = srem i32 %102, 1000003
  store i32 %104, i32* %check.addr, align 4
  %105 = load i32, i32* %total.addr, align 4
  %106 = load i32, i32* %b.addr, align 4
  %107 = sext i32 %106 to i64
  %108 = bitcast i8* %88 to i32*
  %109 = getelementptr inbounds i32, i32* %108, i64 %107
  %110 = load i32, i32* %109, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %111 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %105, i32 %110)
  %112 = extractvalue { i32, i1 } %111, 0
  %113 = extractvalue { i32, i1 } %111, 1
  br i1 %113, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %112, i32* %total.addr, align 4
  %114 = load i32, i32* %b.addr, align 4
  %115 = sext i32 %114 to i64
  %116 = bitcast i8* %88 to i32*
  %117 = getelementptr inbounds i32, i32* %116, i64 %115
  store i32 0, i32* %117, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  br label %for.inc.2

for.inc.2:
  %118 = load i32, i32* %b.addr, align 4
  %119 = add nsw i32 %118, 1
  store i32 %119, i32* %b.addr, align 4
  br label %for.cond.2

for.end.2:
  store i32 0, i32* %t.addr.1, align 4
  %120 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 0
  %122 = load i64, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %124 = load i8*, i8** %123, align 8, !alias.scope !3, !noalias !4, !tbaa !21
  br label %for.cond.3

for.cond.3:
  %125 = load i32, i32* %t.addr.1, align 4
  %126 = load i32, i32* %tasks.addr, align 4
  %127 = icmp slt i32 %125, %126
  br i1 %127, label %for.body.3, label %for.end.3

for.body.3:
  %128 = load i32, i32* %binned.addr, align 4
  %129 = load i32, i32* %t.addr.1, align 4
  %130 = sext i32 %129 to i64
  %131 = icmp ult i64 %130, %122
  br i1 %131, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %130, i64 %122)
  unreachable

bounds.ok.2:
  %132 = bitcast i8* %124 to i32*
  %133 = getelementptr inbounds i32, i32* %132, i64 %130
  %134 = load i32, i32* %133, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %135 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %128, i32 %134)
  %136 = extractvalue { i32, i1 } %135, 0
  %137 = extractvalue { i32, i1 } %135, 1
  br i1 %137, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %136, i32* %binned.addr, align 4
  br label %for.inc.3

for.inc.3:
  %138 = load i32, i32* %t.addr.1, align 4
  %139 = add nsw i32 %138, 1
  store i32 %139, i32* %t.addr.1, align 4
  br label %for.cond.3

for.end.3:
  %140 = atomicrmw xchg i32* %80, i32 0 release
  %141 = icmp eq i32 %140, 2
  br i1 %141, label %unlock.wake, label %unlock.done

unlock.wake:
  call void @nish_mutex_wake(i32* %80)
  br label %unlock.done

unlock.done:
  br label %for.inc

for.inc:
  %142 = load i32, i32* %r.addr, align 4
  %143 = add nsw i32 %142, 1
  store i32 %143, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %144 = load i32, i32* %check.addr, align 4
  %145 = call i8* @nish_str_from_i32(i32 %144)
  call void @nish_print(i8* %145)
  %146 = load i32, i32* %total.addr, align 4
  %147 = call i8* @nish_str_from_i32(i32 %146)
  %148 = call i8* @nish_str_concat(i8* %147, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %149 = load i32, i32* %binned.addr, align 4
  %150 = call i8* @nish_str_from_i32(i32 %149)
  %151 = call i8* @nish_str_concat(i8* %148, i8* %150)
  call void @nish_print(i8* %151)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body.1 ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 2, %for.body.2 ], [ 0, %bounds.ok.1 ], [ 0, %ovf.ok.4 ], [ 0, %bounds.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
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
!13 = !{!"i32", !6, i64 0}
!14 = !{!"ptr", !6, i64 0}
!15 = !{!"Job", !13, i64 0, !13, i64 4, !14, i64 8}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !13, i64 4}
!18 = !{!15, !14, i64 8}
!19 = !{!"MutexGuard$$Hist", !14, i64 0, !13, i64 8}
!20 = !{!19, !14, i64 0}
!21 = !{!11, !10, i64 16}
!22 = !{!"element ptr", !6, i64 0}
!23 = !{!22, !22, i64 0}
!24 = !{!11, !9, i64 8}
