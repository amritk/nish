@.str.0 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"build/test/io_rename_from.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"build/test/io_rename_to.txt\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"old\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"new\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"rename: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"target: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"source gone: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"missing source: \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"target kept: \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef align 8 i8* @nish_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_rename(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  %from.addr = alloca i8*, align 8
  %to.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [30 x i8] }* @.str.0 to i8*), i8** %from.addr, align 8
  store i8* bitcast ({ i64, [28 x i8] }* @.str.1 to i8*), i8** %to.addr, align 8
  %0 = load i8*, i8** %to.addr, align 8
  call void @nish_write_file(i8* %0, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %1 = load i8*, i8** %from.addr, align 8
  call void @nish_write_file(i8* %1, i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*))
  %2 = load i8*, i8** %from.addr, align 8
  %3 = load i8*, i8** %to.addr, align 8
  %4 = call i32 @nish_rename(i8* %2, i8* %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.4 to i8*), i8* %5)
  call void @nish_print(i8* %6)
  %7 = load i8*, i8** %to.addr, align 8
  %8 = call i8* @nish_read_file(i8* %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*), i8* %8)
  call void @nish_print(i8* %9)
  %10 = load i8*, i8** %from.addr, align 8
  %11 = call i8* @nish_read_file_or_null(i8* %10)
  %12 = icmp eq i8* %11, null
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*)
  %14 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.6 to i8*), i8* %13)
  call void @nish_print(i8* %14)
  %15 = load i8*, i8** %from.addr, align 8
  %16 = load i8*, i8** %to.addr, align 8
  %17 = call i32 @nish_rename(i8* %15, i8* %16)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.9 to i8*), i8* %18)
  call void @nish_print(i8* %19)
  %20 = load i8*, i8** %to.addr, align 8
  %21 = call i8* @nish_read_file(i8* %20)
  %22 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.10 to i8*), i8* %21)
  call void @nish_print(i8* %22)
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
