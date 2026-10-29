@.str.0 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/io_unlink.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"doomed\0A\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"unlink: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"gone: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"build/test/io_unlink_dir\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"directory refused: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"directory kept: \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef align 8 i8* @nish_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_unlink(i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_is_dir(i8* noundef nonnull readonly align 8 nocapture) #1

define noundef i32 @nish_main() #0 {
entry:
  %file.addr = alloca i8*, align 8
  %dir.addr = alloca i8*, align 8
  %refused.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [25 x i8] }* @.str.0 to i8*), i8** %file.addr, align 8
  %0 = load i8*, i8** %file.addr, align 8
  call void @nish_write_file(i8* %0, i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*))
  %1 = load i8*, i8** %file.addr, align 8
  %2 = call i32 @nish_unlink(i8* %1)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*), i8* %3)
  call void @nish_print(i8* %4)
  %5 = load i8*, i8** %file.addr, align 8
  %6 = call i8* @nish_read_file_or_null(i8* %5)
  %7 = icmp eq i8* %6, null
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*), i8* %8)
  call void @nish_print(i8* %9)
  %10 = load i8*, i8** %file.addr, align 8
  %11 = call i32 @nish_unlink(i8* %10)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*), i8* %12)
  call void @nish_print(i8* %13)
  store i8* bitcast ({ i64, [25 x i8] }* @.str.7 to i8*), i8** %dir.addr, align 8
  %14 = load i8*, i8** %dir.addr, align 8
  %15 = call zeroext i1 @nish_mkdir(i8* %14)
  %16 = load i8*, i8** %dir.addr, align 8
  %17 = call i32 @nish_unlink(i8* %16)
  store i32 %17, i32* %refused.addr, align 4
  %18 = load i32, i32* %refused.addr, align 4
  %19 = icmp eq i32 %18, -21
  br i1 %19, label %lor.end, label %lor.rhs

lor.rhs:
  %20 = load i32, i32* %refused.addr, align 4
  %21 = icmp eq i32 %20, -1
  br label %lor.end

lor.end:
  %22 = phi i1 [ true, %entry ], [ %21, %lor.rhs ]
  %23 = select i1 %22, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %24 = call i8* @nish_str_concat(i8* bitcast ({ i64, [20 x i8] }* @.str.8 to i8*), i8* %23)
  call void @nish_print(i8* %24)
  %25 = load i8*, i8** %dir.addr, align 8
  %26 = call zeroext i1 @nish_is_dir(i8* %25)
  %27 = select i1 %26, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %28 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.9 to i8*), i8* %27)
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

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
