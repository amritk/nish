@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @sq(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, %x
  ret i32 %0
}

define internal noundef i32 @plus1(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @dbl(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @k(i32 noundef %f) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %f, i32 1)
  ret i32 %0
}

define internal noundef i32 @pick(i32 noundef %n) #0 {
entry:
  %r.addr = alloca i32, align 4
  store i32 1, i32* %r.addr, align 4
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  store i32 3, i32* %r.addr, align 4
  ret i32 3

if.end:
  %1 = load i32, i32* %r.addr, align 4
  ret i32 %1
}

define void @nish_main() #1 {
entry:
  %r.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 1, i32* %r.addr, align 4
  store i32 2, i32* %r.addr, align 4
  %0 = call i32 @k(i32 2)
  store i32 %0, i32* %x.addr, align 4
  store i32 3, i32* %r.addr, align 4
  store i32 3, i32* %h.addr, align 4
  %1 = load i32, i32* %x.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = load i32, i32* %r.addr, align 4
  %5 = call i32 @$ref.0.fr1.i32.i32.1(i32 %4, i32 3)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* %3, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = load i32, i32* %h.addr, align 4
  %10 = call i32 @$ref.0.fr1.i32.i32.2(i32 %9, i32 5)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = call i32 @pick(i32 1)
  %15 = call i32 @$ref.0.fr1.i32.i32.3(i32 %14, i32 7)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %13, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %19 = call i32 @pick(i32 0)
  %20 = call i32 @$ref.0.fr1.i32.i32.3(i32 %19, i32 7)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %18, i8* %21)
  call void @nish_print(i8* %22)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @plus1(i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @$ref.0.fr1.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
    i32 2, label %sw.case.1
  ]

sw.case:
  %0 = tail call i32 @sq(i32 %$a0)
  ret i32 %0

sw.case.1:
  %1 = tail call i32 @plus1(i32 %$a0)
  ret i32 %1

sw.default:
  %2 = tail call i32 @dbl(i32 %$a0)
  ret i32 %2
}

define internal noundef i32 @$ref.0.fr1.i32.i32.2(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @dbl(i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @$ref.0.fr1.i32.i32.3(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @sq(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @dbl(i32 %$a0)
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
