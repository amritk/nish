%struct.ThreadScope = type { i32 }
%struct.Tally = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"parallelMapInto: dst has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c" elements and src has \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"spawn: destination index \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c" is out of range for an array of \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" elements\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #4
declare void @nish_mutex_wait(i32* noundef nonnull) #1
declare double @llvm.floor.f64(double) #0
declare double @llvm.ceil.f64(double) #0
declare i32 @llvm.fptosi.sat.i32.f64(double) #0

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

define internal noundef i32 @nish.reduceBlockCount(i32 noundef %n) #0 {
entry:
  %wanted.addr = alloca i32, align 4
  %0 = sitofp i32 %n to double
  %1 = sitofp i32 1048576 to double
  %2 = fdiv double %0, %1
  %3 = call double @llvm.ceil.f64(double %2)
  %4 = call i32 @llvm.fptosi.sat.i32.f64(double %3)
  store i32 %4, i32* %wanted.addr, align 4
  %5 = load i32, i32* %wanted.addr, align 4
  %6 = icmp slt i32 %5, 64
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %wanted.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ %7, %cond.true ], [ 64, %cond.false ]
  ret i32 %8
}

define internal noundef i32 @nish.reduceBlockStart(i32 noundef %n, i32 noundef %blocks, i32 noundef %k) #0 {
entry:
  %0 = sitofp i32 %n to double
  %1 = sitofp i32 %k to double
  %2 = fmul double %0, %1
  %3 = sitofp i32 %blocks to double
  %4 = fdiv double %2, %3
  %5 = call double @llvm.floor.f64(double %4)
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  ret i32 %6
}

define internal void @nish.dstTooShort(i32 noundef %have, i32 noundef %want) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %have)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i8* %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [23 x i8] }* @.str.1 to i8*))
  %3 = call i8* @nish_str_from_i32(i32 %want)
  %4 = call i8* @nish_str_concat(i8* %2, i8* %3)
  call void @nish_write(i8* %4, i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define internal void @nish.slotOutOfRange(i32 noundef %at, i32 noundef %length) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %at)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i8* %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [34 x i8] }* @.str.3 to i8*))
  %3 = call i8* @nish_str_from_i32(i32 %length)
  %4 = call i8* @nish_str_concat(i8* %2, i8* %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  call void @nish_write(i8* %5, i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.ThreadScope*
  %2 = getelementptr inbounds %struct.ThreadScope, %struct.ThreadScope* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  ret %struct.ThreadScope* %1
}

define void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %this, i32 0, i32 0
  store %struct.Tally* %value, %struct.Tally** %1, align 8, !tbaa !8
  ret void
}

define void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %init) #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.MutexGuard$$Tally*
  call void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* %1, %struct.Tally* %init)
  %2 = getelementptr inbounds %struct.Mutex$$Tally, %struct.Mutex$$Tally* %this, i32 0, i32 0
  store %struct.MutexGuard$$Tally* %1, %struct.MutexGuard$$Tally** %2, align 8, !tbaa !10
  ret void
}

define noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Mutex$$Tally, %struct.Mutex$$Tally* %this, i32 0, i32 0
  %1 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %0, align 8, !tbaa !10
  %2 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %1, i32 0, i32 1
  %3 = cmpxchg i32* %2, i32 0, i32 1 acquire monotonic
  %4 = extractvalue { i32, i1 } %3, 1
  br i1 %4, label %lock.held, label %lock.wait

lock.wait:
  call void @nish_mutex_wait(i32* %2)
  br label %lock.held

lock.held:
  ret %struct.MutexGuard$$Tally* %1
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { noreturn nounwind }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ThreadScope", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"MutexGuard$$Tally", !5, i64 0, !2, i64 8}
!7 = !{!6, !2, i64 8}
!8 = !{!6, !5, i64 0}
!9 = !{!"Mutex$$Tally", !5, i64 0}
!10 = !{!9, !5, i64 0}
