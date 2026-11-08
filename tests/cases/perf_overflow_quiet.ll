declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2

define noundef i32 @test() #0 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %wide.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  %fits.addr = alloca i32, align 4
  %shifted.addr = alloca i32, align 4
  %signBit.addr = alloca i32, align 4
  store i32 70000, i32* %a.addr, align 4
  store i32 40000, i32* %b.addr, align 4
  %0 = load i32, i32* %a.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = load i32, i32* %b.addr, align 4
  %3 = sext i32 %2 to i64
  %4 = mul nsw i64 %1, %3
  store i64 %4, i64* %wide.addr, align 8
  store i32 3, i32* %n.addr, align 4
  %5 = load i32, i32* %n.addr, align 4
  %6 = mul nsw i32 %5, 2
  store i32 %6, i32* %n.addr, align 4
  %7 = add nsw i32 2147483646, 1
  store i32 %7, i32* %fits.addr, align 4
  %8 = shl i32 1, 31
  store i32 %8, i32* %shifted.addr, align 4
  %9 = shl i32 1, 31
  store i32 %9, i32* %signBit.addr, align 4
  %10 = load i64, i64* %wide.addr, align 8
  %11 = sdiv i64 %10, 100000000
  %12 = trunc i64 %11 to i32
  %13 = load i32, i32* %n.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = load i32, i32* %fits.addr, align 4
  %18 = sub nsw i32 %17, 2147483646
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %22 = load i32, i32* %shifted.addr, align 4
  %23 = load i32, i32* %signBit.addr, align 4
  %24 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %22, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %25)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %28

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 0, %ovf.ok ], [ 1, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
