@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_f64(double noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_u64(i64 noundef) #0
declare i32 @llvm.fptoui.sat.i32.f64(double) #1

define noundef i32 @test() #0 {
entry:
  %neg.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  %b.addr = alloca i8, align 1
  %q.addr = alloca i64, align 8
  %f.addr = alloca double, align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = sub i32 0, 1
  store i32 %0, i32* %neg.addr, align 4
  %1 = load i32, i32* %neg.addr, align 4
  store i32 %1, i32* %w.addr, align 4
  store i8 200, i8* %b.addr, align 1
  %2 = load i32, i32* %w.addr, align 4
  %3 = zext i32 %2 to i64
  store i64 %3, i64* %q.addr, align 8
  %4 = load i32, i32* %w.addr, align 4
  %5 = zext i32 %4 to i64
  %6 = call i8* @sts_str_from_u64(i64 %5)
  %7 = call i8* @sts_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %8 = load i32, i32* %w.addr, align 4
  %9 = call i8* @sts_str_from_i32(i32 %8)
  %10 = call i8* @sts_str_concat(i8* %7, i8* %9)
  %11 = call i8* @sts_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %12 = load i8, i8* %b.addr, align 1
  %13 = zext i8 %12 to i16
  %14 = zext i16 %13 to i64
  %15 = call i8* @sts_str_from_u64(i64 %14)
  %16 = call i8* @sts_str_concat(i8* %11, i8* %15)
  %17 = call i8* @sts_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = load i8, i8* %b.addr, align 1
  %19 = zext i8 %18 to i32
  %20 = call i8* @sts_str_from_i32(i32 %19)
  %21 = call i8* @sts_str_concat(i8* %17, i8* %20)
  %22 = call i8* @sts_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %23 = load i64, i64* %q.addr, align 8
  %24 = call i8* @sts_str_from_u64(i64 %23)
  %25 = call i8* @sts_str_concat(i8* %22, i8* %24)
  call void @sts_print(i8* %25)
  %26 = load i32, i32* %w.addr, align 4
  %27 = trunc i32 %26 to i8
  %28 = zext i8 %27 to i64
  %29 = call i8* @sts_str_from_u64(i64 %28)
  %30 = call i8* @sts_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = load i32, i32* %w.addr, align 4
  %32 = trunc i32 %31 to i16
  %33 = zext i16 %32 to i64
  %34 = call i8* @sts_str_from_u64(i64 %33)
  %35 = call i8* @sts_str_concat(i8* %30, i8* %34)
  %36 = call i8* @sts_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %37 = load i32, i32* %neg.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = call i8* @sts_str_from_u64(i64 %38)
  %40 = call i8* @sts_str_concat(i8* %36, i8* %39)
  call void @sts_print(i8* %40)
  %41 = load i32, i32* %w.addr, align 4
  %42 = uitofp i32 %41 to double
  store double %42, double* %f.addr, align 8
  %43 = load double, double* %f.addr, align 8
  %44 = call i8* @sts_str_from_f64(double %43)
  %45 = call i8* @sts_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %46 = load double, double* %f.addr, align 8
  %47 = call i32 @llvm.fptoui.sat.i32.f64(double %46)
  %48 = zext i32 %47 to i64
  %49 = call i8* @sts_str_from_u64(i64 %48)
  %50 = call i8* @sts_str_concat(i8* %45, i8* %49)
  call void @sts_print(i8* %50)
  %51 = load i32, i32* %w.addr, align 4
  %52 = trunc i32 %51 to i8
  %53 = zext i8 %52 to i32
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 %53
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
