; S6, shape 1 on landing pads: hot.ts with `step` throwing where it answers
; `Err` and `hot` calling it by `invoke` under one catch-all landing pad. The
; arithmetic, its overflow check and the module flags are the ones the
; compiler emits for hot.ts; only the error path differs. No function that can
; throw is `nounwind`, which is the attribute every Nish function has today.

declare void @nish_s6_throw(i32 noundef) #2
declare i32 @nish_s6_caught(ptr noundef) #3
declare i32 @nish_s6_personality(...)
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define internal noundef i32 @step(i32 noundef %x) #0 {
entry:
  %neg = icmp slt i32 %x, 0
  br i1 %neg, label %throw, label %ok

throw:
  call void @nish_s6_throw(i32 %x)
  unreachable

ok:
  %m = mul nsw i32 %x, 31
  %s = ashr i32 %x, 3
  %v = xor i32 %m, %s
  %r = and i32 %v, 65535
  ret i32 %r
}

define noundef i32 @hot(i32 noundef %n, i32 noundef %seed) #1 personality ptr @nish_s6_personality {
entry:
  %acc0 = and i32 %seed, 65535
  br label %for.cond

for.cond:
  %acc = phi i32 [ %acc0, %entry ], [ %next, %for.inc ]
  %i = phi i32 [ 0, %entry ], [ %i.next, %for.inc ]
  %more = icmp slt i32 %i, %n
  br i1 %more, label %for.body, label %for.end

for.body:
  %lo = and i32 %i, 255
  %sum = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %acc, i32 %lo)
  %sum.v = extractvalue { i32, i1 } %sum, 0
  %sum.o = extractvalue { i32, i1 } %sum, 1
  br i1 %sum.o, label %ovf.fail, label %ovf.ok

ovf.ok:
  %arg = and i32 %sum.v, 65535
  %next = invoke i32 @step(i32 %arg) to label %for.inc unwind label %catch

for.inc:
  %i.next = add nsw i32 %i, 1
  br label %for.cond

for.end:
  ret i32 %acc

catch:
  %lp = landingpad { ptr, i32 } catch ptr null
  %exc = extractvalue { ptr, i32 } %lp, 0
  %e = call i32 @nish_s6_caught(ptr %exc)
  %out = sub nsw i32 -1, %e
  ret i32 %out

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { willreturn "probe-stack"="inline-asm" }
attributes #1 = { "probe-stack"="inline-asm" }
attributes #2 = { noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
