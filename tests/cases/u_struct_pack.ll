%struct.Pixel = type { i8, i8, i8, i8, i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

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
  store i64 3, i64* %13, align 8, !alias.scope !13, !noalias !14
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %14, align 8, !alias.scope !13, !noalias !14
  %15 = bitcast [3 x i8]* %arr.data to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !13, !noalias !14
  %17 = bitcast i8* %15 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 0
  store i8 1, i8* %18, align 1, !alias.scope !14, !noalias !13
  %19 = getelementptr inbounds i8, i8* %17, i64 1
  store i8 2, i8* %19, align 1, !alias.scope !14, !noalias !13
  %20 = getelementptr inbounds i8, i8* %17, i64 2
  store i8 250, i8* %20, align 1, !alias.scope !14, !noalias !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !13, !noalias !14
  %24 = icmp ult i64 0, %23
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %23)
  unreachable

bounds.ok:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !13, !noalias !14
  %27 = bitcast i8* %26 to i8*
  %28 = getelementptr inbounds i8, i8* %27, i64 0
  store i8 255, i8* %28, align 1, !alias.scope !14, !noalias !13
  %29 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !13, !noalias !14
  %32 = icmp ult i64 0, %31
  br i1 %32, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %31)
  unreachable

bounds.ok.1:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !13, !noalias !14
  %35 = bitcast i8* %34 to i8*
  %36 = getelementptr inbounds i8, i8* %35, i64 0
  %37 = load i8, i8* %36, align 1, !alias.scope !14, !noalias !13
  %38 = add i8 %37, 1
  store i8 %38, i8* %36, align 1, !alias.scope !14, !noalias !13
  %39 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %40 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %39, i32 0, i32 0
  %41 = load i8, i8* %40, align 1, !tbaa !5
  %42 = zext i8 %41 to i64
  %43 = call i8* @nish_str_from_u64(i64 %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %45 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %46 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %45, i32 0, i32 3
  %47 = load i8, i8* %46, align 1, !tbaa !8
  %48 = zext i8 %47 to i64
  %49 = call i8* @nish_str_from_u64(i64 %48)
  %50 = call i8* @nish_str_concat(i8* %44, i8* %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %52 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %53 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %52, i32 0, i32 4
  %54 = load i32, i32* %53, align 4, !tbaa !9
  %55 = zext i32 %54 to i64
  %56 = call i8* @nish_str_from_u64(i64 %55)
  %57 = call i8* @nish_str_concat(i8* %51, i8* %56)
  %58 = call i8* @nish_str_concat(i8* %57, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %59 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !13, !noalias !14
  %62 = icmp ult i64 0, %61
  br i1 %62, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %61)
  unreachable

bounds.ok.2:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !13, !noalias !14
  %65 = bitcast i8* %64 to i8*
  %66 = getelementptr inbounds i8, i8* %65, i64 0
  %67 = load i8, i8* %66, align 1, !alias.scope !14, !noalias !13
  %68 = zext i8 %67 to i64
  %69 = call i8* @nish_str_from_u64(i64 %68)
  %70 = call i8* @nish_str_concat(i8* %58, i8* %69)
  %71 = call i8* @nish_str_concat(i8* %70, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %72 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !13, !noalias !14
  %75 = icmp ult i64 2, %74
  br i1 %75, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 2, i64 %74)
  unreachable

bounds.ok.3:
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !13, !noalias !14
  %78 = bitcast i8* %77 to i8*
  %79 = getelementptr inbounds i8, i8* %78, i64 2
  %80 = load i8, i8* %79, align 1, !alias.scope !14, !noalias !13
  %81 = zext i8 %80 to i64
  %82 = call i8* @nish_str_from_u64(i64 %81)
  %83 = call i8* @nish_str_concat(i8* %71, i8* %82)
  call void @nish_print(i8* %83)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

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
