@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"big\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"small\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3

define internal noundef i32 @double(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  ret i32 %0
}

define internal noundef nonnull align 8 i8* @describe(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 10
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*)

if.end:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
}

define internal noundef i32 @sumTo(i32 noundef %n.in) #1 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %9, %rec.false ]
  %rec.sum = phi i64 [ 0, %entry ], [ %15, %rec.false ]
  %rec.min = phi i64 [ 0, %entry ], [ %12, %rec.false ]
  %rec.max = phi i64 [ 0, %entry ], [ %14, %rec.false ]
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %rec.true, label %rec.false

rec.true:
  %1 = sext i32 0 to i64
  %2 = add i64 %rec.sum, %1
  %3 = sub i64 %2, 2147483647
  %4 = add i64 %2, 2147483648
  %5 = icmp slt i64 %rec.min, %3
  %6 = icmp sgt i64 %rec.max, %4
  %7 = or i1 %5, %6
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = trunc i64 %2 to i32
  ret i32 %8

rec.false:
  %9 = sub nsw i32 %n, 1
  %10 = sext i32 %n to i64
  %11 = icmp slt i64 %rec.sum, %rec.min
  %12 = select i1 %11, i64 %rec.sum, i64 %rec.min
  %13 = icmp sgt i64 %rec.sum, %rec.max
  %14 = select i1 %13, i64 %rec.sum, i64 %rec.max
  %15 = add i64 %rec.sum, %10
  br label %rec.head

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @double(i32 21)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i8* @describe(i32 50)
  call void @nish_print(i8* %2)
  %3 = call i8* @describe(i32 1)
  call void @nish_print(i8* %3)
  %4 = call i32 @sumTo(i32 10)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
