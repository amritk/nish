%struct.Tally = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
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

define internal noundef i32 @scopeThenLock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m) #0 {
entry:
  %s.addr = alloca %struct.ThreadScope*, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %g.addr.1 = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %0, %struct.ThreadScope** %s.addr, align 8
  %1 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %1, %struct.MutexGuard$$Tally** %g.addr, align 8
  %2 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %3 = bitcast %struct.ThreadScope* %2 to i8*
  %4 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %5 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %4, i32 0, i32 1
  %6 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %7 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %6, i32 0, i32 0
  %8 = load %struct.Tally*, %struct.Tally** %7, align 8, !tbaa !5
  %9 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %10 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %9, i32 0, i32 0
  %11 = load %struct.Tally*, %struct.Tally** %10, align 8, !tbaa !5
  %12 = getelementptr inbounds %struct.Tally, %struct.Tally* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4, !tbaa !7
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 1)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = getelementptr inbounds %struct.Tally, %struct.Tally* %8, i32 0, i32 0
  store i32 %15, i32* %17, align 4, !tbaa !7
  store atomic i32 0, i32* %5 release, align 4
  call void @nish_scope_join(i8* %3)
  %18 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %18, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %19 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %20 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %19, i32 0, i32 1
  %21 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %22 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %21, i32 0, i32 0
  %23 = load %struct.Tally*, %struct.Tally** %22, align 8, !tbaa !5
  %24 = getelementptr inbounds %struct.Tally, %struct.Tally* %23, i32 0, i32 0
  %25 = load i32, i32* %24, align 4, !tbaa !7
  store atomic i32 0, i32* %20 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %25

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @arenaThenLock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m) #0 {
entry:
  %a.addr = alloca i64, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %label.addr = alloca i8*, align 8
  %g.addr.1 = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %1, %struct.MutexGuard$$Tally** %g.addr, align 8
  %2 = load i64, i64* %a.addr, align 8
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
  call void @nish_arena_release(i64 %2)
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

define internal noundef i32 @lockThenArena(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m) #0 {
entry:
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %a.addr = alloca i64, align 8
  %label.addr = alloca i8*, align 8
  %g.addr.1 = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %0, %struct.MutexGuard$$Tally** %g.addr, align 8
  %1 = call i64 @nish_arena_mark()
  store i64 %1, i64* %a.addr, align 8
  %2 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %3 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %2, i32 0, i32 1
  %4 = load i64, i64* %a.addr, align 8
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
  %24 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %23, i32 10)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok

ovf.ok:
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %25)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %30 = getelementptr inbounds %struct.Tally, %struct.Tally* %14, i32 0, i32 0
  store i32 %28, i32* %30, align 4, !tbaa !7
  call void @nish_arena_release(i64 %4)
  store atomic i32 0, i32* %3 release, align 4
  %31 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %31, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %32 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %33 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %32, i32 0, i32 1
  %34 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %35 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %34, i32 0, i32 0
  %36 = load %struct.Tally*, %struct.Tally** %35, align 8, !tbaa !5
  %37 = getelementptr inbounds %struct.Tally, %struct.Tally* %36, i32 0, i32 0
  %38 = load i32, i32* %37, align 4, !tbaa !7
  store atomic i32 0, i32* %33 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %38

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
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
  store i32 0, i32* %2, align 4, !tbaa !7
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Tally* %1)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Mutex$$Tally** %m.addr, align 8
  %3 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %4 = call i32 @scopeThenLock(%struct.Mutex$$Tally* %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %7 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %8 = call i32 @scopeThenLock(%struct.Mutex$$Tally* %7)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %6, i8* %9)
  call void @nish_print(i8* %10)
  %11 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %12 = call i32 @arenaThenLock(%struct.Mutex$$Tally* %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %15 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %16 = call i32 @arenaThenLock(%struct.Mutex$$Tally* %15)
  %17 = call i8* @nish_str_from_i32(i32 %16)
  %18 = call i8* @nish_str_concat(i8* %14, i8* %17)
  call void @nish_print(i8* %18)
  %19 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %20 = call i32 @lockThenArena(%struct.Mutex$$Tally* %19)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %23 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %24 = call i32 @lockThenArena(%struct.Mutex$$Tally* %23)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  call void @nish_print(i8* %26)
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
