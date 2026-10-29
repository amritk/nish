@.str.0 = private unnamed_addr constant { i64, [36 x i8] } { i64 35, [36 x i8] c"build/test/io_create_exclusive.lock\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"first: \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"pid 1\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"second: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"pid 2\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"content: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"setgid bit: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [37 x i8] } { i64 36, [37 x i8] c"build/test/io_create_exclusive.other\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"other made: \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"released: \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"again: \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"pid 3\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_unlink(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_create_file_exclusive(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [36 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
  %0 = load i8*, i8** %path.addr, align 8
  %1 = call i32 @nish_unlink(i8* %0)
  %2 = load i8*, i8** %path.addr, align 8
  %3 = call i32 @nish_create_file_exclusive(i8* %2, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i32 384)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %4)
  call void @nish_print(i8* %5)
  %6 = load i8*, i8** %path.addr, align 8
  %7 = call i32 @nish_create_file_exclusive(i8* %6, i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*), i32 384)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.3 to i8*), i8* %8)
  call void @nish_print(i8* %9)
  %10 = load i8*, i8** %path.addr, align 8
  %11 = call i8* @nish_read_file(i8* %10)
  %12 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.5 to i8*), i8* %11)
  call void @nish_print(i8* %12)
  %13 = call i32 @nish_create_file_exclusive(i8* bitcast ({ i64, [37 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*), i32 1408)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.6 to i8*), i8* %14)
  call void @nish_print(i8* %15)
  %16 = call i32 @nish_unlink(i8* bitcast ({ i64, [37 x i8] }* @.str.7 to i8*))
  %17 = call i8* @nish_str_from_i32(i32 %16)
  %18 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.9 to i8*), i8* %17)
  call void @nish_print(i8* %18)
  %19 = load i8*, i8** %path.addr, align 8
  %20 = call i32 @nish_unlink(i8* %19)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.10 to i8*), i8* %21)
  call void @nish_print(i8* %22)
  %23 = load i8*, i8** %path.addr, align 8
  %24 = call i32 @nish_create_file_exclusive(i8* %23, i8* bitcast ({ i64, [6 x i8] }* @.str.12 to i8*), i32 384)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %25)
  call void @nish_print(i8* %26)
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
