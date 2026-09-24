%struct.Base = type { i32, double }
%struct.Wide = type { i32, double, i32, double, i32 }
%struct.Tag = type { i32 }
%struct.Tagged = type { i32, double, i1, double, i32 }
%struct.Late = type { i32, double }

define noundef i32 @test() #0 {
entry:
  %w.addr = alloca %struct.Wide*, align 8
  %Wide.obj = alloca %struct.Wide, align 8
  %t.addr = alloca %struct.Tagged*, align 8
  %Tagged.obj = alloca %struct.Tagged, align 8
  %b.addr = alloca %struct.Base*, align 8
  %l.addr = alloca %struct.Late*, align 8
  %0 = getelementptr inbounds %struct.Wide, %struct.Wide* %Wide.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Wide, %struct.Wide* %Wide.obj, i32 0, i32 1
  store double 0x0000000000000000, double* %1, align 8
  %2 = getelementptr inbounds %struct.Wide, %struct.Wide* %Wide.obj, i32 0, i32 2
  store i32 0, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Wide, %struct.Wide* %Wide.obj, i32 0, i32 3
  store double 0x0000000000000000, double* %3, align 8
  %4 = getelementptr inbounds %struct.Wide, %struct.Wide* %Wide.obj, i32 0, i32 4
  store i32 0, i32* %4, align 4
  store %struct.Wide* %Wide.obj, %struct.Wide** %w.addr, align 8
  %5 = load %struct.Wide*, %struct.Wide** %w.addr, align 8
  %6 = getelementptr inbounds %struct.Wide, %struct.Wide* %5, i32 0, i32 4
  store i32 3, i32* %6, align 4
  %7 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %Tagged.obj, i32 0, i32 0
  store i32 0, i32* %7, align 4
  %8 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %Tagged.obj, i32 0, i32 1
  store double 0x0000000000000000, double* %8, align 8
  %9 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %Tagged.obj, i32 0, i32 2
  store i1 false, i1* %9, align 1
  %10 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %Tagged.obj, i32 0, i32 3
  store double 0x0000000000000000, double* %10, align 8
  %11 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %Tagged.obj, i32 0, i32 4
  store i32 0, i32* %11, align 4
  store %struct.Tagged* %Tagged.obj, %struct.Tagged** %t.addr, align 8
  %12 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %13 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %12, i32 0, i32 4
  store i32 4, i32* %13, align 4
  %14 = load %struct.Wide*, %struct.Wide** %w.addr, align 8
  %15 = bitcast %struct.Wide* %14 to %struct.Base*
  store %struct.Base* %15, %struct.Base** %b.addr, align 8
  %16 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %17 = bitcast %struct.Tagged* %16 to %struct.Late*
  store %struct.Late* %17, %struct.Late** %l.addr, align 8
  %18 = load %struct.Wide*, %struct.Wide** %w.addr, align 8
  %19 = getelementptr inbounds %struct.Wide, %struct.Wide* %18, i32 0, i32 4
  %20 = load i32, i32* %19, align 4
  %21 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %22 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %21, i32 0, i32 4
  %23 = load i32, i32* %22, align 4
  %24 = add nsw i32 %20, %23
  %25 = load %struct.Base*, %struct.Base** %b.addr, align 8
  %26 = getelementptr inbounds %struct.Base, %struct.Base* %25, i32 0, i32 0
  %27 = load i32, i32* %26, align 4
  %28 = add nsw i32 %24, %27
  %29 = load %struct.Late*, %struct.Late** %l.addr, align 8
  %30 = getelementptr inbounds %struct.Late, %struct.Late* %29, i32 0, i32 0
  %31 = load i32, i32* %30, align 4
  %32 = add nsw i32 %28, %31
  %33 = load %struct.Tagged*, %struct.Tagged** %t.addr, align 8
  %34 = getelementptr inbounds %struct.Tagged, %struct.Tagged* %33, i32 0, i32 2
  %35 = load i1, i1* %34, align 1
  br i1 %35, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %36 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %37 = add nsw i32 %32, %36
  ret i32 %37
}

attributes #0 = { nounwind willreturn readnone }
