%struct.nish_array = type { i64, i64, i8* }

define internal noundef i32 @weight(i32 noundef %k) #0 {
entry:
  switch i32 %k, label %sw.default [
    i32 1, label %sw.case
    i32 2, label %sw.case.1
  ]

sw.case:
  ret i32 10

sw.case.1:
  ret i32 20

sw.default:
  ret i32 30
}

define internal noundef i32 @scale(i32 noundef %l) #0 {
entry:
  %0 = icmp eq i32 %l, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %1 = icmp eq i32 %l, 1
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ 2, %cond.true ], [ 4, %cond.false ]
  ret i32 %2
}

define internal noundef i32 @heaviest(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %kinds) #1 {
entry:
  %best.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %w.addr = alloca i32, align 4
  store i32 0, i32* %best.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %kinds, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %kinds, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3
  store i32 %8, i32* %k.addr, align 4
  %9 = load i32, i32* %k.addr, align 4
  %10 = call i32 @weight(i32 %9)
  store i32 %10, i32* %w.addr, align 4
  %11 = load i32, i32* %w.addr, align 4
  %12 = load i32, i32* %best.addr, align 4
  %13 = icmp sgt i32 %11, %12
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = load i32, i32* %w.addr, align 4
  store i32 %14, i32* %best.addr, align 4
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %17 = load i32, i32* %best.addr, align 4
  ret i32 %17
}

define noundef i32 @test() #1 {
entry:
  %kinds.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %total.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 3, i32* %6, align 4, !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 2, i32* %7, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %kinds.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %kinds.addr, align 8
  %9 = call i32 @heaviest(%struct.nish_array* %8)
  %10 = call i32 @scale(i32 2)
  %11 = add nsw i32 %9, %10
  %12 = call i32 @weight(i32 1)
  %13 = add nsw i32 %11, %12
  store i32 %13, i32* %total.addr, align 4
  %14 = load i32, i32* %total.addr, align 4
  ret i32 %14
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind readonly }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
