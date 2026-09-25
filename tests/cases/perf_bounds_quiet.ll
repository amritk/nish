%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #1

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
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4
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
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %22 = add nsw i32 %16, %21
  store i32 %22, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4
  %28 = trunc i64 %27 to i32
  store i32 %28, i32* %n.addr, align 4
  store i32 0, i32* %j.addr, align 4
  %29 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4
  br label %while.cond

while.cond:
  %32 = load i32, i32* %j.addr, align 4
  %33 = load i32, i32* %n.addr, align 4
  %34 = icmp slt i32 %32, %33
  br i1 %34, label %while.body, label %while.end

while.body:
  %35 = load i32, i32* %total.addr, align 4
  %36 = load i32, i32* %j.addr, align 4
  %37 = sext i32 %36 to i64
  %38 = bitcast i8* %31 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %37
  %40 = load i32, i32* %39, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %41 = add nsw i32 %35, %40
  store i32 %41, i32* %total.addr, align 4
  %42 = load i32, i32* %j.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %44 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4
  %47 = trunc i64 %46 to i32
  %48 = icmp sge i32 %47, 2
  br i1 %48, label %if.then, label %if.end

if.then:
  %49 = load i32, i32* %total.addr, align 4
  %50 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4
  %53 = bitcast i8* %52 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 1
  %55 = load i32, i32* %54, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %56 = add nsw i32 %49, %55
  store i32 %56, i32* %total.addr, align 4
  br label %if.end

if.end:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %57, align 8, !alias.scope !3, !noalias !4
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %58, align 8, !alias.scope !3, !noalias !4
  %59 = bitcast [2 x i32]* %arr.data.1 to i8*
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %59, i8** %60, align 8, !alias.scope !3, !noalias !4
  %61 = bitcast i8* %59 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 0
  store i32 10, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %63 = getelementptr inbounds i32, i32* %61, i64 1
  store i32 20, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %fixed.addr, align 8
  store i32 0, i32* %m.addr, align 4
  %64 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4
  br label %while.cond.1

while.cond.1:
  %67 = load i32, i32* %m.addr, align 4
  %68 = icmp slt i32 %67, 2
  br i1 %68, label %while.body.1, label %while.end.1

while.body.1:
  %69 = load i32, i32* %total.addr, align 4
  %70 = load i32, i32* %m.addr, align 4
  %71 = sext i32 %70 to i64
  %72 = bitcast i8* %66 to i32*
  %73 = getelementptr inbounds i32, i32* %72, i64 %71
  %74 = load i32, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %75 = add nsw i32 %69, %74
  store i32 %75, i32* %total.addr, align 4
  %76 = load i32, i32* %m.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %m.addr, align 4
  br label %while.cond.1

while.end.1:
  %78 = load i32, i32* %total.addr, align 4
  %79 = load i32, i32* %total.addr, align 4
  %80 = sub nsw i32 %78, %79
  store i32 %80, i32* %at.addr, align 4
  %81 = load i32, i32* %total.addr, align 4
  %82 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %83 = load i32, i32* %at.addr, align 4
  %84 = sext i32 %83 to i64
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4
  %87 = icmp ult i64 %84, %86
  br i1 %87, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %84, i64 %86)
  unreachable

bounds.ok:
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4
  %90 = bitcast i8* %89 to i32*
  %91 = getelementptr inbounds i32, i32* %90, i64 %84
  %92 = load i32, i32* %91, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %93 = add nsw i32 %81, %92
  store i32 %93, i32* %total.addr, align 4
  %94 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %95 = load i64, i64* %forof.idx, align 8
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !3, !noalias !4
  %98 = icmp ult i64 %95, %97
  br i1 %98, label %forof.body, label %forof.end

forof.body:
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 2
  %100 = load i8*, i8** %99, align 8, !alias.scope !3, !noalias !4
  %101 = bitcast i8* %100 to i32*
  %102 = getelementptr inbounds i32, i32* %101, i64 %95
  %103 = load i32, i32* %102, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %103, i32* %x.addr, align 4
  %104 = load i32, i32* %total.addr, align 4
  %105 = load i32, i32* %x.addr, align 4
  %106 = add nsw i32 %104, %105
  store i32 %106, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %107 = load i64, i64* %forof.idx, align 8
  %108 = add i64 %107, 1
  store i64 %108, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %109 = load i32, i32* %total.addr, align 4
  ret i32 %109
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}
