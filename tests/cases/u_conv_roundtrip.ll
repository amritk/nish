@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0
declare i32 @llvm.fptoui.sat.i32.f64(double) #1

define noundef i32 @test() #0 {
entry:
  %neg.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  %b.addr = alloca i8, align 1
  %q.addr = alloca i64, align 8
  %f.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 -1, i32* %neg.addr, align 4
  %0 = load i32, i32* %neg.addr, align 4
  store i32 %0, i32* %w.addr, align 4
  store i8 200, i8* %b.addr, align 1
  %1 = load i32, i32* %w.addr, align 4
  %2 = zext i32 %1 to i64
  store i64 %2, i64* %q.addr, align 8
  %3 = load i32, i32* %w.addr, align 4
  %4 = zext i32 %3 to i64
  %5 = call i8* @nish_str_from_u64(i64 %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = load i32, i32* %w.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %6, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %11 = load i8, i8* %b.addr, align 1
  %12 = zext i8 %11 to i16
  %13 = zext i16 %12 to i64
  %14 = call i8* @nish_str_from_u64(i64 %13)
  %15 = call i8* @nish_str_concat(i8* %10, i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %17 = load i8, i8* %b.addr, align 1
  %18 = zext i8 %17 to i32
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %16, i8* %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %22 = load i64, i64* %q.addr, align 8
  %23 = call i8* @nish_str_from_u64(i64 %22)
  %24 = call i8* @nish_str_concat(i8* %21, i8* %23)
  call void @nish_print(i8* %24)
  %25 = load i32, i32* %w.addr, align 4
  %26 = trunc i32 %25 to i8
  %27 = zext i8 %26 to i64
  %28 = call i8* @nish_str_from_u64(i64 %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %30 = load i32, i32* %w.addr, align 4
  %31 = trunc i32 %30 to i16
  %32 = zext i16 %31 to i64
  %33 = call i8* @nish_str_from_u64(i64 %32)
  %34 = call i8* @nish_str_concat(i8* %29, i8* %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %36 = load i32, i32* %neg.addr, align 4
  %37 = sext i32 %36 to i64
  %38 = call i8* @nish_str_from_u64(i64 %37)
  %39 = call i8* @nish_str_concat(i8* %35, i8* %38)
  call void @nish_print(i8* %39)
  %40 = load i32, i32* %w.addr, align 4
  %41 = uitofp i32 %40 to double
  store double %41, double* %f.addr, align 8
  %42 = load double, double* %f.addr, align 8
  %43 = call i8* @nish_str_from_f64(double %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %45 = load double, double* %f.addr, align 8
  %46 = call i32 @llvm.fptoui.sat.i32.f64(double %45)
  %47 = zext i32 %46 to i64
  %48 = call i8* @nish_str_from_u64(i64 %47)
  %49 = call i8* @nish_str_concat(i8* %44, i8* %48)
  call void @nish_print(i8* %49)
  %50 = load i32, i32* %w.addr, align 4
  %51 = trunc i32 %50 to i8
  %52 = zext i8 %51 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %52
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
