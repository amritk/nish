%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"four lanes do not fit at off\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal noundef i32 @firstLane(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ys, i32 noundef %off) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp slt i32 %off, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = sub nsw i32 %3, 4
  %5 = icmp sgt i32 %off, %4
  br label %lor.end

lor.end:
  %6 = phi i1 [ true, %entry ], [ %5, %lor.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [29 x i8] }* @.str.0 to i8*))
  unreachable

if.end:
  %7 = add nsw i32 %off, 3
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %8
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  br label %while.cond

while.cond:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = icmp sgt i32 %17, 2
  br i1 %18, label %while.body, label %while.end

while.body:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = sub i64 %20, 1
  store i64 %21, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %21
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %while.cond

while.end:
  %27 = sext i32 %off to i64
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = add i64 %27, 4
  %31 = icmp ult i64 %27, %29
  %32 = icmp ule i64 %30, %29
  %33 = and i1 %31, %32
  br i1 %33, label %bounds.ok, label %bounds.fail

bounds.fail:
  %34 = add i64 %27, 3
  %35 = select i1 %31, i64 %34, i64 %27
  call void @nish_panic_index(i64 %35, i64 %29)
  unreachable

bounds.ok:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %27
  %40 = bitcast i32* %39 to <4 x i32>*
  %41 = load <4 x i32>, <4 x i32>* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %42 = extractelement <4 x i32> %41, i32 0
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %42
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [6 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 4, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 5, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %4, i64 5
  store i32 6, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = call i32 @firstLane(%struct.nish_array* %11, %struct.nish_array* %12, i32 0)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
