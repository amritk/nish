; S6, shape 3 on landing pads: deep.ts with the bottom `descend` throwing
; where it answers `Err`. The 32 frames above it have nothing to release, so
; they recurse by plain `call` with no landing pad and the unwinder crosses
; each on its tables alone; `deep` calls the top one by `invoke` and its
; landing pad is the catch inside the loop. The arithmetic, its overflow
; checks and the module flags are the ones the compiler emits for deep.ts;
; only the error path differs.

declare void @nish_s6_throw(i32 noundef) #1
declare i32 @nish_s6_caught(ptr noundef) #2
declare i32 @nish_s6_personality(...)
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4

define internal noundef i32 @descend(i32 noundef %d, i32 noundef %x) #0 {
entry:
  %bottom = icmp eq i32 %d, 0
  br i1 %bottom, label %if.then, label %if.end

if.then:
  %fails = icmp sge i32 %x, 0
  br i1 %fails, label %throw, label %leaf

throw:
  %code = and i32 %x, 255
  call void @nish_s6_throw(i32 %code)
  unreachable

leaf:
  ret i32 1

if.end:
  %sub = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %d, i32 1)
  %sub.v = extractvalue { i32, i1 } %sub, 0
  %sub.o = extractvalue { i32, i1 } %sub, 1
  br i1 %sub.o, label %ovf.fail, label %ovf.ok

ovf.ok:
  %arg = xor i32 %x, %d
  %below = call i32 @descend(i32 %sub.v, i32 %arg)
  %add = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %below, i32 %d)
  %add.v = extractvalue { i32, i1 } %add, 0
  %add.o = extractvalue { i32, i1 } %add, 1
  br i1 %add.o, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %r = and i32 %add.v, 65535
  ret i32 %r

ovf.fail:
  %ovf.op = phi i32 [ 1, %if.end ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @deep(i32 noundef %n, i32 noundef %seed) #0 personality ptr @nish_s6_personality {
entry:
  %acc0 = and i32 %seed, 65535
  br label %for.cond

for.cond:
  %acc = phi i32 [ %acc0, %entry ], [ %acc.next, %for.inc ]
  %i = phi i32 [ 0, %entry ], [ %i.next, %for.inc ]
  %more = icmp slt i32 %i, %n
  br i1 %more, label %for.body, label %for.end

for.body:
  %lo = and i32 %i, 255
  %sum = add nsw i32 %acc, %lo
  %arg = and i32 %sum, 65535
  %v = invoke i32 @descend(i32 32, i32 %arg) to label %try.ok unwind label %catch

try.ok:
  %mixed = xor i32 %acc, %v
  %acc.ok = and i32 %mixed, 65535
  br label %for.inc

catch:
  %lp = landingpad { ptr, i32 } catch ptr null
  %exc = extractvalue { ptr, i32 } %lp, 0
  %e = call i32 @nish_s6_caught(ptr %exc)
  %add = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %acc, i32 %e)
  %add.v = extractvalue { i32, i1 } %add, 0
  %add.o = extractvalue { i32, i1 } %add, 1
  br i1 %add.o, label %ovf.fail, label %ovf.ok

ovf.ok:
  %inc = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %add.v, i32 1)
  %inc.v = extractvalue { i32, i1 } %inc, 0
  %inc.o = extractvalue { i32, i1 } %inc, 1
  br i1 %inc.o, label %ovf.fail, label %catch.done

catch.done:
  %acc.caught = and i32 %inc.v, 65535
  br label %for.inc

for.inc:
  %acc.next = phi i32 [ %acc.ok, %try.ok ], [ %acc.caught, %catch.done ]
  %i.next = add nsw i32 %i, 1
  br label %for.cond

for.end:
  ret i32 %acc

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { "probe-stack"="inline-asm" }
attributes #1 = { noreturn cold "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
