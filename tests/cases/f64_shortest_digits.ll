declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca double, align 8
  %b.addr = alloca double, align 8
  %c.addr = alloca double, align 8
  %d.addr = alloca double, align 8
  %e.addr = alloca double, align 8
  %f.addr = alloca double, align 8
  %g.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0060000000000000, double* %a.addr, align 8
  store double 0x0100000000000000, double* %b.addr, align 8
  store double 0x0420000000000000, double* %c.addr, align 8
  store double 0x0660000000000000, double* %d.addr, align 8
  store double 0x3FB999999999999A, double* %e.addr, align 8
  store double 0x444B1AE4D6E2EF50, double* %f.addr, align 8
  store double 0x0000000000000001, double* %g.addr, align 8
  %0 = load double, double* %a.addr, align 8
  %1 = call i8* @nish_str_from_f64(double %0)
  call void @nish_print(i8* %1)
  %2 = load double, double* %b.addr, align 8
  %3 = call i8* @nish_str_from_f64(double %2)
  call void @nish_print(i8* %3)
  %4 = load double, double* %c.addr, align 8
  %5 = call i8* @nish_str_from_f64(double %4)
  call void @nish_print(i8* %5)
  %6 = load double, double* %d.addr, align 8
  %7 = call i8* @nish_str_from_f64(double %6)
  call void @nish_print(i8* %7)
  %8 = load double, double* %e.addr, align 8
  %9 = call i8* @nish_str_from_f64(double %8)
  call void @nish_print(i8* %9)
  %10 = load double, double* %f.addr, align 8
  %11 = call i8* @nish_str_from_f64(double %10)
  call void @nish_print(i8* %11)
  %12 = load double, double* %g.addr, align 8
  %13 = call i8* @nish_str_from_f64(double %12)
  call void @nish_print(i8* %13)
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
