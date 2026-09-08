%struct.amrit_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @amrit_free_arena() #1
declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #1
declare void @amrit_panic_index(i64 noundef, i64 noundef) #2

define internal noundef i32 @first(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  %7 = load i32, i32* %6, align 4
  ret i32 %7
}

define noundef i32 @amrit_main() #0 {
entry:
  %xs.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %flags.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr.1 = alloca %struct.amrit_array, align 8
  %arr.data.1 = alloca [2 x i1], align 8
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
  store i32 10, i32* %5, align 4
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 20, i32* %6, align 4
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 30, i32* %7, align 4
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %xs.addr, align 8
  %8 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %9 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = call i8* @amrit_str_from_i32(i32 %11)
  call void @amrit_print(i8* %12)
  %13 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %14 = call i32 @first(%struct.amrit_array* %13)
  %15 = call i8* @amrit_str_from_i32(i32 %14)
  call void @amrit_print(i8* %15)
  %16 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8
  %19 = icmp ult i64 2, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 2, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 2
  %24 = load i32, i32* %23, align 4
  %25 = call i8* @amrit_str_from_i32(i32 %24)
  call void @amrit_print(i8* %25)
  %26 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %26, align 8
  %27 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %27, align 8
  %28 = bitcast [2 x i1]* %arr.data.1 to i8*
  %29 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 2
  store i8* %28, i8** %29, align 8
  %30 = bitcast i8* %28 to i1*
  %31 = getelementptr inbounds i1, i1* %30, i64 0
  store i1 true, i1* %31, align 1
  %32 = getelementptr inbounds i1, i1* %30, i64 1
  store i1 false, i1* %32, align 1
  store %struct.amrit_array* %arr.hdr.1, %struct.amrit_array** %flags.addr, align 8
  %33 = load %struct.amrit_array*, %struct.amrit_array** %flags.addr, align 8
  %34 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8
  %36 = icmp ult i64 1, %35
  br i1 %36, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 1, i64 %35)
  unreachable

bounds.ok.1:
  %37 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8
  %39 = bitcast i8* %38 to i1*
  %40 = getelementptr inbounds i1, i1* %39, i64 1
  %41 = load i1, i1* %40, align 1
  %42 = select i1 %41, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @amrit_print(i8* %42)
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
