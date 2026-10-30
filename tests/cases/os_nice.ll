%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"test \22$(ps -o nice= -p $$)\22 -eq 1\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"test \22$(ps -o cls= -p $$)\22 = IDL\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i32 @nish_spawn(%struct.nish_array* noundef nonnull align 8) #1
declare noundef i32 @nish_set_nice(i32 noundef) #0
declare noundef i32 @nish_set_idle_priority() #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @lower() #0 {
entry:
  %0 = call i32 @nish_set_nice(i32 1)
  ret i32 %0
}

define noundef i32 @above() #0 {
entry:
  %0 = call i32 @nish_set_nice(i32 20)
  ret i32 %0
}

define noundef i32 @negative() #0 {
entry:
  %0 = call i32 @nish_set_nice(i32 -1)
  ret i32 %0
}

define noundef i32 @below() #0 {
entry:
  %0 = call i32 @nish_set_nice(i32 0)
  ret i32 %0
}

define noundef i32 @childNice() #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8*, i8** %6, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8*, i8** %6, i64 2
  store i8* bitcast ({ i64, [34 x i8] }* @.str.2 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = call i32 @nish_spawn(%struct.nish_array* %1)
  ret i32 %10
}

define noundef i32 @idle() #0 {
entry:
  %0 = call i32 @nish_set_idle_priority()
  ret i32 %0
}

define noundef i32 @childClass() #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8*, i8** %6, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8*, i8** %6, i64 2
  store i8* bitcast ({ i64, [33 x i8] }* @.str.3 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = call i32 @nish_spawn(%struct.nish_array* %1)
  ret i32 %10
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
