target datalayout = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20"
target triple = "wasm32-unknown-unknown"

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2

define noundef i64 @high(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = and i64 %a, 4294967295
  %1 = lshr i64 %a, 32
  %2 = and i64 %b, 4294967295
  %3 = lshr i64 %b, 32
  %4 = mul i64 %0, %2
  %5 = mul i64 %0, %3
  %6 = mul i64 %1, %2
  %7 = mul i64 %1, %3
  %8 = lshr i64 %4, 32
  %9 = and i64 %5, 4294967295
  %10 = and i64 %6, 4294967295
  %11 = add i64 %8, %9
  %12 = add i64 %11, %10
  %13 = lshr i64 %5, 32
  %14 = lshr i64 %6, 32
  %15 = lshr i64 %12, 32
  %16 = add i64 %7, %13
  %17 = add i64 %16, %14
  %18 = add i64 %17, %15
  ret i64 %18
}

define noundef i32 @nish_main() #1 {
entry:
  %all.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 0 to i64
  %1 = xor i64 %0, -1
  store i64 %1, i64* %all.addr, align 8
  %2 = load i64, i64* %all.addr, align 8
  %3 = load i64, i64* %all.addr, align 8
  %4 = call i64 @high(i64 %2, i64 %3)
  %5 = call i8* @nish_str_from_u64(i64 %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = select i1 false, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %8 = call i8* @nish_str_concat(i8* %6, i8* %7)
  call void @nish_print(i8* %8)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
