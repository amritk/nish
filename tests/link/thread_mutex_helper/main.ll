%struct.Counter = type { i32, i8*, { %struct.nish_array, [4 x i32] } }
%struct.Job = type { i32, %struct.Mutex$$Counter* }
%struct.Mutex$$Counter = type { %struct.MutexGuard$$Counter* }
%struct.MutexGuard$$Counter = type { %struct.Counter*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"set\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Job$i32$fn.4.work(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Job* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.Mutex$$Counter.constructor(%struct.Mutex$$Counter* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Counter* noundef nonnull align 8 dereferenceable(56)) #0
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Counter* @nish.Mutex$$Counter.lock(%struct.Mutex$$Counter* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #1
declare void @nish.MutexGuard$$Counter.constructor(%struct.MutexGuard$$Counter* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Counter* noundef nonnull align 8 dereferenceable(56)) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #1
declare noundef i8* @nish_guard_keep(i8* noundef, i8* noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 2, i32 0
  %3 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 2, i32 1, i64 0
  %4 = bitcast i32* %3 to i8*
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  store i32 0, i32* %6, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %5, i64 1
  store i32 0, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %5, i64 2
  store i32 0, i32* %8, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %5, i64 3
  store i32 0, i32* %9, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 4, i64* %10, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  ret void
}

define internal void @Job.constructor(%struct.Job* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %id, %struct.Mutex$$Counter* noundef nonnull align 8 dereferenceable(8) %total) #0 {
entry:
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 0
  store i32 %id, i32* %0, align 4, !tbaa !19
  %1 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 1
  store %struct.Mutex$$Counter* %total, %struct.Mutex$$Counter** %1, align 8, !tbaa !20
  ret void
}

define internal void @bump(%struct.MutexGuard$$Counter* noundef nonnull readonly align 8 dereferenceable(16) nocapture %g) #1 {
entry:
  %0 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %g, i32 0, i32 0
  %1 = load %struct.Counter*, %struct.Counter** %0, align 8, !tbaa !22
  %2 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %g, i32 0, i32 0
  %3 = load %struct.Counter*, %struct.Counter** %2, align 8, !tbaa !22
  %4 = getelementptr inbounds %struct.Counter, %struct.Counter* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !5
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 1)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = getelementptr inbounds %struct.Counter, %struct.Counter* %1, i32 0, i32 0
  store i32 %7, i32* %9, align 4, !tbaa !5
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @tally(%struct.MutexGuard$$Counter* noundef nonnull readonly align 8 dereferenceable(16) nocapture %g, i32 noundef %cell) #1 {
entry:
  %0 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %g, i32 0, i32 0
  %1 = load %struct.Counter*, %struct.Counter** %0, align 8, !tbaa !22
  %2 = getelementptr inbounds %struct.Counter, %struct.Counter* %1, i32 0, i32 2, i32 0
  %3 = sext i32 %cell to i64
  %4 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %g, i32 0, i32 0
  %5 = load %struct.Counter*, %struct.Counter** %4, align 8, !tbaa !22
  %6 = getelementptr inbounds %struct.Counter, %struct.Counter* %5, i32 0, i32 2, i32 0
  %7 = sext i32 %cell to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.Counter, %struct.Counter* %5, i32 0, i32 2, i32 1, i64 0
  %12 = bitcast i32* %11 to i8*
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  %15 = load i32, i32* %14, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = getelementptr inbounds %struct.Counter, %struct.Counter* %1, i32 0, i32 2, i32 1, i64 0
  %20 = bitcast i32* %19 to i8*
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %3
  store i32 %17, i32* %22, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %23 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %g, i32 0, i32 0
  %24 = load %struct.Counter*, %struct.Counter** %23, align 8, !tbaa !22
  %25 = getelementptr inbounds %struct.Counter, %struct.Counter* %24, i32 0, i32 1
  %26 = load i8*, i8** %25, align 8, !tbaa !6
  %27 = call i8* @nish_guard_keep(i8* %26, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %28 = getelementptr inbounds %struct.Counter, %struct.Counter* %24, i32 0, i32 1
  store i8* %27, i8** %28, align 8, !tbaa !6
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @record(%struct.MutexGuard$$Counter* noundef nonnull readonly align 8 dereferenceable(16) nocapture %g, i32 noundef %cell) #1 {
entry:
  call void @bump(%struct.MutexGuard$$Counter* %g)
  call void @tally(%struct.MutexGuard$$Counter* %g, i32 %cell)
  ret void
}

define hidden noundef i32 @work$(%struct.Job* noundef nonnull readonly align 8 dereferenceable(16) nocapture %job) #1 {
entry:
  %k.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Counter*, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = icmp slt i32 %0, 1000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 1
  %3 = load %struct.Mutex$$Counter*, %struct.Mutex$$Counter** %2, align 8, !tbaa !20
  %4 = call %struct.MutexGuard$$Counter* @nish.Mutex$$Counter.lock(%struct.Mutex$$Counter* %3)
  store %struct.MutexGuard$$Counter* %4, %struct.MutexGuard$$Counter** %g.addr, align 8
  %5 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %6 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %5, i32 0, i32 1
  %7 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %8 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 0
  %9 = load i32, i32* %8, align 4, !tbaa !19
  call void @record(%struct.MutexGuard$$Counter* %7, i32 %9)
  store atomic i32 0, i32* %6 release, align 4
  br label %for.inc

for.inc:
  %10 = load i32, i32* %k.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %12 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 0
  %13 = load i32, i32* %12, align 4, !tbaa !19
  ret i32 %13
}

define noundef i32 @nish_main() #1 {
entry:
  %total.addr = alloca %struct.Mutex$$Counter*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %t.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Counter*, align 8
  %cells.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Mutex$$Counter*
  %2 = call i8* @nish_alloc_struct(i64 56)
  %3 = bitcast i8* %2 to %struct.Counter*
  %4 = getelementptr inbounds %struct.Counter, %struct.Counter* %3, i32 0, i32 2, i32 0
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 4, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !23
  %7 = getelementptr inbounds %struct.Counter, %struct.Counter* %3, i32 0, i32 2, i32 1, i64 0
  %8 = bitcast i32* %7 to i8*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !24
  call void @Counter.constructor(%struct.Counter* %3)
  call void @nish.Mutex$$Counter.constructor(%struct.Mutex$$Counter* %1, %struct.Counter* %3)
  store %struct.Mutex$$Counter* %1, %struct.Mutex$$Counter** %total.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 4, i64* %12, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 4, i64* %13, align 8, !alias.scope !10, !noalias !11, !tbaa !23
  %14 = call i8* @nish_alloc_struct(i64 16)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !10, !noalias !11, !tbaa !24
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 0, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 0, i32* %18, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %19 = getelementptr inbounds i32, i32* %16, i64 2
  store i32 0, i32* %19, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %20 = getelementptr inbounds i32, i32* %16, i64 3
  store i32 0, i32* %20, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  store %struct.nish_array* %11, %struct.nish_array** %done.addr, align 8
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
  %28 = bitcast i8* %27 to %struct.Job*
  %29 = load i32, i32* %t.addr, align 4
  %30 = load %struct.Mutex$$Counter*, %struct.Mutex$$Counter** %total.addr, align 8
  call void @Job.constructor(%struct.Job* %28, i32 %29, %struct.Mutex$$Counter* %30)
  %31 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %32 = load i32, i32* %t.addr, align 4
  call void @nish.ThreadScope.spawn$$Job$i32$fn.4.work(%struct.ThreadScope* %26, %struct.Job* %28, %struct.nish_array* %31, i32 %32)
  br label %for.inc

for.inc:
  %33 = load i32, i32* %t.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %t.addr, align 4
  br label %for.cond

for.end:
  call void @nish_scope_join(i8* %23)
  %35 = load %struct.Mutex$$Counter*, %struct.Mutex$$Counter** %total.addr, align 8
  %36 = call %struct.MutexGuard$$Counter* @nish.Mutex$$Counter.lock(%struct.Mutex$$Counter* %35)
  store %struct.MutexGuard$$Counter* %36, %struct.MutexGuard$$Counter** %g.addr, align 8
  %37 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %38 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %37, i32 0, i32 1
  %39 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %40 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %39, i32 0, i32 0
  %41 = load %struct.Counter*, %struct.Counter** %40, align 8, !tbaa !22
  %42 = getelementptr inbounds %struct.Counter, %struct.Counter* %41, i32 0, i32 2, i32 0
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %45 = icmp ult i64 0, %44
  br i1 %45, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %44)
  unreachable

bounds.ok:
  %46 = getelementptr inbounds %struct.Counter, %struct.Counter* %41, i32 0, i32 2, i32 1, i64 0
  %47 = bitcast i32* %46 to i8*
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 0
  %50 = load i32, i32* %49, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %51 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %52 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %51, i32 0, i32 0
  %53 = load %struct.Counter*, %struct.Counter** %52, align 8, !tbaa !22
  %54 = getelementptr inbounds %struct.Counter, %struct.Counter* %53, i32 0, i32 2, i32 0
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %57 = icmp ult i64 1, %56
  br i1 %57, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %56)
  unreachable

bounds.ok.1:
  %58 = getelementptr inbounds %struct.Counter, %struct.Counter* %53, i32 0, i32 2, i32 1, i64 0
  %59 = bitcast i32* %58 to i8*
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 1
  %62 = load i32, i32* %61, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %63 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 %62)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok

ovf.ok:
  %66 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %67 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %66, i32 0, i32 0
  %68 = load %struct.Counter*, %struct.Counter** %67, align 8, !tbaa !22
  %69 = getelementptr inbounds %struct.Counter, %struct.Counter* %68, i32 0, i32 2, i32 0
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %72 = icmp ult i64 2, %71
  br i1 %72, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %71)
  unreachable

bounds.ok.2:
  %73 = getelementptr inbounds %struct.Counter, %struct.Counter* %68, i32 0, i32 2, i32 1, i64 0
  %74 = bitcast i32* %73 to i8*
  %75 = bitcast i8* %74 to i32*
  %76 = getelementptr inbounds i32, i32* %75, i64 2
  %77 = load i32, i32* %76, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %78 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %64, i32 %77)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %81 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %82 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %81, i32 0, i32 0
  %83 = load %struct.Counter*, %struct.Counter** %82, align 8, !tbaa !22
  %84 = getelementptr inbounds %struct.Counter, %struct.Counter* %83, i32 0, i32 2, i32 0
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %87 = icmp ult i64 3, %86
  br i1 %87, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %86)
  unreachable

bounds.ok.3:
  %88 = getelementptr inbounds %struct.Counter, %struct.Counter* %83, i32 0, i32 2, i32 1, i64 0
  %89 = bitcast i32* %88 to i8*
  %90 = bitcast i8* %89 to i32*
  %91 = getelementptr inbounds i32, i32* %90, i64 3
  %92 = load i32, i32* %91, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %93 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %79, i32 %92)
  %94 = extractvalue { i32, i1 } %93, 0
  %95 = extractvalue { i32, i1 } %93, 1
  br i1 %95, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %94, i32* %cells.addr, align 4
  %96 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %97 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %96, i32 0, i32 0
  %98 = load %struct.Counter*, %struct.Counter** %97, align 8, !tbaa !22
  %99 = getelementptr inbounds %struct.Counter, %struct.Counter* %98, i32 0, i32 0
  %100 = load i32, i32* %99, align 4, !tbaa !5
  %101 = call i8* @nish_str_from_i32(i32 %100)
  %102 = call i8* @nish_str_concat(i8* %101, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %103 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %104 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %103, i32 0, i32 0
  %105 = load %struct.Counter*, %struct.Counter** %104, align 8, !tbaa !22
  %106 = getelementptr inbounds %struct.Counter, %struct.Counter* %105, i32 0, i32 1
  %107 = load i8*, i8** %106, align 8, !tbaa !6
  %108 = getelementptr inbounds i8, i8* %107, i64 8
  %109 = bitcast i8* %107 to i64*
  %110 = load i64, i64* %109, align 8
  %111 = call i8* @nish_str_new(i8* %108, i64 %110)
  %112 = call i8* @nish_str_concat(i8* %102, i8* %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %114 = load i32, i32* %cells.addr, align 4
  %115 = call i8* @nish_str_from_i32(i32 %114)
  %116 = call i8* @nish_str_concat(i8* %113, i8* %115)
  %117 = call i8* @nish_str_concat(i8* %116, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %118 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 0
  %120 = load i64, i64* %119, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %121 = icmp ult i64 0, %120
  br i1 %121, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %120)
  unreachable

bounds.ok.4:
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !10, !noalias !11, !tbaa !24
  %124 = bitcast i8* %123 to i32*
  %125 = getelementptr inbounds i32, i32* %124, i64 0
  %126 = load i32, i32* %125, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %127 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 0
  %129 = load i64, i64* %128, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %130 = icmp ult i64 1, %129
  br i1 %130, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %129)
  unreachable

bounds.ok.5:
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !10, !noalias !11, !tbaa !24
  %133 = bitcast i8* %132 to i32*
  %134 = getelementptr inbounds i32, i32* %133, i64 1
  %135 = load i32, i32* %134, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %136 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %126, i32 %135)
  %137 = extractvalue { i32, i1 } %136, 0
  %138 = extractvalue { i32, i1 } %136, 1
  br i1 %138, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %139 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 0
  %141 = load i64, i64* %140, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %142 = icmp ult i64 2, %141
  br i1 %142, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 2, i64 %141)
  unreachable

bounds.ok.6:
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  %144 = load i8*, i8** %143, align 8, !alias.scope !10, !noalias !11, !tbaa !24
  %145 = bitcast i8* %144 to i32*
  %146 = getelementptr inbounds i32, i32* %145, i64 2
  %147 = load i32, i32* %146, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %148 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %137, i32 %147)
  %149 = extractvalue { i32, i1 } %148, 0
  %150 = extractvalue { i32, i1 } %148, 1
  br i1 %150, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %151 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 0
  %153 = load i64, i64* %152, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %154 = icmp ult i64 3, %153
  br i1 %154, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 3, i64 %153)
  unreachable

bounds.ok.7:
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !10, !noalias !11, !tbaa !24
  %157 = bitcast i8* %156 to i32*
  %158 = getelementptr inbounds i32, i32* %157, i64 3
  %159 = load i32, i32* %158, align 4, !alias.scope !11, !noalias !10, !tbaa !13
  %160 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %149, i32 %159)
  %161 = extractvalue { i32, i1 } %160, 0
  %162 = extractvalue { i32, i1 } %160, 1
  br i1 %162, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %163 = call i8* @nish_str_from_i32(i32 %161)
  %164 = call i8* @nish_str_concat(i8* %117, i8* %163)
  call void @nish_print(i8* %164)
  store atomic i32 0, i32* %38 release, align 4
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

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Counter", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"element i32", !1, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!"Job", !2, i64 0, !3, i64 8}
!19 = !{!18, !2, i64 0}
!20 = !{!18, !3, i64 8}
!21 = !{!"MutexGuard$$Counter", !3, i64 0, !2, i64 8}
!22 = !{!21, !3, i64 0}
!23 = !{!16, !14, i64 8}
!24 = !{!16, !15, i64 16}
