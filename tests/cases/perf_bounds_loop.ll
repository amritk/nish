%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal noundef i32 @weigh(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ys) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define noundef i32 @test() #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %zs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i32], align 8
  %j.addr = alloca i32, align 4
  %ws.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [2 x i32], align 8
  %k.addr = alloca i32, align 4
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
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %8, align 8, !alias.scope !3, !noalias !4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %9, align 8, !alias.scope !3, !noalias !4
  %10 = bitcast [3 x i32]* %arr.data.1 to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4
  %12 = bitcast i8* %10 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  store i32 4, i32* %13, align 4, !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds i32, i32* %12, i64 1
  store i32 5, i32* %14, align 4, !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds i32, i32* %12, i64 2
  store i32 6, i32* %15, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %16 = load i32, i32* %i.addr, align 4
  %17 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4
  %20 = trunc i64 %19 to i32
  %21 = icmp slt i32 %16, %20
  br i1 %21, label %for.body, label %for.end

for.body:
  %22 = load i32, i32* %total.addr, align 4
  %23 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %24 = load i32, i32* %i.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4
  %28 = icmp ult i64 %25, %27
  br i1 %28, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %25, i64 %27)
  unreachable

bounds.ok:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 %25
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3
  %34 = add nsw i32 %22, %33
  store i32 %34, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %35 = load i32, i32* %i.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %37, align 8, !alias.scope !3, !noalias !4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %38, align 8, !alias.scope !3, !noalias !4
  %39 = bitcast [3 x i32]* %arr.data.2 to i8*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !3, !noalias !4
  %41 = bitcast i8* %39 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 0
  store i32 7, i32* %42, align 4, !alias.scope !4, !noalias !3
  %43 = getelementptr inbounds i32, i32* %41, i64 1
  store i32 8, i32* %43, align 4, !alias.scope !4, !noalias !3
  %44 = getelementptr inbounds i32, i32* %41, i64 2
  store i32 9, i32* %44, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %zs.addr, align 8
  store i32 0, i32* %j.addr, align 4
  br label %while.cond

while.cond:
  %45 = load i32, i32* %j.addr, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4
  %49 = trunc i64 %48 to i32
  %50 = icmp slt i32 %45, %49
  br i1 %50, label %while.body, label %while.end

while.body:
  %51 = load i32, i32* %total.addr, align 4
  %52 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %53 = call i32 @weigh(%struct.nish_array* %52)
  %54 = add nsw i32 %51, %53
  %55 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %56 = load i32, i32* %j.addr, align 4
  %57 = sext i32 %56 to i64
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4
  %60 = icmp ult i64 %57, %59
  br i1 %60, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %57, i64 %59)
  unreachable

bounds.ok.1:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4
  %63 = bitcast i8* %62 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %57
  %65 = load i32, i32* %64, align 4, !alias.scope !4, !noalias !3
  %66 = add nsw i32 %54, %65
  store i32 %66, i32* %total.addr, align 4
  %67 = load i32, i32* %j.addr, align 4
  %68 = add nsw i32 %67, 1
  store i32 %68, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %69, align 8, !alias.scope !3, !noalias !4
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %70, align 8, !alias.scope !3, !noalias !4
  %71 = bitcast [2 x i32]* %arr.data.3 to i8*
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %71, i8** %72, align 8, !alias.scope !3, !noalias !4
  %73 = bitcast i8* %71 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 0
  store i32 1, i32* %74, align 4, !alias.scope !4, !noalias !3
  %75 = getelementptr inbounds i32, i32* %73, i64 1
  store i32 2, i32* %75, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %ws.addr, align 8
  %76 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4
  %79 = trunc i64 %78 to i32
  %80 = sub nsw i32 %79, 1
  store i32 %80, i32* %k.addr, align 4
  br label %while.cond.1

while.cond.1:
  %81 = load i32, i32* %k.addr, align 4
  %82 = icmp sgt i32 %81, 0
  br i1 %82, label %while.body.1, label %while.end.1

while.body.1:
  %83 = load i32, i32* %total.addr, align 4
  %84 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %85 = load i32, i32* %k.addr, align 4
  %86 = sext i32 %85 to i64
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %88 = load i64, i64* %87, align 8, !alias.scope !3, !noalias !4
  %89 = icmp ult i64 %86, %88
  br i1 %89, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %86, i64 %88)
  unreachable

bounds.ok.2:
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4
  %92 = bitcast i8* %91 to i32*
  %93 = getelementptr inbounds i32, i32* %92, i64 %86
  %94 = load i32, i32* %93, align 4, !alias.scope !4, !noalias !3
  %95 = add nsw i32 %83, %94
  store i32 %95, i32* %total.addr, align 4
  %96 = load i32, i32* %k.addr, align 4
  %97 = sub nsw i32 %96, 1
  store i32 %97, i32* %k.addr, align 4
  br label %while.cond.1

while.end.1:
  %98 = load i32, i32* %total.addr, align 4
  ret i32 %98
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
