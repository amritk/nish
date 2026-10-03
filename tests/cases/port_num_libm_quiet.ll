declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare double @llvm.floor.f64(double) #3
declare double @llvm.fabs.f64(double) #3
declare i32 @llvm.smin.i32(i32, i32) #3
declare i32 @llvm.smax.i32(i32, i32) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %high.addr = alloca i32, align 4
  %down.addr = alloca double, align 8
  %size.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %a.addr, align 4
  %0 = load i32, i32* %a.addr, align 4
  %1 = call i32 @llvm.smin.i32(i32 %0, i32 7)
  store i32 %1, i32* %low.addr, align 4
  %2 = load i32, i32* %a.addr, align 4
  %3 = call i32 @llvm.smax.i32(i32 %2, i32 7)
  store i32 %3, i32* %high.addr, align 4
  %4 = fneg double 0x4004000000000000
  %5 = call double @llvm.floor.f64(double %4)
  store double %5, double* %down.addr, align 8
  %6 = fneg double 0x4004000000000000
  %7 = call double @llvm.fabs.f64(double %6)
  store double %7, double* %size.addr, align 8
  %8 = load i32, i32* %low.addr, align 4
  %9 = load i32, i32* %high.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %13)
  %14 = load double, double* %down.addr, align 8
  %15 = load double, double* %size.addr, align 8
  %16 = fadd double %14, %15
  %17 = call i8* @nish_str_from_f64(double %16)
  call void @nish_print(i8* %17)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
