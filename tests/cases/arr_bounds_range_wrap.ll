%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal noundef i32 @diagonals() #0 {
entry:
  %up.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [16 x i32], align 8
  %down.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [16 x i32], align 8
  %total.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 16, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 16, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 16, 4
  %3 = bitcast [16 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %up.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 16, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 16, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = mul i64 16, 4
  %8 = bitcast [16 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %down.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %r.addr, align 4
  %10 = load %struct.nish_array*, %struct.nish_array** %up.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = load %struct.nish_array*, %struct.nish_array** %down.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %20 = load i32, i32* %r.addr, align 4
  %21 = icmp slt i32 %20, 8
  br i1 %21, label %for.body, label %for.end

for.body:
  store i32 0, i32* %c.addr, align 4
  %22 = load %struct.nish_array*, %struct.nish_array** %up.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = load %struct.nish_array*, %struct.nish_array** %down.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %32 = load i32, i32* %c.addr, align 4
  %33 = icmp slt i32 %32, 8
  br i1 %33, label %for.body.1, label %for.end.1

for.body.1:
  %34 = load i32, i32* %total.addr, align 4
  %35 = load i32, i32* %c.addr, align 4
  %36 = load i32, i32* %r.addr, align 4
  %37 = add i32 %35, %36
  %38 = sext i32 %37 to i64
  %39 = icmp ult i64 %38, %24
  br i1 %39, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %38, i64 %24)
  unreachable

bounds.ok:
  %40 = bitcast i8* %26 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %38
  %42 = load i32, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = add i32 %34, %42
  %44 = load i32, i32* %c.addr, align 4
  %45 = load i32, i32* %r.addr, align 4
  %46 = sub i32 %44, %45
  %47 = add i32 %46, 7
  %48 = sext i32 %47 to i64
  %49 = icmp ult i64 %48, %29
  br i1 %49, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %48, i64 %29)
  unreachable

bounds.ok.1:
  %50 = bitcast i8* %31 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 %48
  %52 = load i32, i32* %51, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = add i32 %43, %52
  store i32 %53, i32* %total.addr, align 4
  br label %for.inc.1

for.inc.1:
  %54 = load i32, i32* %c.addr, align 4
  %55 = add i32 %54, 1
  store i32 %55, i32* %c.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %56 = load i32, i32* %r.addr, align 4
  %57 = add i32 %56, 1
  store i32 %57, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %58 = load i32, i32* %total.addr, align 4
  ret i32 %58
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @diagonals()
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
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
