%struct.Acc = type { i32 }
%struct.amrit_array = type { i64, i64, i8* }

declare void @amrit_panic_index(i64 noundef, i64 noundef) #3
declare void @amrit_panic_div(i1 noundef zeroext) #3

define internal void @Acc.constructor(%struct.Acc* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Acc, %struct.Acc* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4
  ret void
}

define internal noundef i32 @poly(i32 noundef %x, i32 noundef %y) #1 {
entry:
  %0 = mul nsw i32 %x, %x
  %1 = mul nsw i32 3, %y
  %2 = sub nsw i32 %0, %1
  %3 = sub nsw i32 0, %x
  %4 = add nsw i32 %2, %3
  ret i32 %4
}

define internal noundef i32 @sum(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %struct.Acc* noundef nonnull align 8 dereferenceable(4) nocapture %acc) #2 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %s.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %9 = load i64, i64* %8, align 8
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  %15 = load i32, i32* %14, align 4
  %16 = add nsw i32 %5, %15
  store i32 %16, i32* %s.addr, align 4
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %20 = load i64, i64* %19, align 8
  %21 = icmp ult i64 %18, %20
  br i1 %21, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 %18, i64 %20)
  unreachable

bounds.ok.1:
  %22 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %18
  %26 = load i32, i32* %25, align 4
  %27 = mul nsw i32 %26, 2
  store i32 %27, i32* %25, align 4
  %28 = getelementptr inbounds %struct.Acc, %struct.Acc* %acc, i32 0, i32 0
  %29 = load i32, i32* %28, align 4
  %30 = load i32, i32* %i.addr, align 4
  %31 = sext i32 %30 to i64
  %32 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %33 = load i64, i64* %32, align 8
  %34 = icmp ult i64 %31, %33
  br i1 %34, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @amrit_panic_index(i64 %31, i64 %33)
  unreachable

bounds.ok.2:
  %35 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 %31
  %39 = load i32, i32* %38, align 4
  %40 = icmp eq i32 2, 0
  %41 = icmp eq i32 %39, -2147483648
  %42 = icmp eq i32 2, -1
  %43 = and i1 %41, %42
  %44 = or i1 %40, %43
  br i1 %44, label %div.fail, label %div.ok

div.fail:
  call void @amrit_panic_div(i1 zeroext %40)
  unreachable

div.ok:
  %45 = sdiv i32 %39, 2
  %46 = sub nsw i32 %29, %45
  store i32 %46, i32* %28, align 4
  br label %for.inc

for.inc:
  %47 = load i32, i32* %i.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %49 = load i32, i32* %s.addr, align 4
  %50 = icmp eq i32 1000, 0
  %51 = icmp eq i32 %49, -2147483648
  %52 = icmp eq i32 1000, -1
  %53 = and i1 %51, %52
  %54 = or i1 %50, %53
  br i1 %54, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @amrit_panic_div(i1 zeroext %50)
  unreachable

div.ok.1:
  %55 = srem i32 %49, 1000
  ret i32 %55
}

define internal noundef i32 @mix(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %m.addr = alloca i32, align 4
  %0 = mul i32 %a, %b
  store i32 %0, i32* %m.addr, align 4
  %1 = load i32, i32* %m.addr, align 4
  %2 = sub i32 %a, %b
  %3 = add i32 %1, %2
  store i32 %3, i32* %m.addr, align 4
  %4 = load i32, i32* %m.addr, align 4
  %5 = sub i32 %4, 1
  store i32 %5, i32* %m.addr, align 4
  %6 = load i32, i32* %m.addr, align 4
  ret i32 %6
}

define noundef i32 @test() #2 {
entry:
  %acc.addr = alloca %struct.Acc*, align 8
  %Acc.obj = alloca %struct.Acc, align 8
  %xs.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %n.addr = alloca i32, align 4
  call void @Acc.constructor(%struct.Acc* %Acc.obj)
  store %struct.Acc* %Acc.obj, %struct.Acc** %acc.addr, align 8
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 4, i32* %8, align 4
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %xs.addr, align 8
  %9 = call i32 @poly(i32 5, i32 2)
  store i32 %9, i32* %n.addr, align 4
  %10 = load i32, i32* %n.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %n.addr, align 4
  %12 = load i32, i32* %n.addr, align 4
  %13 = sub nsw i32 %12, 1
  store i32 %13, i32* %n.addr, align 4
  %14 = load i32, i32* %n.addr, align 4
  %15 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %16 = load %struct.Acc*, %struct.Acc** %acc.addr, align 8
  %17 = call i32 @sum(%struct.amrit_array* %15, %struct.Acc* %16)
  %18 = add nsw i32 %14, %17
  %19 = load %struct.Acc*, %struct.Acc** %acc.addr, align 8
  %20 = getelementptr inbounds %struct.Acc, %struct.Acc* %19, i32 0, i32 0
  %21 = load i32, i32* %20, align 4
  %22 = add nsw i32 %18, %21
  %23 = call i32 @mix(i32 3, i32 2)
  %24 = add nsw i32 %22, %23
  ret i32 %24
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind noreturn cold }
