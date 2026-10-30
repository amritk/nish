@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" * 2 = \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #3
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #3

define internal noundef i64 @square(i64 noundef %x) #0 {
entry:
  %0 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %x, i64 %x)
  %1 = extractvalue { i64, i1 } %0, 0
  %2 = extractvalue { i64, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %big.addr = alloca i64, align 8
  %sq.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i64 3000000000, i64* %big.addr, align 8
  %0 = load i64, i64* %big.addr, align 8
  %1 = call i64 @square(i64 %0)
  store i64 %1, i64* %sq.addr, align 8
  %2 = load i64, i64* %sq.addr, align 8
  %3 = call i8* @nish_str_from_i64(i64 %2)
  call void @nish_print(i8* %3)
  %4 = load i64, i64* %big.addr, align 8
  %5 = call i8* @nish_str_from_i64(i64 %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*))
  %7 = load i64, i64* %big.addr, align 8
  %8 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %7, i64 2)
  %9 = extractvalue { i64, i1 } %8, 0
  %10 = extractvalue { i64, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call i8* @nish_str_from_i64(i64 %9)
  %12 = call i8* @nish_str_concat(i8* %6, i8* %11)
  call void @nish_print(i8* %12)
  %13 = load i64, i64* %big.addr, align 8
  %14 = icmp sgt i64 %13, 5
  %15 = select i1 %14, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %15)
  %16 = load i64, i64* %big.addr, align 8
  %17 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %16)
  %18 = extractvalue { i64, i1 } %17, 0
  %19 = extractvalue { i64, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %20 = call i8* @nish_str_from_i64(i64 %18)
  call void @nish_print(i8* %20)
  %21 = load i64, i64* %sq.addr, align 8
  %22 = mul i64 %21, 2
  %23 = call i8* @nish_str_from_i64(i64 %22)
  call void @nish_print(i8* %23)
  store i32 7, i32* %n.addr, align 4
  %24 = load i32, i32* %n.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = add nsw i64 %25, 1
  %27 = call i8* @nish_str_from_i64(i64 %26)
  call void @nish_print(i8* %27)
  %28 = load i64, i64* %sq.addr, align 8
  %29 = srem i64 %28, 1000
  %30 = trunc i64 %29 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %30

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 3, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
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
