@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"build/test/file_open_errors_absent\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"directory: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"build/test\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"fifo: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"build/test/file_open_errors.fifo\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"socket: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"build/test/file_open_errors.sock\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"nul in path: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"build/test/a\00b\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"empty path: \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noundef i32 @nish_file_open(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_file_open(i8* bitcast ({ i64, [35 x i8] }* @.str.1 to i8*))
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i8* %1)
  call void @nish_print(i8* %2)
  %3 = call i32 @nish_file_open(i8* bitcast ({ i64, [11 x i8] }* @.str.3 to i8*))
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @nish_file_open(i8* bitcast ({ i64, [33 x i8] }* @.str.5 to i8*))
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8* %7)
  call void @nish_print(i8* %8)
  %9 = call i32 @nish_file_open(i8* bitcast ({ i64, [33 x i8] }* @.str.7 to i8*))
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.6 to i8*), i8* %10)
  call void @nish_print(i8* %11)
  %12 = call i32 @nish_file_open(i8* bitcast ({ i64, [15 x i8] }* @.str.9 to i8*))
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.8 to i8*), i8* %13)
  call void @nish_print(i8* %14)
  %15 = call i32 @nish_file_open(i8* bitcast ({ i64, [1 x i8] }* @.str.11 to i8*))
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.10 to i8*), i8* %16)
  call void @nish_print(i8* %17)
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

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
