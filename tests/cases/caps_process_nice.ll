@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noundef i32 @nish_set_nice(i32 noundef) #0
declare noundef i32 @nish_set_idle_priority() #0

define noundef i32 @lower() #0 {
entry:
  %0 = call i32 @nish_set_nice(i32 19)
  ret i32 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %r.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @lower()
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @nish_set_idle_priority()
  store i32 %2, i32* %r.addr, align 4
  %3 = load i32, i32* %r.addr, align 4
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %lor.end, label %lor.rhs

lor.rhs:
  %5 = load i32, i32* %r.addr, align 4
  %6 = icmp eq i32 %5, -95
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %8)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
