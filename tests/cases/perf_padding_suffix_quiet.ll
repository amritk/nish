%struct.Header = type { i1, double }
%struct.Entry = type { i1, double, double, i32, i1 }

define noundef i32 @test() #0 {
entry:
  %e.addr = alloca %struct.Entry*, align 8
  %Entry.obj = alloca %struct.Entry, align 8
  %h.addr = alloca %struct.Header*, align 8
  %0 = getelementptr inbounds %struct.Entry, %struct.Entry* %Entry.obj, i32 0, i32 0
  store i1 false, i1* %0, align 1
  %1 = getelementptr inbounds %struct.Entry, %struct.Entry* %Entry.obj, i32 0, i32 1
  store double 0x0000000000000000, double* %1, align 8
  %2 = getelementptr inbounds %struct.Entry, %struct.Entry* %Entry.obj, i32 0, i32 2
  store double 0x0000000000000000, double* %2, align 8
  %3 = getelementptr inbounds %struct.Entry, %struct.Entry* %Entry.obj, i32 0, i32 3
  store i32 0, i32* %3, align 4
  %4 = getelementptr inbounds %struct.Entry, %struct.Entry* %Entry.obj, i32 0, i32 4
  store i1 false, i1* %4, align 1
  store %struct.Entry* %Entry.obj, %struct.Entry** %e.addr, align 8
  %5 = load %struct.Entry*, %struct.Entry** %e.addr, align 8
  %6 = getelementptr inbounds %struct.Entry, %struct.Entry* %5, i32 0, i32 3
  store i32 5, i32* %6, align 4
  %7 = load %struct.Entry*, %struct.Entry** %e.addr, align 8
  %8 = bitcast %struct.Entry* %7 to %struct.Header*
  store %struct.Header* %8, %struct.Header** %h.addr, align 8
  %9 = load %struct.Entry*, %struct.Entry** %e.addr, align 8
  %10 = getelementptr inbounds %struct.Entry, %struct.Entry* %9, i32 0, i32 3
  %11 = load i32, i32* %10, align 4
  %12 = load %struct.Header*, %struct.Header** %h.addr, align 8
  %13 = getelementptr inbounds %struct.Header, %struct.Header* %12, i32 0, i32 0
  %14 = load i1, i1* %13, align 1
  br i1 %14, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %15 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %16 = add nsw i32 %11, %15
  %17 = load %struct.Entry*, %struct.Entry** %e.addr, align 8
  %18 = getelementptr inbounds %struct.Entry, %struct.Entry* %17, i32 0, i32 4
  %19 = load i1, i1* %18, align 1
  br i1 %19, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %20 = phi i32 [ 1, %cond.true.1 ], [ 0, %cond.false.1 ]
  %21 = add nsw i32 %16, %20
  ret i32 %21
}

attributes #0 = { nounwind willreturn readnone }
