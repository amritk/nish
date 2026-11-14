@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2

define internal noundef i8 @sum8(i32 noundef %n) #0 {
entry:
  %x.addr = alloca i8, align 1
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8 0

if.end:
  store i8 200, i8* %x.addr, align 1
  %1 = load i8, i8* %x.addr, align 1
  %2 = sub nsw i32 %n, 1
  %3 = call i8 @sum8(i32 %2)
  %4 = add i8 %1, %3
  ret i8 %4
}

define internal noundef i16 @sum16(i32 noundef %n) #0 {
entry:
  %x.addr = alloca i16, align 2
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i16 0

if.end:
  store i16 60000, i16* %x.addr, align 2
  %1 = load i16, i16* %x.addr, align 2
  %2 = sub nsw i32 %n, 1
  %3 = call i16 @sum16(i32 %2)
  %4 = add i16 %1, %3
  ret i16 %4
}

define internal noundef i32 @sum32(i32 noundef %n, i32 noundef %x) #0 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @sum32(i32 %1, i32 %x)
  %3 = add i32 %2, %x
  ret i32 %3
}

define internal noundef i64 @sum64(i32 noundef %n, i64 noundef %x) #0 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i64 0

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i64 @sum64(i32 %1, i64 %x)
  %3 = add i64 %x, %2
  ret i64 %3
}

define noundef i32 @nish_main() #1 {
entry:
  %x32.addr = alloca i32, align 4
  %zero.addr = alloca i64, align 8
  %one.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 4000000000, i32* %x32.addr, align 4
  store i64 0, i64* %zero.addr, align 8
  store i64 1, i64* %one.addr, align 8
  %0 = call i8 @sum8(i32 2)
  %1 = zext i8 %0 to i64
  %2 = call i8* @nish_str_from_u64(i64 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = call i16 @sum16(i32 2)
  %5 = zext i16 %4 to i64
  %6 = call i8* @nish_str_from_u64(i64 %5)
  %7 = call i8* @nish_str_concat(i8* %3, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = load i32, i32* %x32.addr, align 4
  %10 = call i32 @sum32(i32 3, i32 %9)
  %11 = zext i32 %10 to i64
  %12 = call i8* @nish_str_from_u64(i64 %11)
  %13 = call i8* @nish_str_concat(i8* %8, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load i64, i64* %zero.addr, align 8
  %16 = load i64, i64* %one.addr, align 8
  %17 = sub i64 %15, %16
  %18 = call i64 @sum64(i32 3, i64 %17)
  %19 = call i8* @nish_str_from_u64(i64 %18)
  %20 = call i8* @nish_str_concat(i8* %14, i8* %19)
  call void @nish_print(i8* %20)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
