%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"parallelMapInto: dst has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c" elements and src has \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"spawn: destination index \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c" is out of range for an array of \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" elements\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef double @sumOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture) #3
declare noundef i32 @primesBelow(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #5
declare void @nish_scope_spawn(i8* noundef nonnull, void (i8*)* noundef nonnull, void (i8*)* noundef nonnull, i8* noundef nonnull, i64 noundef) #1
declare double @llvm.floor.f64(double) #0
declare double @llvm.ceil.f64(double) #0
declare i32 @llvm.fptosi.sat.i32.f64(double) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
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

define internal void @nish.ThreadScope.spawn$arr.f64$f64$fn.5.sumOf$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.nish_array*, %struct.nish_array*, i32, double }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i32, double }, { %struct.nish_array*, %struct.nish_array*, i32, double }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = call double @sumOf(%struct.nish_array* %2)
  %4 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i32, double }, { %struct.nish_array*, %struct.nish_array*, i32, double }* %0, i32 0, i32 3
  store double %3, double* %4
  ret void
}

define internal void @nish.ThreadScope.spawn$arr.f64$f64$fn.5.sumOf$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.nish_array*, %struct.nish_array*, i32, double }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i32, double }, { %struct.nish_array*, %struct.nish_array*, i32, double }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i32, double }, { %struct.nish_array*, %struct.nish_array*, i32, double }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i32, double }, { %struct.nish_array*, %struct.nish_array*, i32, double }* %0, i32 0, i32 3
  %6 = load double, double* %5
  call void @nish.storeResult$f64(%struct.nish_array* %2, i32 %4, double %6)
  ret void
}

define void @nish.ThreadScope.spawn$arr.f64$f64$fn.5.sumOf(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { %struct.nish_array*, %struct.nish_array*, i32, double }, align 8
  %0 = icmp slt i32 %at, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = trunc i64 %2 to i32
  %4 = icmp sge i32 %at, %3
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = trunc i64 %7 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %8)
  br label %if.end

if.end:
  %9 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i32, double }, { %struct.nish_array*, %struct.nish_array*, i32, double }* %task.payload, i32 0, i32 0
  store %struct.nish_array* %arg, %struct.nish_array** %9
  %10 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i32, double }, { %struct.nish_array*, %struct.nish_array*, i32, double }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %10
  %11 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array*, i32, double }, { %struct.nish_array*, %struct.nish_array*, i32, double }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %11
  %12 = bitcast { %struct.nish_array*, %struct.nish_array*, i32, double }* %task.payload to i8*
  %13 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %13, void (i8*)* @nish.ThreadScope.spawn$arr.f64$f64$fn.5.sumOf$run, void (i8*)* @nish.ThreadScope.spawn$arr.f64$f64$fn.5.sumOf$finish, i8* %12, i64 ptrtoint ({ %struct.nish_array*, %struct.nish_array*, i32, double }* getelementptr ({ %struct.nish_array*, %struct.nish_array*, i32, double }, { %struct.nish_array*, %struct.nish_array*, i32, double }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$i32$fn.11.primesBelow$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i32 @primesBelow(i32 %2)
  %4 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  store i32 %3, i32* %4
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$i32$fn.11.primesBelow$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  %6 = load i32, i32* %5
  call void @nish.storeResult$i32(%struct.nish_array* %2, i32 %4, i32 %6)
  ret void
}

define void @nish.ThreadScope.spawn$i32$i32$fn.11.primesBelow(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, i32 }, align 8
  %0 = icmp slt i32 %at, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = trunc i64 %2 to i32
  %4 = icmp sge i32 %at, %3
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = trunc i64 %7 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %8)
  br label %if.end

if.end:
  %9 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %9
  %10 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %10
  %11 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %11
  %12 = bitcast { i32, %struct.nish_array*, i32, i32 }* %task.payload to i8*
  %13 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %13, void (i8*)* @nish.ThreadScope.spawn$i32$i32$fn.11.primesBelow$run, void (i8*)* @nish.ThreadScope.spawn$i32$i32$fn.11.primesBelow$finish, i8* %12, i64 ptrtoint ({ i32, %struct.nish_array*, i32, i32 }* getelementptr ({ i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.runTask$arr.f64$f64$fn.5.sumOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call double @sumOf(%struct.nish_array* %arg)
  call void @nish.storeResult$f64(%struct.nish_array* %dst, i32 %at, double %0)
  ret void
}

define internal void @nish.runTask$i32$i32$fn.11.primesBelow(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i32 @primesBelow(i32 %arg)
  call void @nish.storeResult$i32(%struct.nish_array* %dst, i32 %at, i32 %0)
  ret void
}

define internal void @nish.storeResult$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, double noundef %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %9 = bitcast i8* %8 to double*
  %10 = getelementptr inbounds double, double* %9, i64 %6
  store double %r, double* %10, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.storeResult$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, i32 noundef %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %6
  store i32 %r, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !18
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { noreturn nounwind }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ThreadScope", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !11, i64 16}
!15 = !{!"element double", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element i32", !1, i64 0}
!18 = !{!17, !17, i64 0}
