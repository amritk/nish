; S6, the landing-pad side's `throw`: hand it the thrown i32 and it raises an
; exception through the toolchain's Itanium unwinder. It is IR rather than C
; because the release profile compiles C with -fno-unwind-tables, and a frame
; without an unwind-table entry is one _Unwind_RaiseException cannot leave;
; a function in IR that is not `nounwind` gets its entry whatever the flag.
; unwind.c owns the exception object and the personality.

declare ptr @nish_s6_prepare(i32 noundef) #1
declare i32 @_Unwind_RaiseException(ptr noundef)
declare void @llvm.trap() #2

define void @nish_s6_throw(i32 noundef %code) #0 {
entry:
  %exc = call ptr @nish_s6_prepare(i32 %code)
  ; Returns only when no frame would catch: every throw here is under a catch.
  %failed = call i32 @_Unwind_RaiseException(ptr %exc)
  call void @llvm.trap()
  unreachable
}

attributes #0 = { noreturn cold "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
