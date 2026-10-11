%struct.Counter = type { i32 }
%struct.Job = type { i32, %struct.Mutex$$Counter* }
%struct.Mutex$$Counter = type { %struct.MutexGuard$$Counter* }
%struct.MutexGuard$$Counter = type { %struct.Counter*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Job$i32$fn.7.addMany(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Job* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.Mutex$$Counter.constructor(%struct.Mutex$$Counter* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Counter* noundef nonnull align 8 dereferenceable(4)) #0
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Counter* @nish.Mutex$$Counter.lock(%struct.Mutex$$Counter* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #1
declare void @nish.MutexGuard$$Counter.constructor(%struct.MutexGuard$$Counter* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Counter* noundef nonnull align 8 dereferenceable(4)) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
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

define internal void @Job.constructor(%struct.Job* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %times, %struct.Mutex$$Counter* noundef nonnull align 8 dereferenceable(8) %total) #0 {
entry:
  %0 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 0
  store i32 %times, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Job, %struct.Job* %this, i32 0, i32 1
  store %struct.Mutex$$Counter* %total, %struct.Mutex$$Counter** %1, align 8, !tbaa !6
  ret void
}

define hidden noundef i32 @addMany(%struct.Job* noundef nonnull readonly align 8 dereferenceable(16) nocapture %job) #1 {
entry:
  %k.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Counter*, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !5
  %3 = icmp slt i32 %0, %2
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 1
  %5 = load %struct.Mutex$$Counter*, %struct.Mutex$$Counter** %4, align 8, !tbaa !6
  %6 = call %struct.MutexGuard$$Counter* @nish.Mutex$$Counter.lock(%struct.Mutex$$Counter* %5)
  store %struct.MutexGuard$$Counter* %6, %struct.MutexGuard$$Counter** %g.addr, align 8
  %7 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %8 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %7, i32 0, i32 1
  %9 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %10 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %9, i32 0, i32 0
  %11 = load %struct.Counter*, %struct.Counter** %10, align 8, !tbaa !8
  %12 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %13 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %12, i32 0, i32 0
  %14 = load %struct.Counter*, %struct.Counter** %13, align 8, !tbaa !8
  %15 = getelementptr inbounds %struct.Counter, %struct.Counter* %14, i32 0, i32 0
  %16 = load i32, i32* %15, align 4, !tbaa !10
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 1)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = getelementptr inbounds %struct.Counter, %struct.Counter* %11, i32 0, i32 0
  store i32 %18, i32* %20, align 4, !tbaa !10
  store atomic i32 0, i32* %8 release, align 4
  br label %for.inc

for.inc:
  %21 = load i32, i32* %k.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %23 = getelementptr inbounds %struct.Job, %struct.Job* %job, i32 0, i32 0
  %24 = load i32, i32* %23, align 4, !tbaa !5
  ret i32 %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %total.addr = alloca %struct.Mutex$$Counter*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %t.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Counter*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Mutex$$Counter*
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Counter*
  %4 = getelementptr inbounds %struct.Counter, %struct.Counter* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !10
  call void @nish.Mutex$$Counter.constructor(%struct.Mutex$$Counter* %1, %struct.Counter* %3)
  store %struct.Mutex$$Counter* %1, %struct.Mutex$$Counter** %total.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 4, i64* %7, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 4, i64* %8, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %9 = call i8* @nish_alloc_struct(i64 16)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %11 = bitcast i8* %9 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 0
  store i32 0, i32* %12, align 4, !alias.scope !15, !noalias !14, !tbaa !23
  %13 = getelementptr inbounds i32, i32* %11, i64 1
  store i32 0, i32* %13, align 4, !alias.scope !15, !noalias !14, !tbaa !23
  %14 = getelementptr inbounds i32, i32* %11, i64 2
  store i32 0, i32* %14, align 4, !alias.scope !15, !noalias !14, !tbaa !23
  %15 = getelementptr inbounds i32, i32* %11, i64 3
  store i32 0, i32* %15, align 4, !alias.scope !15, !noalias !14, !tbaa !23
  store %struct.nish_array* %6, %struct.nish_array** %done.addr, align 8
  %16 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %16, %struct.ThreadScope** %s.addr, align 8
  %17 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %18 = bitcast %struct.ThreadScope* %17 to i8*
  store i32 0, i32* %t.addr, align 4
  br label %for.cond

for.cond:
  %19 = load i32, i32* %t.addr, align 4
  %20 = icmp slt i32 %19, 4
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %22 = call i8* @nish_alloc_struct(i64 16)
  %23 = bitcast i8* %22 to %struct.Job*
  %24 = load %struct.Mutex$$Counter*, %struct.Mutex$$Counter** %total.addr, align 8
  call void @Job.constructor(%struct.Job* %23, i32 100000, %struct.Mutex$$Counter* %24)
  %25 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %26 = load i32, i32* %t.addr, align 4
  call void @nish.ThreadScope.spawn$$Job$i32$fn.7.addMany(%struct.ThreadScope* %21, %struct.Job* %23, %struct.nish_array* %25, i32 %26)
  br label %for.inc

for.inc:
  %27 = load i32, i32* %t.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %t.addr, align 4
  br label %for.cond

for.end:
  call void @nish_scope_join(i8* %18)
  %29 = load %struct.Mutex$$Counter*, %struct.Mutex$$Counter** %total.addr, align 8
  %30 = call %struct.MutexGuard$$Counter* @nish.Mutex$$Counter.lock(%struct.Mutex$$Counter* %29)
  store %struct.MutexGuard$$Counter* %30, %struct.MutexGuard$$Counter** %g.addr, align 8
  %31 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %32 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %31, i32 0, i32 1
  %33 = load %struct.MutexGuard$$Counter*, %struct.MutexGuard$$Counter** %g.addr, align 8
  %34 = getelementptr inbounds %struct.MutexGuard$$Counter, %struct.MutexGuard$$Counter* %33, i32 0, i32 0
  %35 = load %struct.Counter*, %struct.Counter** %34, align 8, !tbaa !8
  %36 = getelementptr inbounds %struct.Counter, %struct.Counter* %35, i32 0, i32 0
  %37 = load i32, i32* %36, align 4, !tbaa !10
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %40 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %43 = icmp ult i64 0, %42
  br i1 %43, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %42)
  unreachable

bounds.ok:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 0
  %48 = load i32, i32* %47, align 4, !alias.scope !15, !noalias !14, !tbaa !23
  %49 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %52 = icmp ult i64 1, %51
  br i1 %52, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %51)
  unreachable

bounds.ok.1:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 1
  %57 = load i32, i32* %56, align 4, !alias.scope !15, !noalias !14, !tbaa !23
  %58 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %48, i32 %57)
  %59 = extractvalue { i32, i1 } %58, 0
  %60 = extractvalue { i32, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok

ovf.ok:
  %61 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %64 = icmp ult i64 2, %63
  br i1 %64, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %63)
  unreachable

bounds.ok.2:
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %67 = bitcast i8* %66 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 2
  %69 = load i32, i32* %68, align 4, !alias.scope !15, !noalias !14, !tbaa !23
  %70 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %59, i32 %69)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %73 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %76 = icmp ult i64 3, %75
  br i1 %76, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %75)
  unreachable

bounds.ok.3:
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %79 = bitcast i8* %78 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 3
  %81 = load i32, i32* %80, align 4, !alias.scope !15, !noalias !14, !tbaa !23
  %82 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %71, i32 %81)
  %83 = extractvalue { i32, i1 } %82, 0
  %84 = extractvalue { i32, i1 } %82, 1
  br i1 %84, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %85 = call i8* @nish_str_from_i32(i32 %83)
  %86 = call i8* @nish_str_concat(i8* %39, i8* %85)
  call void @nish_print(i8* %86)
  store atomic i32 0, i32* %32 release, align 4
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
!4 = !{!"Job", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!"MutexGuard$$Counter", !3, i64 0, !2, i64 8}
!8 = !{!7, !3, i64 0}
!9 = !{!"Counter", !2, i64 0}
!10 = !{!9, !2, i64 0}
!11 = !{!"nish array"}
!12 = !{!"header", !11}
!13 = !{!"elements", !11}
!14 = !{!12}
!15 = !{!13}
!16 = !{!"header i64", !1, i64 0}
!17 = !{!"header ptr", !1, i64 0}
!18 = !{!"array header", !16, i64 0, !16, i64 8, !17, i64 16}
!19 = !{!18, !16, i64 0}
!20 = !{!18, !16, i64 8}
!21 = !{!18, !17, i64 16}
!22 = !{!"element i32", !1, i64 0}
!23 = !{!22, !22, i64 0}
