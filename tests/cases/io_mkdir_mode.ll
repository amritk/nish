%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"build/test/io_mkdir_mode.d\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"rm\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"-rf\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"first: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"second: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"a directory: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"bad mode: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"build/test/io_mkdir_mode.e\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"sticky bit: \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"missing parent: \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"build/test/io_mkdir_mode.e/f\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noundef i32 @nish_mkdir_mode(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0
declare zeroext i1 @nish_is_dir(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef i32 @nish_spawn(%struct.nish_array* noundef nonnull align 8) #0

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

define noundef i32 @nish_main() #0 {
entry:
  %dir.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [27 x i8] }* @.str.0 to i8*), i8** %dir.addr, align 8
  %0 = load i8*, i8** %dir.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to i8**
  %8 = getelementptr inbounds i8*, i8** %7, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8*, i8** %7, i64 1
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8*, i8** %7, i64 2
  store i8* %0, i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = call i32 @nish_spawn(%struct.nish_array* %2)
  %12 = load i8*, i8** %dir.addr, align 8
  %13 = call i32 @nish_mkdir_mode(i8* %12, i32 448)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*), i8* %14)
  call void @nish_print(i8* %15)
  %16 = load i8*, i8** %dir.addr, align 8
  %17 = call i32 @nish_mkdir_mode(i8* %16, i32 448)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.4 to i8*), i8* %18)
  call void @nish_print(i8* %19)
  %20 = load i8*, i8** %dir.addr, align 8
  %21 = call zeroext i1 @nish_is_dir(i8* %20)
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*)
  %23 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.5 to i8*), i8* %22)
  call void @nish_print(i8* %23)
  %24 = call i32 @nish_mkdir_mode(i8* bitcast ({ i64, [27 x i8] }* @.str.9 to i8*), i32 -1)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.8 to i8*), i8* %25)
  call void @nish_print(i8* %26)
  %27 = call i32 @nish_mkdir_mode(i8* bitcast ({ i64, [27 x i8] }* @.str.9 to i8*), i32 960)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.10 to i8*), i8* %28)
  call void @nish_print(i8* %29)
  %30 = call i32 @nish_mkdir_mode(i8* bitcast ({ i64, [29 x i8] }* @.str.12 to i8*), i32 448)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.11 to i8*), i8* %31)
  call void @nish_print(i8* %32)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
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
