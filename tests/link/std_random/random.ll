%struct.Rng = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"Rng.nextInt: lo is greater than hi\00" }, align 8

declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_div(i1 noundef zeroext) #3

define internal noundef zeroext i1 @nish.below(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = xor i32 %a, -2147483648
  %1 = xor i32 %b, -2147483648
  %2 = icmp slt i32 %0, %1
  ret i1 %2
}

define internal noundef i32 @nish.remainder(i32 noundef %a, i32 noundef %m) #1 {
entry:
  %low.addr = alloca i32, align 4
  %high.addr = alloca i32, align 4
  %room.addr = alloca i32, align 4
  %0 = icmp slt i32 %m, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i1 @nish.below(i32 %a, i32 %m)
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %2 = sub i32 %a, %m
  br label %cond.end

cond.end:
  %3 = phi i32 [ %a, %cond.true ], [ %2, %cond.false ]
  ret i32 %3

if.end:
  %4 = icmp sge i32 %a, 0
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  %5 = icmp eq i32 %m, 0
  %6 = icmp eq i32 %a, -2147483648
  %7 = icmp eq i32 %m, -1
  %8 = and i1 %6, %7
  %9 = or i1 %5, %8
  br i1 %9, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %5)
  unreachable

div.ok:
  %10 = srem i32 %a, %m
  ret i32 %10

if.end.1:
  %11 = xor i32 %a, -2147483648
  %12 = icmp eq i32 %m, 0
  %13 = icmp eq i32 %11, -2147483648
  %14 = icmp eq i32 %m, -1
  %15 = and i1 %13, %14
  %16 = or i1 %12, %15
  br i1 %16, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %12)
  unreachable

div.ok.1:
  %17 = srem i32 %11, %m
  store i32 %17, i32* %low.addr, align 4
  %18 = icmp eq i32 %m, 0
  %19 = icmp eq i32 2147483647, -2147483648
  %20 = icmp eq i32 %m, -1
  %21 = and i1 %19, %20
  %22 = or i1 %18, %21
  br i1 %22, label %div.fail.2, label %div.ok.2

div.fail.2:
  call void @nish_panic_div(i1 zeroext %18)
  unreachable

div.ok.2:
  %23 = srem i32 2147483647, %m
  %24 = add i32 %23, 1
  %25 = icmp eq i32 %m, 0
  %26 = icmp eq i32 %24, -2147483648
  %27 = icmp eq i32 %m, -1
  %28 = and i1 %26, %27
  %29 = or i1 %25, %28
  br i1 %29, label %div.fail.3, label %div.ok.3

div.fail.3:
  call void @nish_panic_div(i1 zeroext %25)
  unreachable

div.ok.3:
  %30 = srem i32 %24, %m
  store i32 %30, i32* %high.addr, align 4
  %31 = load i32, i32* %high.addr, align 4
  %32 = sub i32 %m, %31
  store i32 %32, i32* %room.addr, align 4
  %33 = load i32, i32* %low.addr, align 4
  %34 = load i32, i32* %room.addr, align 4
  %35 = icmp sge i32 %33, %34
  br i1 %35, label %cond.true.1, label %cond.false.1

cond.true.1:
  %36 = load i32, i32* %low.addr, align 4
  %37 = load i32, i32* %room.addr, align 4
  %38 = sub i32 %36, %37
  br label %cond.end.1

cond.false.1:
  %39 = load i32, i32* %low.addr, align 4
  %40 = load i32, i32* %high.addr, align 4
  %41 = add i32 %39, %40
  br label %cond.end.1

cond.end.1:
  %42 = phi i32 [ %38, %cond.true.1 ], [ %41, %cond.false.1 ]
  ret i32 %42
}

define internal noundef i32 @nish.mix(i32 noundef %h) #0 {
entry:
  %x.addr = alloca i32, align 4
  store i32 %h, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = load i32, i32* %x.addr, align 4
  %2 = lshr i32 %1, 16
  %3 = xor i32 %0, %2
  store i32 %3, i32* %x.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = mul i32 %4, -2048144789
  store i32 %5, i32* %x.addr, align 4
  %6 = load i32, i32* %x.addr, align 4
  %7 = load i32, i32* %x.addr, align 4
  %8 = lshr i32 %7, 13
  %9 = xor i32 %6, %8
  store i32 %9, i32* %x.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = mul i32 %10, -1028477387
  store i32 %11, i32* %x.addr, align 4
  %12 = load i32, i32* %x.addr, align 4
  %13 = load i32, i32* %x.addr, align 4
  %14 = lshr i32 %13, 16
  %15 = xor i32 %12, %14
  store i32 %15, i32* %x.addr, align 4
  %16 = load i32, i32* %x.addr, align 4
  ret i32 %16
}

define void @nish.Rng.constructor(%struct.Rng* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %seed) #2 {
entry:
  %0 = getelementptr inbounds %struct.Rng, %struct.Rng* %this, i32 0, i32 0
  store i32 %seed, i32* %0, align 4, !tbaa !4
  ret void
}

define noundef i32 @nish.Rng.nextI32(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Rng, %struct.Rng* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = add i32 %1, -1640531527
  %3 = getelementptr inbounds %struct.Rng, %struct.Rng* %this, i32 0, i32 0
  store i32 %2, i32* %3, align 4, !tbaa !4
  %4 = getelementptr inbounds %struct.Rng, %struct.Rng* %this, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  %6 = tail call i32 @nish.mix(i32 %5)
  ret i32 %6
}

define noundef double @nish.Rng.nextF64(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture %this) #2 {
entry:
  %hi.addr = alloca i32, align 4
  %lo.addr = alloca i32, align 4
  %0 = call i32 @nish.Rng.nextI32(%struct.Rng* %this)
  %1 = lshr i32 %0, 5
  store i32 %1, i32* %hi.addr, align 4
  %2 = call i32 @nish.Rng.nextI32(%struct.Rng* %this)
  %3 = lshr i32 %2, 6
  store i32 %3, i32* %lo.addr, align 4
  %4 = load i32, i32* %hi.addr, align 4
  %5 = sitofp i32 %4 to double
  %6 = fmul double %5, 0x4190000000000000
  %7 = load i32, i32* %lo.addr, align 4
  %8 = sitofp i32 %7 to double
  %9 = fadd double %6, %8
  %10 = fdiv double %9, 0x4340000000000000
  ret double %10
}

define noundef i32 @nish.Rng.nextInt(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %span.addr = alloca i32, align 4
  %refused.addr = alloca i32, align 4
  %draw.addr = alloca i32, align 4
  %0 = icmp sgt i32 %lo, %hi
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [35 x i8] }* @.str.0 to i8*))
  unreachable

if.end:
  %1 = sub i32 %hi, %lo
  %2 = add i32 %1, 1
  store i32 %2, i32* %span.addr, align 4
  %3 = load i32, i32* %span.addr, align 4
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  %5 = call i32 @nish.Rng.nextI32(%struct.Rng* %this)
  ret i32 %5

if.end.1:
  %6 = load i32, i32* %span.addr, align 4
  %7 = sub i32 0, %6
  %8 = load i32, i32* %span.addr, align 4
  %9 = call i32 @nish.remainder(i32 %7, i32 %8)
  store i32 %9, i32* %refused.addr, align 4
  %10 = call i32 @nish.Rng.nextI32(%struct.Rng* %this)
  store i32 %10, i32* %draw.addr, align 4
  br label %while.cond

while.cond:
  %11 = load i32, i32* %draw.addr, align 4
  %12 = load i32, i32* %refused.addr, align 4
  %13 = call i1 @nish.below(i32 %11, i32 %12)
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = call i32 @nish.Rng.nextI32(%struct.Rng* %this)
  store i32 %14, i32* %draw.addr, align 4
  br label %while.cond

while.end:
  %15 = load i32, i32* %draw.addr, align 4
  %16 = load i32, i32* %span.addr, align 4
  %17 = call i32 @nish.remainder(i32 %15, i32 %16)
  %18 = add i32 %lo, %17
  ret i32 %18
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Rng", !2, i64 0}
!4 = !{!3, !2, i64 0}
