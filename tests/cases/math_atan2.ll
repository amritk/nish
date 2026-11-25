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
  %109 = call double @nish.pow2(i32 %108)
  %110 = load i32, i32* %ix.addr, align 4
  %111 = ashr i32 %110, 20
  %112 = sub nsw i32 %111, 1024
  %113 = sub nsw i32 0, %112
  %114 = ashr i32 %113, 1
  %115 = call double @nish.pow2(i32 %114)
  %116 = fmul double %109, %115
  store double %116, double* %s.addr, align 8
  %117 = load double, double* %a.addr, align 8
  %118 = load double, double* %s.addr, align 8
  %119 = fmul double %117, %118
  store double %119, double* %a.addr, align 8
  %120 = load double, double* %b.addr, align 8
  %121 = load double, double* %s.addr, align 8
  %122 = fmul double %120, %121
  store double %122, double* %b.addr, align 8
  br label %if.end.10

if.end.10:
  %123 = load double, double* %a.addr, align 8
  %124 = load double, double* %b.addr, align 8
  %125 = fdiv double %123, %124
  store double %125, double* %q.addr.1, align 8
  %126 = load double, double* %q.addr.1, align 8
  %127 = fmul double %126, 0x41A0000002000000
  store double %127, double* %qs.addr, align 8
  %128 = load double, double* %qs.addr, align 8
  %129 = load double, double* %qs.addr, align 8
  %130 = load double, double* %q.addr.1, align 8
  %131 = fsub double %129, %130
  %132 = fsub double %128, %131
  store double %132, double* %qh.addr, align 8
  %133 = load double, double* %q.addr.1, align 8
  %134 = load double, double* %qh.addr, align 8
  %135 = fsub double %133, %134
  store double %135, double* %ql.addr, align 8
  %136 = load double, double* %b.addr, align 8
  %137 = fmul double %136, 0x41A0000002000000
  store double %137, double* %bs.addr, align 8
  %138 = load double, double* %bs.addr, align 8
  %139 = load double, double* %bs.addr, align 8
  %140 = load double, double* %b.addr, align 8
  %141 = fsub double %139, %140
  %142 = fsub double %138, %141
  store double %142, double* %bh.addr, align 8
  %143 = load double, double* %b.addr, align 8
  %144 = load double, double* %bh.addr, align 8
  %145 = fsub double %143, %144
  store double %145, double* %bl.addr, align 8
  %146 = load double, double* %q.addr.1, align 8
  %147 = load double, double* %b.addr, align 8
  %148 = fmul double %146, %147
  store double %148, double* %p.addr, align 8
  %149 = load double, double* %qh.addr, align 8
  %150 = load double, double* %bh.addr, align 8
  %151 = fmul double %149, %150
  %152 = load double, double* %p.addr, align 8
  %153 = fsub double %151, %152
  %154 = load double, double* %qh.addr, align 8
  %155 = load double, double* %bl.addr, align 8
  %156 = fmul double %154, %155
  %157 = fadd double %153, %156
  %158 = load double, double* %ql.addr, align 8
  %159 = load double, double* %bh.addr, align 8
  %160 = fmul double %158, %159
  %161 = fadd double %157, %160
  %162 = load double, double* %ql.addr, align 8
  %163 = load double, double* %bl.addr, align 8
  %164 = fmul double %162, %163
  %165 = fadd double %161, %164
  store double %165, double* %pe.addr, align 8
  %166 = load double, double* %a.addr, align 8
  %167 = load double, double* %p.addr, align 8
  %168 = fsub double %166, %167
  %169 = load double, double* %pe.addr, align 8
  %170 = fsub double %168, %169
  %171 = load double, double* %b.addr, align 8
  %172 = load double, double* %a.addr, align 8
  %173 = load double, double* %q.addr.1, align 8
  %174 = fmul double %172, %173
  %175 = fadd double %171, %174
  %176 = fdiv double %170, %175
  store double %176, double* %c.addr, align 8
  store double 0x0000000000000000, double* %hi.addr, align 8
  store double 0x0000000000000000, double* %lo.addr, align 8
  %177 = load double, double* %q.addr.1, align 8
  %178 = call i32 @nish.hiWord(double %177)
  store i32 %178, i32* %iq.addr, align 4
  %179 = load i32, i32* %iq.addr, align 4
  %180 = icmp sge i32 %179, 1141899264
  br i1 %180, label %if.then.11, label %if.else

if.then.11:
  %181 = call double @nish.atanhi(i32 3)
  store double %181, double* %hi.addr, align 8
  %182 = call double @nish.atanlo(i32 3)
  store double %182, double* %lo.addr, align 8
  br label %if.end.11

if.else:
  %183 = load i32, i32* %iq.addr, align 4
  %184 = icmp slt i32 %183, 1044381696
  br i1 %184, label %if.then.12, label %if.else.1

if.then.12:
  %185 = load double, double* %q.addr.1, align 8
  store double %185, double* %lo.addr, align 8
  br label %if.end.12

if.else.1:
  %186 = load double, double* %q.addr.1, align 8
  store double %186, double* %t.addr, align 8
  %187 = load double, double* %c.addr, align 8
  store double %187, double* %tl.addr, align 8
  %188 = load i32, i32* %iq.addr, align 4
  %189 = icmp sge i32 %188, 1071382528
  br i1 %189, label %if.then.13, label %if.end.13

if.then.13:
  store i32 3, i32* %id.addr, align 4
  %190 = load i32, i32* %iq.addr, align 4
  %191 = icmp slt i32 %190, 1072889856
  br i1 %191, label %if.then.14, label %if.else.2

if.then.14:
  %192 = load i32, i32* %iq.addr, align 4
  %193 = icmp slt i32 %192, 1072037888
  br i1 %193, label %if.then.15, label %if.else.3

if.then.15:
  store i32 0, i32* %id.addr, align 4
  %194 = load double, double* %q.addr.1, align 8
  %195 = fmul double 0x4000000000000000, %194
  %196 = fsub double %195, 0x3FF0000000000000
  %197 = load double, double* %q.addr.1, align 8
  %198 = fadd double %197, 0x4000000000000000
  %199 = fdiv double %196, %198
  store double %199, double* %t.addr, align 8
  br label %if.end.15

if.else.3:
  store i32 1, i32* %id.addr, align 4
  %200 = load double, double* %q.addr.1, align 8
  %201 = fsub double %200, 0x3FF0000000000000
  %202 = load double, double* %q.addr.1, align 8
  %203 = fadd double %202, 0x3FF0000000000000
  %204 = fdiv double %201, %203
  store double %204, double* %t.addr, align 8
  br label %if.end.15

if.end.15:
  br label %if.end.14

if.else.2:
  %205 = load i32, i32* %iq.addr, align 4
  %206 = icmp slt i32 %205, 1073971200
  br i1 %206, label %if.then.16, label %if.else.4

if.then.16:
  store i32 2, i32* %id.addr, align 4
  %207 = load double, double* %q.addr.1, align 8
  %208 = fsub double %207, 0x3FF8000000000000
  %209 = load double, double* %q.addr.1, align 8
  %210 = fmul double %209, 0x3FF8000000000000
  %211 = fadd double %210, 0x3FF0000000000000
  %212 = fdiv double %208, %211
  store double %212, double* %t.addr, align 8
  br label %if.end.16

if.else.4:
  %213 = fneg double 0x3FF0000000000000
  %214 = load double, double* %q.addr.1, align 8
  %215 = fdiv double %213, %214
  store double %215, double* %t.addr, align 8
  br label %if.end.16

if.end.16:
  br label %if.end.14

if.end.14:
  %216 = load i32, i32* %id.addr, align 4
  %217 = call double @nish.atanhi(i32 %216)
  store double %217, double* %hi.addr, align 8
  %218 = load i32, i32* %id.addr, align 4
  %219 = call double @nish.atanlo(i32 %218)
  %220 = load double, double* %c.addr, align 8
  %221 = fadd double %219, %220
  store double %221, double* %tl.addr, align 8
  br label %if.end.13

if.end.13:
  %222 = load double, double* %t.addr, align 8
  %223 = load double, double* %t.addr, align 8
  %224 = fmul double %222, %223
  store double %224, double* %z.addr, align 8
  %225 = load double, double* %z.addr, align 8
  %226 = load double, double* %z.addr, align 8
  %227 = fmul double %225, %226
  store double %227, double* %w.addr, align 8
  %228 = load double, double* %z.addr, align 8
  %229 = load double, double* %w.addr, align 8
  %230 = fmul double 0x3F90AD3AE322DA11, %229
  %231 = fadd double %230, 0x3FA97B4B24760DEB
  %232 = load double, double* %w.addr, align 8
  %233 = fmul double %231, %232
  %234 = fadd double %233, 0x3FB10D66A0D03D51
  %235 = load double, double* %w.addr, align 8
  %236 = fmul double %234, %235
  %237 = fadd double %236, 0x3FB745CDC54C206E
  %238 = load double, double* %w.addr, align 8
  %239 = fmul double %237, %238
  %240 = fadd double %239, 0x3FC24924920083FF
  %241 = load double, double* %w.addr, align 8
  %242 = fmul double %240, %241
  %243 = fadd double %242, 0x3FD555555555550D
  %244 = fmul double %228, %243
  store double %244, double* %s1.addr, align 8
  %245 = load double, double* %w.addr, align 8
  %246 = fneg double 0x3FA2B4442C6A6C2F
  %247 = load double, double* %w.addr, align 8
  %248 = fmul double %246, %247
  %249 = fsub double %248, 0x3FADDE2D52DEFD9A
  %250 = load double, double* %w.addr, align 8
  %251 = fmul double %249, %250
  %252 = fsub double %251, 0x3FB3B0F2AF749A6D
  %253 = load double, double* %w.addr, align 8
  %254 = fmul double %252, %253
  %255 = fsub double %254, 0x3FBC71C6FE231671
  %256 = load double, double* %w.addr, align 8
  %257 = fmul double %255, %256
  %258 = fsub double %257, 0x3FC999999998EBC4
  %259 = fmul double %245, %258
  store double %259, double* %s2.addr, align 8
  %260 = load double, double* %t.addr, align 8
  %261 = load double, double* %t.addr, align 8
  %262 = load double, double* %s1.addr, align 8
  %263 = load double, double* %s2.addr, align 8
  %264 = fadd double %262, %263
  %265 = fmul double %261, %264
  %266 = load double, double* %tl.addr, align 8
  %267 = fsub double %265, %266
  %268 = fsub double %260, %267
  store double %268, double* %lo.addr, align 8
  br label %if.end.12

if.end.12:
  br label %if.end.11

if.end.11:
  store double 0x0000000000000000, double* %r.addr.1, align 8
  %269 = load i32, i32* %hx.addr, align 4
  %270 = icmp sge i32 %269, 0
  br i1 %270, label %if.then.17, label %if.else.5

if.then.17:
  %271 = load double, double* %hi.addr, align 8
  %272 = load double, double* %lo.addr, align 8
  %273 = fadd double %271, %272
  store double %273, double* %r.addr.1, align 8
  br label %if.end.17

if.else.5:
  %274 = load double, double* %pi.addr, align 8
  %275 = load double, double* %hi.addr, align 8
  %276 = fsub double %274, %275
  store double %276, double* %s.addr.1, align 8
  %277 = load double, double* %s.addr.1, align 8
  %278 = load double, double* %piLo.addr, align 8
  %279 = load double, double* %lo.addr, align 8
  %280 = fsub double %278, %279
  %281 = load double, double* %pi.addr, align 8
  %282 = load double, double* %s.addr.1, align 8
  %283 = fsub double %281, %282
  %284 = load double, double* %hi.addr, align 8
  %285 = fsub double %283, %284
  %286 = fadd double %280, %285
  %287 = fadd double %277, %286
  store double %287, double* %r.addr.1, align 8
  br label %if.end.17

if.end.17:
  %288 = load i32, i32* %hy.addr, align 4
  %289 = icmp slt i32 %288, 0
  br i1 %289, label %cond.true.5, label %cond.false.5

cond.true.5:
  %290 = load double, double* %r.addr.1, align 8
  %291 = fneg double %290
  br label %cond.end.5

cond.false.5:
  %292 = load double, double* %r.addr.1, align 8
  br label %cond.end.5

cond.end.5:
  %293 = phi double [ %291, %cond.true.5 ], [ %292, %cond.false.5 ]
  ret double %293
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
