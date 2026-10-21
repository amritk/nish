%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Tri = type { i32, i32 }
%union.tagged = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
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

define void @nish_main() #1 {
entry:
  %shapes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x %union.tagged*], align 8
  %n.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %1, i32 1)
  %2 = bitcast %struct.Circle* %1 to %union.tagged*
  %3 = call i8* @nish_alloc_struct(i64 8)
  %4 = bitcast i8* %3 to %struct.Square*
  call void @Square.constructor(%struct.Square* %4, i32 2)
  %5 = bitcast %struct.Square* %4 to %union.tagged*
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %7, i32 3)
  %8 = bitcast %struct.Circle* %7 to %union.tagged*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %9, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %10, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %11 = bitcast [3 x %union.tagged*]* %arr.data to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %13 = bitcast i8* %11 to %union.tagged**
  %14 = getelementptr inbounds %union.tagged*, %union.tagged** %13, i64 0
  store %union.tagged* %2, %union.tagged** %14, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %15 = getelementptr inbounds %union.tagged*, %union.tagged** %13, i64 1
  store %union.tagged* %5, %union.tagged** %15, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %16 = getelementptr inbounds %union.tagged*, %union.tagged** %13, i64 2
  store %union.tagged* %8, %union.tagged** %16, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %shapes.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %20 = bitcast i8* %19 to %union.tagged**
  %21 = getelementptr inbounds %union.tagged*, %union.tagged** %20, i64 1
  %22 = load %union.tagged*, %union.tagged** %21, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %23 = call i32 @apply$fn.16.nish_main$arrow0(%union.tagged* %22)
  store i32 %23, i32* %n.addr, align 4
  %24 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %27 = icmp ult i64 1, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %30 = bitcast i8* %29 to %union.tagged**
  %31 = getelementptr inbounds %union.tagged*, %union.tagged** %30, i64 1
  %32 = load %union.tagged*, %union.tagged** %31, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %33 = call i32 @pick$i32(%union.tagged* %32, i32 10, i32 20)
  %34 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %37 = icmp ult i64 0, %36
  br i1 %37, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %36)
  unreachable

bounds.ok.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %40 = bitcast i8* %39 to %union.tagged**
  %41 = getelementptr inbounds %union.tagged*, %union.tagged** %40, i64 0
  %42 = load %union.tagged*, %union.tagged** %41, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %43 = call i8* @pick$str(%union.tagged* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %44 = bitcast i8* %43 to i64*
  %45 = load i64, i64* %44, align 8
  %46 = trunc i64 %45 to i32
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 %46)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok

ovf.ok:
  %50 = load i32, i32* %n.addr, align 4
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %48, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %54 = call i8* @nish_str_from_i32(i32 %52)
  call void @nish_print(i8* %54)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish_main$arrow0(%union.tagged* noundef %s) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  ret i32 1

sw.case.1:
  ret i32 2

sw.case.2:
  ret i32 3

sw.unreachable:
  unreachable
}

define internal noundef i32 @apply$fn.16.nish_main$arrow0(%union.tagged* noundef %s) #2 {
entry:
  %0 = call i32 @nish_main$arrow0(%union.tagged* %s)
  ret i32 %0
}

define internal noundef i32 @pick$i32(%union.tagged* noundef %s, i32 noundef %a, i32 noundef %b) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  ret i32 %a

sw.case.1:
  ret i32 %b

sw.case.2:
  ret i32 %a

sw.unreachable:
  unreachable
}

define internal noundef nonnull align 8 i8* @pick$str(%union.tagged* noundef %s, i8* noundef nonnull noalias readonly align 8 %a, i8* noundef nonnull noalias readonly align 8 %b) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  ret i8* %a

sw.case.1:
  ret i8* %b

sw.case.2:
  ret i8* %a

sw.unreachable:
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
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
