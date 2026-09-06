%struct.sts_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @sts_free_arena() #1
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1
declare void @sts_panic_index(i64 noundef, i64 noundef) #2

define void @insertionSort(%struct.sts_array* noundef nonnull align 8 nocapture %xs) #0 {
entry:
  %i.addr = alloca i32, align 4
  %key.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = sext i32 %5 to i64
  %7 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %6, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %6
  %14 = load i32, i32* %13, align 4
  store i32 %14, i32* %key.addr, align 4
  %15 = load i32, i32* %i.addr, align 4
  %16 = sub i32 %15, 1
  store i32 %16, i32* %j.addr, align 4
  br label %while.cond

while.cond:
  %17 = load i32, i32* %j.addr, align 4
  %18 = icmp sge i32 %17, 0
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load i32, i32* %j.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %22 = load i64, i64* %21, align 8
  %23 = icmp ult i64 %20, %22
  br i1 %23, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 %20, i64 %22)
  unreachable

bounds.ok.1:
  %24 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %20
  %28 = load i32, i32* %27, align 4
  %29 = load i32, i32* %key.addr, align 4
  %30 = icmp sgt i32 %28, %29
  br label %land.end

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %bounds.ok.1 ]
  br i1 %31, label %while.body, label %while.end

while.body:
  %32 = load i32, i32* %j.addr, align 4
  %33 = add i32 %32, 1
  %34 = sext i32 %33 to i64
  %35 = load i32, i32* %j.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %38 = load i64, i64* %37, align 8
  %39 = icmp ult i64 %36, %38
  br i1 %39, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @sts_panic_index(i64 %36, i64 %38)
  unreachable

bounds.ok.2:
  %40 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  %44 = load i32, i32* %43, align 4
  %45 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %46 = load i64, i64* %45, align 8
  %47 = icmp ult i64 %34, %46
  br i1 %47, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @sts_panic_index(i64 %34, i64 %46)
  unreachable

bounds.ok.3:
  %48 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 %34
  store i32 %44, i32* %51, align 4
  %52 = load i32, i32* %j.addr, align 4
  %53 = sub i32 %52, 1
  store i32 %53, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %54 = load i32, i32* %j.addr, align 4
  %55 = add i32 %54, 1
  %56 = sext i32 %55 to i64
  %57 = load i32, i32* %key.addr, align 4
  %58 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %59 = load i64, i64* %58, align 8
  %60 = icmp ult i64 %56, %59
  br i1 %60, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @sts_panic_index(i64 %56, i64 %59)
  unreachable

bounds.ok.4:
  %61 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8
  %63 = bitcast i8* %62 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %56
  store i32 %57, i32* %64, align 4
  br label %for.inc

for.inc:
  %65 = load i32, i32* %i.addr, align 4
  %66 = add i32 %65, 1
  store i32 %66, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @sts_main() #0 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [20 x i32], align 8
  %line.addr = alloca i8*, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = sub i32 0, 4
  %1 = sub i32 0, 12
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 20, i64* %2, align 8
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 20, i64* %3, align 8
  %4 = bitcast [20 x i32]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 17, i32* %7, align 4
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 3, i32* %8, align 4
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 99, i32* %9, align 4
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 %0, i32* %10, align 4
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 42, i32* %11, align 4
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 8, i32* %12, align 4
  %13 = getelementptr inbounds i32, i32* %6, i64 6
  store i32 0, i32* %13, align 4
  %14 = getelementptr inbounds i32, i32* %6, i64 7
  store i32 23, i32* %14, align 4
  %15 = getelementptr inbounds i32, i32* %6, i64 8
  store i32 15, i32* %15, align 4
  %16 = getelementptr inbounds i32, i32* %6, i64 9
  store i32 61, i32* %16, align 4
  %17 = getelementptr inbounds i32, i32* %6, i64 10
  store i32 7, i32* %17, align 4
  %18 = getelementptr inbounds i32, i32* %6, i64 11
  store i32 88, i32* %18, align 4
  %19 = getelementptr inbounds i32, i32* %6, i64 12
  store i32 %1, i32* %19, align 4
  %20 = getelementptr inbounds i32, i32* %6, i64 13
  store i32 5, i32* %20, align 4
  %21 = getelementptr inbounds i32, i32* %6, i64 14
  store i32 30, i32* %21, align 4
  %22 = getelementptr inbounds i32, i32* %6, i64 15
  store i32 2, i32* %22, align 4
  %23 = getelementptr inbounds i32, i32* %6, i64 16
  store i32 71, i32* %23, align 4
  %24 = getelementptr inbounds i32, i32* %6, i64 17
  store i32 19, i32* %24, align 4
  %25 = getelementptr inbounds i32, i32* %6, i64 18
  store i32 44, i32* %25, align 4
  %26 = getelementptr inbounds i32, i32* %6, i64 19
  store i32 1, i32* %26, align 4
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %xs.addr, align 8
  %27 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  call void @insertionSort(%struct.sts_array* %27)
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %line.addr, align 8
  %28 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %29 = load i64, i64* %forof.idx, align 8
  %30 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %28, i64 0, i32 0
  %31 = load i64, i64* %30, align 8
  %32 = icmp ult i64 %29, %31
  br i1 %32, label %forof.body, label %forof.end

forof.body:
  %33 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %28, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %29
  %37 = load i32, i32* %36, align 4
  store i32 %37, i32* %x.addr, align 4
  %38 = load i8*, i8** %line.addr, align 8
  %39 = load i32, i32* %x.addr, align 4
  %40 = call i8* @sts_str_from_i32(i32 %39)
  %41 = call i8* @sts_str_concat(i8* %38, i8* %40)
  %42 = call i8* @sts_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %42, i8** %line.addr, align 8
  br label %forof.inc

forof.inc:
  %43 = load i64, i64* %forof.idx, align 8
  %44 = add i64 %43, 1
  store i64 %44, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %45 = load i8*, i8** %line.addr, align 8
  call void @sts_print(i8* %45)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
