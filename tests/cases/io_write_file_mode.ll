@.str.0 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"build/test/io_write_file_mode.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"an older and longer text\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"write: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"secret\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"content: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"negative mode: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"setuid bit: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"mode past 0o7777: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"content kept: \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"missing directory: \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"build/test/io_write_file_mode.d/x\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_write_file_mode(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %path.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [34 x i8] }* @.str.0 to i8*), i8** %path.addr, align 8
  %0 = load i8*, i8** %path.addr, align 8
  call void @nish_write_file(i8* %0, i8* bitcast ({ i64, [25 x i8] }* @.str.1 to i8*))
  %1 = load i8*, i8** %path.addr, align 8
  %2 = call i32 @nish_write_file_mode(i8* %1, i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*), i32 384)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*), i8* %3)
  call void @nish_print(i8* %4)
  %5 = load i8*, i8** %path.addr, align 8
  %6 = call i8* @nish_read_file(i8* %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*), i8* %6)
  call void @nish_print(i8* %7)
  %8 = load i8*, i8** %path.addr, align 8
  %9 = call i32 @nish_write_file_mode(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i32 -1)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [16 x i8] }* @.str.5 to i8*), i8* %10)
  call void @nish_print(i8* %11)
  %12 = load i8*, i8** %path.addr, align 8
  %13 = call i32 @nish_write_file_mode(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i32 2432)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.7 to i8*), i8* %14)
  call void @nish_print(i8* %15)
  %16 = load i8*, i8** %path.addr, align 8
  %17 = call i32 @nish_write_file_mode(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i32 4096)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.8 to i8*), i8* %18)
  call void @nish_print(i8* %19)
  %20 = load i8*, i8** %path.addr, align 8
  %21 = call i8* @nish_read_file(i8* %20)
  %22 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.9 to i8*), i8* %21)
  call void @nish_print(i8* %22)
  %23 = call i32 @nish_write_file_mode(i8* bitcast ({ i64, [34 x i8] }* @.str.11 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i32 384)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* bitcast ({ i64, [20 x i8] }* @.str.10 to i8*), i8* %24)
  call void @nish_print(i8* %25)
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
