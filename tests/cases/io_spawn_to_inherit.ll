%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"build/io_spawn_to_inherit.err\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"before\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"status: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"echo inherited\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"empty: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"nish-no-such-program\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef i32 @nish_spawn_to(%struct.nish_array* noundef nonnull align 8, i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

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
  %err.addr = alloca i8*, align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  store i8* bitcast ({ i64, [30 x i8] }* @.str.1 to i8*), i8** %err.addr, align 8
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
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
  store i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8*, i8** %7, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8*, i8** %7, i64 2
  store i8* bitcast ({ i64, [15 x i8] }* @.str.6 to i8*), i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = load i8*, i8** %err.addr, align 8
  %12 = call i32 @nish_spawn_to(%struct.nish_array* %2, i8* bitcast ({ i64, [1 x i8] }* @.str.7 to i8*), i8* %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.3 to i8*), i8* %13)
  call void @nish_print(i8* %14)
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 0, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* null, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %16, %struct.nish_array** %empty.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %21 = load i8*, i8** %err.addr, align 8
  %22 = call i32 @nish_spawn_to(%struct.nish_array* %20, i8* bitcast ({ i64, [1 x i8] }* @.str.7 to i8*), i8* %21)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.8 to i8*), i8* %23)
  call void @nish_print(i8* %24)
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 1, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 1, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = call i8* @nish_alloc_struct(i64 8)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %29 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 0
  store i8* bitcast ({ i64, [21 x i8] }* @.str.10 to i8*), i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = load i8*, i8** %err.addr, align 8
  %34 = call i32 @nish_spawn_to(%struct.nish_array* %26, i8* bitcast ({ i64, [1 x i8] }* @.str.7 to i8*), i8* %33)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.9 to i8*), i8* %35)
  call void @nish_print(i8* %36)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

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
