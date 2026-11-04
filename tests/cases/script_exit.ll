@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"before\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"never\00" }, align 8

declare void @nish_free_arena() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_exit(i32 noundef) #2

define void @nish_main() #0 {
entry:
  %code.addr = alloca i32, align 4
  store i32 0, i32* %code.addr, align 4
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  %0 = load i32, i32* %code.addr, align 4
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = load i32, i32* %code.addr, align 4
  call void @nish_exit(i32 %2)
  unreachable

if.end:
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { noreturn nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
