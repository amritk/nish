@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare double @llvm.fabs.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1

define noundef double @angle(double noundef %y, double noundef %x) #0 {
entry:
  %0 = tail call double @nish.atan2F64(double %y, double %x)
  ret double %0
}

define noundef i32 @nish_main() #0 {
entry:
  %one.addr = alloca double, align 8
  %zero.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x3FF0000000000000, double* %one.addr, align 8
  store double 0x0000000000000000, double* %zero.addr, align 8
  %0 = load double, double* %one.addr, align 8
  %1 = load double, double* %one.addr, align 8
  %2 = call double @angle(double %0, double %1)
  %3 = call i8* @nish_str_from_f64(double %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %5 = load double, double* %one.addr, align 8
  %6 = load double, double* %zero.addr, align 8
  %7 = call double @angle(double %5, double %6)
  %8 = call i8* @nish_str_from_f64(double %7)
  %9 = call i8* @nish_str_concat(i8* %4, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %11 = load double, double* %zero.addr, align 8
  %12 = load double, double* %one.addr, align 8
  %13 = fneg double %12
  %14 = call double @angle(double %11, double %13)
  %15 = call i8* @nish_str_from_f64(double %14)
  %16 = call i8* @nish_str_concat(i8* %10, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = load double, double* %zero.addr, align 8
  %19 = fneg double %18
  %20 = load double, double* %one.addr, align 8
  %21 = fneg double %20
  %22 = call double @angle(double %19, double %21)
  %23 = call i8* @nish_str_from_f64(double %22)
  %24 = call i8* @nish_str_concat(i8* %17, i8* %23)
  call void @nish_print(i8* %24)
  %25 = load double, double* %one.addr, align 8
  %26 = load double, double* %zero.addr, align 8
  %27 = fneg double %26
  %28 = load double, double* %one.addr, align 8
  %29 = call double @angle(double %27, double %28)
  %30 = fdiv double %25, %29
  %31 = call i8* @nish_str_from_f64(double %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load double, double* %zero.addr, align 8
  %34 = load double, double* %zero.addr, align 8
  %35 = call double @angle(double %33, double %34)
  %36 = call i8* @nish_str_from_f64(double %35)
  %37 = call i8* @nish_str_concat(i8* %32, i8* %36)
  call void @nish_print(i8* %37)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.hiWord(double noundef %x) #1 {
entry:
  %0 = bitcast double %x to i64
  %1 = sext i32 32 to i64
  %2 = and i64 %1, 63
  %3 = ashr i64 %0, %2
  %4 = trunc i64 %3 to i32
  ret i32 %4
}

define internal noundef i32 @nish.loWord(double noundef %x) #1 {
entry:
  %0 = bitcast double %x to i64
  %1 = trunc i64 %0 to i32
  ret i32 %1
}

define internal noundef double @nish.pow2(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1023)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = sext i32 %1 to i64
  %4 = sext i32 52 to i64
  %5 = and i64 %4, 63
  %6 = shl i64 %3, %5
  %7 = bitcast i64 %6 to double
  ret double %7

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef zeroext i1 @nish.isNan(double noundef %v) #1 {
entry:
  %0 = fcmp une double %v, %v
  ret i1 %0
}

define internal noundef double @nish.atanhi(i32 noundef %id) #1 {
entry:
  switch i32 %id, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  ret double 0x3FDDAC670561BB4F

sw.case.1:
  ret double 0x3FE921FB54442D18

sw.case.2:
  ret double 0x3FEF730BD281F69B

sw.default:
  ret double 0x3FF921FB54442D18
}

define internal noundef double @nish.atanlo(i32 noundef %id) #1 {
entry:
  switch i32 %id, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  ret double 0x3C7A2B7F222F65E2

sw.case.1:
  ret double 0x3C81A62633145C07

sw.case.2:
  ret double 0x3C7007887AF0CBBD

sw.default:
  ret double 0x3C91A62633145C07
}

define internal noundef double @nish.atan2F64(double noundef %y, double noundef %x) #0 {
entry:
  %piO4.addr = alloca double, align 8
  %piO2.addr = alloca double, align 8
  %pi.addr = alloca double, align 8
  %piLo.addr = alloca double, align 8
  %hx.addr = alloca i32, align 4
  %lx.addr = alloca i32, align 4
  %ix.addr = alloca i32, align 4
  %hy.addr = alloca i32, align 4
  %ly.addr = alloca i32, align 4
  %iy.addr = alloca i32, align 4
  %m.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %r.addr = alloca double, align 8
  %q.addr = alloca double, align 8
  %a.addr = alloca double, align 8
  %b.addr = alloca double, align 8
  %h.addr = alloca i32, align 4
  %h1.addr = alloca i32, align 4
  %s.addr = alloca double, align 8
  %q.addr.1 = alloca double, align 8
  %qs.addr = alloca double, align 8
  %qh.addr = alloca double, align 8
  %ql.addr = alloca double, align 8
  %bs.addr = alloca double, align 8
  %bh.addr = alloca double, align 8
  %bl.addr = alloca double, align 8
  %p.addr = alloca double, align 8
  %pe.addr = alloca double, align 8
  %c.addr = alloca double, align 8
  %hi.addr = alloca double, align 8
  %lo.addr = alloca double, align 8
  %iq.addr = alloca i32, align 4
  %t.addr = alloca double, align 8
  %tl.addr = alloca double, align 8
  %id.addr = alloca i32, align 4
  %z.addr = alloca double, align 8
  %w.addr = alloca double, align 8
  %s1.addr = alloca double, align 8
  %s2.addr = alloca double, align 8
  %r.addr.1 = alloca double, align 8
  %s.addr.1 = alloca double, align 8
  store double 0x3FE921FB54442D18, double* %piO4.addr, align 8
  store double 0x3FF921FB54442D18, double* %piO2.addr, align 8
  store double 0x400921FB54442D18, double* %pi.addr, align 8
  store double 0x3CA1A62633145C07, double* %piLo.addr, align 8
  %0 = call i1 @nish.isNan(double %x)
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = call i1 @nish.isNan(double %y)
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = fadd double %x, %y
  ret double %3

if.end:
  %4 = call i32 @nish.hiWord(double %x)
  store i32 %4, i32* %hx.addr, align 4
  %5 = call i32 @nish.loWord(double %x)
  store i32 %5, i32* %lx.addr, align 4
  %6 = load i32, i32* %hx.addr, align 4
  %7 = and i32 %6, 2147483647
  store i32 %7, i32* %ix.addr, align 4
  %8 = call i32 @nish.hiWord(double %y)
  store i32 %8, i32* %hy.addr, align 4
  %9 = call i32 @nish.loWord(double %y)
  store i32 %9, i32* %ly.addr, align 4
  %10 = load i32, i32* %hy.addr, align 4
  %11 = and i32 %10, 2147483647
  store i32 %11, i32* %iy.addr, align 4
  %12 = load i32, i32* %hy.addr, align 4
  %13 = ashr i32 %12, 31
  %14 = and i32 %13, 1
  %15 = load i32, i32* %hx.addr, align 4
  %16 = ashr i32 %15, 30
  %17 = and i32 %16, 2
  %18 = or i32 %14, %17
  store i32 %18, i32* %m.addr, align 4
  %19 = load i32, i32* %iy.addr, align 4
  %20 = icmp eq i32 %19, 0
  br i1 %20, label %land.rhs, label %land.end

land.rhs:
  %21 = load i32, i32* %ly.addr, align 4
  %22 = icmp eq i32 %21, 0
  br label %land.end

land.end:
  %23 = phi i1 [ false, %if.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  %24 = load i32, i32* %m.addr, align 4
  %25 = icmp slt i32 %24, 2
  br i1 %25, label %if.then.2, label %if.end.2

if.then.2:
  ret double %y

if.end.2:
  %26 = load i32, i32* %m.addr, align 4
  %27 = icmp eq i32 %26, 2
  br i1 %27, label %cond.true, label %cond.false

cond.true:
  %28 = load double, double* %pi.addr, align 8
  br label %cond.end

cond.false:
  %29 = load double, double* %pi.addr, align 8
  %30 = fneg double %29
  br label %cond.end

cond.end:
  %31 = phi double [ %28, %cond.true ], [ %30, %cond.false ]
  ret double %31

if.end.1:
  %32 = load i32, i32* %ix.addr, align 4
  %33 = icmp eq i32 %32, 0
  br i1 %33, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %34 = load i32, i32* %lx.addr, align 4
  %35 = icmp eq i32 %34, 0
  br label %land.end.1

land.end.1:
  %36 = phi i1 [ false, %if.end.1 ], [ %35, %land.rhs.1 ]
  br i1 %36, label %if.then.3, label %if.end.3

if.then.3:
  %37 = load i32, i32* %hy.addr, align 4
  %38 = icmp slt i32 %37, 0
  br i1 %38, label %cond.true.1, label %cond.false.1

cond.true.1:
  %39 = load double, double* %piO2.addr, align 8
  %40 = fneg double %39
  br label %cond.end.1

cond.false.1:
  %41 = load double, double* %piO2.addr, align 8
  br label %cond.end.1

cond.end.1:
  %42 = phi double [ %40, %cond.true.1 ], [ %41, %cond.false.1 ]
  ret double %42

if.end.3:
  %43 = load i32, i32* %ix.addr, align 4
  %44 = icmp eq i32 %43, 2146435072
  br i1 %44, label %if.then.4, label %if.end.4

if.then.4:
  %45 = load i32, i32* %iy.addr, align 4
  %46 = icmp eq i32 %45, 2146435072
  br i1 %46, label %if.then.5, label %if.end.5

if.then.5:
  %47 = load i32, i32* %m.addr, align 4
  switch i32 %47, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  %48 = load double, double* %piO4.addr, align 8
  ret double %48

sw.case.1:
  %49 = load double, double* %piO4.addr, align 8
  %50 = fneg double %49
  ret double %50

sw.case.2:
  %51 = load double, double* %piO4.addr, align 8
  %52 = fmul double 0x4008000000000000, %51
  ret double %52

sw.default:
  %53 = fneg double 0x4008000000000000
  %54 = load double, double* %piO4.addr, align 8
  %55 = fmul double %53, %54
  ret double %55

if.end.5:
  %56 = load i32, i32* %m.addr, align 4
  switch i32 %56, label %sw.default.1 [
    i32 0, label %sw.case.3
    i32 1, label %sw.case.4
    i32 2, label %sw.case.5
  ]

sw.case.3:
  ret double 0x0000000000000000

sw.case.4:
  %57 = fneg double 0x0000000000000000
  ret double %57

sw.case.5:
  %58 = load double, double* %pi.addr, align 8
  ret double %58

sw.default.1:
  %59 = load double, double* %pi.addr, align 8
  %60 = fneg double %59
  ret double %60

if.end.4:
  %61 = load i32, i32* %iy.addr, align 4
  %62 = icmp eq i32 %61, 2146435072
  br i1 %62, label %if.then.6, label %if.end.6

if.then.6:
  %63 = load i32, i32* %hy.addr, align 4
  %64 = icmp slt i32 %63, 0
  br i1 %64, label %cond.true.2, label %cond.false.2

cond.true.2:
  %65 = load double, double* %piO2.addr, align 8
  %66 = fneg double %65
  br label %cond.end.2

cond.false.2:
  %67 = load double, double* %piO2.addr, align 8
  br label %cond.end.2

cond.end.2:
  %68 = phi double [ %66, %cond.true.2 ], [ %67, %cond.false.2 ]
  ret double %68

if.end.6:
  %69 = load i32, i32* %iy.addr, align 4
  %70 = load i32, i32* %ix.addr, align 4
  %71 = sub nsw i32 %69, %70
  %72 = ashr i32 %71, 20
  store i32 %72, i32* %k.addr, align 4
  %73 = load i32, i32* %k.addr, align 4
  %74 = icmp sgt i32 %73, 60
  br i1 %74, label %if.then.7, label %if.end.7

if.then.7:
  %75 = load double, double* %piO2.addr, align 8
  %76 = load double, double* %piLo.addr, align 8
  %77 = fmul double 0x3FE0000000000000, %76
  %78 = fadd double %75, %77
  store double %78, double* %r.addr, align 8
  %79 = load i32, i32* %hy.addr, align 4
  %80 = icmp slt i32 %79, 0
  br i1 %80, label %cond.true.3, label %cond.false.3

cond.true.3:
  %81 = load double, double* %r.addr, align 8
  %82 = fneg double %81
  br label %cond.end.3

cond.false.3:
  %83 = load double, double* %r.addr, align 8
  br label %cond.end.3

cond.end.3:
  %84 = phi double [ %82, %cond.true.3 ], [ %83, %cond.false.3 ]
  ret double %84

if.end.7:
  %85 = load i32, i32* %k.addr, align 4
  %86 = icmp slt i32 %85, -60
  br i1 %86, label %if.then.8, label %if.end.8

if.then.8:
  %87 = load i32, i32* %hx.addr, align 4
  %88 = icmp slt i32 %87, 0
  br i1 %88, label %if.then.9, label %if.end.9

if.then.9:
  %89 = load i32, i32* %hy.addr, align 4
  %90 = icmp slt i32 %89, 0
  br i1 %90, label %cond.true.4, label %cond.false.4

cond.true.4:
  %91 = load double, double* %pi.addr, align 8
  %92 = fneg double %91
  br label %cond.end.4

cond.false.4:
  %93 = load double, double* %pi.addr, align 8
  br label %cond.end.4

cond.end.4:
  %94 = phi double [ %92, %cond.true.4 ], [ %93, %cond.false.4 ]
  ret double %94

if.end.9:
  %95 = fdiv double %y, %x
  store double %95, double* %q.addr, align 8
  %96 = load double, double* %q.addr, align 8
  ret double %96

if.end.8:
  %97 = call double @llvm.fabs.f64(double %y)
  store double %97, double* %a.addr, align 8
  %98 = call double @llvm.fabs.f64(double %x)
  store double %98, double* %b.addr, align 8
  %99 = load i32, i32* %ix.addr, align 4
  %100 = icmp slt i32 %99, 600834048
  br i1 %100, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %101 = load i32, i32* %ix.addr, align 4
  %102 = icmp sgt i32 %101, 1544552448
  br label %lor.end.1

lor.end.1:
  %103 = phi i1 [ true, %if.end.8 ], [ %102, %lor.rhs.1 ]
  br i1 %103, label %if.then.10, label %if.end.10

if.then.10:
  %104 = load i32, i32* %ix.addr, align 4
  %105 = ashr i32 %104, 20
  %106 = sub nsw i32 %105, 1023
  %107 = sub nsw i32 0, %106
  store i32 %107, i32* %h.addr, align 4
  %108 = load i32, i32* %h.addr, align 4
  %109 = ashr i32 %108, 1
  store i32 %109, i32* %h1.addr, align 4
  %110 = load i32, i32* %h1.addr, align 4
  %111 = call double @nish.pow2(i32 %110)
  %112 = load i32, i32* %h.addr, align 4
  %113 = load i32, i32* %h1.addr, align 4
  %114 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %112, i32 %113)
  %115 = extractvalue { i32, i1 } %114, 0
  %116 = extractvalue { i32, i1 } %114, 1
  br i1 %116, label %ovf.fail, label %ovf.ok

ovf.ok:
  %117 = call double @nish.pow2(i32 %115)
  %118 = fmul double %111, %117
  store double %118, double* %s.addr, align 8
  %119 = load double, double* %a.addr, align 8
  %120 = load double, double* %s.addr, align 8
  %121 = fmul double %119, %120
  store double %121, double* %a.addr, align 8
  %122 = load double, double* %b.addr, align 8
  %123 = load double, double* %s.addr, align 8
  %124 = fmul double %122, %123
  store double %124, double* %b.addr, align 8
  br label %if.end.10

if.end.10:
  %125 = load double, double* %a.addr, align 8
  %126 = load double, double* %b.addr, align 8
  %127 = fdiv double %125, %126
  store double %127, double* %q.addr.1, align 8
  %128 = load double, double* %q.addr.1, align 8
  %129 = fmul double %128, 0x41A0000002000000
  store double %129, double* %qs.addr, align 8
  %130 = load double, double* %qs.addr, align 8
  %131 = load double, double* %qs.addr, align 8
  %132 = load double, double* %q.addr.1, align 8
  %133 = fsub double %131, %132
  %134 = fsub double %130, %133
  store double %134, double* %qh.addr, align 8
  %135 = load double, double* %q.addr.1, align 8
  %136 = load double, double* %qh.addr, align 8
  %137 = fsub double %135, %136
  store double %137, double* %ql.addr, align 8
  %138 = load double, double* %b.addr, align 8
  %139 = fmul double %138, 0x41A0000002000000
  store double %139, double* %bs.addr, align 8
  %140 = load double, double* %bs.addr, align 8
  %141 = load double, double* %bs.addr, align 8
  %142 = load double, double* %b.addr, align 8
  %143 = fsub double %141, %142
  %144 = fsub double %140, %143
  store double %144, double* %bh.addr, align 8
  %145 = load double, double* %b.addr, align 8
  %146 = load double, double* %bh.addr, align 8
  %147 = fsub double %145, %146
  store double %147, double* %bl.addr, align 8
  %148 = load double, double* %q.addr.1, align 8
  %149 = load double, double* %b.addr, align 8
  %150 = fmul double %148, %149
  store double %150, double* %p.addr, align 8
  %151 = load double, double* %qh.addr, align 8
  %152 = load double, double* %bh.addr, align 8
  %153 = fmul double %151, %152
  %154 = load double, double* %p.addr, align 8
  %155 = fsub double %153, %154
  %156 = load double, double* %qh.addr, align 8
  %157 = load double, double* %bl.addr, align 8
  %158 = fmul double %156, %157
  %159 = fadd double %155, %158
  %160 = load double, double* %ql.addr, align 8
  %161 = load double, double* %bh.addr, align 8
  %162 = fmul double %160, %161
  %163 = fadd double %159, %162
  %164 = load double, double* %ql.addr, align 8
  %165 = load double, double* %bl.addr, align 8
  %166 = fmul double %164, %165
  %167 = fadd double %163, %166
  store double %167, double* %pe.addr, align 8
  %168 = load double, double* %a.addr, align 8
  %169 = load double, double* %p.addr, align 8
  %170 = fsub double %168, %169
  %171 = load double, double* %pe.addr, align 8
  %172 = fsub double %170, %171
  %173 = load double, double* %b.addr, align 8
  %174 = load double, double* %a.addr, align 8
  %175 = load double, double* %q.addr.1, align 8
  %176 = fmul double %174, %175
  %177 = fadd double %173, %176
  %178 = fdiv double %172, %177
  store double %178, double* %c.addr, align 8
  store double 0x0000000000000000, double* %hi.addr, align 8
  store double 0x0000000000000000, double* %lo.addr, align 8
  %179 = load double, double* %q.addr.1, align 8
  %180 = call i32 @nish.hiWord(double %179)
  store i32 %180, i32* %iq.addr, align 4
  %181 = load i32, i32* %iq.addr, align 4
  %182 = icmp sge i32 %181, 1141899264
  br i1 %182, label %if.then.11, label %if.else

if.then.11:
  %183 = call double @nish.atanhi(i32 3)
  store double %183, double* %hi.addr, align 8
  %184 = call double @nish.atanlo(i32 3)
  store double %184, double* %lo.addr, align 8
  br label %if.end.11

if.else:
  %185 = load i32, i32* %iq.addr, align 4
  %186 = icmp slt i32 %185, 1044381696
  br i1 %186, label %if.then.12, label %if.else.1

if.then.12:
  %187 = load double, double* %q.addr.1, align 8
  store double %187, double* %lo.addr, align 8
  br label %if.end.12

if.else.1:
  %188 = load double, double* %q.addr.1, align 8
  store double %188, double* %t.addr, align 8
  %189 = load double, double* %c.addr, align 8
  store double %189, double* %tl.addr, align 8
  %190 = load i32, i32* %iq.addr, align 4
  %191 = icmp sge i32 %190, 1071382528
  br i1 %191, label %if.then.13, label %if.end.13

if.then.13:
  store i32 3, i32* %id.addr, align 4
  %192 = load i32, i32* %iq.addr, align 4
  %193 = icmp slt i32 %192, 1072889856
  br i1 %193, label %if.then.14, label %if.else.2

if.then.14:
  %194 = load i32, i32* %iq.addr, align 4
  %195 = icmp slt i32 %194, 1072037888
  br i1 %195, label %if.then.15, label %if.else.3

if.then.15:
  store i32 0, i32* %id.addr, align 4
  %196 = load double, double* %q.addr.1, align 8
  %197 = fmul double 0x4000000000000000, %196
  %198 = fsub double %197, 0x3FF0000000000000
  %199 = load double, double* %q.addr.1, align 8
  %200 = fadd double %199, 0x4000000000000000
  %201 = fdiv double %198, %200
  store double %201, double* %t.addr, align 8
  br label %if.end.15

if.else.3:
  store i32 1, i32* %id.addr, align 4
  %202 = load double, double* %q.addr.1, align 8
  %203 = fsub double %202, 0x3FF0000000000000
  %204 = load double, double* %q.addr.1, align 8
  %205 = fadd double %204, 0x3FF0000000000000
  %206 = fdiv double %203, %205
  store double %206, double* %t.addr, align 8
  br label %if.end.15

if.end.15:
  br label %if.end.14

if.else.2:
  %207 = load i32, i32* %iq.addr, align 4
  %208 = icmp slt i32 %207, 1073971200
  br i1 %208, label %if.then.16, label %if.else.4

if.then.16:
  store i32 2, i32* %id.addr, align 4
  %209 = load double, double* %q.addr.1, align 8
  %210 = fsub double %209, 0x3FF8000000000000
  %211 = load double, double* %q.addr.1, align 8
  %212 = fmul double %211, 0x3FF8000000000000
  %213 = fadd double %212, 0x3FF0000000000000
  %214 = fdiv double %210, %213
  store double %214, double* %t.addr, align 8
  br label %if.end.16

if.else.4:
  %215 = fneg double 0x3FF0000000000000
  %216 = load double, double* %q.addr.1, align 8
  %217 = fdiv double %215, %216
  store double %217, double* %t.addr, align 8
  br label %if.end.16

if.end.16:
  br label %if.end.14

if.end.14:
  %218 = load i32, i32* %id.addr, align 4
  %219 = call double @nish.atanhi(i32 %218)
  store double %219, double* %hi.addr, align 8
  %220 = load i32, i32* %id.addr, align 4
  %221 = call double @nish.atanlo(i32 %220)
  %222 = load double, double* %c.addr, align 8
  %223 = fadd double %221, %222
  store double %223, double* %tl.addr, align 8
  br label %if.end.13

if.end.13:
  %224 = load double, double* %t.addr, align 8
  %225 = load double, double* %t.addr, align 8
  %226 = fmul double %224, %225
  store double %226, double* %z.addr, align 8
  %227 = load double, double* %z.addr, align 8
  %228 = load double, double* %z.addr, align 8
  %229 = fmul double %227, %228
  store double %229, double* %w.addr, align 8
  %230 = load double, double* %z.addr, align 8
  %231 = load double, double* %w.addr, align 8
  %232 = fmul double 0x3F90AD3AE322DA11, %231
  %233 = fadd double %232, 0x3FA97B4B24760DEB
  %234 = load double, double* %w.addr, align 8
  %235 = fmul double %233, %234
  %236 = fadd double %235, 0x3FB10D66A0D03D51
  %237 = load double, double* %w.addr, align 8
  %238 = fmul double %236, %237
  %239 = fadd double %238, 0x3FB745CDC54C206E
  %240 = load double, double* %w.addr, align 8
  %241 = fmul double %239, %240
  %242 = fadd double %241, 0x3FC24924920083FF
  %243 = load double, double* %w.addr, align 8
  %244 = fmul double %242, %243
  %245 = fadd double %244, 0x3FD555555555550D
  %246 = fmul double %230, %245
  store double %246, double* %s1.addr, align 8
  %247 = load double, double* %w.addr, align 8
  %248 = fneg double 0x3FA2B4442C6A6C2F
  %249 = load double, double* %w.addr, align 8
  %250 = fmul double %248, %249
  %251 = fsub double %250, 0x3FADDE2D52DEFD9A
  %252 = load double, double* %w.addr, align 8
  %253 = fmul double %251, %252
  %254 = fsub double %253, 0x3FB3B0F2AF749A6D
  %255 = load double, double* %w.addr, align 8
  %256 = fmul double %254, %255
  %257 = fsub double %256, 0x3FBC71C6FE231671
  %258 = load double, double* %w.addr, align 8
  %259 = fmul double %257, %258
  %260 = fsub double %259, 0x3FC999999998EBC4
  %261 = fmul double %247, %260
  store double %261, double* %s2.addr, align 8
  %262 = load double, double* %t.addr, align 8
  %263 = load double, double* %t.addr, align 8
  %264 = load double, double* %s1.addr, align 8
  %265 = load double, double* %s2.addr, align 8
  %266 = fadd double %264, %265
  %267 = fmul double %263, %266
  %268 = load double, double* %tl.addr, align 8
  %269 = fsub double %267, %268
  %270 = fsub double %262, %269
  store double %270, double* %lo.addr, align 8
  br label %if.end.12

if.end.12:
  br label %if.end.11

if.end.11:
  store double 0x0000000000000000, double* %r.addr.1, align 8
  %271 = load i32, i32* %hx.addr, align 4
  %272 = icmp sge i32 %271, 0
  br i1 %272, label %if.then.17, label %if.else.5

if.then.17:
  %273 = load double, double* %hi.addr, align 8
  %274 = load double, double* %lo.addr, align 8
  %275 = fadd double %273, %274
  store double %275, double* %r.addr.1, align 8
  br label %if.end.17

if.else.5:
  %276 = load double, double* %pi.addr, align 8
  %277 = load double, double* %hi.addr, align 8
  %278 = fsub double %276, %277
  store double %278, double* %s.addr.1, align 8
  %279 = load double, double* %s.addr.1, align 8
  %280 = load double, double* %piLo.addr, align 8
  %281 = load double, double* %lo.addr, align 8
  %282 = fsub double %280, %281
  %283 = load double, double* %pi.addr, align 8
  %284 = load double, double* %s.addr.1, align 8
  %285 = fsub double %283, %284
  %286 = load double, double* %hi.addr, align 8
  %287 = fsub double %285, %286
  %288 = fadd double %282, %287
  %289 = fadd double %279, %288
  store double %289, double* %r.addr.1, align 8
  br label %if.end.17

if.end.17:
  %290 = load i32, i32* %hy.addr, align 4
  %291 = icmp slt i32 %290, 0
  br i1 %291, label %cond.true.5, label %cond.false.5

cond.true.5:
  %292 = load double, double* %r.addr.1, align 8
  %293 = fneg double %292
  br label %cond.end.5

cond.false.5:
  %294 = load double, double* %r.addr.1, align 8
  br label %cond.end.5

cond.end.5:
  %295 = phi double [ %293, %cond.true.5 ], [ %294, %cond.false.5 ]
  ret double %295

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
