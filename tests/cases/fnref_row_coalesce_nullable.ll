@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @u1(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @u2(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @u3(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 3
  ret i32 %0
}

define internal noundef i32 @pick(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  ret i32 %1
}

define void @nish_main() #1 {
entry:
  %other.addr = alloca i32, align 4
  %g.addr = alloca i32, align 8
  %h.addr = alloca i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 2, i32* %other.addr, align 4
  %0 = call i32 @pick(i32 0)
  %1 = icmp ne i32 %0, 0
  br i1 %1, label %nullish.end, label %nullish.default

nullish.default:
  br label %nullish.end

nullish.end:
  %2 = phi i32 [ %0, %entry ], [ 3, %nullish.default ]
  store i32 %2, i32* %g.addr, align 8
  %3 = call i32 @pick(i32 1)
  %4 = icmp ne i32 %3, 0
  br i1 %4, label %nullish.end.1, label %nullish.default.1

nullish.default.1:
  br label %nullish.end.1

nullish.end.1:
  %5 = phi i32 [ %3, %nullish.end ], [ 3, %nullish.default.1 ]
  store i32 %5, i32* %h.addr, align 8
  %6 = load i32, i32* %g.addr, align 8
  %7 = icmp ne i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %h.addr, align 8
  %9 = icmp ne i32 %8, 0
  br label %land.end

land.end:
  %10 = phi i1 [ false, %nullish.end.1 ], [ %9, %land.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i32, i32* %g.addr, align 8
  %12 = call i32 @$ref.0.fr1.i32.i32.0(i32 %11, i32 10)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load i32, i32* %h.addr, align 8
  %16 = call i32 @$ref.0.fr1.i32.i32.0(i32 %15, i32 10)
  %17 = call i8* @nish_str_from_i32(i32 %16)
  %18 = call i8* @nish_str_concat(i8* %14, i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %20 = load i32, i32* %other.addr, align 4
  %21 = call i32 @$ref.0.fr1.i32.i32.1(i32 %20, i32 10)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %19, i8* %22)
  call void @nish_print(i8* %23)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @u1(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @u3(i32 %$a0)
  ret i32 %1
}

define internal noundef i32 @$ref.0.fr1.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @u2(i32 %$a0)
  ret i32 %0
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
