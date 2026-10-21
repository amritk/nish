%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"sleep\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"30\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noundef i32 @nish_spawn_child(%struct.nish_array* noundef nonnull align 8) #2
declare noundef i32 @nish_kill(i32 noundef, i32 noundef) #0
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
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8*, i8** %6, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = call i32 @nish_spawn_child(%struct.nish_array* %1)
  store i32 %9, i32* %pid.addr, align 4
  %10 = load i32, i32* %pid.addr, align 4
  %11 = call i32 @nish_kill(i32 %10, i32 0)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = load i32, i32* %pid.addr, align 4
  %14 = call i32 @nish_kill(i32 %13, i32 7)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  %16 = load i32, i32* %pid.addr, align 4
  %17 = call i32 @nish_kill(i32 %16, i32 15)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  %19 = load i32, i32* %pid.addr, align 4
  %20 = call %struct.nish_array* @nish_wait_pid(i32 %19, i32 0)
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = icmp ult i64 1, %22
  br i1 %23, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %22)
  unreachable

bounds.ok:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 1
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %29 = call i8* @nish_str_from_i32(i32 %28)
  call void @nish_print(i8* %29)
  %30 = load i32, i32* %pid.addr, align 4
  %31 = call i32 @nish_kill(i32 %30, i32 0)
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  %33 = call i32 @nish_kill(i32 0, i32 15)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
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
