declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %zero.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = fneg double 0x0000000000000000
  store double %0, double* %zero.addr, align 8
  %1 = load double, double* %zero.addr, align 8
  %2 = call i8* @nish_str_from_f64(double %1)
  call void @nish_print(i8* %2)
  %3 = load double, double* %zero.addr, align 8
  %4 = fmul double %3, 0x4000000000000000
  %5 = call i8* @nish_str_from_f64(double %4)
  call void @nish_print(i8* %5)
  %6 = load double, double* %zero.addr, align 8
  %7 = call i8* @nish_str_from_f64(double %6)
  call void @nish_write(i8* %7, i32 2, i1 true)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
