%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Box = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
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

define internal void @poison(%struct.Box* noundef nonnull align 8 dereferenceable(4) nocapture %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  store i32 2, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @boxed(%struct.Box* noundef nonnull align 8 dereferenceable(4) nocapture %b, %union.tagged* noundef %s) #0 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  store i32 %1, i32* %2, align 4, !tbaa !4
  call void @poison(%struct.Box* %b)
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !4
  switch i32 %4, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  ret i32 1

sw.case.1:
  ret i32 2

sw.default:
  ret i32 3
}

define internal noundef i32 @broken(%union.tagged* noundef %s) #1 {
entry:
  %n.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  store i32 1, i32* %n.addr, align 4
  br label %sw.end

sw.case.1:
  store i32 2, i32* %n.addr, align 4
  br label %sw.end

sw.unreachable:
  unreachable

sw.end:
  %2 = load i32, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 10)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nested(%union.tagged* noundef %s, %union.tagged* noundef %t) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %2 = getelementptr inbounds %union.tagged, %union.tagged* %t, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  switch i32 %3, label %sw.unreachable.1 [
    i32 0, label %sw.case.2
    i32 1, label %sw.case.3
  ]

sw.case.2:
  ret i32 11

sw.case.3:
  ret i32 12

sw.unreachable.1:
  unreachable

sw.case.1:
  %4 = getelementptr inbounds %union.tagged, %union.tagged* %t, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  switch i32 %5, label %sw.unreachable.2 [
    i32 0, label %sw.case.4
    i32 1, label %sw.case.5
  ]

sw.case.4:
  ret i32 21

sw.case.5:
  ret i32 22

sw.unreachable.2:
  unreachable

sw.unreachable:
  unreachable
}

define internal noundef i32 @skipped(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %shapes) #1 {
entry:
  %n.addr = alloca i32, align 4
  %s.addr = alloca %union.tagged*, align 8
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %n.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %shapes, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %shapes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = bitcast i8* %5 to %union.tagged**
  %7 = getelementptr inbounds %union.tagged*, %union.tagged** %6, i64 %0
  %8 = load %union.tagged*, %union.tagged** %7, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  store %union.tagged* %8, %union.tagged** %s.addr, align 8
  %9 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %10 = getelementptr inbounds %union.tagged, %union.tagged* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4
  switch i32 %11, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  br label %forof.inc

sw.case.1:
  %12 = load i32, i32* %n.addr, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 1)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %n.addr, align 4
  br label %sw.end

sw.unreachable:
  unreachable

sw.end:
  %16 = load i32, i32* %n.addr, align 4
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 100)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %18, i32* %n.addr, align 4
  br label %forof.inc

forof.inc:
  %20 = load i64, i64* %forof.idx, align 8
  %21 = add i64 %20, 1
  store i64 %21, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %22 = load i32, i32* %n.addr, align 4
  ret i32 %22

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %shapes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x %union.tagged*], align 8
  %Box.obj = alloca %struct.Box, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Circle*
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !18
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 1
  store i32 1, i32* %3, align 4, !tbaa !19
  %4 = bitcast %struct.Circle* %1 to %union.tagged*
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = bitcast i8* %5 to %struct.Square*
  %7 = getelementptr inbounds %struct.Square, %struct.Square* %6, i32 0, i32 0
  store i32 1, i32* %7, align 4, !tbaa !21
  %8 = getelementptr inbounds %struct.Square, %struct.Square* %6, i32 0, i32 1
  store i32 2, i32* %8, align 4, !tbaa !22
  %9 = bitcast %struct.Square* %6 to %union.tagged*
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Circle*
  %12 = getelementptr inbounds %struct.Circle, %struct.Circle* %11, i32 0, i32 0
  store i32 0, i32* %12, align 4, !tbaa !18
  %13 = getelementptr inbounds %struct.Circle, %struct.Circle* %11, i32 0, i32 1
  store i32 1, i32* %13, align 4, !tbaa !19
  %14 = bitcast %struct.Circle* %11 to %union.tagged*
  %15 = call i8* @nish_alloc_struct(i64 8)
  %16 = bitcast i8* %15 to %struct.Square*
  %17 = getelementptr inbounds %struct.Square, %struct.Square* %16, i32 0, i32 0
  store i32 1, i32* %17, align 4, !tbaa !21
  %18 = getelementptr inbounds %struct.Square, %struct.Square* %16, i32 0, i32 1
  store i32 2, i32* %18, align 4, !tbaa !22
  %19 = bitcast %struct.Square* %16 to %union.tagged*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %21, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %22 = bitcast [4 x %union.tagged*]* %arr.data to i8*
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %24 = bitcast i8* %22 to %union.tagged**
  %25 = getelementptr inbounds %union.tagged*, %union.tagged** %24, i64 0
  store %union.tagged* %4, %union.tagged** %25, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %26 = getelementptr inbounds %union.tagged*, %union.tagged** %24, i64 1
  store %union.tagged* %9, %union.tagged** %26, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %27 = getelementptr inbounds %union.tagged*, %union.tagged** %24, i64 2
  store %union.tagged* %14, %union.tagged** %27, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %28 = getelementptr inbounds %union.tagged*, %union.tagged** %24, i64 3
  store %union.tagged* %19, %union.tagged** %28, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %shapes.addr, align 8
  %29 = getelementptr inbounds %struct.Box, %struct.Box* %Box.obj, i32 0, i32 0
  store i32 0, i32* %29, align 4, !tbaa !4
  %30 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %33 = bitcast i8* %32 to %union.tagged**
  %34 = getelementptr inbounds %union.tagged*, %union.tagged** %33, i64 1
  %35 = load %union.tagged*, %union.tagged** %34, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %36 = call i32 @boxed(%struct.Box* %Box.obj, %union.tagged* %35)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %39 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %42 = bitcast i8* %41 to %union.tagged**
  %43 = getelementptr inbounds %union.tagged*, %union.tagged** %42, i64 0
  %44 = load %union.tagged*, %union.tagged** %43, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %45 = call i32 @broken(%union.tagged* %44)
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %38, i8* %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %49 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %52 = bitcast i8* %51 to %union.tagged**
  %53 = getelementptr inbounds %union.tagged*, %union.tagged** %52, i64 1
  %54 = load %union.tagged*, %union.tagged** %53, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %55 = call i32 @broken(%union.tagged* %54)
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* %48, i8* %56)
  call void @nish_print(i8* %57)
  %58 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %61 = bitcast i8* %60 to %union.tagged**
  %62 = getelementptr inbounds %union.tagged*, %union.tagged** %61, i64 0
  %63 = load %union.tagged*, %union.tagged** %62, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %64 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %67 = bitcast i8* %66 to %union.tagged**
  %68 = getelementptr inbounds %union.tagged*, %union.tagged** %67, i64 1
  %69 = load %union.tagged*, %union.tagged** %68, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %70 = call i32 @nested(%union.tagged* %63, %union.tagged* %69)
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %73 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %76 = bitcast i8* %75 to %union.tagged**
  %77 = getelementptr inbounds %union.tagged*, %union.tagged** %76, i64 1
  %78 = load %union.tagged*, %union.tagged** %77, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %79 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %82 = bitcast i8* %81 to %union.tagged**
  %83 = getelementptr inbounds %union.tagged*, %union.tagged** %82, i64 0
  %84 = load %union.tagged*, %union.tagged** %83, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %85 = call i32 @nested(%union.tagged* %78, %union.tagged* %84)
  %86 = call i8* @nish_str_from_i32(i32 %85)
  %87 = call i8* @nish_str_concat(i8* %72, i8* %86)
  call void @nish_print(i8* %87)
  %88 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %89 = call i32 @skipped(%struct.nish_array* %88)
  %90 = call i8* @nish_str_from_i32(i32 %89)
  call void @nish_print(i8* %90)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!24, !25, !26, !27, !28}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
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
!15 = !{!"element ptr", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"Circle", !2, i64 0, !2, i64 4}
!18 = !{!17, !2, i64 0}
!19 = !{!17, !2, i64 4}
!20 = !{!"Square", !2, i64 0, !2, i64 4}
!21 = !{!20, !2, i64 0}
!22 = !{!20, !2, i64 4}
!23 = !{!12, !10, i64 8}
!24 = !{i32 8, !"cf-protection-branch", i32 1}
!25 = !{i32 8, !"cf-protection-return", i32 1}
!26 = !{i32 8, !"branch-target-enforcement", i32 1}
!27 = !{i32 8, !"sign-return-address", i32 1}
!28 = !{i32 4, !"probe-stack", !"inline-asm"}
