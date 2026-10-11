%struct.Tally = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$$Mutex$$Tally$i32$fn.4.work(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef nonnull align 8 dereferenceable(8), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #0
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

define internal noundef i32 @firstOver(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m, i32 noundef %limit) #0 {
entry:
  %i.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 100
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %2, %struct.MutexGuard$$Tally** %g.addr, align 8
  %3 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %4 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %3, i32 0, i32 1
  %5 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %6 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %5, i32 0, i32 0
  %7 = load %struct.Tally*, %struct.Tally** %6, align 8, !tbaa !5
  %8 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %9 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %8, i32 0, i32 0
  %10 = load %struct.Tally*, %struct.Tally** %9, align 8, !tbaa !5
  %11 = getelementptr inbounds %struct.Tally, %struct.Tally* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !7
  %13 = load i32, i32* %i.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = getelementptr inbounds %struct.Tally, %struct.Tally* %7, i32 0, i32 0
  store i32 %15, i32* %17, align 4, !tbaa !7
  %18 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %19 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %18, i32 0, i32 0
  %20 = load %struct.Tally*, %struct.Tally** %19, align 8, !tbaa !5
  %21 = getelementptr inbounds %struct.Tally, %struct.Tally* %20, i32 0, i32 0
  %22 = load i32, i32* %21, align 4, !tbaa !7
  %23 = icmp sgt i32 %22, %limit
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %25 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %24, i32 0, i32 0
  %26 = load %struct.Tally*, %struct.Tally** %25, align 8, !tbaa !5
  %27 = getelementptr inbounds %struct.Tally, %struct.Tally* %26, i32 0, i32 0
  %28 = load i32, i32* %27, align 4, !tbaa !7
  store atomic i32 0, i32* %4 release, align 4
  ret i32 %28

if.end:
  store atomic i32 0, i32* %4 release, align 4
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @evensToSix(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m) #0 {
entry:
  %i.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %g.addr.1 = alloca %struct.MutexGuard$$Tally*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 100
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %2, %struct.MutexGuard$$Tally** %g.addr, align 8
  %3 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %4 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %3, i32 0, i32 1
  %5 = load i32, i32* %i.addr, align 4
  %6 = srem i32 %5, 2
  %7 = icmp eq i32 %6, 1
  br i1 %7, label %if.then, label %if.end

if.then:
  store atomic i32 0, i32* %4 release, align 4
  br label %for.inc

if.end:
  %8 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %9 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %8, i32 0, i32 0
  %10 = load %struct.Tally*, %struct.Tally** %9, align 8, !tbaa !5
  %11 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %12 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %11, i32 0, i32 0
  %13 = load %struct.Tally*, %struct.Tally** %12, align 8, !tbaa !5
  %14 = getelementptr inbounds %struct.Tally, %struct.Tally* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !7
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = getelementptr inbounds %struct.Tally, %struct.Tally* %10, i32 0, i32 0
  store i32 %17, i32* %19, align 4, !tbaa !7
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp eq i32 %20, 6
  br i1 %21, label %if.then.1, label %if.end.1

if.then.1:
  store atomic i32 0, i32* %4 release, align 4
  br label %for.end

if.end.1:
  store atomic i32 0, i32* %4 release, align 4
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %24, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %25 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %26 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %25, i32 0, i32 1
  %27 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %28 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %27, i32 0, i32 0
  %29 = load %struct.Tally*, %struct.Tally** %28, align 8, !tbaa !5
  %30 = getelementptr inbounds %struct.Tally, %struct.Tally* %29, i32 0, i32 0
  %31 = load i32, i32* %30, align 4, !tbaa !7
  store atomic i32 0, i32* %26 release, align 4
  ret i32 %31

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @labelled(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m) #0 {
entry:
  %a.addr = alloca i64, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %label.addr = alloca i8*, align 8
  %g.addr.1 = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %2, %struct.MutexGuard$$Tally** %g.addr, align 8
  %3 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %4 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %3, i32 0, i32 1
  %5 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %6 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %5, i32 0, i32 0
  %7 = load %struct.Tally*, %struct.Tally** %6, align 8, !tbaa !5
  %8 = getelementptr inbounds %struct.Tally, %struct.Tally* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4, !tbaa !7
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %10)
  store i8* %11, i8** %label.addr, align 8
  %12 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %13 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %12, i32 0, i32 0
  %14 = load %struct.Tally*, %struct.Tally** %13, align 8, !tbaa !5
  %15 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %16 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %15, i32 0, i32 0
  %17 = load %struct.Tally*, %struct.Tally** %16, align 8, !tbaa !5
  %18 = getelementptr inbounds %struct.Tally, %struct.Tally* %17, i32 0, i32 0
  %19 = load i32, i32* %18, align 4, !tbaa !7
  %20 = load i8*, i8** %label.addr, align 8
  %21 = bitcast i8* %20 to i64*
  %22 = load i64, i64* %21, align 8
  %23 = trunc i64 %22 to i32
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok

ovf.ok:
  %27 = getelementptr inbounds %struct.Tally, %struct.Tally* %14, i32 0, i32 0
  store i32 %25, i32* %27, align 4, !tbaa !7
  store atomic i32 0, i32* %4 release, align 4
  call void @nish_arena_release(i64 %1)
  %28 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %28, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %29 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %30 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %29, i32 0, i32 1
  %31 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %32 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %31, i32 0, i32 0
  %33 = load %struct.Tally*, %struct.Tally** %32, align 8, !tbaa !5
  %34 = getelementptr inbounds %struct.Tally, %struct.Tally* %33, i32 0, i32 0
  %35 = load i32, i32* %34, align 4, !tbaa !7
  store atomic i32 0, i32* %30 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %35

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @work(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m) #0 {
entry:
  %0 = call i32 @firstOver(%struct.Mutex$$Tally* %m, i32 1000000)
  %1 = call i32 @evensToSix(%struct.Mutex$$Tally* %m)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj = alloca %struct.Mutex$$Tally, align 8
  %b.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj.1 = alloca %struct.Mutex$$Tally, align 8
  %c.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj.2 = alloca %struct.Mutex$$Tally, align 8
  %shared.addr = alloca %struct.Mutex$$Tally*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Tally*
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !7
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Tally* %1)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Mutex$$Tally** %a.addr, align 8
  %3 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %a.addr, align 8
  %4 = call i32 @firstOver(%struct.Mutex$$Tally* %3, i32 10)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %7 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %a.addr, align 8
  %8 = call i32 @firstOver(%struct.Mutex$$Tally* %7, i32 10)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %6, i8* %9)
  call void @nish_print(i8* %10)
  %11 = call i8* @nish_alloc_struct(i64 4)
  %12 = bitcast i8* %11 to %struct.Tally*
  %13 = getelementptr inbounds %struct.Tally, %struct.Tally* %12, i32 0, i32 0
  store i32 0, i32* %13, align 4, !tbaa !7
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj.1, %struct.Tally* %12)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj.1, %struct.Mutex$$Tally** %b.addr, align 8
  %14 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %b.addr, align 8
  %15 = call i32 @evensToSix(%struct.Mutex$$Tally* %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %18 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %b.addr, align 8
  %19 = call i32 @evensToSix(%struct.Mutex$$Tally* %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  call void @nish_print(i8* %21)
  %22 = call i8* @nish_alloc_struct(i64 4)
  %23 = bitcast i8* %22 to %struct.Tally*
  %24 = getelementptr inbounds %struct.Tally, %struct.Tally* %23, i32 0, i32 0
  store i32 0, i32* %24, align 4, !tbaa !7
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj.2, %struct.Tally* %23)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj.2, %struct.Mutex$$Tally** %c.addr, align 8
  %25 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %c.addr, align 8
  %26 = call i32 @labelled(%struct.Mutex$$Tally* %25)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %29 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %c.addr, align 8
  %30 = call i32 @labelled(%struct.Mutex$$Tally* %29)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %28, i8* %31)
  call void @nish_print(i8* %32)
  %33 = call i8* @nish_alloc_struct(i64 8)
  %34 = bitcast i8* %33 to %struct.Mutex$$Tally*
  %35 = call i8* @nish_alloc_struct(i64 4)
  %36 = bitcast i8* %35 to %struct.Tally*
  %37 = getelementptr inbounds %struct.Tally, %struct.Tally* %36, i32 0, i32 0
  store i32 0, i32* %37, align 4, !tbaa !7
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %34, %struct.Tally* %36)
  store %struct.Mutex$$Tally* %34, %struct.Mutex$$Tally** %shared.addr, align 8
  %38 = call i8* @nish_alloc_struct(i64 24)
  %39 = bitcast i8* %38 to %struct.nish_array*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  store i64 3, i64* %40, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  store i64 3, i64* %41, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %42 = call i8* @nish_alloc_struct(i64 12)
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  store i8* %42, i8** %43, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %44 = bitcast i8* %42 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 0
  store i32 0, i32* %45, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %46 = getelementptr inbounds i32, i32* %44, i64 1
  store i32 0, i32* %46, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %47 = getelementptr inbounds i32, i32* %44, i64 2
  store i32 0, i32* %47, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  store %struct.nish_array* %39, %struct.nish_array** %out.addr, align 8
  %48 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %48, %struct.ThreadScope** %s.addr, align 8
  %49 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %50 = bitcast %struct.ThreadScope* %49 to i8*
  %51 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %52 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %shared.addr, align 8
  %53 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$$Mutex$$Tally$i32$fn.4.work(%struct.ThreadScope* %51, %struct.Mutex$$Tally* %52, %struct.nish_array* %53, i32 0)
  %54 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %55 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %shared.addr, align 8
  %56 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$$Mutex$$Tally$i32$fn.4.work(%struct.ThreadScope* %54, %struct.Mutex$$Tally* %55, %struct.nish_array* %56, i32 1)
  %57 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %58 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %shared.addr, align 8
  %59 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$$Mutex$$Tally$i32$fn.4.work(%struct.ThreadScope* %57, %struct.Mutex$$Tally* %58, %struct.nish_array* %59, i32 2)
  call void @nish_scope_join(i8* %50)
  %60 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %shared.addr, align 8
  %61 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %60)
  store %struct.MutexGuard$$Tally* %61, %struct.MutexGuard$$Tally** %g.addr, align 8
  %62 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %63 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %62, i32 0, i32 1
  %64 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %65 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %64, i32 0, i32 0
  %66 = load %struct.Tally*, %struct.Tally** %65, align 8, !tbaa !5
  %67 = getelementptr inbounds %struct.Tally, %struct.Tally* %66, i32 0, i32 0
  %68 = load i32, i32* %67, align 4, !tbaa !7
  %69 = call i8* @nish_str_from_i32(i32 %68)
  call void @nish_print(i8* %69)
  store atomic i32 0, i32* %63 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"MutexGuard$$Tally", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!"Tally", !3, i64 0}
!7 = !{!6, !3, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !13, i64 8}
!18 = !{!15, !14, i64 16}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
