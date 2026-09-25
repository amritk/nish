%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal void @fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %bytes, i8 noundef %v) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  store i8 %v, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %total.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 %9
  %12 = load i8, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = zext i8 %12 to i32
  %14 = add nsw i32 %7, %13
  store i32 %14, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %total.addr, align 4
  ret i32 %17
}

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %one.addr = alloca i8, align 1
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [4 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 4, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  call void @fill(%struct.nish_array* %4, i8 200)
  %5 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %6 = call i32 @sum(%struct.nish_array* %5)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 0, %10
  br i1 %11, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %10)
  unreachable

bounds.ok:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast i8* %13 to i8*
  %15 = getelementptr inbounds i8, i8* %14, i64 0
  store i8 255, i8* %15, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 1, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %21 to i8*
  %23 = getelementptr inbounds i8, i8* %22, i64 1
  store i8 255, i8* %23, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %24 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = icmp ult i64 2, %26
  br i1 %27, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %26)
  unreachable

bounds.ok.2:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = bitcast i8* %29 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 2
  store i8 255, i8* %31, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %32 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = icmp ult i64 3, %34
  br i1 %35, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %34)
  unreachable

bounds.ok.3:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = bitcast i8* %37 to i8*
  %39 = getelementptr inbounds i8, i8* %38, i64 3
  store i8 0, i8* %39, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %40 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %41 = call i32 @sum(%struct.nish_array* %40)
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
  store i8 1, i8* %one.addr, align 1
  %43 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 0, %46
  br i1 %47, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %46)
  unreachable

bounds.ok.4:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %50 = bitcast i8* %49 to i8*
  %51 = getelementptr inbounds i8, i8* %50, i64 0
  %52 = load i8, i8* %51, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %53 = load i8, i8* %one.addr, align 1
  %54 = add i8 %52, %53
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = icmp ult i64 3, %56
  br i1 %57, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 3, i64 %56)
  unreachable

bounds.ok.5:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %60 = bitcast i8* %59 to i8*
  %61 = getelementptr inbounds i8, i8* %60, i64 3
  store i8 %54, i8* %61, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %62 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %65 = bitcast i8* %64 to i8*
  %66 = getelementptr inbounds i8, i8* %65, i64 3
  %67 = load i8, i8* %66, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %68 = zext i8 %67 to i32
  %69 = call i8* @nish_str_from_i32(i32 %68)
  call void @nish_print(i8* %69)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
