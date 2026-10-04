%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8

declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

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
  %29 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %28, i32 100000)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  %32 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at, align 8
  br label %idx.scan

idx.scan:
  %35 = load i64, i64* %idx.at, align 8
  %36 = icmp ult i64 %35, %34
  br i1 %36, label %idx.test, label %idx.miss

idx.test:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %38 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %35
  %41 = load i8*, i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = call zeroext i1 @nish_str_eq(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  br i1 %42, label %idx.found, label %idx.next

idx.next:
  %43 = add i64 %35, 1
  store i64 %43, i64* %idx.at, align 8
  br label %idx.scan

idx.miss:
  br label %idx.found

idx.found:
  %44 = phi i64 [ %35, %idx.test ], [ -1, %idx.miss ]
  %45 = trunc i64 %44 to i32
  %46 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %45, i32 10000)
  %47 = extractvalue { i32, i1 } %46, 0
  %48 = extractvalue { i32, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %49 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %47)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %52 = load i8*, i8** %last.addr, align 8
  %53 = call zeroext i1 @nish_str_eq(i8* %52, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  br i1 %53, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %54 = phi i32 [ 1000, %cond.true ], [ 0, %cond.false ]
  %55 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 %54)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %58 = load %struct.nish_array*, %struct.nish_array** %nums.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at.1, align 8
  br label %idx.scan.1

idx.scan.1:
  %61 = load i64, i64* %idx.at.1, align 8
  %62 = icmp ult i64 %61, %60
  br i1 %62, label %idx.test.1, label %idx.miss.1

idx.test.1:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %64 to i32*
  %66 = getelementptr inbounds i32, i32* %65, i64 %61
  %67 = load i32, i32* %66, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %68 = icmp eq i32 %67, 15
  br i1 %68, label %idx.found.1, label %idx.next.1

idx.next.1:
  %69 = add i64 %61, 1
  store i64 %69, i64* %idx.at.1, align 8
  br label %idx.scan.1

idx.miss.1:
  br label %idx.found.1

idx.found.1:
  %70 = phi i64 [ %61, %idx.test.1 ], [ -1, %idx.miss.1 ]
  %71 = trunc i64 %70 to i32
  %72 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %71, i32 1)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %75 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %73, i32 100)
  %76 = extractvalue { i32, i1 } %75, 0
  %77 = extractvalue { i32, i1 } %75, 1
  br i1 %77, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %78 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %56, i32 %76)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %81 = load %struct.nish_array*, %struct.nish_array** %nums.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at.2, align 8
  br label %idx.scan.2

idx.scan.2:
  %84 = load i64, i64* %idx.at.2, align 8
  %85 = icmp ult i64 %84, %83
  br i1 %85, label %idx.test.2, label %idx.miss.2

idx.test.2:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %88 = bitcast i8* %87 to i32*
  %89 = getelementptr inbounds i32, i32* %88, i64 %84
  %90 = load i32, i32* %89, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %91 = icmp eq i32 %90, 99
  br i1 %91, label %idx.found.2, label %idx.next.2

idx.next.2:
  %92 = add i64 %84, 1
  store i64 %92, i64* %idx.at.2, align 8
  br label %idx.scan.2

idx.miss.2:
  br label %idx.found.2

idx.found.2:
  %93 = phi i64 [ %84, %idx.test.2 ], [ -1, %idx.miss.2 ]
  %94 = trunc i64 %93 to i32
  %95 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %94, i32 1)
  %96 = extractvalue { i32, i1 } %95, 0
  %97 = extractvalue { i32, i1 } %95, 1
  br i1 %97, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %98 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %96, i32 10)
  %99 = extractvalue { i32, i1 } %98, 0
  %100 = extractvalue { i32, i1 } %98, 1
  br i1 %100, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %101 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %79, i32 %99)
  %102 = extractvalue { i32, i1 } %101, 0
  %103 = extractvalue { i32, i1 } %101, 1
  br i1 %103, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %104 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 0
  %106 = load i64, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at.3, align 8
  br label %idx.scan.3

idx.scan.3:
  %107 = load i64, i64* %idx.at.3, align 8
  %108 = icmp ult i64 %107, %106
  br i1 %108, label %idx.test.3, label %idx.miss.3

idx.test.3:
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %111 = bitcast i8* %110 to i8**
  %112 = getelementptr inbounds i8*, i8** %111, i64 %107
  %113 = load i8*, i8** %112, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %114 = call zeroext i1 @nish_str_eq(i8* %113, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  br i1 %114, label %idx.found.3, label %idx.next.3

idx.next.3:
  %115 = add i64 %107, 1
  store i64 %115, i64* %idx.at.3, align 8
  br label %idx.scan.3

idx.miss.3:
  br label %idx.found.3

idx.found.3:
  %116 = phi i64 [ %107, %idx.test.3 ], [ -1, %idx.miss.3 ]
  %117 = trunc i64 %116 to i32
  %118 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %117, i32 1)
  %119 = extractvalue { i32, i1 } %118, 0
  %120 = extractvalue { i32, i1 } %118, 1
  br i1 %120, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  %121 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %102, i32 %119)
  %122 = extractvalue { i32, i1 } %121, 0
  %123 = extractvalue { i32, i1 } %121, 1
  br i1 %123, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  ret i32 %122

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 2, %idx.found ], [ 0, %ovf.ok.1 ], [ 0, %cond.end ], [ 0, %idx.found.1 ], [ 2, %ovf.ok.4 ], [ 0, %ovf.ok.5 ], [ 0, %idx.found.2 ], [ 2, %ovf.ok.7 ], [ 0, %ovf.ok.8 ], [ 0, %idx.found.3 ], [ 0, %ovf.ok.10 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn memory(argmem: read) }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

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
