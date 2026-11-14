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
  %n = phi i32 [ %n.in, %entry ], [ %15, %rec.false ], [ %18, %if.then.3 ], [ %19, %ovf.ok.3 ]
  %k = phi i32 [ %k.in, %entry ], [ %k, %rec.false ], [ %k, %if.then.3 ], [ %21, %ovf.ok.3 ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %rec.false ], [ %rec.sum, %if.then.3 ], [ %rec.sum, %ovf.ok.3 ]
  %rec.last = phi i32 [ 0, %entry ], [ %14, %rec.false ], [ %n, %if.then.3 ], [ %k, %ovf.ok.3 ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp sle i32 %n, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %k)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  %4 = icmp eq i32 %n, 7
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 100)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %6

if.end.1:
  %8 = icmp sgt i32 %n, 40
  br i1 %8, label %if.then.2, label %if.end.2

if.then.2:
  %9 = srem i32 %n, 3
  %10 = icmp eq i32 %9, 0
  br i1 %10, label %rec.true, label %rec.false

rec.true:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 1000)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %12

rec.false:
  %14 = mul nsw i32 2, %n
  %15 = sub nsw i32 %n, 3
  br label %rec.head

if.end.2:
  %16 = srem i32 %n, 2
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then.3, label %if.end.3

if.then.3:
  %18 = sub nsw i32 %n, 1
  br label %rec.head

if.end.3:
  %19 = sub nsw i32 %n, 2
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %k, i32 1)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %23 = call i32 @shape(i32 %n, i32 %k)
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %25)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  ret i32 %28

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
