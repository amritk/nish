@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2

define internal noundef i32 @fib(i32 noundef %n.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %11, %if.end ]
  %rec.sum = phi i64 [ 0, %entry ], [ %17, %if.end ]
  %rec.min = phi i64 [ 0, %entry ], [ %14, %if.end ]
  %rec.max = phi i64 [ 0, %entry ], [ %16, %if.end ]
  %0 = icmp slt i32 %n, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sext i32 %n to i64
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

if.end:
  %9 = sub nsw i32 %n, 1
  %10 = call i32 @fib(i32 %9)
  %11 = sub nsw i32 %n, 2
  %12 = sext i32 %10 to i64
  %13 = icmp slt i64 %rec.sum, %rec.min
  %14 = select i1 %13, i64 %rec.sum, i64 %rec.min
  %15 = icmp sgt i64 %rec.sum, %rec.max
  %16 = select i1 %15, i64 %rec.sum, i64 %rec.max
  %17 = add i64 %rec.sum, %12
  br label %rec.head

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @fib(i32 0)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = call i32 @fib(i32 1)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = call i32 @fib(i32 2)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %6, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %11 = call i32 @fib(i32 10)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = call i32 @fib(i32 25)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %14, i8* %16)
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
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
