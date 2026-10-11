%struct.Tally = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

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

define internal { i1, i32, i32 } @addOk(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m, { i1, i32, i32 } %r) #0 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %v.addr = alloca i32, align 4
  %0 = extractvalue { i1, i32, i32 } %r, 0
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = extractvalue { i1, i32, i32 } %r, 1
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %2, i32* %3, align 4
  %4 = extractvalue { i1, i32, i32 } %r, 2
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %4, i32* %5, align 4
  %6 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %6, %struct.MutexGuard$$Tally** %g.addr, align 8
  %7 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %8 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %7, i32 0, i32 1
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %10 = load i1, i1* %9, align 1
  br i1 %10, label %res.ok, label %res.propagate

res.propagate:
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %12 = load i32, i32* %11, align 4
  %13 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %12, 2
  store atomic i32 0, i32* %8 release, align 4
  ret { i1, i32, i32 } %13

res.ok:
  %14 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %15 = load i32, i32* %14, align 4
  store i32 %15, i32* %v.addr, align 4
  %16 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %17 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %16, i32 0, i32 0
  %18 = load %struct.Tally*, %struct.Tally** %17, align 8, !tbaa !5
  %19 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %20 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %19, i32 0, i32 0
  %21 = load %struct.Tally*, %struct.Tally** %20, align 8, !tbaa !5
  %22 = getelementptr inbounds %struct.Tally, %struct.Tally* %21, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !7
  %24 = load i32, i32* %v.addr, align 4
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  %28 = getelementptr inbounds %struct.Tally, %struct.Tally* %18, i32 0, i32 0
  store i32 %26, i32* %28, align 4, !tbaa !7
  %29 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %30 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %29, i32 0, i32 0
  %31 = load %struct.Tally*, %struct.Tally** %30, align 8, !tbaa !5
  %32 = getelementptr inbounds %struct.Tally, %struct.Tally* %31, i32 0, i32 0
  %33 = load i32, i32* %32, align 4, !tbaa !7
  %34 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %33, 1
  store atomic i32 0, i32* %8 release, align 4
  ret { i1, i32, i32 } %34

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj = alloca %struct.Mutex$$Tally, align 8
  %first.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %second.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %third.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.2 = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Tally*
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !7
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Tally* %1)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Mutex$$Tally** %m.addr, align 8
  %3 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %4 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 7, 2
  %5 = call { i1, i32, i32 } @addOk(%struct.Mutex$$Tally* %3, { i1, i32, i32 } %4)
  %6 = extractvalue { i1, i32, i32 } %5, 0
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %6, i1* %7, align 1
  %8 = extractvalue { i1, i32, i32 } %5, 1
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %8, i32* %9, align 4
  %10 = extractvalue { i1, i32, i32 } %5, 2
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %10, i32* %11, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %first.addr, align 8
  %12 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %13 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 5, 1
  %14 = call { i1, i32, i32 } @addOk(%struct.Mutex$$Tally* %12, { i1, i32, i32 } %13)
  %15 = extractvalue { i1, i32, i32 } %14, 0
  %16 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %15, i1* %16, align 1
  %17 = extractvalue { i1, i32, i32 } %14, 1
  %18 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %17, i32* %18, align 4
  %19 = extractvalue { i1, i32, i32 } %14, 2
  %20 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %19, i32* %20, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, %struct.nish_result.i32.i32** %second.addr, align 8
  %21 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %22 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 4, 1
  %23 = call { i1, i32, i32 } @addOk(%struct.Mutex$$Tally* %21, { i1, i32, i32 } %22)
  %24 = extractvalue { i1, i32, i32 } %23, 0
  %25 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  store i1 %24, i1* %25, align 1
  %26 = extractvalue { i1, i32, i32 } %23, 1
  %27 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  store i32 %26, i32* %27, align 4
  %28 = extractvalue { i1, i32, i32 } %23, 2
  %29 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 2
  store i32 %28, i32* %29, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, %struct.nish_result.i32.i32** %third.addr, align 8
  %30 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %first.addr, align 8
  %31 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %30, i32 0, i32 0
  %32 = load i1, i1* %31, align 1
  br i1 %32, label %res.ok, label %res.alt

res.ok:
  %33 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %30, i32 0, i32 1
  %34 = load i32, i32* %33, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %35 = phi i32 [ %34, %res.ok ], [ -1, %res.alt ]
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %38 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %second.addr, align 8
  %39 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %38, i32 0, i32 0
  %40 = load i1, i1* %39, align 1
  br i1 %40, label %res.ok.1, label %res.alt.1

res.ok.1:
  %41 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %38, i32 0, i32 1
  %42 = load i32, i32* %41, align 4
  br label %res.end.1

res.alt.1:
  br label %res.end.1

res.end.1:
  %43 = phi i32 [ %42, %res.ok.1 ], [ -1, %res.alt.1 ]
  %44 = call i8* @nish_str_from_i32(i32 %43)
  %45 = call i8* @nish_str_concat(i8* %37, i8* %44)
  %46 = call i8* @nish_str_concat(i8* %45, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %47 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %third.addr, align 8
  %48 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %47, i32 0, i32 0
  %49 = load i1, i1* %48, align 1
  br i1 %49, label %res.ok.2, label %res.alt.2

res.ok.2:
  %50 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %47, i32 0, i32 1
  %51 = load i32, i32* %50, align 4
  br label %res.end.2

res.alt.2:
  br label %res.end.2

res.end.2:
  %52 = phi i32 [ %51, %res.ok.2 ], [ -1, %res.alt.2 ]
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %46, i8* %53)
  call void @nish_print(i8* %54)
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
