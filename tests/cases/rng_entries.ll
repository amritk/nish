%struct.Pixel = type { i32 }
%struct.Cursor = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"value out of range: expected integer<0, 99>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"value out of range: expected integer<-5, 5>\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [45 x i8] } { i64 44, [45 x i8] c"value out of range: expected integer<0, 255>\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<0, 9>\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
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
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %3 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %Pixel.obj, i32 0, i32 0
  store i32 %1, i32* %3, align 4
  store %struct.Pixel* %Pixel.obj, %struct.Pixel** %p.addr, align 8
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp ult i32 %4, 10
  br i1 %5, label %rng.ok.1, label %rng.fail.1

rng.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.1:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %8 = bitcast [3 x i32]* %arr.data to i8*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %10 = bitcast i8* %8 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 0
  store i32 1, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %12 = getelementptr inbounds i32, i32* %10, i64 1
  store i32 %4, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %13 = getelementptr inbounds i32, i32* %10, i64 2
  store i32 2, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %levels.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %levels.addr, align 8
  %15 = load i32, i32* %n.addr, align 4
  %16 = add nsw i32 %15, 1
  %17 = icmp ult i32 %16, 10
  br i1 %17, label %rng.ok.2, label %rng.fail.2

rng.fail.2:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.2:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 4)
  br label %push.store

push.store:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %19
  store i32 %16, i32* %26, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %27 = add i64 %19, 1
  store i64 %27, i64* %18, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %28 = trunc i64 %27 to i32
  %29 = load %struct.nish_array*, %struct.nish_array** %levels.addr, align 8
  %30 = load i32, i32* %n.addr, align 4
  %31 = add nsw i32 %30, 5
  %32 = icmp ult i32 %31, 10
  br i1 %32, label %rng.ok.3, label %rng.fail.3

rng.fail.3:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.3:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %35 = icmp ult i64 0, %34
  br i1 %35, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %34)
  unreachable

bounds.ok:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 0
  store i32 %31, i32* %39, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %40 = load %struct.nish_array*, %struct.nish_array** %levels.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %43 = icmp ult i64 1, %42
  br i1 %43, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %42)
  unreachable

bounds.ok.1:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 1
  %48 = load i32, i32* %47, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %49 = add nsw i32 %48, 1
  %50 = icmp ult i32 %49, 10
  br i1 %50, label %rng.ok.4, label %rng.fail.4

rng.fail.4:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.4:
  store i32 %49, i32* %47, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 0, i32* %total.addr, align 4
  %51 = load %struct.nish_array*, %struct.nish_array** %levels.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %52 = load i64, i64* %forof.idx, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %55 = icmp ult i64 %52, %54
  br i1 %55, label %forof.body, label %forof.end

forof.body:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %52
  %60 = load i32, i32* %59, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %60, i32* %v.addr, align 4
  %61 = load i32, i32* %total.addr, align 4
  %62 = load i32, i32* %v.addr, align 4
  %63 = add nsw i32 %61, %62
  store i32 %63, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %64 = load i64, i64* %forof.idx, align 8
  %65 = add i64 %64, 1
  store i64 %65, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %66 = getelementptr inbounds %struct.Cursor, %struct.Cursor* %Cursor.obj, i32 0, i32 0
  store i32 0, i32* %66, align 4, !tbaa !4
  store %struct.Cursor* %Cursor.obj, %struct.Cursor** %c.addr, align 8
  %67 = load %struct.Cursor*, %struct.Cursor** %c.addr, align 8
  call void @Cursor.advance(%struct.Cursor* %67, i32 4)
  store i32 0, i32* %count.addr, align 4
  %68 = load i32, i32* %count.addr, align 4
  %69 = add nsw i32 %68, 1
  %70 = icmp ult i32 %69, 10
  br i1 %70, label %rng.ok.5, label %rng.fail.5

rng.fail.5:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.5:
  store i32 %69, i32* %count.addr, align 4
  %71 = load i32, i32* %count.addr, align 4
  %72 = add nsw i32 %71, 2
  %73 = icmp ult i32 %72, 10
  br i1 %73, label %rng.ok.6, label %rng.fail.6

rng.fail.6:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.6:
  store i32 %72, i32* %count.addr, align 4
  %74 = load %struct.Pixel*, %struct.Pixel** %p.addr, align 8
  %75 = getelementptr inbounds %struct.Pixel, %struct.Pixel* %74, i32 0, i32 0
  %76 = load i32, i32* %75, align 4
  %77 = call i8* @nish_str_from_i32(i32 %76)
  %78 = call i8* @nish_str_concat(i8* %77, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %79 = load i32, i32* %total.addr, align 4
  %80 = call i8* @nish_str_from_i32(i32 %79)
  %81 = call i8* @nish_str_concat(i8* %78, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %83 = load %struct.Cursor*, %struct.Cursor** %c.addr, align 8
  %84 = getelementptr inbounds %struct.Cursor, %struct.Cursor* %83, i32 0, i32 0
  %85 = load i32, i32* %84, align 4, !tbaa !4
  %86 = call i8* @nish_str_from_i32(i32 %85)
  %87 = call i8* @nish_str_concat(i8* %82, i8* %86)
  %88 = call i8* @nish_str_concat(i8* %87, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %89 = sub nsw i32 0, 3
  %90 = call i32 @clamp(i1 true, i32 %89)
  %91 = call i8* @nish_str_from_i32(i32 %90)
  %92 = call i8* @nish_str_concat(i8* %88, i8* %91)
  %93 = call i8* @nish_str_concat(i8* %92, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %94 = load i32, i32* %count.addr, align 4
  %95 = call i8* @nish_str_from_i32(i32 %94)
  %96 = call i8* @nish_str_concat(i8* %93, i8* %95)
  call void @nish_print(i8* %96)
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
