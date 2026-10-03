%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8

declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
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
  %11 = icmp eq i64 %10, 0
  br i1 %11, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %12 = sub i64 %10, 1
  store i64 %12, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %12
  %17 = load i8*, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %17, i8** %last.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast [3 x i32]* %arr.data.1 to i8*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %20 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 0
  store i32 4, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %24 = getelementptr inbounds i32, i32* %22, i64 1
  store i32 8, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = getelementptr inbounds i32, i32* %22, i64 2
  store i32 15, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %nums.addr, align 8
  %26 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  %30 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %29, i32 100000)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  %33 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at, align 8
  br label %idx.scan

idx.scan:
  %36 = load i64, i64* %idx.at, align 8
  %37 = icmp ult i64 %36, %35
  br i1 %37, label %idx.test, label %idx.miss

idx.test:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i8**
  %41 = getelementptr inbounds i8*, i8** %40, i64 %36
  %42 = load i8*, i8** %41, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = call zeroext i1 @nish_str_eq(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  br i1 %43, label %idx.found, label %idx.next

idx.next:
  %44 = add i64 %36, 1
  store i64 %44, i64* %idx.at, align 8
  br label %idx.scan

idx.miss:
  br label %idx.found

idx.found:
  %45 = phi i64 [ %36, %idx.test ], [ -1, %idx.miss ]
  %46 = trunc i64 %45 to i32
  %47 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %46, i32 10000)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %50 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %48)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %53 = load i8*, i8** %last.addr, align 8
  %54 = call zeroext i1 @nish_str_eq(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  br i1 %54, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %55 = phi i32 [ 1000, %cond.true ], [ 0, %cond.false ]
  %56 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %51, i32 %55)
  %57 = extractvalue { i32, i1 } %56, 0
  %58 = extractvalue { i32, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %59 = load %struct.nish_array*, %struct.nish_array** %nums.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at.1, align 8
  br label %idx.scan.1

idx.scan.1:
  %62 = load i64, i64* %idx.at.1, align 8
  %63 = icmp ult i64 %62, %61
  br i1 %63, label %idx.test.1, label %idx.miss.1

idx.test.1:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 %62
  %68 = load i32, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %69 = icmp eq i32 %68, 15
  br i1 %69, label %idx.found.1, label %idx.next.1

idx.next.1:
  %70 = add i64 %62, 1
  store i64 %70, i64* %idx.at.1, align 8
  br label %idx.scan.1

idx.miss.1:
  br label %idx.found.1

idx.found.1:
  %71 = phi i64 [ %62, %idx.test.1 ], [ -1, %idx.miss.1 ]
  %72 = trunc i64 %71 to i32
  %73 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %72, i32 1)
  %74 = extractvalue { i32, i1 } %73, 0
  %75 = extractvalue { i32, i1 } %73, 1
  br i1 %75, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %76 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %74, i32 100)
  %77 = extractvalue { i32, i1 } %76, 0
  %78 = extractvalue { i32, i1 } %76, 1
  br i1 %78, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %79 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %57, i32 %77)
  %80 = extractvalue { i32, i1 } %79, 0
  %81 = extractvalue { i32, i1 } %79, 1
  br i1 %81, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %82 = load %struct.nish_array*, %struct.nish_array** %nums.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at.2, align 8
  br label %idx.scan.2

idx.scan.2:
  %85 = load i64, i64* %idx.at.2, align 8
  %86 = icmp ult i64 %85, %84
  br i1 %86, label %idx.test.2, label %idx.miss.2

idx.test.2:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %89 = bitcast i8* %88 to i32*
  %90 = getelementptr inbounds i32, i32* %89, i64 %85
  %91 = load i32, i32* %90, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %92 = icmp eq i32 %91, 99
  br i1 %92, label %idx.found.2, label %idx.next.2

idx.next.2:
  %93 = add i64 %85, 1
  store i64 %93, i64* %idx.at.2, align 8
  br label %idx.scan.2

idx.miss.2:
  br label %idx.found.2

idx.found.2:
  %94 = phi i64 [ %85, %idx.test.2 ], [ -1, %idx.miss.2 ]
  %95 = trunc i64 %94 to i32
  %96 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %95, i32 1)
  %97 = extractvalue { i32, i1 } %96, 0
  %98 = extractvalue { i32, i1 } %96, 1
  br i1 %98, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %99 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %97, i32 10)
  %100 = extractvalue { i32, i1 } %99, 0
  %101 = extractvalue { i32, i1 } %99, 1
  br i1 %101, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %102 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %80, i32 %100)
  %103 = extractvalue { i32, i1 } %102, 0
  %104 = extractvalue { i32, i1 } %102, 1
  br i1 %104, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %105 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at.3, align 8
  br label %idx.scan.3

idx.scan.3:
  %108 = load i64, i64* %idx.at.3, align 8
  %109 = icmp ult i64 %108, %107
  br i1 %109, label %idx.test.3, label %idx.miss.3

idx.test.3:
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 2
  %111 = load i8*, i8** %110, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %112 = bitcast i8* %111 to i8**
  %113 = getelementptr inbounds i8*, i8** %112, i64 %108
  %114 = load i8*, i8** %113, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %115 = call zeroext i1 @nish_str_eq(i8* %114, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  br i1 %115, label %idx.found.3, label %idx.next.3

idx.next.3:
  %116 = add i64 %108, 1
  store i64 %116, i64* %idx.at.3, align 8
  br label %idx.scan.3

idx.miss.3:
  br label %idx.found.3

idx.found.3:
  %117 = phi i64 [ %108, %idx.test.3 ], [ -1, %idx.miss.3 ]
  %118 = trunc i64 %117 to i32
  %119 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %118, i32 1)
  %120 = extractvalue { i32, i1 } %119, 0
  %121 = extractvalue { i32, i1 } %119, 1
  br i1 %121, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  %122 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %103, i32 %120)
  %123 = extractvalue { i32, i1 } %122, 0
  %124 = extractvalue { i32, i1 } %122, 1
  br i1 %124, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  ret i32 %123

ovf.fail:
  %ovf.op = phi i32 [ 2, %pop.ok ], [ 2, %idx.found ], [ 0, %ovf.ok.1 ], [ 0, %cond.end ], [ 0, %idx.found.1 ], [ 2, %ovf.ok.4 ], [ 0, %ovf.ok.5 ], [ 0, %idx.found.2 ], [ 2, %ovf.ok.7 ], [ 0, %ovf.ok.8 ], [ 0, %idx.found.3 ], [ 0, %ovf.ok.10 ]
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
