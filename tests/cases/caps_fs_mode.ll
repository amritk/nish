@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"/lock\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"/secret\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"build/test/caps_fs_mode.d\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"hunter2\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"kept: \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noundef i32 @nish_unlink(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_write_file_mode(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0
declare noundef i32 @nish_create_file_exclusive(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0
declare noundef i32 @nish_mkdir_mode(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0

define internal noundef i32 @keep(i8* noundef nonnull noalias readonly align 8 nocapture %dir, i8* noundef nonnull noalias readonly align 8 nocapture %secret) #0 {
entry:
  %wrote.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_mkdir_mode(i8* %dir, i32 448)
  %1 = call i8* @nish_str_concat(i8* %dir, i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %2 = call i32 @nish_create_file_exclusive(i8* %1, i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i32 384)
  %3 = icmp slt i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %4 = call i8* @nish_str_concat(i8* %dir, i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*))
  %5 = call i32 @nish_write_file_mode(i8* %4, i8* %secret, i32 384)
  store i32 %5, i32* %wrote.addr, align 4
  %6 = call i8* @nish_str_concat(i8* %dir, i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %7 = call i32 @nish_unlink(i8* %6)
  %8 = load i32, i32* %wrote.addr, align 4
  %9 = icmp slt i32 %8, 0
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %10 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %10
}

define noundef i32 @nish_main() #0 {
entry:
  %done.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @keep(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [8 x i8] }* @.str.4 to i8*))
  store i32 %0, i32* %done.addr, align 4
  %1 = load i32, i32* %done.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*), i8* %2)
  call void @nish_print(i8* %3)
  %4 = load i32, i32* %done.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %4
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
