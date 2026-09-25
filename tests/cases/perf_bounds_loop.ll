%struct.nish_array = type { i64, i64, i8* }

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @test() #0 {
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
  %arena.mark = call i64 @nish_arena_mark()
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
  br label %while.cond

while.cond:
  %45 = load i32, i32* %j.addr, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
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
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = icmp ult i64 %57, %59
  br i1 %60, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %57, i64 %59)
  unreachable

bounds.ok.1:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %57
  %65 = load i32, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %66 = add nsw i32 %54, %65
  store i32 %66, i32* %total.addr, align 4
  %67 = load i32, i32* %j.addr, align 4
  %68 = add nsw i32 %67, 1
  store i32 %68, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %71 = bitcast [2 x i32]* %arr.data.3 to i8*
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %71, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %73 = bitcast i8* %71 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 0
  store i32 1, i32* %74, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = getelementptr inbounds i32, i32* %73, i64 1
  store i32 2, i32* %75, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %ws.addr, align 8
  %76 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = trunc i64 %78 to i32
  %80 = sub nsw i32 %79, 1
  store i32 %80, i32* %k.addr, align 4
  %81 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %86 = load i32, i32* %k.addr, align 4
  %87 = icmp ne i32 %86, 0
  br i1 %87, label %while.body.1, label %while.end.1

while.body.1:
  %88 = load i32, i32* %total.addr, align 4
  %89 = load i32, i32* %k.addr, align 4
  %90 = sext i32 %89 to i64
  %91 = icmp ult i64 %90, %83
  br i1 %91, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %90, i64 %83)
  unreachable

bounds.ok.2:
  %92 = bitcast i8* %85 to i32*
  %93 = getelementptr inbounds i32, i32* %92, i64 %90
  %94 = load i32, i32* %93, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %95 = add nsw i32 %88, %94
  store i32 %95, i32* %total.addr, align 4
  %96 = load i32, i32* %k.addr, align 4
  %97 = sub nsw i32 %96, 1
  store i32 %97, i32* %k.addr, align 4
  br label %while.cond.1

while.end.1:
  %98 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %98
}

define internal noundef i32 @weigh(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ys) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %ys, i64 4)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp eq i64 %12, 0
  br i1 %13, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %14 = sub i64 %12, 1
  store i64 %14, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %14
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  ret i32 %22
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
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
