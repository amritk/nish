%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal void @insertionSort(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %i.addr = alloca i32, align 4
  %key.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = sext i32 %5 to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %6
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3
  store i32 %11, i32* %key.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = sub nsw i32 %12, 1
  store i32 %13, i32* %j.addr, align 4
  br label %while.cond

while.cond:
  %14 = load i32, i32* %j.addr, align 4
  %15 = icmp sge i32 %14, 0
  br i1 %15, label %land.rhs, label %land.end

land.rhs:
  %16 = load i32, i32* %j.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4
  %20 = icmp ult i64 %17, %19
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %17, i64 %19)
  unreachable

bounds.ok:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3
  %26 = load i32, i32* %key.addr, align 4
  %27 = icmp sgt i32 %25, %26
  br label %land.end

land.end:
  %28 = phi i1 [ false, %while.cond ], [ %27, %bounds.ok ]
  br i1 %28, label %while.body, label %while.end

while.body:
  %29 = load i32, i32* %j.addr, align 4
  %30 = add nsw i32 %29, 1
  %31 = sext i32 %30 to i64
  %32 = load i32, i32* %j.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4
  %36 = icmp ult i64 %33, %35
  br i1 %36, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %33, i64 %35)
  unreachable

bounds.ok.1:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %33
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4
  %44 = icmp ult i64 %31, %43
  br i1 %44, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %31, i64 %43)
  unreachable

bounds.ok.2:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 %31
  store i32 %41, i32* %48, align 4, !alias.scope !4, !noalias !3
  %49 = load i32, i32* %j.addr, align 4
  %50 = sub nsw i32 %49, 1
  store i32 %50, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %51 = load i32, i32* %j.addr, align 4
  %52 = add nsw i32 %51, 1
  %53 = sext i32 %52 to i64
  %54 = load i32, i32* %key.addr, align 4
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4
  %57 = icmp ult i64 %53, %56
  br i1 %57, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %53, i64 %56)
  unreachable

bounds.ok.3:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 %53
  store i32 %54, i32* %61, align 4, !alias.scope !4, !noalias !3
  br label %for.inc

for.inc:
  %62 = load i32, i32* %i.addr, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [20 x i32], align 8
  %line.addr = alloca i8*, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = sub nsw i32 0, 4
  %1 = sub nsw i32 0, 12
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 20, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 20, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast [20 x i32]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 17, i32* %7, align 4, !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 3, i32* %8, align 4, !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 99, i32* %9, align 4, !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 %0, i32* %10, align 4, !alias.scope !4, !noalias !3
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 42, i32* %11, align 4, !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 8, i32* %12, align 4, !alias.scope !4, !noalias !3
  %13 = getelementptr inbounds i32, i32* %6, i64 6
  store i32 0, i32* %13, align 4, !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds i32, i32* %6, i64 7
  store i32 23, i32* %14, align 4, !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds i32, i32* %6, i64 8
  store i32 15, i32* %15, align 4, !alias.scope !4, !noalias !3
  %16 = getelementptr inbounds i32, i32* %6, i64 9
  store i32 61, i32* %16, align 4, !alias.scope !4, !noalias !3
  %17 = getelementptr inbounds i32, i32* %6, i64 10
  store i32 7, i32* %17, align 4, !alias.scope !4, !noalias !3
  %18 = getelementptr inbounds i32, i32* %6, i64 11
  store i32 88, i32* %18, align 4, !alias.scope !4, !noalias !3
  %19 = getelementptr inbounds i32, i32* %6, i64 12
  store i32 %1, i32* %19, align 4, !alias.scope !4, !noalias !3
  %20 = getelementptr inbounds i32, i32* %6, i64 13
  store i32 5, i32* %20, align 4, !alias.scope !4, !noalias !3
  %21 = getelementptr inbounds i32, i32* %6, i64 14
  store i32 30, i32* %21, align 4, !alias.scope !4, !noalias !3
  %22 = getelementptr inbounds i32, i32* %6, i64 15
  store i32 2, i32* %22, align 4, !alias.scope !4, !noalias !3
  %23 = getelementptr inbounds i32, i32* %6, i64 16
  store i32 71, i32* %23, align 4, !alias.scope !4, !noalias !3
  %24 = getelementptr inbounds i32, i32* %6, i64 17
  store i32 19, i32* %24, align 4, !alias.scope !4, !noalias !3
  %25 = getelementptr inbounds i32, i32* %6, i64 18
  store i32 44, i32* %25, align 4, !alias.scope !4, !noalias !3
  %26 = getelementptr inbounds i32, i32* %6, i64 19
  store i32 1, i32* %26, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @insertionSort(%struct.nish_array* %27)
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %line.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %29 = load i64, i64* %forof.idx, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4
  %32 = icmp ult i64 %29, %31
  br i1 %32, label %forof.body, label %forof.end

forof.body:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %29
  %37 = load i32, i32* %36, align 4, !alias.scope !4, !noalias !3
  store i32 %37, i32* %x.addr, align 4
  %38 = load i8*, i8** %line.addr, align 8
  %39 = load i32, i32* %x.addr, align 4
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %38, i8* %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %42, i8** %line.addr, align 8
  br label %forof.inc

forof.inc:
  %43 = load i64, i64* %forof.idx, align 8
  %44 = add i64 %43, 1
  store i64 %44, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %45 = load i8*, i8** %line.addr, align 8
  call void @nish_print(i8* %45)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
