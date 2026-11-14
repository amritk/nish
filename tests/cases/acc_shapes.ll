@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @shape(i32 noundef %n.in, i32 noundef %k.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %30, %rec.false ], [ %39, %if.then.3 ], [ %46, %ovf.ok.3 ]
  %k = phi i32 [ %k.in, %entry ], [ %k, %rec.false ], [ %k, %if.then.3 ], [ %48, %ovf.ok.3 ]
  %rec.sum = phi i64 [ 0, %entry ], [ %36, %rec.false ], [ %45, %if.then.3 ], [ %55, %ovf.ok.3 ]
  %rec.min = phi i64 [ 0, %entry ], [ %33, %rec.false ], [ %42, %if.then.3 ], [ %52, %ovf.ok.3 ]
  %rec.max = phi i64 [ 0, %entry ], [ %35, %rec.false ], [ %44, %if.then.3 ], [ %54, %ovf.ok.3 ]
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sext i32 %k to i64
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
  %9 = icmp eq i32 %n, 7
  br i1 %9, label %if.then.1, label %if.end.1

if.then.1:
  %10 = sext i32 100 to i64
  %11 = add i64 %rec.sum, %10
  %12 = sub i64 %11, 2147483647
  %13 = add i64 %11, 2147483648
  %14 = icmp slt i64 %rec.min, %12
  %15 = icmp sgt i64 %rec.max, %13
  %16 = or i1 %14, %15
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = trunc i64 %11 to i32
  ret i32 %17

if.end.1:
  %18 = icmp sgt i32 %n, 40
  br i1 %18, label %if.then.2, label %if.end.2

if.then.2:
  %19 = srem i32 %n, 3
  %20 = icmp eq i32 %19, 0
  br i1 %20, label %rec.true, label %rec.false

rec.true:
  %21 = sext i32 1000 to i64
  %22 = add i64 %rec.sum, %21
  %23 = sub i64 %22, 2147483647
  %24 = add i64 %22, 2147483648
  %25 = icmp slt i64 %rec.min, %23
  %26 = icmp sgt i64 %rec.max, %24
  %27 = or i1 %25, %26
  br i1 %27, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %28 = trunc i64 %22 to i32
  ret i32 %28

rec.false:
  %29 = mul nsw i32 2, %n
  %30 = sub nsw i32 %n, 3
  %31 = sext i32 %29 to i64
  %32 = icmp slt i64 %rec.sum, %rec.min
  %33 = select i1 %32, i64 %rec.sum, i64 %rec.min
  %34 = icmp sgt i64 %rec.sum, %rec.max
  %35 = select i1 %34, i64 %rec.sum, i64 %rec.max
  %36 = add i64 %rec.sum, %31
  br label %rec.head

if.end.2:
  %37 = srem i32 %n, 2
  %38 = icmp eq i32 %37, 0
  br i1 %38, label %if.then.3, label %if.end.3

if.then.3:
  %39 = sub nsw i32 %n, 1
  %40 = sext i32 %n to i64
  %41 = icmp slt i64 %rec.sum, %rec.min
  %42 = select i1 %41, i64 %rec.sum, i64 %rec.min
  %43 = icmp sgt i64 %rec.sum, %rec.max
  %44 = select i1 %43, i64 %rec.sum, i64 %rec.max
  %45 = add i64 %rec.sum, %40
  br label %rec.head

if.end.3:
  %46 = sub nsw i32 %n, 2
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %k, i32 1)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %50 = sext i32 %k to i64
  %51 = icmp slt i64 %rec.sum, %rec.min
  %52 = select i1 %51, i64 %rec.sum, i64 %rec.min
  %53 = icmp sgt i64 %rec.sum, %rec.max
  %54 = select i1 %53, i64 %rec.sum, i64 %rec.max
  %55 = add i64 %rec.sum, %50
  br label %rec.head

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @shape(i32 0, i32 5)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = call i32 @shape(i32 7, i32 0)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = call i32 @shape(i32 9, i32 2)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %6, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %11 = call i32 @shape(i32 30, i32 1)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = call i32 @shape(i32 50, i32 3)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %14, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %19 = call i32 @shape(i32 45, i32 1)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %18, i8* %20)
  call void @nish_print(i8* %21)
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
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
