define noundef i32 @score(i32 noundef %limit) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %limit
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  switch i32 %2, label %sw.default [
    i32 0, label %sw.case
    i32 3, label %sw.case.1
  ]

sw.case:
  %3 = load i32, i32* %total.addr, align 4
  %4 = add i32 %3, 100
  store i32 %4, i32* %total.addr, align 4
  br label %sw.end

sw.case.1:
  br label %for.inc

sw.default:
  %5 = load i32, i32* %total.addr, align 4
  %6 = add i32 %5, 1
  store i32 %6, i32* %total.addr, align 4
  br label %sw.end

sw.end:
  %7 = load i32, i32* %total.addr, align 4
  %8 = add i32 %7, 1000
  store i32 %8, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %9 = load i32, i32* %i.addr, align 4
  %10 = add i32 %9, 1
  store i32 %10, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %11 = load i32, i32* %total.addr, align 4
  ret i32 %11
}

define noundef i64 @widen(i64 noundef %w) #0 {
entry:
  %out.addr = alloca i64, align 8
  store i64 0, i64* %out.addr, align 8
  switch i64 %w, label %sw.end [
    i64 1, label %sw.case
    i64 2, label %sw.case.1
  ]

sw.case:
  store i64 11, i64* %out.addr, align 8
  br label %sw.end

sw.case.1:
  store i64 22, i64* %out.addr, align 8
  br label %sw.end

sw.end:
  %0 = load i64, i64* %out.addr, align 8
  ret i64 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @score(i32 6)
  %1 = call i64 @widen(i64 2)
  %2 = trunc i64 %1 to i32
  %3 = add i32 %0, %2
  ret i32 %3
}

attributes #0 = { nounwind willreturn readnone }
