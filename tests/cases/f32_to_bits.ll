@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define noundef i32 @bits(float noundef %x) #0 {
entry:
  %0 = bitcast float %x to i32
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %zero.addr = alloca float, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store float 0x0000000000000000, float* %zero.addr, align 4
  %0 = call i32 @bits(float 0x3FF0000000000000)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = fneg float 0x4000000000000000
  %4 = call i32 @bits(float %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* %2, i8* %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %8 = load float, float* %zero.addr, align 4
  %9 = call i32 @bits(float %8)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %7, i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = load float, float* %zero.addr, align 4
  %14 = fneg float %13
  %15 = call i32 @bits(float %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %12, i8* %16)
  call void @nish_print(i8* %17)
  %18 = load float, float* %zero.addr, align 4
  %19 = fdiv float 0x3FF0000000000000, %18
  %20 = call i32 @bits(float %19)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %23 = call i32 @bits(float 0x3FB99999A0000000)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %22, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %27 = call i32 @bits(float 0x4170000000000000)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %26, i8* %28)
  call void @nish_print(i8* %29)
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
