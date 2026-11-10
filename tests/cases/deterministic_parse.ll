@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"0x1p3\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"0x10\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"0x1fffffffffffff1\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" 0.1e1x\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" -42z\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"+0x10\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"-0x1fffffffffffff1\00" }, align 8

declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
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
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  %6 = load i32, i32* %h.addr, align 4
  %7 = call i32 @llvm.ctlz.i32(i32 %6, i1 false)
  br label %cond.end

cond.false:
  %8 = trunc i64 %v to i32
  %9 = call i32 @llvm.ctlz.i32(i32 %8, i1 false)
  %10 = add nsw i32 %9, 32
  br label %cond.end

cond.end:
  %11 = phi i32 [ %7, %cond.true ], [ %10, %cond.false ]
  ret i32 %11
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

define internal noundef double @nish.hexValue(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %start, i32 noundef %end) #0 {
entry:
  %m.addr = alloca i64, align 8
  %scale.addr = alloca i32, align 4
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
  store i32 0, i32* %scale.addr, align 4
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
  %25 = load i32, i32* %scale.addr, align 4
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 4)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %27, i32* %scale.addr, align 4
  %29 = load i1, i1* %sticky.addr, align 1
  br i1 %29, label %lor.end, label %lor.rhs

lor.rhs:
  %30 = load i32, i32* %d.addr, align 4
  %31 = icmp ne i32 %30, 0
  br label %lor.end

lor.end:
  %32 = phi i1 [ true, %ovf.ok ], [ %31, %lor.rhs ]
  store i1 %32, i1* %sticky.addr, align 1
  br label %if.end

if.else:
  %33 = load i64, i64* %m.addr, align 8
  %34 = sext i32 4 to i64
  %35 = and i64 %34, 63
  %36 = shl i64 %33, %35
  %37 = load i32, i32* %d.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = or i64 %36, %38
  store i64 %39, i64* %m.addr, align 8
  br label %if.end

if.end:
  %40 = load i32, i32* %k.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %42 = load i64, i64* %m.addr, align 8
  %43 = sext i32 0 to i64
  %44 = icmp eq i64 %42, %43
  br i1 %44, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %45 = load i64, i64* %m.addr, align 8
  %46 = call i32 @nish.clz64(i64 %45)
  %47 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 64, i32 %46)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.end:
  %50 = phi i32 [ 0, %cond.true ], [ %48, %ovf.ok.1 ]
  store i32 %50, i32* %bits.addr, align 4
  %51 = load i32, i32* %bits.addr, align 4
  %52 = icmp sgt i32 %51, 53
  br i1 %52, label %if.then.1, label %if.end.1

if.then.1:
  %53 = load i32, i32* %bits.addr, align 4
  %54 = sub nsw i32 %53, 53
  store i32 %54, i32* %shift.addr, align 4
  %55 = load i64, i64* %m.addr, align 8
  %56 = sext i32 1 to i64
  %57 = load i32, i32* %shift.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = and i64 %58, 63
  %60 = shl i64 %56, %59
  %61 = sext i32 1 to i64
  %62 = sub i64 %60, %61
  %63 = and i64 %55, %62
  store i64 %63, i64* %low.addr, align 8
  %64 = sext i32 1 to i64
  %65 = load i32, i32* %shift.addr, align 4
  %66 = sub nsw i32 %65, 1
  %67 = sext i32 %66 to i64
  %68 = and i64 %67, 63
  %69 = shl i64 %64, %68
  store i64 %69, i64* %half.addr, align 8
  %70 = load i64, i64* %m.addr, align 8
  %71 = load i32, i32* %shift.addr, align 4
  %72 = sext i32 %71 to i64
  %73 = and i64 %72, 63
  %74 = lshr i64 %70, %73
  store i64 %74, i64* %m.addr, align 8
  %75 = load i64, i64* %low.addr, align 8
  %76 = load i64, i64* %half.addr, align 8
  %77 = icmp ugt i64 %75, %76
  br i1 %77, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %78 = load i64, i64* %low.addr, align 8
  %79 = load i64, i64* %half.addr, align 8
  %80 = icmp eq i64 %78, %79
  br i1 %80, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %81 = load i1, i1* %sticky.addr, align 1
  br i1 %81, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %82 = load i64, i64* %m.addr, align 8
  %83 = sext i32 1 to i64
  %84 = and i64 %82, %83
  %85 = sext i32 0 to i64
  %86 = icmp ne i64 %84, %85
  br label %lor.end.2

lor.end.2:
  %87 = phi i1 [ true, %land.rhs.2 ], [ %86, %lor.rhs.2 ]
  br label %land.end.2

land.end.2:
  %88 = phi i1 [ false, %lor.rhs.1 ], [ %87, %lor.end.2 ]
  br label %lor.end.1

lor.end.1:
  %89 = phi i1 [ true, %if.then.1 ], [ %88, %land.end.2 ]
  br i1 %89, label %if.then.2, label %if.end.2

if.then.2:
  %90 = load i64, i64* %m.addr, align 8
  %91 = sext i32 1 to i64
  %92 = add i64 %90, %91
  store i64 %92, i64* %m.addr, align 8
  br label %if.end.2

if.end.2:
  %93 = load i32, i32* %scale.addr, align 4
  %94 = load i32, i32* %shift.addr, align 4
  %95 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %93, i32 %94)
  %96 = extractvalue { i32, i1 } %95, 0
  %97 = extractvalue { i32, i1 } %95, 1
  br i1 %97, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %96, i32* %scale.addr, align 4
  br label %if.end.1

if.end.1:
  %98 = load i64, i64* %m.addr, align 8
  %99 = uitofp i64 %98 to double
  store double %99, double* %v.addr, align 8
  br label %while.cond.1

while.cond.1:
  %100 = load i32, i32* %scale.addr, align 4
  %101 = icmp sgt i32 %100, 0
  br i1 %101, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %102 = load double, double* %v.addr, align 8
  %103 = fcmp ole double %102, 0x7FEFFFFFFFFFFFFF
  br label %land.end.3

land.end.3:
  %104 = phi i1 [ false, %while.cond.1 ], [ %103, %land.rhs.3 ]
  br i1 %104, label %while.body.1, label %while.end.1

while.body.1:
  %105 = load double, double* %v.addr, align 8
  %106 = fmul double %105, 0x4000000000000000
  store double %106, double* %v.addr, align 8
  %107 = load i32, i32* %scale.addr, align 4
  %108 = sub nsw i32 %107, 1
  store i32 %108, i32* %scale.addr, align 4
  br label %while.cond.1

while.end.1:
  %109 = load double, double* %v.addr, align 8
  ret double %109

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then ], [ 1, %cond.false ], [ 0, %if.end.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef zeroext i1 @nish.isHexPrefix(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %at) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = bitcast i8* %s to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %1, %5
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = sext i32 %at to i64
  %8 = bitcast i8* %s to i64*
  %9 = load i64, i64* %8, align 8
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds i8, i8* %s, i64 8
  %12 = getelementptr inbounds i8, i8* %11, i64 %7
  %13 = load i8, i8* %12, align 1
  %14 = zext i8 %13 to i32
  %15 = icmp eq i32 %14, 48
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %ovf.ok ], [ %15, %bounds.ok ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = add nsw i32 %at, 1
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %s to i64*
  %20 = load i64, i64* %19, align 8
  %21 = icmp ult i64 %18, %20
  br i1 %21, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %18, i64 %20)
  unreachable

bounds.ok.1:
  %22 = getelementptr inbounds i8, i8* %s, i64 8
  %23 = getelementptr inbounds i8, i8* %22, i64 %18
  %24 = load i8, i8* %23, align 1
  %25 = zext i8 %24 to i32
  %26 = or i32 %25, 32
  %27 = icmp eq i32 %26, 120
  br label %land.end

land.end:
  %28 = phi i1 [ false, %land.end.1 ], [ %27, %bounds.ok.1 ]
  ret i1 %28

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef double @nish.numberExact(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %p.addr = alloca i32, align 4
  %negative.addr = alloca i1, align 1
  %q.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %zero.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %0 = call i32 @nish.skipSpaces(i8* %s, i32 0)
  store i32 %0, i32* %p.addr, align 4
  %1 = load i32, i32* %p.addr, align 4
  %2 = bitcast i8* %s to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = icmp slt i32 %1, %4
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %p.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = bitcast i8* %s to i64*
  %9 = load i64, i64* %8, align 8
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds i8, i8* %s, i64 8
  %12 = getelementptr inbounds i8, i8* %11, i64 %7
  %13 = load i8, i8* %12, align 1
  %14 = zext i8 %13 to i32
  %15 = icmp eq i32 %14, 45
  br label %land.end

land.end:
  %16 = phi i1 [ false, %entry ], [ %15, %bounds.ok ]
  store i1 %16, i1* %negative.addr, align 1
  %17 = load i32, i32* %p.addr, align 4
  %18 = bitcast i8* %s to i64*
  %19 = load i64, i64* %18, align 8
  %20 = trunc i64 %19 to i32
  %21 = icmp slt i32 %17, %20
  br i1 %21, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %22 = load i1, i1* %negative.addr, align 1
  br i1 %22, label %lor.end, label %lor.rhs

lor.rhs:
  %23 = load i32, i32* %p.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %s to i64*
  %26 = load i64, i64* %25, align 8
  %27 = icmp ult i64 %24, %26
  br i1 %27, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %24, i64 %26)
  unreachable

bounds.ok.1:
  %28 = getelementptr inbounds i8, i8* %s, i64 8
  %29 = getelementptr inbounds i8, i8* %28, i64 %24
  %30 = load i8, i8* %29, align 1
  %31 = zext i8 %30 to i32
  %32 = icmp eq i32 %31, 43
  br label %lor.end

lor.end:
  %33 = phi i1 [ true, %land.rhs.1 ], [ %32, %bounds.ok.1 ]
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end ], [ %33, %lor.end ]
  br i1 %34, label %cond.true, label %cond.false

cond.true:
  %35 = load i32, i32* %p.addr, align 4
  %36 = add nsw i32 %35, 1
  br label %cond.end

cond.false:
  %37 = load i32, i32* %p.addr, align 4
  br label %cond.end

cond.end:
  %38 = phi i32 [ %36, %cond.true ], [ %37, %cond.false ]
  store i32 %38, i32* %q.addr, align 4
  %39 = load i32, i32* %q.addr, align 4
  %40 = call i1 @nish.isHexPrefix(i8* %s, i32 %39)
  %41 = xor i1 %40, true
  br i1 %41, label %if.then, label %if.end

if.then:
  %42 = call double @nish_parse_number(i8* %s, i32 1)
  ret double %42

if.end:
  %43 = load i32, i32* %q.addr, align 4
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 2)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok

ovf.ok:
  %47 = call i32 @nish.hexEnd(i8* %s, i32 %45)
  store i32 %47, i32* %end.addr, align 4
  %48 = load i32, i32* %end.addr, align 4
  %49 = load i32, i32* %q.addr, align 4
  %50 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %49, i32 2)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %53 = icmp eq i32 %48, %51
  br i1 %53, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %54 = load i32, i32* %end.addr, align 4
  %55 = call i32 @nish.skipSpaces(i8* %s, i32 %54)
  %56 = bitcast i8* %s to i64*
  %57 = load i64, i64* %56, align 8
  %58 = trunc i64 %57 to i32
  %59 = icmp ne i32 %55, %58
  br label %lor.end.1

lor.end.1:
  %60 = phi i1 [ true, %ovf.ok.1 ], [ %59, %lor.rhs.1 ]
  br i1 %60, label %if.then.1, label %if.end.1

if.then.1:
  store double 0x0000000000000000, double* %zero.addr, align 8
  %61 = load double, double* %zero.addr, align 8
  %62 = load double, double* %zero.addr, align 8
  %63 = fdiv double %61, %62
  ret double %63

if.end.1:
  %64 = load i32, i32* %q.addr, align 4
  %65 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %64, i32 2)
  %66 = extractvalue { i32, i1 } %65, 0
  %67 = extractvalue { i32, i1 } %65, 1
  br i1 %67, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %68 = load i32, i32* %end.addr, align 4
  %69 = call double @nish.hexValue(i8* %s, i32 %66, i32 %68)
  store double %69, double* %v.addr, align 8
  %70 = load i1, i1* %negative.addr, align 1
  br i1 %70, label %cond.true.1, label %cond.false.1

cond.true.1:
  %71 = load double, double* %v.addr, align 8
  %72 = fneg double %71
  br label %cond.end.1

cond.false.1:
  %73 = load double, double* %v.addr, align 8
  br label %cond.end.1

cond.end.1:
  %74 = phi double [ %72, %cond.true.1 ], [ %73, %cond.false.1 ]
  ret double %74

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef double @nish.parseFloatExact(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %p.addr = alloca i32, align 4
  %negative.addr = alloca i1, align 1
  %q.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %v.addr = alloca double, align 8
  %0 = call i32 @nish.skipSpaces(i8* %s, i32 0)
  store i32 %0, i32* %p.addr, align 4
  %1 = load i32, i32* %p.addr, align 4
  %2 = bitcast i8* %s to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = icmp slt i32 %1, %4
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %p.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = bitcast i8* %s to i64*
  %9 = load i64, i64* %8, align 8
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds i8, i8* %s, i64 8
  %12 = getelementptr inbounds i8, i8* %11, i64 %7
  %13 = load i8, i8* %12, align 1
  %14 = zext i8 %13 to i32
  %15 = icmp eq i32 %14, 45
  br label %land.end

land.end:
  %16 = phi i1 [ false, %entry ], [ %15, %bounds.ok ]
  store i1 %16, i1* %negative.addr, align 1
  %17 = load i32, i32* %p.addr, align 4
  %18 = bitcast i8* %s to i64*
  %19 = load i64, i64* %18, align 8
  %20 = trunc i64 %19 to i32
  %21 = icmp slt i32 %17, %20
  br i1 %21, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %22 = load i1, i1* %negative.addr, align 1
  br i1 %22, label %lor.end, label %lor.rhs

lor.rhs:
  %23 = load i32, i32* %p.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %s to i64*
  %26 = load i64, i64* %25, align 8
  %27 = icmp ult i64 %24, %26
  br i1 %27, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %24, i64 %26)
  unreachable

bounds.ok.1:
  %28 = getelementptr inbounds i8, i8* %s, i64 8
  %29 = getelementptr inbounds i8, i8* %28, i64 %24
  %30 = load i8, i8* %29, align 1
  %31 = zext i8 %30 to i32
  %32 = icmp eq i32 %31, 43
  br label %lor.end

lor.end:
  %33 = phi i1 [ true, %land.rhs.1 ], [ %32, %bounds.ok.1 ]
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end ], [ %33, %lor.end ]
  br i1 %34, label %cond.true, label %cond.false

cond.true:
  %35 = load i32, i32* %p.addr, align 4
  %36 = add nsw i32 %35, 1
  br label %cond.end

cond.false:
  %37 = load i32, i32* %p.addr, align 4
  br label %cond.end

cond.end:
  %38 = phi i32 [ %36, %cond.true ], [ %37, %cond.false ]
  store i32 %38, i32* %q.addr, align 4
  %39 = load i32, i32* %q.addr, align 4
  %40 = call i1 @nish.isHexPrefix(i8* %s, i32 %39)
  %41 = xor i1 %40, true
  br i1 %41, label %if.then, label %if.end

if.then:
  %42 = call double @nish_parse_number(i8* %s, i32 0)
  ret double %42

if.end:
  %43 = load i32, i32* %q.addr, align 4
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 2)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok

ovf.ok:
  %47 = call i32 @nish.hexEnd(i8* %s, i32 %45)
  store i32 %47, i32* %end.addr, align 4
  %48 = load i32, i32* %end.addr, align 4
  %49 = load i32, i32* %q.addr, align 4
  %50 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %49, i32 2)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %53 = icmp eq i32 %48, %51
  br i1 %53, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %54 = load i32, i32* %q.addr, align 4
  %55 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %54, i32 2)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %58 = load i32, i32* %end.addr, align 4
  %59 = call double @nish.hexValue(i8* %s, i32 %56, i32 %58)
  br label %cond.end.1

cond.end.1:
  %60 = phi double [ 0x0000000000000000, %cond.true.1 ], [ %59, %ovf.ok.2 ]
  store double %60, double* %v.addr, align 8
  %61 = load i1, i1* %negative.addr, align 1
  br i1 %61, label %cond.true.2, label %cond.false.2

cond.true.2:
  %62 = load double, double* %v.addr, align 8
  %63 = fneg double %62
  br label %cond.end.2

cond.false.2:
  %64 = load double, double* %v.addr, align 8
  br label %cond.end.2

cond.end.2:
  %65 = phi double [ %63, %cond.true.2 ], [ %64, %cond.false.2 ]
  ret double %65

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
