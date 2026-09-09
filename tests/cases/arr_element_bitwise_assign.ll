%struct.amrit_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"slot\00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0
declare void @amrit_panic_index(i64 noundef, i64 noundef) #2

define internal noundef i32 @slot() #0 {
entry:
  call void @amrit_print(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  ret i32 1
}

define noundef i32 @amrit_main() #1 {
entry:
  %a.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 255, i32* %6, align 4, !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 4, i32* %7, align 4, !alias.scope !4, !noalias !3
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %a.addr, align 8
  %8 = load %struct.amrit_array*, %struct.amrit_array** %a.addr, align 8
  %9 = call i32 @slot()
  %10 = sext i32 %9 to i64
  %11 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %8, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %8, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3
  %19 = and i32 %18, 60
  store i32 %19, i32* %17, align 4, !alias.scope !4, !noalias !3
  %20 = load %struct.amrit_array*, %struct.amrit_array** %a.addr, align 8
  %21 = call i32 @slot()
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %20, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4
  %25 = icmp ult i64 %22, %24
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 %22, i64 %24)
  unreachable

bounds.ok.1:
  %26 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %22
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3
  %31 = or i32 %30, 3
  store i32 %31, i32* %29, align 4, !alias.scope !4, !noalias !3
  %32 = load %struct.amrit_array*, %struct.amrit_array** %a.addr, align 8
  %33 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4
  %35 = icmp ult i64 2, %34
  br i1 %35, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @amrit_panic_index(i64 2, i64 %34)
  unreachable

bounds.ok.2:
  %36 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %32, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 2
  %40 = load i32, i32* %39, align 4, !alias.scope !4, !noalias !3
  %41 = shl i32 %40, 1
  store i32 %41, i32* %39, align 4, !alias.scope !4, !noalias !3
  %42 = load %struct.amrit_array*, %struct.amrit_array** %a.addr, align 8
  %43 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4
  %45 = icmp ult i64 2, %44
  br i1 %45, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @amrit_panic_index(i64 2, i64 %44)
  unreachable

bounds.ok.3:
  %46 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 2
  %50 = load i32, i32* %49, align 4, !alias.scope !4, !noalias !3
  %51 = lshr i32 %50, 1
  store i32 %51, i32* %49, align 4, !alias.scope !4, !noalias !3
  %52 = load %struct.amrit_array*, %struct.amrit_array** %a.addr, align 8
  %53 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4
  %55 = icmp ult i64 0, %54
  br i1 %55, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @amrit_panic_index(i64 0, i64 %54)
  unreachable

bounds.ok.4:
  %56 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %52, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 0
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3
  %61 = call i8* @amrit_str_from_i32(i32 %60)
  call void @amrit_print(i8* %61)
  %62 = load %struct.amrit_array*, %struct.amrit_array** %a.addr, align 8
  %63 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4
  %65 = icmp ult i64 1, %64
  br i1 %65, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @amrit_panic_index(i64 1, i64 %64)
  unreachable

bounds.ok.5:
  %66 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %62, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4
  %68 = bitcast i8* %67 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 1
  %70 = load i32, i32* %69, align 4, !alias.scope !4, !noalias !3
  %71 = call i8* @amrit_str_from_i32(i32 %70)
  call void @amrit_print(i8* %71)
  %72 = load %struct.amrit_array*, %struct.amrit_array** %a.addr, align 8
  %73 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4
  %75 = icmp ult i64 2, %74
  br i1 %75, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @amrit_panic_index(i64 2, i64 %74)
  unreachable

bounds.ok.6:
  %76 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %72, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4
  %78 = bitcast i8* %77 to i32*
  %79 = getelementptr inbounds i32, i32* %78, i64 2
  %80 = load i32, i32* %79, align 4, !alias.scope !4, !noalias !3
  %81 = call i8* @amrit_str_from_i32(i32 %80)
  call void @amrit_print(i8* %81)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"amritc array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
