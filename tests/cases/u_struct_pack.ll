%struct.Pixel = type { i8, i8, i8, i8, i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0

define noundef i32 @test() #0 {
entry:
  %p.addr = alloca %struct.Pixel*, align 8
  %Pixel.obj = alloca %struct.Pixel, align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %Pixel.obj, i32 0, i32 0
  store i8 0, i8* %0, align 1, !tbaa !5
  %1 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %Pixel.obj, i32 0, i32 1
  store i8 0, i8* %1, align 1, !tbaa !6
  %2 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %Pixel.obj, i32 0, i32 2
  store i8 0, i8* %2, align 1, !tbaa !7
  %3 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %Pixel.obj, i32 0, i32 3
  store i8 255, i8* %3, align 1, !tbaa !8
  %4 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %Pixel.obj, i32 0, i32 4
  store i32 0, i32* %4, align 4, !tbaa !9
  store %struct.Pixel* %Pixel.obj, %struct.Pixel** %p.addr, align 8
  %5 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %6 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %5, i32 0, i32 0
  store i8 250, i8* %6, align 1, !tbaa !5
  %7 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %8 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %7, i32 0, i32 0
  %9 = load i8, i8* %8, align 1
  %10 = add i8 %9, 10
  store i8 %10, i8* %8, align 1
  %11 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %12 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %11, i32 0, i32 4
  store i32 4000000000, i32* %12, align 4, !tbaa !9
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %13, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %14, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %15 = bitcast [3 x i8]* %arr.data to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %17 = bitcast i8* %15 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 0
  store i8 1, i8* %18, align 1, !alias.scope !14, !noalias !13, !tbaa !22
  %19 = getelementptr inbounds i8, i8* %17, i64 1
  store i8 2, i8* %19, align 1, !alias.scope !14, !noalias !13, !tbaa !22
  %20 = getelementptr inbounds i8, i8* %17, i64 2
  store i8 250, i8* %20, align 1, !alias.scope !14, !noalias !13, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %24 = bitcast i8* %23 to i8*
  %25 = getelementptr inbounds i8, i8* %24, i64 0
  store i8 255, i8* %25, align 1, !alias.scope !14, !noalias !13, !tbaa !22
  %26 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %29 = bitcast i8* %28 to i8*
  %30 = getelementptr inbounds i8, i8* %29, i64 0
  %31 = load i8, i8* %30, align 1, !alias.scope !14, !noalias !13, !tbaa !22
  %32 = add i8 %31, 1
  store i8 %32, i8* %30, align 1, !alias.scope !14, !noalias !13, !tbaa !22
  %33 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %34 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %33, i32 0, i32 0
  %35 = load i8, i8* %34, align 1, !tbaa !5
  %36 = zext i8 %35 to i64
  %37 = call i8* @nish_str_from_u64(i64 %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %39 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %40 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %39, i32 0, i32 3
  %41 = load i8, i8* %40, align 1, !tbaa !8
  %42 = zext i8 %41 to i64
  %43 = call i8* @nish_str_from_u64(i64 %42)
  %44 = call i8* @nish_str_concat(i8* %38, i8* %43)
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %46 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %47 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %46, i32 0, i32 4
  %48 = load i32, i32* %47, align 4, !tbaa !9
  %49 = zext i32 %48 to i64
  %50 = call i8* @nish_str_from_u64(i64 %49)
  %51 = call i8* @nish_str_concat(i8* %45, i8* %50)
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %53 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %56 = bitcast i8* %55 to i8*
  %57 = getelementptr inbounds i8, i8* %56, i64 0
  %58 = load i8, i8* %57, align 1, !alias.scope !14, !noalias !13, !tbaa !22
  %59 = zext i8 %58 to i64
  %60 = call i8* @nish_str_from_u64(i64 %59)
  %61 = call i8* @nish_str_concat(i8* %52, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %63 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %66 = bitcast i8* %65 to i8*
  %67 = getelementptr inbounds i8, i8* %66, i64 2
  %68 = load i8, i8* %67, align 1, !alias.scope !14, !noalias !13, !tbaa !22
  %69 = zext i8 %68 to i64
  %70 = call i8* @nish_str_from_u64(i64 %69)
  %71 = call i8* @nish_str_concat(i8* %62, i8* %70)
  call void @nish_print(i8* %71)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i8", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Pixel", !2, i64 0, !2, i64 1, !2, i64 2, !2, i64 3, !3, i64 4}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !2, i64 1}
!7 = !{!4, !2, i64 2}
!8 = !{!4, !2, i64 3}
!9 = !{!4, !3, i64 4}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"element i8", !1, i64 0}
!22 = !{!21, !21, i64 0}
