@.str.0 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"widen_u8(toU8(511)): \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"widen_u16(toU16(196611)): \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"pick(true): \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"pick(false): \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"low_byte(511): \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"is_odd(511): \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare i64 @ident(i64)
declare i32 @widen_u8(i8 zeroext)
declare i32 @widen_u16(i16 zeroext)
declare i32 @pick(i1 zeroext)
declare zeroext i8 @low_byte(i32)
declare zeroext i1 @is_odd(i32)
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1

define noundef i32 @run() #0 {
entry:
  %n.addr = alloca i64, align 8
  %m.addr = alloca i64, align 8
  %b.addr = alloca i8, align 1
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @ident(i64 511)
  store i64 %0, i64* %n.addr, align 8
  %1 = load i64, i64* %n.addr, align 8
  %2 = trunc i64 %1 to i8
  %3 = call i32 @widen_u8(i8 zeroext %2)
  %4 = zext i32 %3 to i64
  %5 = call i8* @nish_str_from_u64(i64 %4)
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [22 x i8] }* @.str.0 to i8*), i8* %5)
  call void @nish_print(i8* %6)
  %7 = call i64 @ident(i64 196611)
  store i64 %7, i64* %m.addr, align 8
  %8 = load i64, i64* %m.addr, align 8
  %9 = trunc i64 %8 to i16
  %10 = call i32 @widen_u16(i16 zeroext %9)
  %11 = zext i32 %10 to i64
  %12 = call i8* @nish_str_from_u64(i64 %11)
  %13 = call i8* @nish_str_concat(i8* bitcast ({ i64, [27 x i8] }* @.str.1 to i8*), i8* %12)
  call void @nish_print(i8* %13)
  %14 = load i64, i64* %n.addr, align 8
  %15 = icmp sgt i64 %14, 0
  %16 = call i32 @pick(i1 zeroext %15)
  %17 = call i8* @nish_str_from_i32(i32 %16)
  %18 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.2 to i8*), i8* %17)
  call void @nish_print(i8* %18)
  %19 = load i64, i64* %n.addr, align 8
  %20 = icmp slt i64 %19, 0
  %21 = call i32 @pick(i1 zeroext %20)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.3 to i8*), i8* %22)
  call void @nish_print(i8* %23)
  %24 = load i64, i64* %n.addr, align 8
  %25 = trunc i64 %24 to i32
  %26 = call zeroext i8 @low_byte(i32 %25)
  store i8 %26, i8* %b.addr, align 1
  %27 = load i8, i8* %b.addr, align 1
  %28 = zext i8 %27 to i64
  %29 = call i8* @nish_str_from_u64(i64 %28)
  %30 = call i8* @nish_str_concat(i8* bitcast ({ i64, [16 x i8] }* @.str.4 to i8*), i8* %29)
  call void @nish_print(i8* %30)
  %31 = load i64, i64* %n.addr, align 8
  %32 = trunc i64 %31 to i32
  %33 = call zeroext i1 @is_odd(i32 %32)
  %34 = select i1 %33, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*)
  %35 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.5 to i8*), i8* %34)
  call void @nish_print(i8* %35)
  %36 = load i64, i64* %n.addr, align 8
  %37 = trunc i64 %36 to i8
  %38 = call i32 @widen_u8(i8 zeroext %37)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %38
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
