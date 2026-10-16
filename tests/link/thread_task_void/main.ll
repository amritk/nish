%struct.Tally = type { i32 }
%struct.Job = type { %struct.nish_array*, %struct.Mutex$$Tally* }
%struct.Pipe = type { %struct.Channel$i32*, i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.Channel$i32 = type { %struct.nish_array*, i32, i64 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawnWith$$Job$void$fn.6.addAll(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Job* noundef nonnull align 8 dereferenceable(16)) #1
declare void @nish.ThreadScope.spawnWith$$Pipe$void$fn.7.produce(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Pipe* noundef nonnull align 8 dereferenceable(16)) #1
declare void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Pipe* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #0
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #1
declare void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #0
declare void @nish.Channel$i32.constructor(%struct.Channel$i32* noundef nonnull noalias align 8 dereferenceable(24) nocapture) #0
declare void @nish.Channel$i32.send(%struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef) #1
declare noundef i32 @nish.Channel$i32.take(%struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef zeroext i1 @nish.Channel$i32.ready(%struct.Channel$i32* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #1
declare void @nish_channel_count(i64* noundef nonnull, i64 noundef) #1
declare noundef i32 @nish_channel_receive(i64* noundef nonnull, i64* noundef nonnull) #1
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

define internal void @Job.constructor(%struct.Job* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.Mutex$$Tally* noundef nonnull align 8 dereferenceable(8) %tally) #0 {
entry:
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 0
  store %struct.nish_array* %xs, %struct.nish_array** %0, align 8, !tbaa !4
  %1 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 1
  store %struct.Mutex$$Tally* %tally, %struct.Mutex$$Tally** %1, align 8, !tbaa !5
  ret void
}

define internal void @Pipe.constructor(%struct.Pipe* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) %ch, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 0
  store %struct.Channel$i32* %ch, %struct.Channel$i32** %0, align 8, !tbaa !8
  %1 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 1
  store i32 %n, i32* %1, align 4, !tbaa !9
  ret void
}

define hidden void @addAll$(%struct.Job* noundef nonnull readonly align 8 dereferenceable(16) nocapture %job) #1 {
entry:
  %t.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  store i32 0, i32* %t.addr, align 4
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %2 = load i64, i64* %forof.idx, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %forof.body, label %forof.end

forof.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  store i32 %10, i32* %x.addr, align 4
  %11 = load i32, i32* %t.addr, align 4
  %12 = load i32, i32* %x.addr, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = add i64 %16, 1
  store i64 %17, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %18 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 1
  %19 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %18, align 8, !tbaa !5
  %20 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %19)
  store %struct.MutexGuard$$Tally* %20, %struct.MutexGuard$$Tally** %g.addr, align 8
  %21 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %22 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %21, i32 0, i32 1
  %23 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %24 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %23, i32 0, i32 0
  %25 = load %struct.Tally*, %struct.Tally** %24, align 8, !tbaa !23
  %26 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %27 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %26, i32 0, i32 0
  %28 = load %struct.Tally*, %struct.Tally** %27, align 8, !tbaa !23
  %29 = getelementptr inbounds %struct.Tally, %struct.Tally* %28, i32 0, i32 0
  %30 = load i32, i32* %29, align 4, !tbaa !25
  %31 = load i32, i32* %t.addr, align 4
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %31)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %35 = getelementptr inbounds %struct.Tally, %struct.Tally* %25, i32 0, i32 0
  store i32 %33, i32* %35, align 4, !tbaa !25
  store atomic i32 0, i32* %22 release, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden void @produce$(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture %p) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 1
  %2 = load i32, i32* %1, align 4, !tbaa !9
  %3 = icmp sle i32 %0, %2
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 0
  %5 = load %struct.Channel$i32*, %struct.Channel$i32** %4, align 8, !tbaa !8
  %6 = load i32, i32* %i.addr, align 4
  call void @nish.Channel$i32.send(%struct.Channel$i32* %5, i32 %6)
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 1)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @consume$(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture %p) #1 {
entry:
  %t.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %chan.slot = alloca i64, align 8
  store i32 0, i32* %t.addr, align 4
  %0 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 0
  %1 = load %struct.Channel$i32*, %struct.Channel$i32** %0, align 8, !tbaa !8
  %2 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %1, i32 0, i32 2
  br label %chan.recv

chan.recv:
  %3 = call i32 @nish_channel_receive(i64* %2, i64* %chan.slot)
  %4 = icmp ne i32 %3, 0
  br i1 %4, label %chan.body, label %chan.end

chan.body:
  %5 = load i64, i64* %chan.slot, align 8
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %x.addr, align 4
  %7 = load i32, i32* %t.addr, align 4
  %8 = load i32, i32* %x.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %t.addr, align 4
  br label %chan.recv

chan.end:
  %12 = load i32, i32* %t.addr, align 4
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %tally.addr = alloca %struct.Mutex$$Tally*, align 8
  %ch.addr = alloca %struct.Channel$i32*, align 8
  %sums.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Mutex$$Tally*
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Tally*
  %4 = getelementptr inbounds %struct.Tally, %struct.Tally* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !25
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %1, %struct.Tally* %3)
  store %struct.Mutex$$Tally* %1, %struct.Mutex$$Tally** %tally.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.Channel$i32*
  call void @nish.Channel$i32.constructor(%struct.Channel$i32* %6)
  store %struct.Channel$i32* %6, %struct.Channel$i32** %ch.addr, align 8
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 1, i64* %9, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 1, i64* %10, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %11 = call i8* @nish_alloc_struct(i64 4)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %13 = bitcast i8* %11 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  store i32 0, i32* %14, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  store %struct.nish_array* %8, %struct.nish_array** %sums.addr, align 8
  %15 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %15, %struct.ThreadScope** %s.addr, align 8
  %16 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %17 = bitcast %struct.ThreadScope* %16 to i8*
  %18 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  %19 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %18, i32 0, i32 2
  %20 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %21 = call i8* @nish_alloc_struct(i64 16)
  %22 = bitcast i8* %21 to %struct.Job*
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.nish_array*
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 3, i64* %25, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  store i64 3, i64* %26, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %27 = call i8* @nish_alloc_struct(i64 12)
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  store i8* %27, i8** %28, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %29 = bitcast i8* %27 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 0
  store i32 1, i32* %30, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %31 = getelementptr inbounds i32, i32* %29, i64 1
  store i32 2, i32* %31, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %32 = getelementptr inbounds i32, i32* %29, i64 2
  store i32 3, i32* %32, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %33 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  call void @Job.constructor(%struct.Job* %22, %struct.nish_array* %24, %struct.Mutex$$Tally* %33)
  call void @nish.ThreadScope.spawnWith$$Job$void$fn.6.addAll(%struct.ThreadScope* %20, %struct.Job* %22)
  %34 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %35 = call i8* @nish_alloc_struct(i64 16)
  %36 = bitcast i8* %35 to %struct.Job*
  %37 = call i8* @nish_alloc_struct(i64 24)
  %38 = bitcast i8* %37 to %struct.nish_array*
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  store i64 2, i64* %39, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 1
  store i64 2, i64* %40, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %41 = call i8* @nish_alloc_struct(i64 8)
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  store i8* %41, i8** %42, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %43 = bitcast i8* %41 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 0
  store i32 40, i32* %44, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %45 = getelementptr inbounds i32, i32* %43, i64 1
  store i32 50, i32* %45, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %46 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  call void @Job.constructor(%struct.Job* %36, %struct.nish_array* %38, %struct.Mutex$$Tally* %46)
  call void @nish.ThreadScope.spawnWith$$Job$void$fn.6.addAll(%struct.ThreadScope* %34, %struct.Job* %36)
  %47 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %48 = call i8* @nish_alloc_struct(i64 16)
  %49 = bitcast i8* %48 to %struct.Pipe*
  %50 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %49, %struct.Channel$i32* %50, i32 10)
  call void @nish.ThreadScope.spawnWith$$Pipe$void$fn.7.produce(%struct.ThreadScope* %47, %struct.Pipe* %49)
  %51 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %52 = call i8* @nish_alloc_struct(i64 16)
  %53 = bitcast i8* %52 to %struct.Pipe*
  %54 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %53, %struct.Channel$i32* %54, i32 4)
  call void @nish.ThreadScope.spawnWith$$Pipe$void$fn.7.produce(%struct.ThreadScope* %51, %struct.Pipe* %53)
  %55 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %56 = call i8* @nish_alloc_struct(i64 16)
  %57 = bitcast i8* %56 to %struct.Pipe*
  %58 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %57, %struct.Channel$i32* %58, i32 0)
  %59 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  call void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume(%struct.ThreadScope* %55, %struct.Pipe* %57, %struct.nish_array* %59, i32 0)
  call void @nish_channel_count(i64* %19, i64 -1)
  call void @nish_scope_join(i8* %17)
  %60 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %61 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %60)
  store %struct.MutexGuard$$Tally* %61, %struct.MutexGuard$$Tally** %g.addr, align 8
  %62 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %63 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %62, i32 0, i32 1
  %64 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %65 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %64, i32 0, i32 0
  %66 = load %struct.Tally*, %struct.Tally** %65, align 8, !tbaa !23
  %67 = getelementptr inbounds %struct.Tally, %struct.Tally* %66, i32 0, i32 0
  %68 = load i32, i32* %67, align 4, !tbaa !25
  %69 = call i8* @nish_str_from_i32(i32 %68)
  %70 = call i8* @nish_str_concat(i8* %69, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %71 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %74 = icmp ult i64 0, %73
  br i1 %74, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %73)
  unreachable

bounds.ok:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %77 = bitcast i8* %76 to i32*
  %78 = getelementptr inbounds i32, i32* %77, i64 0
  %79 = load i32, i32* %78, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %80 = call i8* @nish_str_from_i32(i32 %79)
  %81 = call i8* @nish_str_concat(i8* %70, i8* %80)
  call void @nish_print(i8* %81)
  store atomic i32 0, i32* %63 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Job", !2, i64 0, !2, i64 8}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 8}
!6 = !{!"i32", !1, i64 0}
!7 = !{!"Pipe", !2, i64 0, !6, i64 8}
!8 = !{!7, !2, i64 0}
!9 = !{!7, !6, i64 8}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !16, i64 16}
!20 = !{!"element i32", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{!"MutexGuard$$Tally", !2, i64 0, !6, i64 8}
!23 = !{!22, !2, i64 0}
!24 = !{!"Tally", !6, i64 0}
!25 = !{!24, !6, i64 0}
!26 = !{!17, !15, i64 8}
