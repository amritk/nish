%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i64$fn.4.cube(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow1(i32 noundef) #0
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #1

define hidden noundef i64 @cube$(i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = sext i32 %i to i64
  %2 = mul nsw i64 %0, %1
  %3 = sext i32 %i to i64
  %4 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %2, i64 %3)
  %5 = extractvalue { i64, i1 } %4, 0
  %6 = extractvalue { i64, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %5

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %squares.addr = alloca %struct.nish_array*, align 8
  %cubes.addr = alloca %struct.nish_array*, align 8
  %none.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 6)
  store %struct.nish_array* %0, %struct.nish_array** %squares.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelFrom$i64$fn.4.cube(i32 4)
  store %struct.nish_array* %1, %struct.nish_array** %cubes.addr, align 8
  %2 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow1(i32 0)
  store %struct.nish_array* %2, %struct.nish_array** %none.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ult i64 5, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 5, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 5
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %8, i8* %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %21 = load %struct.nish_array*, %struct.nish_array** %cubes.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 3, %23
  br i1 %24, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %23)
  unreachable

bounds.ok.1:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast i8* %26 to i64*
  %28 = getelementptr inbounds i64, i64* %27, i64 3
  %29 = load i64, i64* %28, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  %30 = call i8* @nish_str_from_i64(i64 %29)
  %31 = call i8* @nish_str_concat(i8* %20, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = trunc i64 %35 to i32
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %32, i8* %37)
  call void @nish_print(i8* %38)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %i) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %i, i32 %i)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @nish_main$arrow1(i32 noundef %i) #1 {
entry:
  ret i32 %i
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"element i64", !6, i64 0}
!15 = !{!14, !14, i64 0}
