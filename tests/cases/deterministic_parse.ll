@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"0x1p3\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"0x10\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"0x1fffffffffffff1\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" 0.1e1x\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" -42z\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"+0x10\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"-0x1fffffffffffff1\00" }, align 8

declare void @nish_free_arena() #4
declare noundef i64 @nish_arena_mark() #4
declare void @nish_arena_release(i64 noundef) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #4
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #4
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i32 @llvm.ctlz.i32(i32, i1) #1

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @nish.numberExact(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %1 = call i8* @nish_str_from_f64(double %0)
  call void @nish_print(i8* %1)
  %2 = call double @nish.parseFloatExact(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %3 = call i8* @nish_str_from_f64(double %2)
  call void @nish_print(i8* %3)
  %4 = call double @nish.numberExact(i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*))
  %5 = call i8* @nish_str_from_f64(double %4)
  call void @nish_print(i8* %5)
  %6 = call double @nish.numberExact(i8* bitcast ({ i64, [18 x i8] }* @.str.2 to i8*))
  %7 = call i8* @nish_str_from_f64(double %6)
  call void @nish_print(i8* %7)
  %8 = call double @nish.parseFloatExact(i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*))
  %9 = call i8* @nish_str_from_f64(double %8)
  call void @nish_print(i8* %9)
  %10 = call double @nish_parse_number(i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*), i32 2)
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = call double @nish.parseFloatExact(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*))
  %14 = call i8* @nish_str_from_f64(double %13)
  call void @nish_print(i8* %14)
  %15 = call double @nish.numberExact(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*))
  %16 = call i8* @nish_str_from_f64(double %15)
  call void @nish_print(i8* %16)
  %17 = call double @nish.parseFloatExact(i8* bitcast ({ i64, [19 x i8] }* @.str.6 to i8*))
  %18 = call i8* @nish_str_from_f64(double %17)
  call void @nish_print(i8* %18)
  %19 = call double @nish_parse_number(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i32 2)
  %20 = call i32 @llvm.fptosi.sat.i32.f64(double %19)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  %22 = call double @nish_parse_number(i8* bitcast ({ i64, [18 x i8] }* @.str.2 to i8*), i32 2)
  %23 = call i32 @llvm.fptosi.sat.i32.f64(double %22)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.clz64(i64 noundef %v) #1 {
entry:
  %h.addr = alloca i32, align 4
  %0 = sext i32 32 to i64
  %1 = and i64 %0, 63
  %2 = lshr i64 %v, %1
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %h.addr, align 4
  %4 = load i32, i32* %h.addr, align 4
  %5 = icmp ne i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = load i32, i32* %h.addr, align 4
  %7 = call i32 @llvm.ctlz.i32(i32 %6, i1 false)
  ret i32 %7

if.end:
  %8 = trunc i64 %v to i32
  %9 = call i32 @llvm.ctlz.i32(i32 %8, i1 false)
  %10 = add nsw i32 %9, 32
  ret i32 %10
}

define internal noundef i32 @nish.hexDigit(i32 noundef %c) #1 {
entry:
  %lower.addr = alloca i32, align 4
  %0 = icmp sge i32 %c, 48
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp sle i32 %c, 57
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = sub nsw i32 %c, 48
  ret i32 %3

if.end:
  %4 = or i32 %c, 32
  store i32 %4, i32* %lower.addr, align 4
  %5 = load i32, i32* %lower.addr, align 4
  %6 = icmp sge i32 %5, 97
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %lower.addr, align 4
  %8 = icmp sle i32 %7, 102
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %if.end ], [ %8, %land.rhs.1 ]
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  %10 = load i32, i32* %lower.addr, align 4
  %11 = sub nsw i32 %10, 87
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %12 = phi i32 [ %11, %cond.true ], [ -1, %cond.false ]
  ret i32 %12
}

define internal noundef i32 @nish.skipSpaces(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %at) #2 {
entry:
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  store i32 %at, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %k.addr, align 4
  %3 = bitcast i8* %s to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %2, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %while.cond ], [ %6, %land.rhs ]
  br i1 %7, label %while.body, label %while.end

while.body:
  %8 = load i32, i32* %k.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = getelementptr inbounds i8, i8* %s, i64 8
  %11 = getelementptr inbounds i8, i8* %10, i64 %9
  %12 = load i8, i8* %11, align 1
  %13 = zext i8 %12 to i32
  store i32 %13, i32* %c.addr, align 4
  %14 = load i32, i32* %c.addr, align 4
  %15 = icmp ne i32 %14, 32
  br i1 %15, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %16 = load i32, i32* %c.addr, align 4
  %17 = icmp slt i32 %16, 9
  br i1 %17, label %lor.end, label %lor.rhs

lor.rhs:
  %18 = load i32, i32* %c.addr, align 4
  %19 = icmp sgt i32 %18, 13
  br label %lor.end

lor.end:
  %20 = phi i1 [ true, %land.rhs.1 ], [ %19, %lor.rhs ]
  br label %land.end.1

land.end.1:
  %21 = phi i1 [ false, %while.body ], [ %20, %lor.end ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %k.addr, align 4
  ret i32 %22

if.end:
  %23 = load i32, i32* %k.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %25 = load i32, i32* %k.addr, align 4
  ret i32 %25
}

define internal noundef i32 @nish.hexEnd(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %at) #2 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %at, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %2 = load i32, i32* %k.addr, align 4
  %3 = bitcast i8* %s to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %2, %5
  br label %land.end.1

land.end.1:
  %7 = phi i1 [ false, %while.cond ], [ %6, %land.rhs.1 ]
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %k.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = getelementptr inbounds i8, i8* %s, i64 8
  %11 = getelementptr inbounds i8, i8* %10, i64 %9
  %12 = load i8, i8* %11, align 1
  %13 = zext i8 %12 to i32
  %14 = call i32 @nish.hexDigit(i32 %13)
  %15 = icmp sge i32 %14, 0
  br label %land.end

land.end:
  %16 = phi i1 [ false, %land.end.1 ], [ %15, %land.rhs ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %k.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %19 = load i32, i32* %k.addr, align 4
  ret i32 %19
}

define internal noundef double @nish.hexValue(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %start, i32 noundef %end) #2 {
entry:
  %m.addr = alloca i64, align 8
  %scale.addr = alloca double, align 8
  %sticky.addr = alloca i1, align 1
  %k.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %bits.addr = alloca i32, align 4
  %shift.addr = alloca i32, align 4
  %low.addr = alloca i64, align 8
  %half.addr = alloca i64, align 8
  %v.addr = alloca double, align 8
  %0 = sext i32 0 to i64
  store i64 %0, i64* %m.addr, align 8
  store double 0x0000000000000000, double* %scale.addr, align 8
  store i1 false, i1* %sticky.addr, align 1
  store i32 %start, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %k.addr, align 4
  %2 = icmp sge i32 %1, 0
  br i1 %2, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, %end
  br label %land.end.1

land.end.1:
  %5 = phi i1 [ false, %while.cond ], [ %4, %land.rhs.1 ]
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %k.addr, align 4
  %7 = bitcast i8* %s to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  %10 = icmp slt i32 %6, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %land.end.1 ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %k.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds i8, i8* %s, i64 8
  %15 = getelementptr inbounds i8, i8* %14, i64 %13
  %16 = load i8, i8* %15, align 1
  %17 = zext i8 %16 to i32
  %18 = call i32 @nish.hexDigit(i32 %17)
  store i32 %18, i32* %d.addr, align 4
  %19 = load i64, i64* %m.addr, align 8
  %20 = sext i32 60 to i64
  %21 = and i64 %20, 63
  %22 = lshr i64 %19, %21
  %23 = sext i32 0 to i64
  %24 = icmp ne i64 %22, %23
  br i1 %24, label %if.then, label %if.else

if.then:
  %25 = load double, double* %scale.addr, align 8
  %26 = fadd double %25, 0x4010000000000000
  store double %26, double* %scale.addr, align 8
  %27 = load i1, i1* %sticky.addr, align 1
  br i1 %27, label %lor.end, label %lor.rhs

lor.rhs:
  %28 = load i32, i32* %d.addr, align 4
  %29 = icmp ne i32 %28, 0
  br label %lor.end

lor.end:
  %30 = phi i1 [ true, %if.then ], [ %29, %lor.rhs ]
  store i1 %30, i1* %sticky.addr, align 1
  br label %if.end

if.else:
  %31 = load i64, i64* %m.addr, align 8
  %32 = sext i32 4 to i64
  %33 = and i64 %32, 63
  %34 = shl i64 %31, %33
  %35 = load i32, i32* %d.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = or i64 %34, %36
  store i64 %37, i64* %m.addr, align 8
  br label %if.end

if.end:
  %38 = load i32, i32* %k.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %40 = load i64, i64* %m.addr, align 8
  %41 = sext i32 0 to i64
  %42 = icmp eq i64 %40, %41
  br i1 %42, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %43 = load i64, i64* %m.addr, align 8
  %44 = call i32 @nish.clz64(i64 %43)
  %45 = sub nsw i32 64, %44
  br label %cond.end

cond.end:
  %46 = phi i32 [ 0, %cond.true ], [ %45, %cond.false ]
  store i32 %46, i32* %bits.addr, align 4
  %47 = load i32, i32* %bits.addr, align 4
  %48 = icmp sgt i32 %47, 53
  br i1 %48, label %if.then.1, label %if.end.1

if.then.1:
  %49 = load i32, i32* %bits.addr, align 4
  %50 = sub nsw i32 %49, 53
  store i32 %50, i32* %shift.addr, align 4
  %51 = load i64, i64* %m.addr, align 8
  %52 = sext i32 1 to i64
  %53 = load i32, i32* %shift.addr, align 4
  %54 = sext i32 %53 to i64
  %55 = and i64 %54, 63
  %56 = shl i64 %52, %55
  %57 = sext i32 1 to i64
  %58 = sub i64 %56, %57
  %59 = and i64 %51, %58
  store i64 %59, i64* %low.addr, align 8
  %60 = sext i32 1 to i64
  %61 = load i32, i32* %shift.addr, align 4
  %62 = sub nsw i32 %61, 1
  %63 = sext i32 %62 to i64
  %64 = and i64 %63, 63
  %65 = shl i64 %60, %64
  store i64 %65, i64* %half.addr, align 8
  %66 = load i64, i64* %m.addr, align 8
  %67 = load i32, i32* %shift.addr, align 4
  %68 = sext i32 %67 to i64
  %69 = and i64 %68, 63
  %70 = lshr i64 %66, %69
  store i64 %70, i64* %m.addr, align 8
  %71 = load i64, i64* %low.addr, align 8
  %72 = load i64, i64* %half.addr, align 8
  %73 = icmp ugt i64 %71, %72
  br i1 %73, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %74 = load i64, i64* %low.addr, align 8
  %75 = load i64, i64* %half.addr, align 8
  %76 = icmp eq i64 %74, %75
  br i1 %76, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %77 = load i1, i1* %sticky.addr, align 1
  br i1 %77, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %78 = load i64, i64* %m.addr, align 8
  %79 = sext i32 1 to i64
  %80 = and i64 %78, %79
  %81 = sext i32 0 to i64
  %82 = icmp ne i64 %80, %81
  br label %lor.end.2

lor.end.2:
  %83 = phi i1 [ true, %land.rhs.2 ], [ %82, %lor.rhs.2 ]
  br label %land.end.2

land.end.2:
  %84 = phi i1 [ false, %lor.rhs.1 ], [ %83, %lor.end.2 ]
  br label %lor.end.1

lor.end.1:
  %85 = phi i1 [ true, %if.then.1 ], [ %84, %land.end.2 ]
  br i1 %85, label %if.then.2, label %if.end.2

if.then.2:
  %86 = load i64, i64* %m.addr, align 8
  %87 = sext i32 1 to i64
  %88 = add i64 %86, %87
  store i64 %88, i64* %m.addr, align 8
  br label %if.end.2

if.end.2:
  %89 = load double, double* %scale.addr, align 8
  %90 = load i32, i32* %shift.addr, align 4
  %91 = sitofp i32 %90 to double
  %92 = fadd double %89, %91
  store double %92, double* %scale.addr, align 8
  br label %if.end.1

if.end.1:
  %93 = load i64, i64* %m.addr, align 8
  %94 = uitofp i64 %93 to double
  store double %94, double* %v.addr, align 8
  br label %while.cond.1

while.cond.1:
  %95 = load double, double* %scale.addr, align 8
  %96 = fcmp ogt double %95, 0x0000000000000000
  br i1 %96, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %97 = load double, double* %v.addr, align 8
  %98 = fcmp ole double %97, 0x7FEFFFFFFFFFFFFF
  br label %land.end.3

land.end.3:
  %99 = phi i1 [ false, %while.cond.1 ], [ %98, %land.rhs.3 ]
  br i1 %99, label %while.body.1, label %while.end.1

while.body.1:
  %100 = load double, double* %v.addr, align 8
  %101 = fmul double %100, 0x4000000000000000
  store double %101, double* %v.addr, align 8
  %102 = load double, double* %scale.addr, align 8
  %103 = fsub double %102, 0x3FF0000000000000
  store double %103, double* %scale.addr, align 8
  br label %while.cond.1

while.end.1:
  %104 = load double, double* %v.addr, align 8
  ret double %104
}

define internal noundef i32 @nish.hexDigitsAt(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %at) #3 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = sub nsw i32 %3, 1
  %5 = icmp slt i32 %at, %4
  br label %land.end.2

land.end.2:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs.2 ]
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = sext i32 %at to i64
  %8 = getelementptr inbounds i8, i8* %s, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %7
  %10 = load i8, i8* %9, align 1
  %11 = zext i8 %10 to i32
  %12 = icmp eq i32 %11, 48
  br label %land.end.1

land.end.1:
  %13 = phi i1 [ false, %land.end.2 ], [ %12, %land.rhs.1 ]
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = add nsw i32 %at, 1
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds i8, i8* %s, i64 8
  %17 = getelementptr inbounds i8, i8* %16, i64 %15
  %18 = load i8, i8* %17, align 1
  %19 = zext i8 %18 to i32
  %20 = or i32 %19, 32
  %21 = icmp eq i32 %20, 120
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %if.then, label %if.end

if.then:
  %23 = add nsw i32 %at, 2
  ret i32 %23

if.end:
  ret i32 -1
}

define internal noundef i32 @nish.signEnd(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %p) #3 {
entry:
  %0 = icmp sge i32 %p, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %p, %3
  br label %land.end.1

land.end.1:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs.1 ]
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = sext i32 %p to i64
  %7 = getelementptr inbounds i8, i8* %s, i64 8
  %8 = getelementptr inbounds i8, i8* %7, i64 %6
  %9 = load i8, i8* %8, align 1
  %10 = zext i8 %9 to i32
  %11 = icmp eq i32 %10, 45
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = sext i32 %p to i64
  %13 = getelementptr inbounds i8, i8* %s, i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 %12
  %15 = load i8, i8* %14, align 1
  %16 = zext i8 %15 to i32
  %17 = icmp eq i32 %16, 43
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %land.rhs ], [ %17, %lor.rhs ]
  br label %land.end

land.end:
  %19 = phi i1 [ false, %land.end.1 ], [ %18, %lor.end ]
  br i1 %19, label %cond.true, label %cond.false

cond.true:
  %20 = add nsw i32 %p, 1
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %21 = phi i32 [ %20, %cond.true ], [ %p, %cond.false ]
  ret i32 %21
}

define internal noundef zeroext i1 @nish.isMinus(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %p) #3 {
entry:
  %0 = icmp sge i32 %p, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %p, %3
  br label %land.end.1

land.end.1:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs.1 ]
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = sext i32 %p to i64
  %7 = getelementptr inbounds i8, i8* %s, i64 8
  %8 = getelementptr inbounds i8, i8* %7, i64 %6
  %9 = load i8, i8* %8, align 1
  %10 = zext i8 %9 to i32
  %11 = icmp eq i32 %10, 45
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  ret i1 %12
}

define internal noundef double @nish.numberExact(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %p.addr = alloca i32, align 4
  %negative.addr = alloca i1, align 1
  %h.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %zero.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %0 = call i32 @nish.skipSpaces(i8* %s, i32 0)
  store i32 %0, i32* %p.addr, align 4
  %1 = load i32, i32* %p.addr, align 4
  %2 = call i1 @nish.isMinus(i8* %s, i32 %1)
  store i1 %2, i1* %negative.addr, align 1
  %3 = load i32, i32* %p.addr, align 4
  %4 = call i32 @nish.signEnd(i8* %s, i32 %3)
  %5 = call i32 @nish.hexDigitsAt(i8* %s, i32 %4)
  store i32 %5, i32* %h.addr, align 4
  %6 = load i32, i32* %h.addr, align 4
  %7 = icmp slt i32 %6, 0
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = call double @nish_parse_number(i8* %s, i32 1)
  ret double %8

if.end:
  %9 = load i32, i32* %h.addr, align 4
  %10 = call i32 @nish.hexEnd(i8* %s, i32 %9)
  store i32 %10, i32* %end.addr, align 4
  %11 = load i32, i32* %end.addr, align 4
  %12 = load i32, i32* %h.addr, align 4
  %13 = icmp eq i32 %11, %12
  br i1 %13, label %lor.end, label %lor.rhs

lor.rhs:
  %14 = load i32, i32* %end.addr, align 4
  %15 = call i32 @nish.skipSpaces(i8* %s, i32 %14)
  %16 = bitcast i8* %s to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = icmp ne i32 %15, %18
  br label %lor.end

lor.end:
  %20 = phi i1 [ true, %if.end ], [ %19, %lor.rhs ]
  br i1 %20, label %if.then.1, label %if.end.1

if.then.1:
  store double 0x0000000000000000, double* %zero.addr, align 8
  %21 = load double, double* %zero.addr, align 8
  %22 = load double, double* %zero.addr, align 8
  %23 = fdiv double %21, %22
  ret double %23

if.end.1:
  %24 = load i32, i32* %h.addr, align 4
  %25 = load i32, i32* %end.addr, align 4
  %26 = call double @nish.hexValue(i8* %s, i32 %24, i32 %25)
  store double %26, double* %v.addr, align 8
  %27 = load i1, i1* %negative.addr, align 1
  br i1 %27, label %cond.true, label %cond.false

cond.true:
  %28 = load double, double* %v.addr, align 8
  %29 = fneg double %28
  br label %cond.end

cond.false:
  %30 = load double, double* %v.addr, align 8
  br label %cond.end

cond.end:
  %31 = phi double [ %29, %cond.true ], [ %30, %cond.false ]
  ret double %31
}

define internal noundef double @nish.parseFloatExact(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %p.addr = alloca i32, align 4
  %negative.addr = alloca i1, align 1
  %h.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %v.addr = alloca double, align 8
  %0 = call i32 @nish.skipSpaces(i8* %s, i32 0)
  store i32 %0, i32* %p.addr, align 4
  %1 = load i32, i32* %p.addr, align 4
  %2 = call i1 @nish.isMinus(i8* %s, i32 %1)
  store i1 %2, i1* %negative.addr, align 1
  %3 = load i32, i32* %p.addr, align 4
  %4 = call i32 @nish.signEnd(i8* %s, i32 %3)
  %5 = call i32 @nish.hexDigitsAt(i8* %s, i32 %4)
  store i32 %5, i32* %h.addr, align 4
  %6 = load i32, i32* %h.addr, align 4
  %7 = icmp slt i32 %6, 0
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = call double @nish_parse_number(i8* %s, i32 0)
  ret double %8

if.end:
  %9 = load i32, i32* %h.addr, align 4
  %10 = call i32 @nish.hexEnd(i8* %s, i32 %9)
  store i32 %10, i32* %end.addr, align 4
  %11 = load i32, i32* %end.addr, align 4
  %12 = load i32, i32* %h.addr, align 4
  %13 = icmp eq i32 %11, %12
  br i1 %13, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %14 = load i32, i32* %h.addr, align 4
  %15 = load i32, i32* %end.addr, align 4
  %16 = call double @nish.hexValue(i8* %s, i32 %14, i32 %15)
  br label %cond.end

cond.end:
  %17 = phi double [ 0x0000000000000000, %cond.true ], [ %16, %cond.false ]
  store double %17, double* %v.addr, align 8
  %18 = load i1, i1* %negative.addr, align 1
  br i1 %18, label %cond.true.1, label %cond.false.1

cond.true.1:
  %19 = load double, double* %v.addr, align 8
  %20 = fneg double %19
  br label %cond.end.1

cond.false.1:
  %21 = load double, double* %v.addr, align 8
  br label %cond.end.1

cond.end.1:
  %22 = phi double [ %20, %cond.true.1 ], [ %21, %cond.false.1 ]
  ret double %22
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
