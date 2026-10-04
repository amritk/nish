%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2

define noundef i32 @test() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %fixed.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %m.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %10 to i32
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i32, i32* %total.addr, align 4
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %12 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %18
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %23, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  store i32 %30, i32* %n.addr, align 4
  store i32 0, i32* %j.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %34 = load i32, i32* %j.addr, align 4
  %35 = load i32, i32* %n.addr, align 4
  %36 = icmp slt i32 %34, %35
  br i1 %36, label %while.body, label %while.end

while.body:
  %37 = load i32, i32* %total.addr, align 4
  %38 = load i32, i32* %j.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = bitcast i8* %33 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %39
  %42 = load i32, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %37, i32 %42)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %44, i32* %total.addr, align 4
  %46 = load i32, i32* %j.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %48 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  %52 = icmp sge i32 %51, 2
  br i1 %52, label %if.then, label %if.end

if.then:
  %53 = load i32, i32* %total.addr, align 4
  %54 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 1
  %59 = load i32, i32* %58, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %60 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 %59)
  %61 = extractvalue { i32, i1 } %60, 0
  %62 = extractvalue { i32, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %61, i32* %total.addr, align 4
  br label %if.end

if.end:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %65 = bitcast [2 x i32]* %arr.data.1 to i8*
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = bitcast i8* %65 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 0
  store i32 10, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %69 = getelementptr inbounds i32, i32* %67, i64 1
  store i32 20, i32* %69, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %fixed.addr, align 8
  store i32 0, i32* %m.addr, align 4
  %70 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %73 = load i32, i32* %m.addr, align 4
  %74 = icmp slt i32 %73, 2
  br i1 %74, label %while.body.1, label %while.end.1

while.body.1:
  %75 = load i32, i32* %total.addr, align 4
  %76 = load i32, i32* %m.addr, align 4
  %77 = sext i32 %76 to i64
  %78 = bitcast i8* %72 to i32*
  %79 = getelementptr inbounds i32, i32* %78, i64 %77
  %80 = load i32, i32* %79, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %75, i32 %80)
  %82 = extractvalue { i32, i1 } %81, 0
  %83 = extractvalue { i32, i1 } %81, 1
  br i1 %83, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %82, i32* %total.addr, align 4
  %84 = load i32, i32* %m.addr, align 4
  %85 = add nsw i32 %84, 1
  store i32 %85, i32* %m.addr, align 4
  br label %while.cond.1

while.end.1:
  %86 = load i32, i32* %total.addr, align 4
  %87 = load i32, i32* %total.addr, align 4
  %88 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %86, i32 %87)
  %89 = extractvalue { i32, i1 } %88, 0
  %90 = extractvalue { i32, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %89, i32* %at.addr, align 4
  %91 = load i32, i32* %total.addr, align 4
  %92 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %93 = load i32, i32* %at.addr, align 4
  %94 = sext i32 %93 to i64
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  %96 = load i64, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %97 = icmp ult i64 %94, %96
  br i1 %97, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %94, i64 %96)
  unreachable

bounds.ok:
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %100 = bitcast i8* %99 to i32*
  %101 = getelementptr inbounds i32, i32* %100, i64 %94
  %102 = load i32, i32* %101, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %103 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %91, i32 %102)
  %104 = extractvalue { i32, i1 } %103, 0
  %105 = extractvalue { i32, i1 } %103, 1
  br i1 %105, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %104, i32* %total.addr, align 4
  %106 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %107 = load i64, i64* %forof.idx, align 8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = icmp ult i64 %107, %109
  br i1 %110, label %forof.body, label %forof.end

forof.body:
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  %112 = load i8*, i8** %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = bitcast i8* %112 to i32*
  %114 = getelementptr inbounds i32, i32* %113, i64 %107
  %115 = load i32, i32* %114, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %115, i32* %x.addr, align 4
  %116 = load i32, i32* %total.addr, align 4
  %117 = load i32, i32* %x.addr, align 4
  %118 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %116, i32 %117)
  %119 = extractvalue { i32, i1 } %118, 0
  %120 = extractvalue { i32, i1 } %118, 1
  br i1 %120, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %119, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %121 = load i64, i64* %forof.idx, align 8
  %122 = add i64 %121, 1
  store i64 %122, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %123 = load i32, i32* %total.addr, align 4
  ret i32 %123

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 0, %while.body ], [ 0, %if.then ], [ 0, %while.body.1 ], [ 1, %while.end.1 ], [ 0, %bounds.ok ], [ 0, %forof.body ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
