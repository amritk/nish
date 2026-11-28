%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c": the window is outside the buffer\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"need4\00" }, align 8

declare noundef nonnull align 8 i8* @done() #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3

define internal void @checkWindow(i8* noundef nonnull noalias readonly align 8 nocapture %what, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %off, i32 noundef %len) #0 {
entry:
  %size.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %size.addr, align 4
  %3 = icmp slt i32 %off, 0
  br i1 %3, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %4 = icmp slt i32 %len, 0
  br label %lor.end.2

lor.end.2:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs.2 ]
  br i1 %5, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %6 = load i32, i32* %size.addr, align 4
  %7 = icmp sgt i32 %off, %6
  br label %lor.end.1

lor.end.1:
  %8 = phi i1 [ true, %lor.end.2 ], [ %7, %lor.rhs.1 ]
  br i1 %8, label %lor.end, label %lor.rhs

lor.rhs:
  %9 = load i32, i32* %size.addr, align 4
  %10 = sub nsw i32 %9, %off
  %11 = icmp sgt i32 %len, %10
  br label %lor.end

lor.end:
  %12 = phi i1 [ true, %lor.end.1 ], [ %11, %lor.rhs ]
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = call i8* @nish_str_concat(i8* %what, i8* bitcast ({ i64, [35 x i8] }* @.str.0 to i8*))
  call void @nish_panic(i8* %13)
  unreachable

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @need4(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  call void @checkWindow(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), %struct.nish_array* %b, i32 %off, i32 4)
  ret void
}

define internal noundef i32 @sum4(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  call void @need4(%struct.nish_array* %b, i32 %off)
  %0 = sext i32 %off to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = load i8, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = zext i8 %5 to i32
  %7 = add nsw i32 %off, 1
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %8
  %13 = load i8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = zext i8 %13 to i32
  %15 = add nsw i32 %6, %14
  %16 = add nsw i32 %off, 2
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %17
  %22 = load i8, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = zext i8 %22 to i32
  %24 = add nsw i32 %15, %23
  %25 = add nsw i32 %off, 3
  %26 = sext i32 %25 to i64
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = bitcast i8* %28 to i8*
  %30 = getelementptr inbounds i8, i8* %29, i64 %26
  %31 = load i8, i8* %30, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %32 = zext i8 %31 to i32
  %33 = add nsw i32 %24, %32
  ret i32 %33
}

define void @nish_main() #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [5 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 5, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 5, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [5 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 2, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 3, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 4, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i8, i8* %4, i64 4
  store i8 5, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %11 = call i32 @sum4(%struct.nish_array* %10, i32 0)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %14 = call i32 @sum4(%struct.nish_array* %13, i32 1)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  %16 = call i8* @done()
  call void @nish_print(i8* %16)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
