@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare double @llvm.copysign.f64(double, double) #0
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #0
declare float @llvm.copysign.f32(float, float) #0

define noundef double @signF64(double noundef %x) #0 {
entry:
  %0 = call double @llvm.copysign.f64(double 1.0, double %x)
  %1 = fcmp ueq double %x, 0.0
  %2 = select i1 %1, double %x, double %0
  ret double %2
}

define noundef i32 @signI32(i32 noundef %x) #0 {
entry:
  %0 = icmp sgt i32 %x, 0
  %1 = icmp slt i32 %x, 0
  %2 = zext i1 %0 to i32
  %3 = zext i1 %1 to i32
  %4 = sub i32 %2, %3
  ret i32 %4
}

define noundef i32 @signU32(i32 noundef %x) #0 {
entry:
  %0 = icmp ne i32 %x, 0
  %1 = zext i1 %0 to i32
  ret i32 %1
}

define noundef i64 @signWide(i64 noundef %x) #0 {
entry:
  %0 = icmp sgt i64 %x, 0
  %1 = icmp slt i64 %x, 0
  %2 = zext i1 %0 to i64
  %3 = zext i1 %1 to i64
  %4 = sub i64 %2, %3
  ret i64 %4
}

define noundef i64 @signUWide(i64 noundef %x) #0 {
entry:
  %0 = icmp ne i64 %x, 0
  %1 = zext i1 %0 to i64
  ret i64 %1
}

define noundef float @signF32(float noundef %x) #0 {
entry:
  %0 = call float @llvm.copysign.f32(float 1.0, float %x)
  %1 = fcmp ueq float %x, 0.0
  %2 = select i1 %1, float %x, float %0
  ret float %2
}

define noundef i8 @signU8(i8 noundef %x) #0 {
entry:
  %0 = icmp ne i8 %x, 0
  %1 = zext i1 %0 to i8
  ret i8 %1
}

define noundef i16 @signU16(i16 noundef %x) #0 {
entry:
  %0 = icmp ne i16 %x, 0
  %1 = zext i1 %0 to i16
  ret i16 %1
}

define noundef i32 @nish_main() #1 {
entry:
  %zero.addr = alloca double, align 8
  %one.addr = alloca double, align 8
  %top.addr = alloca i32, align 4
  %low.addr = alloca i64, align 8
  %high.addr = alloca i64, align 8
  %zero32.addr = alloca float, align 4
  %negZero32.addr = alloca double, align 8
  %byte.addr = alloca i8, align 1
  %half.addr = alloca i16, align 2
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0000000000000000, double* %zero.addr, align 8
  store double 0x3FF0000000000000, double* %one.addr, align 8
  %0 = fneg double 0x4004000000000000
  %1 = call double @signF64(double %0)
  %2 = call i8* @nish_str_from_f64(double %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = call double @signF64(double 0x401C000000000000)
  %5 = call i8* @nish_str_from_f64(double %4)
  %6 = call i8* @nish_str_concat(i8* %3, i8* %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %8 = load double, double* %zero.addr, align 8
  %9 = call double @signF64(double %8)
  %10 = call i8* @nish_str_from_f64(double %9)
  %11 = call i8* @nish_str_concat(i8* %7, i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = load double, double* %one.addr, align 8
  %14 = load double, double* %zero.addr, align 8
  %15 = fneg double %14
  %16 = call double @signF64(double %15)
  %17 = fdiv double %13, %16
  %18 = call i8* @nish_str_from_f64(double %17)
  %19 = call i8* @nish_str_concat(i8* %12, i8* %18)
  call void @nish_print(i8* %19)
  %20 = load double, double* %zero.addr, align 8
  %21 = load double, double* %zero.addr, align 8
  %22 = fdiv double %20, %21
  %23 = call double @signF64(double %22)
  %24 = call i8* @nish_str_from_f64(double %23)
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %26 = load double, double* %one.addr, align 8
  %27 = fneg double %26
  %28 = load double, double* %zero.addr, align 8
  %29 = fdiv double %27, %28
  %30 = call double @signF64(double %29)
  %31 = call i8* @nish_str_from_f64(double %30)
  %32 = call i8* @nish_str_concat(i8* %25, i8* %31)
  call void @nish_print(i8* %32)
  %33 = call i32 @signI32(i32 -42)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %36 = call i32 @signI32(i32 0)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %35, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %40 = call i32 @signI32(i32 2147483647)
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %39, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %44 = call i32 @signI32(i32 -2147483648)
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %43, i8* %45)
  call void @nish_print(i8* %46)
  store i32 4294967295, i32* %top.addr, align 4
  %47 = load i32, i32* %top.addr, align 4
  %48 = call i32 @signU32(i32 %47)
  %49 = zext i32 %48 to i64
  %50 = call i8* @nish_str_from_u64(i64 %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %52 = call i32 @signU32(i32 0)
  %53 = zext i32 %52 to i64
  %54 = call i8* @nish_str_from_u64(i64 %53)
  %55 = call i8* @nish_str_concat(i8* %51, i8* %54)
  call void @nish_print(i8* %55)
  store i64 -9000000000, i64* %low.addr, align 8
  %56 = sext i32 -1 to i64
  store i64 %56, i64* %high.addr, align 8
  %57 = load i64, i64* %low.addr, align 8
  %58 = call i64 @signWide(i64 %57)
  %59 = call i8* @nish_str_from_i64(i64 %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %61 = sext i32 0 to i64
  %62 = call i64 @signWide(i64 %61)
  %63 = call i8* @nish_str_from_i64(i64 %62)
  %64 = call i8* @nish_str_concat(i8* %60, i8* %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %66 = load i64, i64* %low.addr, align 8
  %67 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %66)
  %68 = extractvalue { i64, i1 } %67, 0
  %69 = extractvalue { i64, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok

ovf.ok:
  %70 = call i64 @signWide(i64 %68)
  %71 = call i8* @nish_str_from_i64(i64 %70)
  %72 = call i8* @nish_str_concat(i8* %65, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %74 = load i64, i64* %high.addr, align 8
  %75 = call i64 @signUWide(i64 %74)
  %76 = call i8* @nish_str_from_u64(i64 %75)
  %77 = call i8* @nish_str_concat(i8* %73, i8* %76)
  %78 = call i8* @nish_str_concat(i8* %77, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %79 = sext i32 0 to i64
  %80 = call i64 @signUWide(i64 %79)
  %81 = call i8* @nish_str_from_u64(i64 %80)
  %82 = call i8* @nish_str_concat(i8* %78, i8* %81)
  call void @nish_print(i8* %82)
  store float 0x0000000000000000, float* %zero32.addr, align 4
  %83 = load float, float* %zero32.addr, align 4
  %84 = fneg float %83
  %85 = call float @signF32(float %84)
  %86 = fpext float %85 to double
  store double %86, double* %negZero32.addr, align 8
  %87 = fneg float 0x4004000000000000
  %88 = call float @signF32(float %87)
  %89 = fpext float %88 to double
  %90 = call i8* @nish_str_from_f64(double %89)
  %91 = call i8* @nish_str_concat(i8* %90, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %92 = call float @signF32(float 0x4008000000000000)
  %93 = fpext float %92 to double
  %94 = call i8* @nish_str_from_f64(double %93)
  %95 = call i8* @nish_str_concat(i8* %91, i8* %94)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %97 = load double, double* %one.addr, align 8
  %98 = load double, double* %negZero32.addr, align 8
  %99 = fdiv double %97, %98
  %100 = call i8* @nish_str_from_f64(double %99)
  %101 = call i8* @nish_str_concat(i8* %96, i8* %100)
  %102 = call i8* @nish_str_concat(i8* %101, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %103 = load float, float* %zero32.addr, align 4
  %104 = load float, float* %zero32.addr, align 4
  %105 = fdiv float %103, %104
  %106 = call float @signF32(float %105)
  %107 = fpext float %106 to double
  %108 = call i8* @nish_str_from_f64(double %107)
  %109 = call i8* @nish_str_concat(i8* %102, i8* %108)
  call void @nish_print(i8* %109)
  store i8 255, i8* %byte.addr, align 1
  store i16 65535, i16* %half.addr, align 2
  %110 = load i8, i8* %byte.addr, align 1
  %111 = call i8 @signU8(i8 %110)
  %112 = zext i8 %111 to i64
  %113 = call i8* @nish_str_from_u64(i64 %112)
  %114 = call i8* @nish_str_concat(i8* %113, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %115 = trunc i32 0 to i8
  %116 = call i8 @signU8(i8 %115)
  %117 = zext i8 %116 to i64
  %118 = call i8* @nish_str_from_u64(i64 %117)
  %119 = call i8* @nish_str_concat(i8* %114, i8* %118)
  %120 = call i8* @nish_str_concat(i8* %119, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %121 = load i16, i16* %half.addr, align 2
  %122 = call i16 @signU16(i16 %121)
  %123 = zext i16 %122 to i64
  %124 = call i8* @nish_str_from_u64(i64 %123)
  %125 = call i8* @nish_str_concat(i8* %120, i8* %124)
  %126 = call i8* @nish_str_concat(i8* %125, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %127 = trunc i32 0 to i16
  %128 = call i16 @signU16(i16 %127)
  %129 = zext i16 %128 to i64
  %130 = call i8* @nish_str_from_u64(i64 %129)
  %131 = call i8* @nish_str_concat(i8* %126, i8* %130)
  call void @nish_print(i8* %131)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
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
attributes #3 = { nounwind noreturn cold }
