%frame.alsoNever = type { i32, i32, i32, %frame.alsoNever.rest }
%frame.alsoNever.rest = type { [0 x <2 x i64>], i32 }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @never(i32 noundef %x) #0 {
entry:
  ret i32 %x
}

define internal i1 @alsoNever.resume(i8* %async.raw) #1 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.alsoNever*
  %async.state = getelementptr inbounds %frame.alsoNever, %frame.alsoNever* %async.frame, i32 0, i32 0
  %x.at = getelementptr inbounds %frame.alsoNever, %frame.alsoNever* %async.frame, i32 0, i32 1
  %x = load i32, i32* %x.at
  %async.answer = getelementptr inbounds %frame.alsoNever, %frame.alsoNever* %async.frame, i32 0, i32 2
  %async.rest = getelementptr inbounds %frame.alsoNever, %frame.alsoNever* %async.frame, i32 0, i32 3
  %async.kids = bitcast %frame.alsoNever.rest* %async.rest to i8*
  %y.addr = getelementptr inbounds %frame.alsoNever.rest, %frame.alsoNever.rest* %async.rest, i32 0, i32 1
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  %0 = call i32 @never(i32 %x)
  store i32 %0, i32* %y.addr, align 4
  %1 = load i32, i32* %y.addr, align 4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %3, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  ret i32 42
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
