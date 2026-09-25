%struct.nish_array = type { i64, i64, i8* }

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal noundef i32 @afterPop(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i) #0 {
entry:
  %a.addr = alloca i32, align 4
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %8, i32* %a.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4
  %11 = icmp eq i64 %10, 0
  br i1 %11, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %12 = sub i64 %10, 1
  store i64 %12, i64* %9, align 8, !alias.scope !3, !noalias !4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %12
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %18 = load i32, i32* %a.addr, align 4
  %19 = sext i32 %i to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %19
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %28 = add nsw i32 %18, %27
  ret i32 %28
}

define internal noundef i32 @afterPush(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i) #0 {
entry:
  %a.addr = alloca i32, align 4
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %8, i32* %a.addr, align 4
  %9 = load i32, i32* %a.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %xs, i64 4)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %11
  store i32 %9, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4
  %20 = trunc i64 %19 to i32
  %21 = load i32, i32* %a.addr, align 4
  %22 = sext i32 %i to i64
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4
  %25 = icmp ult i64 %22, %24
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %22, i64 %24)
  unreachable

bounds.ok.1:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %22
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %31 = add nsw i32 %21, %30
  ret i32 %31
}

define noundef i32 @test() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
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
  %8 = call i32 @afterPop(%struct.nish_array* %arr.hdr, i32 1)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %9, align 8, !alias.scope !3, !noalias !4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = bitcast [3 x i32]* %arr.data.1 to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4
  %13 = bitcast i8* %11 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  store i32 1, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %15 = getelementptr inbounds i32, i32* %13, i64 1
  store i32 2, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %16 = getelementptr inbounds i32, i32* %13, i64 2
  store i32 3, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %17 = call i32 @afterPush(%struct.nish_array* %arr.hdr.1, i32 2)
  %18 = add nsw i32 %8, %17
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %18
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
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}
