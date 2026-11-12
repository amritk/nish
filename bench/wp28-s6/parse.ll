; S6, shape 2 on landing pads: parse.ts with `parseDigit` throwing where it
; answers `Err`. `parseField` and `parseRecord` have nothing to release, so
; they call straight through with no landing pad of their own and the unwinder
; crosses them on its tables alone; `parse` calls `parseRecord` by `invoke`
; and its landing pad is the catch inside the loop. The arithmetic, its
; overflow checks and the module flags are the ones the compiler emits for
; parse.ts; only the error path differs.

declare void @nish_s6_throw(i32 noundef) #3
declare i32 @nish_s6_caught(ptr noundef) #4
declare i32 @nish_s6_personality(...)
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #0

define internal noundef i32 @mix(i32 noundef %rec, i32 noundef %key) #0 {
entry:
  %k = shl i32 %key, 16
  %x = xor i32 %rec, %k
  %h = mul i32 %x, 739982445
  %s = ashr i32 %h, 15
  %r = xor i32 %h, %s
  ret i32 %r
}

define internal noundef i32 @byteAt(i32 noundef %h, i32 noundef %bad, i32 noundef %pos) #0 {
entry:
  %hit = icmp eq i32 %pos, %bad
  br i1 %hit, label %if.then, label %if.end

if.then:
  ret i32 120

if.end:
  %sh = and i32 %pos, 31
  %v = ashr i32 %h, %sh
  %nib = and i32 %v, 15
  %dig = srem i32 %nib, 10
  %c = add nsw i32 48, %dig
  ret i32 %c
}

define internal noundef i32 @parseDigit(i32 noundef %c) #1 {
entry:
  %lo = icmp slt i32 %c, 48
  %hi = icmp sgt i32 %c, 57
  %bad = or i1 %lo, %hi
  br i1 %bad, label %throw, label %ok

throw:
  call void @nish_s6_throw(i32 %c)
  unreachable

ok:
  %d = sub nsw i32 %c, 48
  ret i32 %d
}

define internal noundef i32 @parseField(i32 noundef %h, i32 noundef %bad, i32 noundef %first) #2 {
entry:
  br label %for.cond

for.cond:
  %v = phi i32 [ 0, %entry ], [ %v.next, %ovf.ok.1 ]
  %k = phi i32 [ 0, %entry ], [ %k.next, %ovf.ok.1 ]
  %more = icmp slt i32 %k, 4
  br i1 %more, label %for.body, label %for.end

for.body:
  %pos = add nsw i32 %first, %k
  %c = call i32 @byteAt(i32 %h, i32 %bad, i32 %pos)
  %d = call i32 @parseDigit(i32 %c)
  %mul = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %v, i32 10)
  %mul.v = extractvalue { i32, i1 } %mul, 0
  %mul.o = extractvalue { i32, i1 } %mul, 1
  br i1 %mul.o, label %ovf.fail, label %ovf.ok

ovf.ok:
  %add = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %mul.v, i32 %d)
  %v.next = extractvalue { i32, i1 } %add, 0
  %add.o = extractvalue { i32, i1 } %add, 1
  br i1 %add.o, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %k.next = add nsw i32 %k, 1
  br label %for.cond

for.end:
  ret i32 %v

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @parseRecord(i32 noundef %rec, i32 noundef %key, i1 noundef zeroext %poison) #2 {
entry:
  %h = call i32 @mix(i32 %rec, i32 %key)
  %low = and i32 %h, 7
  %bad = select i1 %poison, i32 %low, i32 -1
  %a = call i32 @parseField(i32 %h, i32 %bad, i32 0)
  %b = call i32 @parseField(i32 %h, i32 %bad, i32 4)
  %c = call i32 @parseField(i32 %h, i32 %bad, i32 8)
  %ab = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %ab.v = extractvalue { i32, i1 } %ab, 0
  %ab.o = extractvalue { i32, i1 } %ab, 1
  br i1 %ab.o, label %ovf.fail, label %ovf.ok

ovf.ok:
  %abc = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %ab.v, i32 %c)
  %abc.v = extractvalue { i32, i1 } %abc, 0
  %abc.o = extractvalue { i32, i1 } %abc, 1
  br i1 %abc.o, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %r = and i32 %abc.v, 65535
  ret i32 %r

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @parse(i32 noundef %n, i32 noundef %seed, i32 noundef %every) #2 personality ptr @nish_s6_personality {
entry:
  %sum0 = and i32 %seed, 65535
  br label %for.cond

for.cond:
  %sum = phi i32 [ %sum0, %entry ], [ %sum.next, %for.inc ]
  %failed = phi i32 [ 0, %entry ], [ %failed.next, %for.inc ]
  %until = phi i32 [ %every, %entry ], [ %until.next, %for.inc ]
  %rec = phi i32 [ 0, %entry ], [ %rec.next, %for.inc ]
  %more = icmp slt i32 %rec, %n
  br i1 %more, label %for.body, label %for.end

for.body:
  %poison = icmp eq i32 %until, 1
  br i1 %poison, label %cond.end, label %cond.false

cond.false:
  %dec = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %until, i32 1)
  %dec.v = extractvalue { i32, i1 } %dec, 0
  %dec.o = extractvalue { i32, i1 } %dec, 1
  br i1 %dec.o, label %ovf.fail, label %cond.end

cond.end:
  %until.next = phi i32 [ %every, %for.body ], [ %dec.v, %cond.false ]
  %v = invoke i32 @parseRecord(i32 %rec, i32 %sum, i1 %poison) to label %try.ok unwind label %catch

try.ok:
  %add = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %sum, i32 %v)
  %add.v = extractvalue { i32, i1 } %add, 0
  %add.o = extractvalue { i32, i1 } %add, 1
  br i1 %add.o, label %ovf.fail, label %try.done

try.done:
  %sum.ok = and i32 %add.v, 65535
  br label %for.inc

catch:
  %lp = landingpad { ptr, i32 } catch ptr null
  %exc = extractvalue { ptr, i32 } %lp, 0
  %e = call i32 @nish_s6_caught(ptr %exc)
  %cnt = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %failed, i32 %e)
  %cnt.v = extractvalue { i32, i1 } %cnt, 0
  %cnt.o = extractvalue { i32, i1 } %cnt, 1
  br i1 %cnt.o, label %ovf.fail, label %catch.done

catch.done:
  %failed.caught = and i32 %cnt.v, 32767
  br label %for.inc

for.inc:
  %sum.next = phi i32 [ %sum.ok, %try.done ], [ %sum, %catch.done ]
  %failed.next = phi i32 [ %failed, %try.done ], [ %failed.caught, %catch.done ]
  %rec.next = add nsw i32 %rec, 1
  br label %for.cond

for.end:
  %high = mul nsw i32 %failed, 65536
  %out = add nsw i32 %high, %sum
  ret i32 %out

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { willreturn "probe-stack"="inline-asm" }
attributes #2 = { "probe-stack"="inline-asm" }
attributes #3 = { noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
