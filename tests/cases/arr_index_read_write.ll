%struct.amrit_array = type { i64, i64, i8* }

declare void @amrit_free_arena() #1
declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #1
declare void @amrit_panic_index(i64 noundef, i64 noundef) #2

define void @set(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) nocapture %a, i32 noundef %i, i32 noundef %v) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  store i32 %v, i32* %7, align 4
  ret void
}

define noundef i32 @get(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4
  ret i32 %8
}

define noundef i32 @amrit_main() #0 {
entry:
  %xs.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %xs.addr, align 8
  %8 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  call void @set(%struct.amrit_array* %8, i32 1, i32 42)
  %9 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8
  %12 = icmp ult i64 0, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 0, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  %17 = load i32, i32* %16, align 4
  %18 = add i32 %17, 5
  store i32 %18, i32* %16, align 4
  %19 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %20 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8
  %22 = icmp ult i64 2, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 2, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %19, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 2
  %27 = load i32, i32* %26, align 4
  %28 = mul i32 %27, 10
  store i32 %28, i32* %26, align 4
  %29 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %30 = call i32 @get(%struct.amrit_array* %29, i32 0)
  %31 = call i8* @amrit_str_from_i32(i32 %30)
  call void @amrit_print(i8* %31)
  %32 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %33 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8
  %35 = icmp ult i64 1, %34
  br i1 %35, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @amrit_panic_index(i64 1, i64 %34)
  unreachable

bounds.ok.2:
  %36 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %32, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 1
  %40 = load i32, i32* %39, align 4
  %41 = call i8* @amrit_str_from_i32(i32 %40)
  call void @amrit_print(i8* %41)
  %42 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %43 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8
  %45 = icmp ult i64 2, %44
  br i1 %45, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @amrit_panic_index(i64 2, i64 %44)
  unreachable

bounds.ok.3:
  %46 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 2
  %50 = load i32, i32* %49, align 4
  %51 = call i8* @amrit_str_from_i32(i32 %50)
  call void @amrit_print(i8* %51)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
