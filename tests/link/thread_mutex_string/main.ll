%struct.Log = type { i8*, { %struct.nish_array, [4 x i8*] }, i32 }
%struct.Job = type { %struct.Mutex$$Log*, i32 }
%struct.Box = type { %struct.Mutex$str*, i32 }
%struct.Mutex$$Log = type { %struct.MutexGuard$$Log* }
%struct.MutexGuard$$Log = type { %struct.Log*, i32 }
%struct.Mutex$str = type { %struct.MutexGuard$str* }
%struct.MutexGuard$str = type { i8*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [51 x i8] } { i64 50, [51 x i8] c"kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c";\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"start\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"reset\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$$Job$i32$fn.4.work(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Job* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Box$i32$fn.4.bump(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Box* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.Mutex$$Log.constructor(%struct.Mutex$$Log* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Log* noundef nonnull align 8 dereferenceable(72)) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Log* @nish.Mutex$$Log.lock(%struct.Mutex$$Log* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Log.constructor(%struct.MutexGuard$$Log* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Log* noundef nonnull align 8 dereferenceable(72)) #1
declare void @nish.Mutex$str.constructor(%struct.Mutex$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$str* @nish.Mutex$str.lock(%struct.Mutex$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$str.constructor(%struct.MutexGuard$str* noundef nonnull noalias align 8 dereferenceable(16) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #0
declare noundef nonnull i8* @nish_guard_keep(i8* noundef, i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

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

define internal noundef i32 @churn() #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %t.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [51 x i8] }* @.str.0 to i8*), i8* %8)
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %t.addr, align 4
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
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(72) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 1, i32 0
  %2 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 1, i32 1, i64 0
  %3 = bitcast i8** %2 to i8*
  %4 = bitcast i8* %3 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %5, align 8, !alias.scope !10, !noalias !9, !tbaa !12
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %6, align 8, !alias.scope !10, !noalias !9, !tbaa !12
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %7, align 8, !alias.scope !10, !noalias !9, !tbaa !12
  %8 = getelementptr inbounds i8*, i8** %4, i64 3
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %8, align 8, !alias.scope !10, !noalias !9, !tbaa !12
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %9, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %10 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 2
  store i32 0, i32* %10, align 4, !tbaa !17
  ret void
}

define internal void @Job.constructor(%struct.Job* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Mutex$$Log* noundef nonnull align 8 dereferenceable(8) %m, i32 noundef %id) #1 {
entry:
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 0
  store %struct.Mutex$$Log* %m, %struct.Mutex$$Log** %0, align 8, !tbaa !19
  %1 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 1
  store i32 %id, i32* %1, align 4, !tbaa !20
  ret void
}

define hidden noundef i32 @work$(%struct.Job* noundef nonnull readonly align 8 dereferenceable(16) nocapture %job) #0 {
entry:
  %seen.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %piece.addr = alloca i8*, align 8
  %g.addr = alloca %struct.MutexGuard$$Log*, align 8
  store i32 0, i32* %seen.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 200
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !20
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %5, i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  store i8* %9, i8** %piece.addr, align 8
  %10 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 0
  %11 = load %struct.Mutex$$Log*, %struct.Mutex$$Log** %10, align 8, !tbaa !19
  %12 = call %struct.MutexGuard$$Log* @nish.Mutex$$Log.lock(%struct.Mutex$$Log* %11)
  store %struct.MutexGuard$$Log* %12, %struct.MutexGuard$$Log** %g.addr, align 8
  %13 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %14 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %13, i32 0, i32 1
  %15 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %16 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %15, i32 0, i32 0
  %17 = load %struct.Log*, %struct.Log** %16, align 8, !tbaa !22
  %18 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %19 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %18, i32 0, i32 0
  %20 = load %struct.Log*, %struct.Log** %19, align 8, !tbaa !22
  %21 = getelementptr inbounds %struct.Log, %struct.Log* %20, i32 0, i32 0
  %22 = load i8*, i8** %21, align 8, !tbaa !5
  %23 = getelementptr inbounds i8, i8* %22, i64 8
  %24 = bitcast i8* %22 to i64*
  %25 = load i64, i64* %24, align 8
  %26 = call i8* @nish_str_new(i8* %23, i64 %25)
  %27 = load i8*, i8** %piece.addr, align 8
  %28 = call i8* @nish_str_concat(i8* %26, i8* %27)
  %29 = getelementptr inbounds %struct.Log, %struct.Log* %17, i32 0, i32 0
  %30 = load i8*, i8** %29, align 8, !tbaa !5
  %31 = call i8* @nish_guard_keep(i8* %30, i8* %28)
  %32 = getelementptr inbounds %struct.Log, %struct.Log* %17, i32 0, i32 0
  store i8* %31, i8** %32, align 8, !tbaa !5
  %33 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %34 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %33, i32 0, i32 0
  %35 = load %struct.Log*, %struct.Log** %34, align 8, !tbaa !22
  %36 = getelementptr inbounds %struct.Log, %struct.Log* %35, i32 0, i32 1, i32 0
  %37 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 1
  %38 = load i32, i32* %37, align 4, !tbaa !20
  %39 = sext i32 %38 to i64
  %40 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 1
  %41 = load i32, i32* %40, align 4, !tbaa !20
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8* %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %45 = load i32, i32* %i.addr, align 4
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %44, i8* %46)
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %50 = icmp ult i64 %39, %49
  br i1 %50, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %39, i64 %49)
  unreachable

bounds.ok:
  %51 = getelementptr inbounds %struct.Log, %struct.Log* %35, i32 0, i32 1, i32 1, i64 0
  %52 = bitcast i8** %51 to i8*
  %53 = bitcast i8* %52 to i8**
  %54 = getelementptr inbounds i8*, i8** %53, i64 %39
  %55 = load i8*, i8** %54, align 8
  %56 = call i8* @nish_guard_keep(i8* %55, i8* %47)
  store i8* %56, i8** %54, align 8, !alias.scope !10, !noalias !9, !tbaa !12
  %57 = load i32, i32* %seen.addr, align 4
  %58 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %59 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %58, i32 0, i32 0
  %60 = load %struct.Log*, %struct.Log** %59, align 8, !tbaa !22
  %61 = getelementptr inbounds %struct.Log, %struct.Log* %60, i32 0, i32 0
  %62 = load i8*, i8** %61, align 8, !tbaa !5
  %63 = getelementptr inbounds i8, i8* %62, i64 8
  %64 = bitcast i8* %62 to i64*
  %65 = load i64, i64* %64, align 8
  %66 = call i8* @nish_str_new(i8* %63, i64 %65)
  %67 = call i64 @nish_str_index_of(i8* %66, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %68 = trunc i64 %67 to i32
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %57, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %70, i32* %seen.addr, align 4
  %72 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %73 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %72, i32 0, i32 0
  %74 = load %struct.Log*, %struct.Log** %73, align 8, !tbaa !22
  %75 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %76 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %75, i32 0, i32 0
  %77 = load %struct.Log*, %struct.Log** %76, align 8, !tbaa !22
  %78 = getelementptr inbounds %struct.Log, %struct.Log* %77, i32 0, i32 2
  %79 = load i32, i32* %78, align 4, !tbaa !17
  %80 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %79, i32 1)
  %81 = extractvalue { i32, i1 } %80, 0
  %82 = extractvalue { i32, i1 } %80, 1
  br i1 %82, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %83 = getelementptr inbounds %struct.Log, %struct.Log* %74, i32 0, i32 2
  store i32 %81, i32* %83, align 4, !tbaa !17
  store atomic i32 0, i32* %14 release, align 4
  br label %for.inc

for.inc:
  %84 = load i32, i32* %i.addr, align 4
  %85 = add nsw i32 %84, 1
  store i32 %85, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %86 = load i32, i32* %seen.addr, align 4
  ret i32 %86

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Mutex$str* noundef nonnull align 8 dereferenceable(8) %m, i32 noundef %id) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.Mutex$str* %m, %struct.Mutex$str** %0, align 8, !tbaa !24
  %1 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 1
  store i32 %id, i32* %1, align 4, !tbaa !25
  ret void
}

define hidden noundef i32 @bump$(%struct.Box* noundef nonnull readonly align 8 dereferenceable(16) nocapture %b) #0 {
entry:
  %i.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$str*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 100
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %3 = load %struct.Mutex$str*, %struct.Mutex$str** %2, align 8, !tbaa !24
  %4 = call %struct.MutexGuard$str* @nish.Mutex$str.lock(%struct.Mutex$str* %3)
  store %struct.MutexGuard$str* %4, %struct.MutexGuard$str** %g.addr, align 8
  %5 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %g.addr, align 8
  %6 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %5, i32 0, i32 1
  %7 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %g.addr, align 8
  %8 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 1
  %9 = load i32, i32* %8, align 4, !tbaa !25
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %12 = load i32, i32* %i.addr, align 4
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %11, i8* %13)
  %15 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %7, i32 0, i32 0
  %16 = load i8*, i8** %15, align 8, !tbaa !27
  %17 = call i8* @nish_guard_keep(i8* %16, i8* %14)
  %18 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %7, i32 0, i32 0
  store i8* %17, i8** %18, align 8, !tbaa !27
  store atomic i32 0, i32* %6 release, align 4
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 1
  %22 = load i32, i32* %21, align 4, !tbaa !25
  ret i32 %22
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Mutex$$Log*, align 8
  %word.addr = alloca %struct.Mutex$str*, align 8
  %seen.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %i.addr = alloca i32, align 4
  %text.addr = alloca i8*, align 8
  %names.addr = alloca i8*, align 8
  %count.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Log*, align 8
  %last.addr = alloca i8*, align 8
  %g.addr.1 = alloca %struct.MutexGuard$str*, align 8
  %c.addr = alloca i32, align 4
  %semis.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %after.addr = alloca i8*, align 8
  %g.addr.2 = alloca %struct.MutexGuard$$Log*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Mutex$$Log*
  %2 = call i8* @nish_alloc_struct(i64 72)
  %3 = bitcast i8* %2 to %struct.Log*
  %4 = getelementptr inbounds %struct.Log, %struct.Log* %3, i32 0, i32 1, i32 0
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 4, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !28
  %7 = getelementptr inbounds %struct.Log, %struct.Log* %3, i32 0, i32 1, i32 1, i64 0
  %8 = bitcast i8** %7 to i8*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !29
  call void @Log.constructor(%struct.Log* %3)
  call void @nish.Mutex$$Log.constructor(%struct.Mutex$$Log* %1, %struct.Log* %3)
  store %struct.Mutex$$Log* %1, %struct.Mutex$$Log** %m.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Mutex$str*
  call void @nish.Mutex$str.constructor(%struct.Mutex$str* %11, i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*))
  store %struct.Mutex$str* %11, %struct.Mutex$str** %word.addr, align 8
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 6, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 6, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !28
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !9, !noalias !10, !tbaa !29
  %18 = bitcast i8* %16 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 0
  store i32 0, i32* %19, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %20 = getelementptr inbounds i32, i32* %18, i64 1
  store i32 0, i32* %20, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %21 = getelementptr inbounds i32, i32* %18, i64 2
  store i32 0, i32* %21, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %22 = getelementptr inbounds i32, i32* %18, i64 3
  store i32 0, i32* %22, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %23 = getelementptr inbounds i32, i32* %18, i64 4
  store i32 0, i32* %23, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %24 = getelementptr inbounds i32, i32* %18, i64 5
  store i32 0, i32* %24, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  store %struct.nish_array* %13, %struct.nish_array** %seen.addr, align 8
  %25 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %25, %struct.ThreadScope** %s.addr, align 8
  %26 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %27 = bitcast %struct.ThreadScope* %26 to i8*
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %28 = load i32, i32* %i.addr, align 4
  %29 = icmp slt i32 %28, 4
  br i1 %29, label %for.body, label %for.end

for.body:
  %30 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %31 = call i8* @nish_alloc_struct(i64 16)
  %32 = bitcast i8* %31 to %struct.Job*
  %33 = load %struct.Mutex$$Log*, %struct.Mutex$$Log** %m.addr, align 8
  %34 = load i32, i32* %i.addr, align 4
  call void @Job.constructor(%struct.Job* %32, %struct.Mutex$$Log* %33, i32 %34)
  %35 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %36 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$$Job$i32$fn.4.work(%struct.ThreadScope* %30, %struct.Job* %32, %struct.nish_array* %35, i32 %36)
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %39 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %40 = call i8* @nish_alloc_struct(i64 16)
  %41 = bitcast i8* %40 to %struct.Box*
  %42 = load %struct.Mutex$str*, %struct.Mutex$str** %word.addr, align 8
  call void @Box.constructor(%struct.Box* %41, %struct.Mutex$str* %42, i32 7)
  %43 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  call void @nish.ThreadScope.spawn$$Box$i32$fn.4.bump(%struct.ThreadScope* %39, %struct.Box* %41, %struct.nish_array* %43, i32 4)
  %44 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %45 = call i8* @nish_alloc_struct(i64 16)
  %46 = bitcast i8* %45 to %struct.Box*
  %47 = load %struct.Mutex$str*, %struct.Mutex$str** %word.addr, align 8
  call void @Box.constructor(%struct.Box* %46, %struct.Mutex$str* %47, i32 7)
  %48 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  call void @nish.ThreadScope.spawn$$Box$i32$fn.4.bump(%struct.ThreadScope* %44, %struct.Box* %46, %struct.nish_array* %48, i32 5)
  call void @nish_scope_join(i8* %27)
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %text.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %names.addr, align 8
  store i32 0, i32* %count.addr, align 4
  %49 = load %struct.Mutex$$Log*, %struct.Mutex$$Log** %m.addr, align 8
  %50 = call %struct.MutexGuard$$Log* @nish.Mutex$$Log.lock(%struct.Mutex$$Log* %49)
  store %struct.MutexGuard$$Log* %50, %struct.MutexGuard$$Log** %g.addr, align 8
  %51 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %52 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %51, i32 0, i32 1
  %53 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %54 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %53, i32 0, i32 0
  %55 = load %struct.Log*, %struct.Log** %54, align 8, !tbaa !22
  %56 = getelementptr inbounds %struct.Log, %struct.Log* %55, i32 0, i32 0
  %57 = load i8*, i8** %56, align 8, !tbaa !5
  %58 = getelementptr inbounds i8, i8* %57, i64 8
  %59 = bitcast i8* %57 to i64*
  %60 = load i64, i64* %59, align 8
  %61 = call i8* @nish_str_new(i8* %58, i64 %60)
  store i8* %61, i8** %text.addr, align 8
  %62 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %63 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %62, i32 0, i32 0
  %64 = load %struct.Log*, %struct.Log** %63, align 8, !tbaa !22
  %65 = getelementptr inbounds %struct.Log, %struct.Log* %64, i32 0, i32 1, i32 0
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %68 = icmp ult i64 0, %67
  br i1 %68, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %67)
  unreachable

bounds.ok:
  %69 = getelementptr inbounds %struct.Log, %struct.Log* %64, i32 0, i32 1, i32 1, i64 0
  %70 = bitcast i8** %69 to i8*
  %71 = bitcast i8* %70 to i8**
  %72 = getelementptr inbounds i8*, i8** %71, i64 0
  %73 = load i8*, i8** %72, align 8, !alias.scope !10, !noalias !9, !tbaa !12
  %74 = getelementptr inbounds i8, i8* %73, i64 8
  %75 = bitcast i8* %73 to i64*
  %76 = load i64, i64* %75, align 8
  %77 = call i8* @nish_str_new(i8* %74, i64 %76)
  %78 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %79 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %78, i32 0, i32 0
  %80 = load %struct.Log*, %struct.Log** %79, align 8, !tbaa !22
  %81 = getelementptr inbounds %struct.Log, %struct.Log* %80, i32 0, i32 1, i32 0
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %84 = icmp ult i64 1, %83
  br i1 %84, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %83)
  unreachable

bounds.ok.1:
  %85 = getelementptr inbounds %struct.Log, %struct.Log* %80, i32 0, i32 1, i32 1, i64 0
  %86 = bitcast i8** %85 to i8*
  %87 = bitcast i8* %86 to i8**
  %88 = getelementptr inbounds i8*, i8** %87, i64 1
  %89 = load i8*, i8** %88, align 8, !alias.scope !10, !noalias !9, !tbaa !12
  %90 = getelementptr inbounds i8, i8* %89, i64 8
  %91 = bitcast i8* %89 to i64*
  %92 = load i64, i64* %91, align 8
  %93 = call i8* @nish_str_new(i8* %90, i64 %92)
  %94 = call i8* @nish_str_concat(i8* %77, i8* %93)
  %95 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %96 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %95, i32 0, i32 0
  %97 = load %struct.Log*, %struct.Log** %96, align 8, !tbaa !22
  %98 = getelementptr inbounds %struct.Log, %struct.Log* %97, i32 0, i32 1, i32 0
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 0
  %100 = load i64, i64* %99, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %101 = icmp ult i64 2, %100
  br i1 %101, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %100)
  unreachable

bounds.ok.2:
  %102 = getelementptr inbounds %struct.Log, %struct.Log* %97, i32 0, i32 1, i32 1, i64 0
  %103 = bitcast i8** %102 to i8*
  %104 = bitcast i8* %103 to i8**
  %105 = getelementptr inbounds i8*, i8** %104, i64 2
  %106 = load i8*, i8** %105, align 8, !alias.scope !10, !noalias !9, !tbaa !12
  %107 = getelementptr inbounds i8, i8* %106, i64 8
  %108 = bitcast i8* %106 to i64*
  %109 = load i64, i64* %108, align 8
  %110 = call i8* @nish_str_new(i8* %107, i64 %109)
  %111 = call i8* @nish_str_concat(i8* %94, i8* %110)
  %112 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %113 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %112, i32 0, i32 0
  %114 = load %struct.Log*, %struct.Log** %113, align 8, !tbaa !22
  %115 = getelementptr inbounds %struct.Log, %struct.Log* %114, i32 0, i32 1, i32 0
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 0
  %117 = load i64, i64* %116, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %118 = icmp ult i64 3, %117
  br i1 %118, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %117)
  unreachable

bounds.ok.3:
  %119 = getelementptr inbounds %struct.Log, %struct.Log* %114, i32 0, i32 1, i32 1, i64 0
  %120 = bitcast i8** %119 to i8*
  %121 = bitcast i8* %120 to i8**
  %122 = getelementptr inbounds i8*, i8** %121, i64 3
  %123 = load i8*, i8** %122, align 8, !alias.scope !10, !noalias !9, !tbaa !12
  %124 = getelementptr inbounds i8, i8* %123, i64 8
  %125 = bitcast i8* %123 to i64*
  %126 = load i64, i64* %125, align 8
  %127 = call i8* @nish_str_new(i8* %124, i64 %126)
  %128 = call i8* @nish_str_concat(i8* %111, i8* %127)
  store i8* %128, i8** %names.addr, align 8
  %129 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %130 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %129, i32 0, i32 0
  %131 = load %struct.Log*, %struct.Log** %130, align 8, !tbaa !22
  %132 = getelementptr inbounds %struct.Log, %struct.Log* %131, i32 0, i32 2
  %133 = load i32, i32* %132, align 4, !tbaa !17
  store i32 %133, i32* %count.addr, align 4
  %134 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr, align 8
  %135 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %134, i32 0, i32 0
  %136 = load %struct.Log*, %struct.Log** %135, align 8, !tbaa !22
  %137 = getelementptr inbounds %struct.Log, %struct.Log* %136, i32 0, i32 0
  %138 = load i8*, i8** %137, align 8, !tbaa !5
  %139 = call i8* @nish_guard_keep(i8* %138, i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*))
  %140 = getelementptr inbounds %struct.Log, %struct.Log* %136, i32 0, i32 0
  store i8* %139, i8** %140, align 8, !tbaa !5
  store atomic i32 0, i32* %52 release, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %last.addr, align 8
  %141 = load %struct.Mutex$str*, %struct.Mutex$str** %word.addr, align 8
  %142 = call %struct.MutexGuard$str* @nish.Mutex$str.lock(%struct.Mutex$str* %141)
  store %struct.MutexGuard$str* %142, %struct.MutexGuard$str** %g.addr.1, align 8
  %143 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %g.addr.1, align 8
  %144 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %143, i32 0, i32 1
  %145 = load %struct.MutexGuard$str*, %struct.MutexGuard$str** %g.addr.1, align 8
  %146 = getelementptr inbounds %struct.MutexGuard$str, %struct.MutexGuard$str* %145, i32 0, i32 0
  %147 = load i8*, i8** %146, align 8, !tbaa !27
  %148 = getelementptr inbounds i8, i8* %147, i64 8
  %149 = bitcast i8* %147 to i64*
  %150 = load i64, i64* %149, align 8
  %151 = call i8* @nish_str_new(i8* %148, i64 %150)
  store i8* %151, i8** %last.addr, align 8
  store atomic i32 0, i32* %144 release, align 4
  %152 = call i32 @churn()
  store i32 %152, i32* %c.addr, align 4
  store i32 0, i32* %semis.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %153 = load i32, i32* %i.addr.1, align 4
  %154 = load i8*, i8** %text.addr, align 8
  %155 = bitcast i8* %154 to i64*
  %156 = load i64, i64* %155, align 8
  %157 = trunc i64 %156 to i32
  %158 = icmp slt i32 %153, %157
  br i1 %158, label %for.body.1, label %for.end.1

for.body.1:
  %159 = load i8*, i8** %text.addr, align 8
  %160 = load i32, i32* %i.addr.1, align 4
  %161 = sext i32 %160 to i64
  %162 = getelementptr inbounds i8, i8* %159, i64 8
  %163 = getelementptr inbounds i8, i8* %162, i64 %161
  %164 = load i8, i8* %163, align 1
  %165 = zext i8 %164 to i32
  %166 = icmp eq i32 %165, 59
  br i1 %166, label %if.then, label %if.end

if.then:
  %167 = load i32, i32* %semis.addr, align 4
  %168 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %167, i32 1)
  %169 = extractvalue { i32, i1 } %168, 0
  %170 = extractvalue { i32, i1 } %168, 1
  br i1 %170, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %169, i32* %semis.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %171 = load i32, i32* %i.addr.1, align 4
  %172 = add nsw i32 %171, 1
  store i32 %172, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %after.addr, align 8
  %173 = load %struct.Mutex$$Log*, %struct.Mutex$$Log** %m.addr, align 8
  %174 = call %struct.MutexGuard$$Log* @nish.Mutex$$Log.lock(%struct.Mutex$$Log* %173)
  store %struct.MutexGuard$$Log* %174, %struct.MutexGuard$$Log** %g.addr.2, align 8
  %175 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr.2, align 8
  %176 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %175, i32 0, i32 1
  %177 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %g.addr.2, align 8
  %178 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %177, i32 0, i32 0
  %179 = load %struct.Log*, %struct.Log** %178, align 8, !tbaa !22
  %180 = getelementptr inbounds %struct.Log, %struct.Log* %179, i32 0, i32 0
  %181 = load i8*, i8** %180, align 8, !tbaa !5
  %182 = getelementptr inbounds i8, i8* %181, i64 8
  %183 = bitcast i8* %181 to i64*
  %184 = load i64, i64* %183, align 8
  %185 = call i8* @nish_str_new(i8* %182, i64 %184)
  store i8* %185, i8** %after.addr, align 8
  store atomic i32 0, i32* %176 release, align 4
  %186 = load i8*, i8** %text.addr, align 8
  %187 = bitcast i8* %186 to i64*
  %188 = load i64, i64* %187, align 8
  %189 = trunc i64 %188 to i32
  %190 = call i8* @nish_str_from_i32(i32 %189)
  %191 = call i8* @nish_str_concat(i8* %190, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %192 = load i32, i32* %semis.addr, align 4
  %193 = call i8* @nish_str_from_i32(i32 %192)
  %194 = call i8* @nish_str_concat(i8* %191, i8* %193)
  %195 = call i8* @nish_str_concat(i8* %194, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %196 = load i32, i32* %count.addr, align 4
  %197 = call i8* @nish_str_from_i32(i32 %196)
  %198 = call i8* @nish_str_concat(i8* %195, i8* %197)
  %199 = call i8* @nish_str_concat(i8* %198, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %200 = load i8*, i8** %names.addr, align 8
  %201 = call i8* @nish_str_concat(i8* %199, i8* %200)
  call void @nish_print(i8* %201)
  %202 = load i8*, i8** %last.addr, align 8
  %203 = call i8* @nish_str_concat(i8* %202, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %204 = load i8*, i8** %after.addr, align 8
  %205 = call i8* @nish_str_concat(i8* %203, i8* %204)
  %206 = call i8* @nish_str_concat(i8* %205, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %207 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 0
  %209 = load i64, i64* %208, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %210 = icmp ult i64 0, %209
  br i1 %210, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %209)
  unreachable

bounds.ok.4:
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 2
  %212 = load i8*, i8** %211, align 8, !alias.scope !9, !noalias !10, !tbaa !29
  %213 = bitcast i8* %212 to i32*
  %214 = getelementptr inbounds i32, i32* %213, i64 0
  %215 = load i32, i32* %214, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %216 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 0
  %218 = load i64, i64* %217, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %219 = icmp ult i64 1, %218
  br i1 %219, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %218)
  unreachable

bounds.ok.5:
  %220 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 2
  %221 = load i8*, i8** %220, align 8, !alias.scope !9, !noalias !10, !tbaa !29
  %222 = bitcast i8* %221 to i32*
  %223 = getelementptr inbounds i32, i32* %222, i64 1
  %224 = load i32, i32* %223, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %225 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %215, i32 %224)
  %226 = extractvalue { i32, i1 } %225, 0
  %227 = extractvalue { i32, i1 } %225, 1
  br i1 %227, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %228 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %229 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %228, i64 0, i32 0
  %230 = load i64, i64* %229, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %231 = icmp ult i64 2, %230
  br i1 %231, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 2, i64 %230)
  unreachable

bounds.ok.6:
  %232 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %228, i64 0, i32 2
  %233 = load i8*, i8** %232, align 8, !alias.scope !9, !noalias !10, !tbaa !29
  %234 = bitcast i8* %233 to i32*
  %235 = getelementptr inbounds i32, i32* %234, i64 2
  %236 = load i32, i32* %235, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %237 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %226, i32 %236)
  %238 = extractvalue { i32, i1 } %237, 0
  %239 = extractvalue { i32, i1 } %237, 1
  br i1 %239, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %240 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %241 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %240, i64 0, i32 0
  %242 = load i64, i64* %241, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %243 = icmp ult i64 3, %242
  br i1 %243, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 3, i64 %242)
  unreachable

bounds.ok.7:
  %244 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %240, i64 0, i32 2
  %245 = load i8*, i8** %244, align 8, !alias.scope !9, !noalias !10, !tbaa !29
  %246 = bitcast i8* %245 to i32*
  %247 = getelementptr inbounds i32, i32* %246, i64 3
  %248 = load i32, i32* %247, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %249 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %238, i32 %248)
  %250 = extractvalue { i32, i1 } %249, 0
  %251 = extractvalue { i32, i1 } %249, 1
  br i1 %251, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %252 = call i8* @nish_str_from_i32(i32 %250)
  %253 = call i8* @nish_str_concat(i8* %206, i8* %252)
  %254 = call i8* @nish_str_concat(i8* %253, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %255 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %256 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %255, i64 0, i32 0
  %257 = load i64, i64* %256, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %258 = icmp ult i64 4, %257
  br i1 %258, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 4, i64 %257)
  unreachable

bounds.ok.8:
  %259 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %255, i64 0, i32 2
  %260 = load i8*, i8** %259, align 8, !alias.scope !9, !noalias !10, !tbaa !29
  %261 = bitcast i8* %260 to i32*
  %262 = getelementptr inbounds i32, i32* %261, i64 4
  %263 = load i32, i32* %262, align 4, !alias.scope !10, !noalias !9, !tbaa !31
  %264 = call i8* @nish_str_from_i32(i32 %263)
  %265 = call i8* @nish_str_concat(i8* %254, i8* %264)
  %266 = call i8* @nish_str_concat(i8* %265, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %267 = load i32, i32* %c.addr, align 4
  %268 = call i8* @nish_str_from_i32(i32 %267)
  %269 = call i8* @nish_str_concat(i8* %266, i8* %268)
  call void @nish_print(i8* %269)
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Log", !2, i64 0, !3, i64 64}
!5 = !{!4, !2, i64 0}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"element ptr", !1, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!4, !3, i64 64}
!18 = !{!"Job", !2, i64 0, !3, i64 8}
!19 = !{!18, !2, i64 0}
!20 = !{!18, !3, i64 8}
!21 = !{!"MutexGuard$$Log", !2, i64 0, !3, i64 8}
!22 = !{!21, !2, i64 0}
!23 = !{!"Box", !2, i64 0, !3, i64 8}
!24 = !{!23, !2, i64 0}
!25 = !{!23, !3, i64 8}
!26 = !{!"MutexGuard$str", !2, i64 0, !3, i64 8}
!27 = !{!26, !2, i64 0}
!28 = !{!15, !13, i64 8}
!29 = !{!15, !14, i64 16}
!30 = !{!"element i32", !1, i64 0}
!31 = !{!30, !30, i64 0}
