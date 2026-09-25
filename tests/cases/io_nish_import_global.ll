%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"build/test/io_nish_import.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"imported\0A\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"argv: \00" }, align 8
@nish_argv = external global %struct.nish_array*, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\0A\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #0

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  call void @nish_write_file(i8* bitcast ({ i64, [30 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*))
  %0 = call i8* @nish_read_file(i8* bitcast ({ i64, [30 x i8] }* @.str.0 to i8*))
  call void @nish_write(i8* %0, i32 1, i1 false)
  %1 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = icmp sgt i32 %4, 0
  %6 = select i1 %5, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  call void @nish_write(i8* %8, i32 1, i1 false)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

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
