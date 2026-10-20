%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"sleep 0.5; exit 3\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"/nonexistent/nish-no-such-program\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noundef i32 @nish_spawn_child(%struct.nish_array* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 %struct.nish_array* @nish_wait_pid(i32 noundef, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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
  %pid.addr = alloca i32, align 4
  %done.addr = alloca %struct.nish_array*, align 8
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
  store i8* bitcast ({ i64, [18 x i8] }* @.str.2 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = call i32 @nish_spawn_child(%struct.nish_array* %1)
  store i32 %10, i32* %pid.addr, align 4
  %11 = load i32, i32* %pid.addr, align 4
  %12 = icmp sgt i32 %11, 0
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @nish_print(i8* %13)
  %14 = load i32, i32* %pid.addr, align 4
  %15 = call %struct.nish_array* @nish_wait_pid(i32 %14, i32 1)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 0, %17
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %17)
  unreachable

bounds.ok:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  %25 = load i32, i32* %pid.addr, align 4
  %26 = call %struct.nish_array* @nish_wait_pid(i32 %25, i32 0)
  store %struct.nish_array* %26, %struct.nish_array** %done.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 0, %29
  br i1 %30, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %29)
  unreachable

bounds.ok.1:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 0
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %36 = load i32, i32* %pid.addr, align 4
  %37 = icmp eq i32 %35, %36
  %38 = select i1 %37, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @nish_print(i8* %38)
  %39 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = icmp ult i64 1, %41
  br i1 %42, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %41)
  unreachable

bounds.ok.2:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 1
  %47 = load i32, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %48 = call i8* @nish_str_from_i32(i32 %47)
  call void @nish_print(i8* %48)
  %49 = call i8* @nish_alloc_struct(i64 24)
  %50 = bitcast i8* %49 to %struct.nish_array*
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  store i64 1, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 1
  store i64 1, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %53 = call i8* @nish_alloc_struct(i64 8)
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  store i8* %53, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %53 to i8**
  %56 = getelementptr inbounds i8*, i8** %55, i64 0
  store i8* bitcast ({ i64, [34 x i8] }* @.str.5 to i8*), i8** %56, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %57 = call i32 @nish_spawn_child(%struct.nish_array* %50)
  %58 = call i8* @nish_str_from_i32(i32 %57)
  call void @nish_print(i8* %58)
  %59 = call i8* @nish_alloc_struct(i64 24)
  %60 = bitcast i8* %59 to %struct.nish_array*
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  store i64 0, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 1
  store i64 0, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  store i8* null, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = call i32 @nish_spawn_child(%struct.nish_array* %60)
  %65 = call i8* @nish_str_from_i32(i32 %64)
  call void @nish_print(i8* %65)
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
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
