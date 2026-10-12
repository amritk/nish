%struct.Label = type { i8*, i32 }
%struct.Job = type { i32, %struct.Mutex$i32*, %struct.Mutex$$Label* }
%struct.Mutex$i32 = type { %struct.MutexGuard$i32* }
%struct.MutexGuard$i32 = type { i32, i32 }
%struct.Mutex$$Label = type { %struct.MutexGuard$$Label* }
%struct.MutexGuard$$Label = type { %struct.Label*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"total\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Job$i32$fn.4.work(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Job* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.Mutex$i32.constructor(%struct.Mutex$i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(8) %struct.MutexGuard$i32* @nish.Mutex$i32.lock(%struct.Mutex$i32* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #1
declare void @nish.MutexGuard$i32.constructor(%struct.MutexGuard$i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i32 noundef) #0
declare void @nish.Mutex$$Label.constructor(%struct.Mutex$$Label* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Label* noundef nonnull align 8 dereferenceable(16)) #0
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Label* @nish.Mutex$$Label.lock(%struct.Mutex$$Label* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #1
declare void @nish.MutexGuard$$Label.constructor(%struct.MutexGuard$$Label* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Label* noundef nonnull align 8 dereferenceable(16)) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #1
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

define internal void @Label.constructor(%struct.Label* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name, i32 noundef %hits) #0 {
entry:
  %0 = getelementptr inbounds %struct.Label, %struct.Label* %this, i32 0, i32 0
  store i8* %name, i8** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Label, %struct.Label* %this, i32 0, i32 1
  store i32 %hits, i32* %1, align 4, !tbaa !6
  ret void
}

define internal void @Job.constructor(%struct.Job* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %times, %struct.Mutex$i32* noundef nonnull align 8 dereferenceable(8) %count, %struct.Mutex$$Label* noundef nonnull align 8 dereferenceable(8) %label) #0 {
entry:
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 0
  store i32 %times, i32* %0, align 4, !tbaa !8
  %1 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 1
  store %struct.Mutex$i32* %count, %struct.Mutex$i32** %1, align 8, !tbaa !9
  %2 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 2
  store %struct.Mutex$$Label* %label, %struct.Mutex$$Label** %2, align 8, !tbaa !10
  ret void
}

define hidden noundef i32 @work(%struct.Job* noundef nonnull readonly align 8 dereferenceable(24) nocapture %job) #1 {
entry:
  %k.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$i32*, align 8
  %h.addr = alloca %struct.MutexGuard$$Label*, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !8
  %3 = icmp slt i32 %0, %2
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 1
  %5 = load %struct.Mutex$i32*, %struct.Mutex$i32** %4, align 8, !tbaa !9
  %6 = call %struct.MutexGuard$i32* @nish.Mutex$i32.lock(%struct.Mutex$i32* %5)
  store %struct.MutexGuard$i32* %6, %struct.MutexGuard$i32** %g.addr, align 8
  %7 = load %struct.MutexGuard$i32*, %struct.MutexGuard$i32** %g.addr, align 8
  %8 = getelementptr inbounds %struct.MutexGuard$i32, %struct.MutexGuard$i32* %7, i32 0, i32 1
  %9 = load %struct.MutexGuard$i32*, %struct.MutexGuard$i32** %g.addr, align 8
  %10 = load %struct.MutexGuard$i32*, %struct.MutexGuard$i32** %g.addr, align 8
  %11 = getelementptr inbounds %struct.MutexGuard$i32, %struct.MutexGuard$i32* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !12
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 2)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = getelementptr inbounds %struct.MutexGuard$i32, %struct.MutexGuard$i32* %9, i32 0, i32 0
  store i32 %14, i32* %16, align 4, !tbaa !12
  store atomic i32 0, i32* %8 release, align 4
  %17 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 2
  %18 = load %struct.Mutex$$Label*, %struct.Mutex$$Label** %17, align 8, !tbaa !10
  %19 = call %struct.MutexGuard$$Label* @nish.Mutex$$Label.lock(%struct.Mutex$$Label* %18)
  store %struct.MutexGuard$$Label* %19, %struct.MutexGuard$$Label** %h.addr, align 8
  %20 = load %struct.MutexGuard$$Label*, %struct.MutexGuard$$Label** %h.addr, align 8
  %21 = getelementptr inbounds %struct.MutexGuard$$Label, %struct.MutexGuard$$Label* %20, i32 0, i32 1
  %22 = load %struct.MutexGuard$$Label*, %struct.MutexGuard$$Label** %h.addr, align 8
  %23 = getelementptr inbounds %struct.MutexGuard$$Label, %struct.MutexGuard$$Label* %22, i32 0, i32 0
  %24 = load %struct.Label*, %struct.Label** %23, align 8, !tbaa !14
  %25 = load %struct.MutexGuard$$Label*, %struct.MutexGuard$$Label** %h.addr, align 8
  %26 = getelementptr inbounds %struct.MutexGuard$$Label, %struct.MutexGuard$$Label* %25, i32 0, i32 0
  %27 = load %struct.Label*, %struct.Label** %26, align 8, !tbaa !14
  %28 = getelementptr inbounds %struct.Label, %struct.Label* %27, i32 0, i32 1
  %29 = load i32, i32* %28, align 4, !tbaa !6
  %30 = load %struct.MutexGuard$$Label*, %struct.MutexGuard$$Label** %h.addr, align 8
  %31 = getelementptr inbounds %struct.MutexGuard$$Label, %struct.MutexGuard$$Label* %30, i32 0, i32 0
  %32 = load %struct.Label*, %struct.Label** %31, align 8, !tbaa !14
  %33 = getelementptr inbounds %struct.Label, %struct.Label* %32, i32 0, i32 0
  %34 = load i8*, i8** %33, align 8, !tbaa !5
  %35 = bitcast i8* %34 to i64*
  %36 = load i64, i64* %35, align 8
  %37 = trunc i64 %36 to i32
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %41 = getelementptr inbounds %struct.Label, %struct.Label* %24, i32 0, i32 1
  store i32 %39, i32* %41, align 4, !tbaa !6
  store atomic i32 0, i32* %21 release, align 4
  br label %for.inc

for.inc:
  %42 = load i32, i32* %k.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %count.addr = alloca %struct.Mutex$i32*, align 8
  %label.addr = alloca %struct.Mutex$$Label*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %t.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$i32*, align 8
  %total.addr = alloca i32, align 4
  %g.addr.1 = alloca %struct.MutexGuard$i32*, align 8
  %h.addr = alloca %struct.MutexGuard$$Label*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Mutex$i32*
  call void @nish.Mutex$i32.constructor(%struct.Mutex$i32* %1, i32 0)
  store %struct.Mutex$i32* %1, %struct.Mutex$i32** %count.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Mutex$$Label*
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = bitcast i8* %4 to %struct.Label*
  call void @Label.constructor(%struct.Label* %5, i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i32 0)
  call void @nish.Mutex$$Label.constructor(%struct.Mutex$$Label* %3, %struct.Label* %5)
  store %struct.Mutex$$Label* %3, %struct.Mutex$$Label** %label.addr, align 8
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 4, i64* %8, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 4, i64* %9, align 8, !alias.scope !18, !noalias !19, !tbaa !24
  %10 = call i8* @nish_alloc_struct(i64 16)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %12 = bitcast i8* %10 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  store i32 0, i32* %13, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %14 = getelementptr inbounds i32, i32* %12, i64 1
  store i32 0, i32* %14, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %15 = getelementptr inbounds i32, i32* %12, i64 2
  store i32 0, i32* %15, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  %16 = getelementptr inbounds i32, i32* %12, i64 3
  store i32 0, i32* %16, align 4, !alias.scope !19, !noalias !18, !tbaa !27
  store %struct.nish_array* %7, %struct.nish_array** %done.addr, align 8
  %17 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %17, %struct.ThreadScope** %s.addr, align 8
  %18 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %19 = bitcast %struct.ThreadScope* %18 to i8*
  store i32 0, i32* %t.addr, align 4
  br label %for.cond

for.cond:
  %20 = load i32, i32* %t.addr, align 4
  %21 = icmp slt i32 %20, 4
  br i1 %21, label %for.body, label %for.end

for.body:
  %22 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.Job*
  %25 = load %struct.Mutex$i32*, %struct.Mutex$i32** %count.addr, align 8
  %26 = load %struct.Mutex$$Label*, %struct.Mutex$$Label** %label.addr, align 8
  call void @Job.constructor(%struct.Job* %24, i32 50000, %struct.Mutex$i32* %25, %struct.Mutex$$Label* %26)
  %27 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %28 = load i32, i32* %t.addr, align 4
  call void @nish.ThreadScope.spawn$$Job$i32$fn.4.work(%struct.ThreadScope* %22, %struct.Job* %24, %struct.nish_array* %27, i32 %28)
  br label %for.inc

for.inc:
  %29 = load i32, i32* %t.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %t.addr, align 4
  br label %for.cond

for.end:
  call void @nish_scope_join(i8* %19)
  %31 = load %struct.Mutex$i32*, %struct.Mutex$i32** %count.addr, align 8
  %32 = call %struct.MutexGuard$i32* @nish.Mutex$i32.lock(%struct.Mutex$i32* %31)
  store %struct.MutexGuard$i32* %32, %struct.MutexGuard$i32** %g.addr, align 8
  %33 = load %struct.MutexGuard$i32*, %struct.MutexGuard$i32** %g.addr, align 8
  %34 = getelementptr inbounds %struct.MutexGuard$i32, %struct.MutexGuard$i32* %33, i32 0, i32 1
  %35 = load %struct.MutexGuard$i32*, %struct.MutexGuard$i32** %g.addr, align 8
  %36 = load %struct.MutexGuard$i32*, %struct.MutexGuard$i32** %g.addr, align 8
  %37 = getelementptr inbounds %struct.MutexGuard$i32, %struct.MutexGuard$i32* %36, i32 0, i32 0
  %38 = load i32, i32* %37, align 4, !tbaa !12
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %38, i32 1)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok

ovf.ok:
  %42 = getelementptr inbounds %struct.MutexGuard$i32, %struct.MutexGuard$i32* %35, i32 0, i32 0
  store i32 %40, i32* %42, align 4, !tbaa !12
  store atomic i32 0, i32* %34 release, align 4
  store i32 0, i32* %total.addr, align 4
  %43 = load %struct.Mutex$i32*, %struct.Mutex$i32** %count.addr, align 8
  %44 = call %struct.MutexGuard$i32* @nish.Mutex$i32.lock(%struct.Mutex$i32* %43)
  store %struct.MutexGuard$i32* %44, %struct.MutexGuard$i32** %g.addr.1, align 8
  %45 = load %struct.MutexGuard$i32*, %struct.MutexGuard$i32** %g.addr.1, align 8
  %46 = getelementptr inbounds %struct.MutexGuard$i32, %struct.MutexGuard$i32* %45, i32 0, i32 1
  %47 = load %struct.MutexGuard$i32*, %struct.MutexGuard$i32** %g.addr.1, align 8
  %48 = getelementptr inbounds %struct.MutexGuard$i32, %struct.MutexGuard$i32* %47, i32 0, i32 0
  %49 = load i32, i32* %48, align 4, !tbaa !12
  store i32 %49, i32* %total.addr, align 4
  store atomic i32 0, i32* %46 release, align 4
  %50 = load %struct.Mutex$$Label*, %struct.Mutex$$Label** %label.addr, align 8
  %51 = call %struct.MutexGuard$$Label* @nish.Mutex$$Label.lock(%struct.Mutex$$Label* %50)
  store %struct.MutexGuard$$Label* %51, %struct.MutexGuard$$Label** %h.addr, align 8
  %52 = load %struct.MutexGuard$$Label*, %struct.MutexGuard$$Label** %h.addr, align 8
  %53 = getelementptr inbounds %struct.MutexGuard$$Label, %struct.MutexGuard$$Label* %52, i32 0, i32 1
  %54 = load i32, i32* %total.addr, align 4
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %57 = load %struct.MutexGuard$$Label*, %struct.MutexGuard$$Label** %h.addr, align 8
  %58 = getelementptr inbounds %struct.MutexGuard$$Label, %struct.MutexGuard$$Label* %57, i32 0, i32 0
  %59 = load %struct.Label*, %struct.Label** %58, align 8, !tbaa !14
  %60 = getelementptr inbounds %struct.Label, %struct.Label* %59, i32 0, i32 1
  %61 = load i32, i32* %60, align 4, !tbaa !6
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %56, i8* %62)
  call void @nish_print(i8* %63)
  store atomic i32 0, i32* %53 release, align 4
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
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Label", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!"Job", !3, i64 0, !2, i64 8, !2, i64 16}
!8 = !{!7, !3, i64 0}
!9 = !{!7, !2, i64 8}
!10 = !{!7, !2, i64 16}
!11 = !{!"MutexGuard$i32", !3, i64 0, !3, i64 4}
!12 = !{!11, !3, i64 0}
!13 = !{!"MutexGuard$$Label", !2, i64 0, !3, i64 8}
!14 = !{!13, !2, i64 0}
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
