%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8

declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1

define noundef i32 @test() #0 {
entry:
  %names.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8*], align 8
  %last.addr = alloca i8*, align 8
  %nums.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %idx.at = alloca i64, align 8
  %idx.at.1 = alloca i64, align 8
  %idx.at.2 = alloca i64, align 8
  %idx.at.3 = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %names.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = sub i64 %10, 1
  store i64 %11, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %11
  %16 = load i8*, i8** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %16, i8** %last.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast [3 x i32]* %arr.data.1 to i8*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %19 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  store i32 4, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %23 = getelementptr inbounds i32, i32* %21, i64 1
  store i32 8, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %24 = getelementptr inbounds i32, i32* %21, i64 2
  store i32 15, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %nums.addr, align 8
  %25 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  %29 = mul nsw i32 %28, 100000
  %30 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at, align 8
  br label %idx.scan

idx.scan:
  %33 = load i64, i64* %idx.at, align 8
  %34 = icmp ult i64 %33, %32
  br i1 %34, label %idx.test, label %idx.miss

idx.test:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to i8**
  %38 = getelementptr inbounds i8*, i8** %37, i64 %33
  %39 = load i8*, i8** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %40 = call zeroext i1 @nish_str_eq(i8* %39, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  br i1 %40, label %idx.found, label %idx.next

idx.next:
  %41 = add i64 %33, 1
  store i64 %41, i64* %idx.at, align 8
  br label %idx.scan

idx.miss:
  br label %idx.found

idx.found:
  %42 = phi i64 [ %33, %idx.test ], [ -1, %idx.miss ]
  %43 = trunc i64 %42 to i32
  %44 = mul nsw i32 %43, 10000
  %45 = add nsw i32 %29, %44
  %46 = load i8*, i8** %last.addr, align 8
  %47 = call zeroext i1 @nish_str_eq(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  br i1 %47, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %48 = phi i32 [ 1000, %cond.true ], [ 0, %cond.false ]
  %49 = add nsw i32 %45, %48
  %50 = load %struct.nish_array*, %struct.nish_array** %nums.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at.1, align 8
  br label %idx.scan.1

idx.scan.1:
  %53 = load i64, i64* %idx.at.1, align 8
  %54 = icmp ult i64 %53, %52
  br i1 %54, label %idx.test.1, label %idx.miss.1

idx.test.1:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 %53
  %59 = load i32, i32* %58, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %60 = icmp eq i32 %59, 15
  br i1 %60, label %idx.found.1, label %idx.next.1

idx.next.1:
  %61 = add i64 %53, 1
  store i64 %61, i64* %idx.at.1, align 8
  br label %idx.scan.1

idx.miss.1:
  br label %idx.found.1

idx.found.1:
  %62 = phi i64 [ %53, %idx.test.1 ], [ -1, %idx.miss.1 ]
  %63 = trunc i64 %62 to i32
  %64 = add nsw i32 %63, 1
  %65 = mul nsw i32 %64, 100
  %66 = add nsw i32 %49, %65
  %67 = load %struct.nish_array*, %struct.nish_array** %nums.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at.2, align 8
  br label %idx.scan.2

idx.scan.2:
  %70 = load i64, i64* %idx.at.2, align 8
  %71 = icmp ult i64 %70, %69
  br i1 %71, label %idx.test.2, label %idx.miss.2

idx.test.2:
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %74 = bitcast i8* %73 to i32*
  %75 = getelementptr inbounds i32, i32* %74, i64 %70
  %76 = load i32, i32* %75, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %77 = icmp eq i32 %76, 99
  br i1 %77, label %idx.found.2, label %idx.next.2

idx.next.2:
  %78 = add i64 %70, 1
  store i64 %78, i64* %idx.at.2, align 8
  br label %idx.scan.2

idx.miss.2:
  br label %idx.found.2

idx.found.2:
  %79 = phi i64 [ %70, %idx.test.2 ], [ -1, %idx.miss.2 ]
  %80 = trunc i64 %79 to i32
  %81 = add nsw i32 %80, 1
  %82 = mul nsw i32 %81, 10
  %83 = add nsw i32 %66, %82
  %84 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at.3, align 8
  br label %idx.scan.3

idx.scan.3:
  %87 = load i64, i64* %idx.at.3, align 8
  %88 = icmp ult i64 %87, %86
  br i1 %88, label %idx.test.3, label %idx.miss.3

idx.test.3:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to i8**
  %92 = getelementptr inbounds i8*, i8** %91, i64 %87
  %93 = load i8*, i8** %92, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %94 = call zeroext i1 @nish_str_eq(i8* %93, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  br i1 %94, label %idx.found.3, label %idx.next.3

idx.next.3:
  %95 = add i64 %87, 1
  store i64 %95, i64* %idx.at.3, align 8
  br label %idx.scan.3

idx.miss.3:
  br label %idx.found.3

idx.found.3:
  %96 = phi i64 [ %87, %idx.test.3 ], [ -1, %idx.miss.3 ]
  %97 = trunc i64 %96 to i32
  %98 = add nsw i32 %97, 1
  %99 = add nsw i32 %83, %98
  ret i32 %99
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn memory(argmem: read) }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
