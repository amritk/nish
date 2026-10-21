%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Tri = type { i32, i32 }
%union.tagged = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
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

define internal noundef i32 @measure(%union.tagged* noundef %s) #0 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = bitcast %union.tagged* %s to %struct.Circle*
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !4
  ret i32 %5

if.end:
  %6 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  switch i32 %7, label %sw.unreachable [
    i32 1, label %sw.case
    i32 2, label %sw.case.1
  ]

sw.case:
  %8 = bitcast %union.tagged* %s to %struct.Square*
  %9 = getelementptr inbounds %struct.Square, %struct.Square* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4, !tbaa !6
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %10, i32 10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %12

sw.case.1:
  %14 = bitcast %union.tagged* %s to %struct.Tri*
  %15 = getelementptr inbounds %struct.Tri, %struct.Tri* %14, i32 0, i32 1
  %16 = load i32, i32* %15, align 4, !tbaa !8
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 100)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %18

sw.unreachable:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define void @nish_main() #0 {
entry:
  %shapes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x %union.tagged*], align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Circle*
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !9
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 1
  store i32 1, i32* %3, align 4, !tbaa !4
  %4 = bitcast %struct.Circle* %1 to %union.tagged*
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = bitcast i8* %5 to %struct.Square*
  %7 = getelementptr inbounds %struct.Square, %struct.Square* %6, i32 0, i32 0
  store i32 1, i32* %7, align 4, !tbaa !10
  %8 = getelementptr inbounds %struct.Square, %struct.Square* %6, i32 0, i32 1
  store i32 2, i32* %8, align 4, !tbaa !6
  %9 = bitcast %struct.Square* %6 to %union.tagged*
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Tri*
  %12 = getelementptr inbounds %struct.Tri, %struct.Tri* %11, i32 0, i32 0
  store i32 2, i32* %12, align 4, !tbaa !11
  %13 = getelementptr inbounds %struct.Tri, %struct.Tri* %11, i32 0, i32 1
  store i32 3, i32* %13, align 4, !tbaa !8
  %14 = bitcast %struct.Tri* %11 to %union.tagged*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %15, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %16, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %17 = bitcast [3 x %union.tagged*]* %arr.data to i8*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %19 = bitcast i8* %17 to %union.tagged**
  %20 = getelementptr inbounds %union.tagged*, %union.tagged** %19, i64 0
  store %union.tagged* %4, %union.tagged** %20, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %21 = getelementptr inbounds %union.tagged*, %union.tagged** %19, i64 1
  store %union.tagged* %9, %union.tagged** %21, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %22 = getelementptr inbounds %union.tagged*, %union.tagged** %19, i64 2
  store %union.tagged* %14, %union.tagged** %22, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %shapes.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %26 = bitcast i8* %25 to %union.tagged**
  %27 = getelementptr inbounds %union.tagged*, %union.tagged** %26, i64 0
  %28 = load %union.tagged*, %union.tagged** %27, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %29 = call i32 @measure(%union.tagged* %28)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %32 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %35 = bitcast i8* %34 to %union.tagged**
  %36 = getelementptr inbounds %union.tagged*, %union.tagged** %35, i64 1
  %37 = load %union.tagged*, %union.tagged** %36, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %38 = call i32 @measure(%union.tagged* %37)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %31, i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %42 = load %struct.nish_array*, %struct.nish_array** %shapes.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %45 = bitcast i8* %44 to %union.tagged**
  %46 = getelementptr inbounds %union.tagged*, %union.tagged** %45, i64 2
  %47 = load %union.tagged*, %union.tagged** %46, align 8, !alias.scope !16, !noalias !15, !tbaa !24
  %48 = call i32 @measure(%union.tagged* %47)
  %49 = call i8* @nish_str_from_i32(i32 %48)
  %50 = call i8* @nish_str_concat(i8* %41, i8* %49)
  call void @nish_print(i8* %50)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 4}
!5 = !{!"Square", !2, i64 0, !2, i64 4}
!6 = !{!5, !2, i64 4}
!7 = !{!"Tri", !2, i64 0, !2, i64 4}
!8 = !{!7, !2, i64 4}
!9 = !{!3, !2, i64 0}
!10 = !{!5, !2, i64 0}
!11 = !{!7, !2, i64 0}
!12 = !{!"nish array"}
!13 = !{!"header", !12}
!14 = !{!"elements", !12}
!15 = !{!13}
!16 = !{!14}
!17 = !{!"header i64", !1, i64 0}
!18 = !{!"header ptr", !1, i64 0}
!19 = !{!"array header", !17, i64 0, !17, i64 8, !18, i64 16}
!20 = !{!19, !17, i64 0}
!21 = !{!19, !17, i64 8}
!22 = !{!19, !18, i64 16}
!23 = !{!"element ptr", !1, i64 0}
!24 = !{!23, !23, i64 0}
