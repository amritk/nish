declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1

define internal noundef i32 @abs$(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %x)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  ret i32 %x

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
}

define internal noundef i32 @pick(i1 noundef zeroext %flag, i32 noundef %a, i32 noundef %b) #1 {
entry:
  %r.addr = alloca i32, align 4
  store i32 0, i32* %r.addr, align 4
  br i1 %flag, label %if.then, label %if.else

if.then:
  store i32 %a, i32* %r.addr, align 4
  br label %if.end

if.else:
  store i32 %b, i32* %r.addr, align 4
  br label %if.end

if.end:
  %0 = load i32, i32* %r.addr, align 4
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @abs$(i32 -4)
  %1 = call i32 @pick(i1 true, i32 10, i32 20)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
