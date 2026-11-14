%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Keeper = type {}
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"same\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"different\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

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

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %r, i32* %1, align 4, !tbaa !5
  ret void
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %side, i32* %1, align 4, !tbaa !8
  ret void
}

define internal noundef i32 @area(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %2 = bitcast %union.tagged* %s to %struct.Circle*
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %2, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !5
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = bitcast %union.tagged* %s to %struct.Circle*
  %9 = getelementptr inbounds %struct.Circle, %struct.Circle* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4, !tbaa !5
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %12

sw.case.1:
  %14 = bitcast %union.tagged* %s to %struct.Square*
  %15 = getelementptr inbounds %struct.Square, %struct.Square* %14, i32 0, i32 1
  %16 = load i32, i32* %15, align 4, !tbaa !8
  %17 = bitcast %union.tagged* %s to %struct.Square*
  %18 = getelementptr inbounds %struct.Square, %struct.Square* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4, !tbaa !8
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %21

sw.unreachable:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef %union.tagged* @pick(i32 noundef %n) #1 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 8)
  %2 = bitcast i8* %1 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %2, i32 %n)
  %3 = bitcast %struct.Circle* %2 to %union.tagged*
  br label %cond.end

cond.false:
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Square*
  %6 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %n)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @Square.constructor(%struct.Square* %5, i32 %7)
  %9 = bitcast %struct.Square* %5 to %union.tagged*
  br label %cond.end

cond.end:
  %10 = phi %union.tagged* [ %3, %cond.true ], [ %9, %ovf.ok ]
  ret %union.tagged* %10

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
}

define void @nish_main() #1 {
entry:
  %s.addr = alloca %union.tagged*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %union.tagged*], align 8
  %k.addr = alloca %struct.Keeper*, align 8
  %Keeper.obj = alloca %struct.Keeper, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %union.tagged* @pick(i32 4)
  store %union.tagged* %0, %union.tagged** %s.addr, align 8
  %1 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %2 = call %union.tagged* @identity$un2.$Circle.$Square(%union.tagged* %1)
  %3 = call i32 @area(%union.tagged* %2)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = bitcast i8* %5 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %6, i32 1)
  %7 = call %struct.Circle* @identity$$Circle(%struct.Circle* %6)
  %8 = bitcast %struct.Circle* %7 to %union.tagged*
  %9 = call i32 @area(%union.tagged* %8)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = call i8* @nish_alloc_struct(i64 8)
  %12 = bitcast i8* %11 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %12, i32 1)
  %13 = bitcast %struct.Circle* %12 to %union.tagged*
  %14 = call i8* @nish_alloc_struct(i64 8)
  %15 = bitcast i8* %14 to %struct.Square*
  call void @Square.constructor(%struct.Square* %15, i32 2)
  %16 = bitcast %struct.Square* %15 to %union.tagged*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %17, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %18, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %19 = bitcast [2 x %union.tagged*]* %arr.data to i8*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %21 = bitcast i8* %19 to %union.tagged**
  %22 = getelementptr inbounds %union.tagged*, %union.tagged** %21, i64 0
  store %union.tagged* %13, %union.tagged** %22, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %23 = getelementptr inbounds %union.tagged*, %union.tagged** %21, i64 1
  store %union.tagged* %16, %union.tagged** %23, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %25 = call %union.tagged* @first$un2.$Circle.$Square(%struct.nish_array* %24)
  %26 = call i32 @area(%union.tagged* %25)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %29 = call i8* @nish_alloc_struct(i64 8)
  %30 = bitcast i8* %29 to %struct.Square*
  call void @Square.constructor(%struct.Square* %30, i32 2)
  %31 = bitcast %struct.Square* %30 to %union.tagged*
  %32 = call i32 @fill$un2.$Circle.$Square(%struct.nish_array* %28, %union.tagged* %31)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
  %34 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %37 = icmp ult i64 2, %36
  br i1 %37, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %36)
  unreachable

bounds.ok:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %40 = bitcast i8* %39 to %union.tagged**
  %41 = getelementptr inbounds %union.tagged*, %union.tagged** %40, i64 2
  %42 = load %union.tagged*, %union.tagged** %41, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %43 = call i32 @area(%union.tagged* %42)
  %44 = call i8* @nish_str_from_i32(i32 %43)
  call void @nish_print(i8* %44)
  store %struct.Keeper* %Keeper.obj, %struct.Keeper** %k.addr, align 8
  %45 = load %struct.Keeper*, %struct.Keeper** %k.addr, align 8
  %46 = call %union.tagged* @pick(i32 -3)
  %47 = call %union.tagged* @Keeper.keep$un2.$Circle.$Square(%struct.Keeper* %45, %union.tagged* %46)
  %48 = call i32 @area(%union.tagged* %47)
  %49 = call i8* @nish_str_from_i32(i32 %48)
  call void @nish_print(i8* %49)
  %50 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %51 = call %union.tagged* @identity$un2.$Circle.$Square(%union.tagged* %50)
  %52 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %53 = icmp eq %union.tagged* %51, %52
  br i1 %53, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %54 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), %cond.true ], [ bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), %cond.false ]
  call void @nish_print(i8* %54)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef %union.tagged* @identity$un2.$Circle.$Square(%union.tagged* noundef %value) #2 {
entry:
  ret %union.tagged* %value
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Circle* @identity$$Circle(%struct.Circle* noundef nonnull align 8 dereferenceable(8) %value) #2 {
entry:
  ret %struct.Circle* %value
}

define internal noundef %union.tagged* @first$un2.$Circle.$Square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %5 = bitcast i8* %4 to %union.tagged**
  %6 = getelementptr inbounds %union.tagged*, %union.tagged** %5, i64 0
  %7 = load %union.tagged*, %union.tagged** %6, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  ret %union.tagged* %7
}

define internal noundef i32 @fill$un2.$Circle.$Square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %union.tagged* noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %xs, i64 8)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %7 = bitcast i8* %6 to %union.tagged**
  %8 = getelementptr inbounds %union.tagged*, %union.tagged** %7, i64 %1
  store %union.tagged* %value, %union.tagged** %8, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %13 = trunc i64 %12 to i32
  ret i32 %13
}

define internal noundef %union.tagged* @Keeper.keep$un2.$Circle.$Square(%struct.Keeper* noundef nonnull readonly align 8 nocapture %this, %union.tagged* noundef %value) #2 {
entry:
  ret %union.tagged* %value
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!22, !23, !24, !25, !26}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Square", !2, i64 0, !2, i64 4}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!"element ptr", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{i32 8, !"cf-protection-branch", i32 1}
!23 = !{i32 8, !"cf-protection-return", i32 1}
!24 = !{i32 8, !"branch-target-enforcement", i32 1}
!25 = !{i32 8, !"sign-return-address", i32 1}
!26 = !{i32 4, !"probe-stack", !"inline-asm"}
