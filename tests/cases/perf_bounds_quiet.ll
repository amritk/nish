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
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4
  %12 = trunc i64 %11 to i32
  %13 = icmp slt i32 %8, %12
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %total.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %17
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3
  %23 = add nsw i32 %14, %22
  store i32 %23, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4
  %29 = trunc i64 %28 to i32
  store i32 %29, i32* %n.addr, align 4
  store i32 0, i32* %j.addr, align 4
  br label %while.cond

while.cond:
  %30 = load i32, i32* %j.addr, align 4
  %31 = load i32, i32* %n.addr, align 4
  %32 = icmp slt i32 %30, %31
  br i1 %32, label %while.body, label %while.end

while.body:
  %33 = load i32, i32* %total.addr, align 4
  %34 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %35 = load i32, i32* %j.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %36
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3
  %42 = add nsw i32 %33, %41
  store i32 %42, i32* %total.addr, align 4
  %43 = load i32, i32* %j.addr, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %45 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4
  %48 = trunc i64 %47 to i32
  %49 = icmp sge i32 %48, 2
  br i1 %49, label %if.then, label %if.end

if.then:
  %50 = load i32, i32* %total.addr, align 4
  %51 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 1
  %56 = load i32, i32* %55, align 4, !alias.scope !4, !noalias !3
  %57 = add nsw i32 %50, %56
  store i32 %57, i32* %total.addr, align 4
  br label %if.end

if.end:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %58, align 8, !alias.scope !3, !noalias !4
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %59, align 8, !alias.scope !3, !noalias !4
  %60 = bitcast [2 x i32]* %arr.data.1 to i8*
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %60, i8** %61, align 8, !alias.scope !3, !noalias !4
  %62 = bitcast i8* %60 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 0
  store i32 10, i32* %63, align 4, !alias.scope !4, !noalias !3
  %64 = getelementptr inbounds i32, i32* %62, i64 1
  store i32 20, i32* %64, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %fixed.addr, align 8
  store i32 0, i32* %m.addr, align 4
  br label %while.cond.1

while.cond.1:
  %65 = load i32, i32* %m.addr, align 4
  %66 = icmp slt i32 %65, 2
  br i1 %66, label %while.body.1, label %while.end.1

while.body.1:
  %67 = load i32, i32* %total.addr, align 4
  %68 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %69 = load i32, i32* %m.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !3, !noalias !4
  %73 = bitcast i8* %72 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 %70
  %75 = load i32, i32* %74, align 4, !alias.scope !4, !noalias !3
  %76 = add nsw i32 %67, %75
  store i32 %76, i32* %total.addr, align 4
  %77 = load i32, i32* %m.addr, align 4
  %78 = add nsw i32 %77, 1
  store i32 %78, i32* %m.addr, align 4
  br label %while.cond.1

while.end.1:
  %79 = load i32, i32* %total.addr, align 4
  %80 = load i32, i32* %total.addr, align 4
  %81 = sub nsw i32 %79, %80
  store i32 %81, i32* %at.addr, align 4
  %82 = load i32, i32* %total.addr, align 4
  %83 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %84 = load i32, i32* %at.addr, align 4
  %85 = sext i32 %84 to i64
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4
  %88 = icmp ult i64 %85, %87
  br i1 %88, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %85, i64 %87)
  unreachable

bounds.ok:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4
  %91 = bitcast i8* %90 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 %85
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3
  %94 = add nsw i32 %82, %93
  store i32 %94, i32* %total.addr, align 4
  %95 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %96 = load i64, i64* %forof.idx, align 8
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !3, !noalias !4
  %99 = icmp ult i64 %96, %98
  br i1 %99, label %forof.body, label %forof.end

forof.body:
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %101 = load i8*, i8** %100, align 8, !alias.scope !3, !noalias !4
  %102 = bitcast i8* %101 to i32*
  %103 = getelementptr inbounds i32, i32* %102, i64 %96
  %104 = load i32, i32* %103, align 4, !alias.scope !4, !noalias !3
  store i32 %104, i32* %x.addr, align 4
  %105 = load i32, i32* %total.addr, align 4
  %106 = load i32, i32* %x.addr, align 4
  %107 = add nsw i32 %105, %106
  store i32 %107, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %108 = load i64, i64* %forof.idx, align 8
  %109 = add i64 %108, 1
  store i64 %109, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %110 = load i32, i32* %total.addr, align 4
  ret i32 %110
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
