%struct.Pixel = type { i32 }
%struct.Cursor = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"value out of range: expected integer<0, 99>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"value out of range: expected integer<-5, 5>\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [62 x i8] } { i64 61, [62 x i8] c"value out of range: expected integer<-2000000000, 2000000000>\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [45 x i8] } { i64 44, [45 x i8] c"value out of range: expected integer<0, 255>\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<0, 9>\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_exit(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal void @Cursor.advance(%struct.Cursor* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %by) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cursor, %struct.Cursor* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = add nsw i32 %1, %by
  %3 = icmp ult i32 %2, 100
  br i1 %3, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %4 = getelementptr inbounds %struct.Cursor, %struct.Cursor* %this, i32 0, i32 0
  store i32 %2, i32* %4, align 4, !tbaa !4
  %5 = getelementptr inbounds %struct.Cursor, %struct.Cursor* %this, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = add nsw i32 %6, 1
  %8 = icmp ult i32 %7, 100
  br i1 %8, label %rng.ok.1, label %rng.fail.1

rng.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.1:
  store i32 %7, i32* %5, align 4
  ret void
}

define internal noundef i32 @clamp(i1 noundef zeroext %big, i32 noundef %v) #0 {
entry:
  br i1 %big, label %cond.true, label %cond.false

cond.true:
  %0 = sub i32 %v, -5
  %1 = icmp ult i32 %0, 11
  br i1 %1, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ %v, %rng.ok ], [ 0, %cond.false ]
  ret i32 %2
}

define internal noundef i32 @span(i32 noundef %v) #0 {
entry:
  %0 = sub i32 %v, -2000000000
  %1 = icmp ult i32 %0, -294967295
  br i1 %1, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [62 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  ret i32 %v
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %p.addr = alloca %struct.Pixel*, align 8
  %Pixel.obj = alloca %struct.Pixel, align 8
  %levels.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %total.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %c.addr = alloca %struct.Cursor*, align 8
  %Cursor.obj = alloca %struct.Cursor, align 8
  %count.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = mul nsw i32 %0, 10
  %2 = icmp ult i32 %1, 256
  br i1 %2, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %3 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %Pixel.obj, i32 0, i32 0
  store i32 %1, i32* %3, align 4
  store %struct.Pixel* %Pixel.obj, %struct.Pixel** %p.addr, align 8
  %4 = load i32, i32* %n.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %7 = bitcast [3 x i32]* %arr.data to i8*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %9 = bitcast i8* %7 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 0
  store i32 1, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %11 = getelementptr inbounds i32, i32* %9, i64 1
  store i32 %4, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %12 = getelementptr inbounds i32, i32* %9, i64 2
  store i32 2, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %levels.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %levels.addr, align 8
  %14 = load i32, i32* %n.addr, align 4
  %15 = add nsw i32 %14, 1
  %16 = icmp ult i32 %15, 10
  br i1 %16, label %rng.ok.1, label %rng.fail.1

rng.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %13, i64 4)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %18
  store i32 %15, i32* %25, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = trunc i64 %26 to i32
  %28 = load %struct.nish_array*, %struct.nish_array** %levels.addr, align 8
  %29 = load i32, i32* %n.addr, align 4
  %30 = add nsw i32 %29, 5
  %31 = icmp ult i32 %30, 10
  br i1 %31, label %rng.ok.2, label %rng.fail.2

rng.fail.2:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.2:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %34 = icmp ult i64 0, %33
  br i1 %34, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %33)
  unreachable

bounds.ok:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 0
  store i32 %30, i32* %38, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %39 = load %struct.nish_array*, %struct.nish_array** %levels.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %42 = icmp ult i64 1, %41
  br i1 %42, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %41)
  unreachable

bounds.ok.1:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 1
  %47 = load i32, i32* %46, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %48 = add nsw i32 %47, 1
  %49 = icmp ult i32 %48, 10
  br i1 %49, label %rng.ok.3, label %rng.fail.3

rng.fail.3:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.3:
  store i32 %48, i32* %46, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 0, i32* %total.addr, align 4
  %50 = load %struct.nish_array*, %struct.nish_array** %levels.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %51 = load i64, i64* %forof.idx, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %54 = icmp ult i64 %51, %53
  br i1 %54, label %forof.body, label %forof.end

forof.body:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 %51
  %59 = load i32, i32* %58, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %59, i32* %v.addr, align 4
  %60 = load i32, i32* %total.addr, align 4
  %61 = load i32, i32* %v.addr, align 4
  %62 = add nsw i32 %60, %61
  store i32 %62, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %63 = load i64, i64* %forof.idx, align 8
  %64 = add i64 %63, 1
  store i64 %64, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %65 = getelementptr inbounds %struct.Cursor, %struct.Cursor* %Cursor.obj, i32 0, i32 0
  store i32 0, i32* %65, align 4, !tbaa !4
  store %struct.Cursor* %Cursor.obj, %struct.Cursor** %c.addr, align 8
  %66 = load %struct.Cursor*, %struct.Cursor** %c.addr, align 8
  call void @Cursor.advance(%struct.Cursor* %66, i32 4)
  store i32 0, i32* %count.addr, align 4
  %67 = load i32, i32* %count.addr, align 4
  %68 = add nsw i32 %67, 1
  %69 = icmp ult i32 %68, 10
  br i1 %69, label %rng.ok.4, label %rng.fail.4

rng.fail.4:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.4:
  store i32 %68, i32* %count.addr, align 4
  %70 = load i32, i32* %count.addr, align 4
  %71 = add nsw i32 %70, 2
  %72 = icmp ult i32 %71, 10
  br i1 %72, label %rng.ok.5, label %rng.fail.5

rng.fail.5:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.5:
  store i32 %71, i32* %count.addr, align 4
  %73 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %74 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %73, i32 0, i32 0
  %75 = load i32, i32* %74, align 4
  %76 = call i8* @nish_str_from_i32(i32 %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %78 = load i32, i32* %total.addr, align 4
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* %77, i8* %79)
  %81 = call i8* @nish_str_concat(i8* %80, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %82 = load %struct.Cursor*, %struct.Cursor** %c.addr, align 8
  %83 = getelementptr inbounds %struct.Cursor, %struct.Cursor* %82, i32 0, i32 0
  %84 = load i32, i32* %83, align 4, !tbaa !4
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* %81, i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %88 = call i32 @clamp(i1 true, i32 -3)
  %89 = call i8* @nish_str_from_i32(i32 %88)
  %90 = call i8* @nish_str_concat(i8* %87, i8* %89)
  %91 = call i8* @nish_str_concat(i8* %90, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %92 = load i32, i32* %count.addr, align 4
  %93 = call i8* @nish_str_from_i32(i32 %92)
  %94 = call i8* @nish_str_concat(i8* %91, i8* %93)
  call void @nish_print(i8* %94)
  %95 = load i32, i32* %n.addr, align 4
  %96 = mul nsw i32 %95, 666666666
  %97 = add nsw i32 %96, 2
  %98 = call i32 @span(i32 %97)
  %99 = call i8* @nish_str_from_i32(i32 %98)
  %100 = call i8* @nish_str_concat(i8* %99, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %101 = call i32 @span(i32 -2000000000)
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %100, i8* %102)
  call void @nish_print(i8* %103)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { noreturn nounwind }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Cursor", !2, i64 0}
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
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
