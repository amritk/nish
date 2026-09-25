%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal noundef i32 @weigh(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ys) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
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
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast [3 x i32]* %arr.data.1 to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %10 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  store i32 4, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i32, i32* %12, i64 1
  store i32 5, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i32, i32* %12, i64 2
  store i32 6, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %24 = load i32, i32* %i.addr, align 4
  %25 = trunc i64 %18 to i32
  %26 = icmp slt i32 %24, %25
  br i1 %26, label %for.body, label %for.end

for.body:
  %27 = load i32, i32* %total.addr, align 4
  %28 = load i32, i32* %i.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = icmp ult i64 %29, %21
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %29, i64 %21)
  unreachable

bounds.ok:
  %31 = bitcast i8* %23 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 %29
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = add nsw i32 %27, %33
  store i32 %34, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %35 = load i32, i32* %i.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = bitcast [3 x i32]* %arr.data.2 to i8*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %39 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 0
  store i32 7, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = getelementptr inbounds i32, i32* %41, i64 1
  store i32 8, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = getelementptr inbounds i32, i32* %41, i64 2
  store i32 9, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %zs.addr, align 8
  store i32 0, i32* %j.addr, align 4
  %45 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %50 = load i32, i32* %j.addr, align 4
  %51 = trunc i64 %47 to i32
  %52 = icmp slt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = load i32, i32* %total.addr, align 4
  %54 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %55 = call i32 @weigh(%struct.nish_array* %54)
  %56 = add nsw i32 %53, %55
  %57 = load i32, i32* %j.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = icmp ult i64 %58, %47
  br i1 %59, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %58, i64 %47)
  unreachable

bounds.ok.1:
  %60 = bitcast i8* %49 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 %58
  %62 = load i32, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %63 = add nsw i32 %56, %62
  store i32 %63, i32* %total.addr, align 4
  %64 = load i32, i32* %j.addr, align 4
  %65 = add nsw i32 %64, 1
  store i32 %65, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %68 = bitcast [2 x i32]* %arr.data.3 to i8*
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %68, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = bitcast i8* %68 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 0
  store i32 1, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %72 = getelementptr inbounds i32, i32* %70, i64 1
  store i32 2, i32* %72, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %ws.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = trunc i64 %75 to i32
  %77 = sub nsw i32 %76, 1
  store i32 %77, i32* %k.addr, align 4
  %78 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %83 = load i32, i32* %k.addr, align 4
  %84 = icmp sgt i32 %83, 0
  br i1 %84, label %while.body.1, label %while.end.1

while.body.1:
  %85 = load i32, i32* %total.addr, align 4
  %86 = load i32, i32* %k.addr, align 4
  %87 = sext i32 %86 to i64
  %88 = icmp ult i64 %87, %80
  br i1 %88, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %87, i64 %80)
  unreachable

bounds.ok.2:
  %89 = bitcast i8* %82 to i32*
  %90 = getelementptr inbounds i32, i32* %89, i64 %87
  %91 = load i32, i32* %90, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %92 = add nsw i32 %85, %91
  store i32 %92, i32* %total.addr, align 4
  %93 = load i32, i32* %k.addr, align 4
  %94 = sub nsw i32 %93, 1
  store i32 %94, i32* %k.addr, align 4
  br label %while.cond.1

while.end.1:
  %95 = load i32, i32* %total.addr, align 4
  ret i32 %95
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

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
