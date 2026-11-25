@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare double @llvm.fabs.f64(double) #0

define noundef double @angle(double noundef %y, double noundef %x) #0 {
entry:
  %0 = tail call double @nish.atan2F64(double %y, double %x)
  ret double %0
}

define noundef i32 @nish_main() #1 {
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

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.hiWord(double noundef %x) #0 {
entry:
  %0 = bitcast double %x to i64
  %1 = sext i32 32 to i64
  %2 = and i64 %1, 63
  %3 = ashr i64 %0, %2
  %4 = trunc i64 %3 to i32
  ret i32 %4
}

define internal noundef i32 @nish.loWord(double noundef %x) #0 {
entry:
  %0 = bitcast double %x to i64
  %1 = trunc i64 %0 to i32
  ret i32 %1
}

define internal noundef double @nish.exp2Bits(i64 noundef %biased) #0 {
entry:
  %0 = sext i32 52 to i64
  %1 = and i64 %0, 63
  %2 = shl i64 %biased, %1
  %3 = bitcast i64 %2 to double
  ret double %3
}

define internal noundef double @nish.pow2(i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = sext i32 1023 to i64
  %2 = add nsw i64 %0, %1
  %3 = tail call double @nish.exp2Bits(i64 %2)
  ret double %3
}

define internal noundef zeroext i1 @nish.isNan(double noundef %v) #0 {
entry:
  %0 = fcmp une double %v, %v
  ret i1 %0
}

define internal noundef double @nish.atanhi(i32 noundef %id) #0 {
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

define internal noundef double @nish.atanlo(i32 noundef %id) #0 {
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
  %108 = ashr i32 %107, 1
  store i32 %108, i32* %h1.addr, align 4
  %109 = load i32, i32* %h1.addr, align 4
  %110 = call double @nish.pow2(i32 %109)
  %111 = sext i32 2046 to i64
  %112 = load i32, i32* %ix.addr, align 4
  %113 = ashr i32 %112, 20
  %114 = sext i32 %113 to i64
  %115 = sub nsw i64 %111, %114
  %116 = load i32, i32* %h1.addr, align 4
  %117 = sext i32 %116 to i64
  %118 = sub nsw i64 %115, %117
  %119 = call double @nish.exp2Bits(i64 %118)
  %120 = fmul double %110, %119
  store double %120, double* %s.addr, align 8
  %121 = load double, double* %a.addr, align 8
  %122 = load double, double* %s.addr, align 8
  %123 = fmul double %121, %122
  store double %123, double* %a.addr, align 8
  %124 = load double, double* %b.addr, align 8
  %125 = load double, double* %s.addr, align 8
  %126 = fmul double %124, %125
  store double %126, double* %b.addr, align 8
  br label %if.end.10

if.end.10:
  %127 = load double, double* %a.addr, align 8
  %128 = load double, double* %b.addr, align 8
  %129 = fdiv double %127, %128
  store double %129, double* %q.addr.1, align 8
  %130 = load double, double* %q.addr.1, align 8
  %131 = fmul double %130, 0x41A0000002000000
  store double %131, double* %qs.addr, align 8
  %132 = load double, double* %qs.addr, align 8
  %133 = load double, double* %qs.addr, align 8
  %134 = load double, double* %q.addr.1, align 8
  %135 = fsub double %133, %134
  %136 = fsub double %132, %135
  store double %136, double* %qh.addr, align 8
  %137 = load double, double* %q.addr.1, align 8
  %138 = load double, double* %qh.addr, align 8
  %139 = fsub double %137, %138
  store double %139, double* %ql.addr, align 8
  %140 = load double, double* %b.addr, align 8
  %141 = fmul double %140, 0x41A0000002000000
  store double %141, double* %bs.addr, align 8
  %142 = load double, double* %bs.addr, align 8
  %143 = load double, double* %bs.addr, align 8
  %144 = load double, double* %b.addr, align 8
  %145 = fsub double %143, %144
  %146 = fsub double %142, %145
  store double %146, double* %bh.addr, align 8
  %147 = load double, double* %b.addr, align 8
  %148 = load double, double* %bh.addr, align 8
  %149 = fsub double %147, %148
  store double %149, double* %bl.addr, align 8
  %150 = load double, double* %q.addr.1, align 8
  %151 = load double, double* %b.addr, align 8
  %152 = fmul double %150, %151
  store double %152, double* %p.addr, align 8
  %153 = load double, double* %qh.addr, align 8
  %154 = load double, double* %bh.addr, align 8
  %155 = fmul double %153, %154
  %156 = load double, double* %p.addr, align 8
  %157 = fsub double %155, %156
  %158 = load double, double* %qh.addr, align 8
  %159 = load double, double* %bl.addr, align 8
  %160 = fmul double %158, %159
  %161 = fadd double %157, %160
  %162 = load double, double* %ql.addr, align 8
  %163 = load double, double* %bh.addr, align 8
  %164 = fmul double %162, %163
  %165 = fadd double %161, %164
  %166 = load double, double* %ql.addr, align 8
  %167 = load double, double* %bl.addr, align 8
  %168 = fmul double %166, %167
  %169 = fadd double %165, %168
  store double %169, double* %pe.addr, align 8
  %170 = load double, double* %a.addr, align 8
  %171 = load double, double* %p.addr, align 8
  %172 = fsub double %170, %171
  %173 = load double, double* %pe.addr, align 8
  %174 = fsub double %172, %173
  %175 = load double, double* %b.addr, align 8
  %176 = load double, double* %a.addr, align 8
  %177 = load double, double* %q.addr.1, align 8
  %178 = fmul double %176, %177
  %179 = fadd double %175, %178
  %180 = fdiv double %174, %179
  store double %180, double* %c.addr, align 8
  store double 0x0000000000000000, double* %hi.addr, align 8
  store double 0x0000000000000000, double* %lo.addr, align 8
  %181 = load double, double* %q.addr.1, align 8
  %182 = call i32 @nish.hiWord(double %181)
  store i32 %182, i32* %iq.addr, align 4
  %183 = load i32, i32* %iq.addr, align 4
  %184 = icmp sge i32 %183, 1141899264
  br i1 %184, label %if.then.11, label %if.else

if.then.11:
  %185 = call double @nish.atanhi(i32 3)
  store double %185, double* %hi.addr, align 8
  %186 = call double @nish.atanlo(i32 3)
  store double %186, double* %lo.addr, align 8
  br label %if.end.11

if.else:
  %187 = load i32, i32* %iq.addr, align 4
  %188 = icmp slt i32 %187, 1044381696
  br i1 %188, label %if.then.12, label %if.else.1

if.then.12:
  %189 = load double, double* %q.addr.1, align 8
  store double %189, double* %lo.addr, align 8
  br label %if.end.12

if.else.1:
  %190 = load double, double* %q.addr.1, align 8
  store double %190, double* %t.addr, align 8
  %191 = load double, double* %c.addr, align 8
  store double %191, double* %tl.addr, align 8
  %192 = load i32, i32* %iq.addr, align 4
  %193 = icmp sge i32 %192, 1071382528
  br i1 %193, label %if.then.13, label %if.end.13

if.then.13:
  store i32 3, i32* %id.addr, align 4
  %194 = load i32, i32* %iq.addr, align 4
  %195 = icmp slt i32 %194, 1072889856
  br i1 %195, label %if.then.14, label %if.else.2

if.then.14:
  %196 = load i32, i32* %iq.addr, align 4
  %197 = icmp slt i32 %196, 1072037888
  br i1 %197, label %if.then.15, label %if.else.3

if.then.15:
  store i32 0, i32* %id.addr, align 4
  %198 = load double, double* %q.addr.1, align 8
  %199 = fmul double 0x4000000000000000, %198
  %200 = fsub double %199, 0x3FF0000000000000
  %201 = load double, double* %q.addr.1, align 8
  %202 = fadd double %201, 0x4000000000000000
  %203 = fdiv double %200, %202
  store double %203, double* %t.addr, align 8
  br label %if.end.15

if.else.3:
  store i32 1, i32* %id.addr, align 4
  %204 = load double, double* %q.addr.1, align 8
  %205 = fsub double %204, 0x3FF0000000000000
  %206 = load double, double* %q.addr.1, align 8
  %207 = fadd double %206, 0x3FF0000000000000
  %208 = fdiv double %205, %207
  store double %208, double* %t.addr, align 8
  br label %if.end.15

if.end.15:
  br label %if.end.14

if.else.2:
  %209 = load i32, i32* %iq.addr, align 4
  %210 = icmp slt i32 %209, 1073971200
  br i1 %210, label %if.then.16, label %if.else.4

if.then.16:
  store i32 2, i32* %id.addr, align 4
  %211 = load double, double* %q.addr.1, align 8
  %212 = fsub double %211, 0x3FF8000000000000
  %213 = load double, double* %q.addr.1, align 8
  %214 = fmul double %213, 0x3FF8000000000000
  %215 = fadd double %214, 0x3FF0000000000000
  %216 = fdiv double %212, %215
  store double %216, double* %t.addr, align 8
  br label %if.end.16

if.else.4:
  %217 = fneg double 0x3FF0000000000000
  %218 = load double, double* %q.addr.1, align 8
  %219 = fdiv double %217, %218
  store double %219, double* %t.addr, align 8
  br label %if.end.16

if.end.16:
  br label %if.end.14

if.end.14:
  %220 = load i32, i32* %id.addr, align 4
  %221 = call double @nish.atanhi(i32 %220)
  store double %221, double* %hi.addr, align 8
  %222 = load i32, i32* %id.addr, align 4
  %223 = call double @nish.atanlo(i32 %222)
  %224 = load double, double* %c.addr, align 8
  %225 = fadd double %223, %224
  store double %225, double* %tl.addr, align 8
  br label %if.end.13

if.end.13:
  %226 = load double, double* %t.addr, align 8
  %227 = load double, double* %t.addr, align 8
  %228 = fmul double %226, %227
  store double %228, double* %z.addr, align 8
  %229 = load double, double* %z.addr, align 8
  %230 = load double, double* %z.addr, align 8
  %231 = fmul double %229, %230
  store double %231, double* %w.addr, align 8
  %232 = load double, double* %z.addr, align 8
  %233 = load double, double* %w.addr, align 8
  %234 = fmul double 0x3F90AD3AE322DA11, %233
  %235 = fadd double %234, 0x3FA97B4B24760DEB
  %236 = load double, double* %w.addr, align 8
  %237 = fmul double %235, %236
  %238 = fadd double %237, 0x3FB10D66A0D03D51
  %239 = load double, double* %w.addr, align 8
  %240 = fmul double %238, %239
  %241 = fadd double %240, 0x3FB745CDC54C206E
  %242 = load double, double* %w.addr, align 8
  %243 = fmul double %241, %242
  %244 = fadd double %243, 0x3FC24924920083FF
  %245 = load double, double* %w.addr, align 8
  %246 = fmul double %244, %245
  %247 = fadd double %246, 0x3FD555555555550D
  %248 = fmul double %232, %247
  store double %248, double* %s1.addr, align 8
  %249 = load double, double* %w.addr, align 8
  %250 = fneg double 0x3FA2B4442C6A6C2F
  %251 = load double, double* %w.addr, align 8
  %252 = fmul double %250, %251
  %253 = fsub double %252, 0x3FADDE2D52DEFD9A
  %254 = load double, double* %w.addr, align 8
  %255 = fmul double %253, %254
  %256 = fsub double %255, 0x3FB3B0F2AF749A6D
  %257 = load double, double* %w.addr, align 8
  %258 = fmul double %256, %257
  %259 = fsub double %258, 0x3FBC71C6FE231671
  %260 = load double, double* %w.addr, align 8
  %261 = fmul double %259, %260
  %262 = fsub double %261, 0x3FC999999998EBC4
  %263 = fmul double %249, %262
  store double %263, double* %s2.addr, align 8
  %264 = load double, double* %t.addr, align 8
  %265 = load double, double* %t.addr, align 8
  %266 = load double, double* %s1.addr, align 8
  %267 = load double, double* %s2.addr, align 8
  %268 = fadd double %266, %267
  %269 = fmul double %265, %268
  %270 = load double, double* %tl.addr, align 8
  %271 = fsub double %269, %270
  %272 = fsub double %264, %271
  store double %272, double* %lo.addr, align 8
  br label %if.end.12

if.end.12:
  br label %if.end.11

if.end.11:
  store double 0x0000000000000000, double* %r.addr.1, align 8
  %273 = load i32, i32* %hx.addr, align 4
  %274 = icmp sge i32 %273, 0
  br i1 %274, label %if.then.17, label %if.else.5

if.then.17:
  %275 = load double, double* %hi.addr, align 8
  %276 = load double, double* %lo.addr, align 8
  %277 = fadd double %275, %276
  store double %277, double* %r.addr.1, align 8
  br label %if.end.17

if.else.5:
  %278 = load double, double* %pi.addr, align 8
  %279 = load double, double* %hi.addr, align 8
  %280 = fsub double %278, %279
  store double %280, double* %s.addr.1, align 8
  %281 = load double, double* %s.addr.1, align 8
  %282 = load double, double* %piLo.addr, align 8
  %283 = load double, double* %lo.addr, align 8
  %284 = fsub double %282, %283
  %285 = load double, double* %pi.addr, align 8
  %286 = load double, double* %s.addr.1, align 8
  %287 = fsub double %285, %286
  %288 = load double, double* %hi.addr, align 8
  %289 = fsub double %287, %288
  %290 = fadd double %284, %289
  %291 = fadd double %281, %290
  store double %291, double* %r.addr.1, align 8
  br label %if.end.17

if.end.17:
  %292 = load i32, i32* %hy.addr, align 4
  %293 = icmp slt i32 %292, 0
  br i1 %293, label %cond.true.5, label %cond.false.5

cond.true.5:
  %294 = load double, double* %r.addr.1, align 8
  %295 = fneg double %294
  br label %cond.end.5

cond.false.5:
  %296 = load double, double* %r.addr.1, align 8
  br label %cond.end.5

cond.end.5:
  %297 = phi double [ %295, %cond.true.5 ], [ %296, %cond.false.5 ]
  ret double %297
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
