%struct.Tally = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$arr.i32$i32$fn.5.sumOf(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
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

define hidden noundef i32 @sumOf$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
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

define internal noundef i32 @guards(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m) #0 {
entry:
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %g.addr.1 = alloca %struct.MutexGuard$$Tally*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 4
  br i1 %1, label %for.body, label %for.end

for.body:
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %2 = load i32, i32* %j.addr, align 4
  %3 = icmp slt i32 %2, 4
  br i1 %3, label %for.body.1, label %for.end.1

for.body.1:
  %4 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %4, %struct.MutexGuard$$Tally** %g.addr, align 8
  %5 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %6 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %5, i32 0, i32 1
  %7 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %8 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %7, i32 0, i32 0
  %9 = load %struct.Tally*, %struct.Tally** %8, align 8, !tbaa !17
  %10 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %11 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %10, i32 0, i32 0
  %12 = load %struct.Tally*, %struct.Tally** %11, align 8, !tbaa !17
  %13 = getelementptr inbounds %struct.Tally, %struct.Tally* %12, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !19
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = getelementptr inbounds %struct.Tally, %struct.Tally* %9, i32 0, i32 0
  store i32 %16, i32* %18, align 4, !tbaa !19
  %19 = load i32, i32* %j.addr, align 4
  %20 = icmp eq i32 %19, 1
  br i1 %20, label %if.then, label %if.end

if.then:
  store atomic i32 0, i32* %6 release, align 4
  br label %for.inc

if.end:
  %21 = load i32, i32* %i.addr, align 4
  %22 = icmp eq i32 %21, 3
  br i1 %22, label %if.then.1, label %if.end.1

if.then.1:
  store atomic i32 0, i32* %6 release, align 4
  br label %for.end

if.end.1:
  store atomic i32 0, i32* %6 release, align 4
  br label %for.inc.1

for.inc.1:
  %23 = load i32, i32* %j.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %27, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %28 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %29 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %28, i32 0, i32 1
  %30 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %31 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %30, i32 0, i32 0
  %32 = load %struct.Tally*, %struct.Tally** %31, align 8, !tbaa !17
  %33 = getelementptr inbounds %struct.Tally, %struct.Tally* %32, i32 0, i32 0
  %34 = load i32, i32* %33, align 4, !tbaa !19
  store atomic i32 0, i32* %29 release, align 4
  ret i32 %34

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @scopes() #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %seen.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !20
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 3, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 3, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !20
  %14 = call i8* @nish_alloc_struct(i64 12)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 1, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 2, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = getelementptr inbounds i32, i32* %16, i64 2
  store i32 3, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %11, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %seen.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp slt i32 %20, 3
  br i1 %21, label %for.body, label %for.end

for.body:
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %23 = load i8*, i8** %22, align 8
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %25 = load i64, i64* %24, align 8
  %26 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %26, %struct.ThreadScope** %s.addr, align 8
  %27 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %28 = bitcast %struct.ThreadScope* %27 to i8*
  %29 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %32 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.5.sumOf(%struct.ThreadScope* %29, %struct.nish_array* %30, %struct.nish_array* %31, i32 %32)
  %33 = load i32, i32* %i.addr, align 4
  %34 = icmp eq i32 %33, 0
  br i1 %34, label %if.then, label %if.end

if.then:
  call void @nish_scope_join(i8* %28)
  br label %label.end

if.end:
  %35 = load i32, i32* %i.addr, align 4
  %36 = icmp eq i32 %35, 1
  br i1 %36, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_scope_join(i8* %28)
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %38 = load i8*, i8** %37, align 8
  %39 = icmp eq i8* %38, %23
  br i1 %39, label %pass.rewind, label %pass.free

pass.rewind:
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %25, i64* %40, align 8
  br label %pass.done

pass.free:
  %41 = ptrtoint i8* %23 to i64
  %42 = add i64 %41, %25
  call void @nish_arena_release(i64 %42)
  br label %pass.done

pass.done:
  br label %for.inc

if.end.1:
  call void @nish_scope_join(i8* %28)
  %43 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %44 = load i8*, i8** %43, align 8
  %45 = icmp eq i8* %44, %23
  br i1 %45, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %46 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %25, i64* %46, align 8
  br label %pass.done.1

pass.free.1:
  %47 = ptrtoint i8* %23 to i64
  %48 = add i64 %47, %25
  call void @nish_arena_release(i64 %48)
  br label %pass.done.1

pass.done.1:
  br label %for.end

label.end:
  %49 = load i32, i32* %seen.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %seen.addr, align 4
  %51 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %52 = load i8*, i8** %51, align 8
  %53 = icmp eq i8* %52, %23
  br i1 %53, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %54 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %25, i64* %54, align 8
  br label %pass.done.2

pass.free.2:
  %55 = ptrtoint i8* %23 to i64
  %56 = add i64 %55, %25
  call void @nish_arena_release(i64 %56)
  br label %pass.done.2

pass.done.2:
  br label %for.inc

for.inc:
  %57 = load i32, i32* %i.addr, align 4
  %58 = add nsw i32 %57, 1
  store i32 %58, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %59 = load i32, i32* %seen.addr, align 4
  %60 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = icmp ult i64 0, %62
  br i1 %63, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %62)
  unreachable

bounds.ok:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %66 = bitcast i8* %65 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 0
  %68 = load i32, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %59, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok

ovf.ok:
  %72 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = icmp ult i64 1, %74
  br i1 %75, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %74)
  unreachable

bounds.ok.1:
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = bitcast i8* %77 to i32*
  %79 = getelementptr inbounds i32, i32* %78, i64 1
  %80 = load i32, i32* %79, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %81 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %80, i32 10)
  %82 = extractvalue { i32, i1 } %81, 0
  %83 = extractvalue { i32, i1 } %81, 1
  br i1 %83, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %84 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %70, i32 %82)
  %85 = extractvalue { i32, i1 } %84, 0
  %86 = extractvalue { i32, i1 } %84, 1
  br i1 %86, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %87 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = icmp ult i64 2, %89
  br i1 %90, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %89)
  unreachable

bounds.ok.2:
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %93 = bitcast i8* %92 to i32*
  %94 = getelementptr inbounds i32, i32* %93, i64 2
  %95 = load i32, i32* %94, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %96 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %95, i32 100)
  %97 = extractvalue { i32, i1 } %96, 0
  %98 = extractvalue { i32, i1 } %96, 1
  br i1 %98, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %99 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %85, i32 %97)
  %100 = extractvalue { i32, i1 } %99, 0
  %101 = extractvalue { i32, i1 } %99, 1
  br i1 %101, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %100

ovf.fail:
  %ovf.op = phi i32 [ 0, %bounds.ok ], [ 2, %bounds.ok.1 ], [ 0, %ovf.ok.1 ], [ 2, %bounds.ok.2 ], [ 0, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj = alloca %struct.Mutex$$Tally, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Tally*
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !19
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Tally* %1)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Mutex$$Tally** %m.addr, align 8
  %3 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %4 = call i32 @guards(%struct.Mutex$$Tally* %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @scopes()
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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

!llvm.module.flags = !{!21, !22, !23, !24, !25}
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
!14 = !{!"ptr", !6, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"MutexGuard$$Tally", !14, i64 0, !15, i64 8}
!17 = !{!16, !14, i64 0}
!18 = !{!"Tally", !15, i64 0}
!19 = !{!18, !15, i64 0}
!20 = !{!9, !7, i64 8}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
