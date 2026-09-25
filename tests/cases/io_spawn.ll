%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"ok: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"exit 0\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"status: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"exit 7\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"signal: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"kill -9 $$\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"nish-no-such-program\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"empty: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
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

define internal noundef i32 @run(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %argv) #0 {
entry:
  %0 = call i32 @nish_spawn(%struct.nish_array* %argv)
  ret i32 %0
}

define internal noundef i32 @shell(i8* noundef nonnull noalias readonly align 8 %script) #0 {
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
  store i8* %script, i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = call i32 @run(%struct.nish_array* %1)
  ret i32 %10
}

define noundef i32 @nish_main() #0 {
entry:
  %empty.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @shell(i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*))
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* %1)
  call void @nish_print(i8* %2)
  %3 = call i32 @shell(i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*))
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.4 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @shell(i8* bitcast ({ i64, [11 x i8] }* @.str.7 to i8*))
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.6 to i8*), i8* %7)
  call void @nish_print(i8* %8)
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 1, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 1, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = call i8* @nish_alloc_struct(i64 8)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %13 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 0
  store i8* bitcast ({ i64, [21 x i8] }* @.str.9 to i8*), i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = call i32 @run(%struct.nish_array* %10)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.8 to i8*), i8* %18)
  call void @nish_print(i8* %19)
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %21, %struct.nish_array** %empty.addr, align 8
  %25 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %26 = call i32 @run(%struct.nish_array* %25)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.10 to i8*), i8* %27)
  call void @nish_print(i8* %28)
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
