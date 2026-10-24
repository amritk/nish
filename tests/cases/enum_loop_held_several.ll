@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2

define internal noundef zeroext i1 @f(i32 noundef %k, i32 noundef %j) #0 {
entry:
  %0 = icmp eq i32 %j, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %1 = icmp ne i32 %k, %j
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  br label %while.end

if.end.1:
  ret i1 false

while.end:
  %2 = icmp eq i32 %k, 1
  ret i1 %2
}

define void @nish_main() #1 {
entry:
  %0 = call i1 @f(i32 1, i32 2)
  %1 = select i1 %0, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %1)
  %2 = call i1 @f(i32 0, i32 1)
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %3)
  %4 = call i1 @f(i32 2, i32 2)
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %5)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
