%struct.sts_array = type { i64, i64, i8* }

declare void @sts_free_arena() #1
declare noundef i64 @sts_arena_mark() #1
declare void @sts_arena_release(i64 noundef) #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1
declare void @sts_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @pick(%struct.sts_array* noundef nonnull align 8 readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4
  ret i32 %8
}

define noundef i32 @sts_main() #0 {
entry:
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arr.hdr.1 = alloca %struct.sts_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4
  %8 = call i32 @pick(%struct.sts_array* %arr.hdr, i32 2)
  %9 = call i8* @sts_str_from_i32(i32 %8)
  call void @sts_print(i8* %9)
  %10 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %10, align 8
  %11 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %11, align 8
  %12 = bitcast [3 x i32]* %arr.data.1 to i8*
  %13 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr.1, i64 0, i32 2
  store i8* %12, i8** %13, align 8
  %14 = bitcast i8* %12 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  store i32 1, i32* %15, align 4
  %16 = getelementptr inbounds i32, i32* %14, i64 1
  store i32 2, i32* %16, align 4
  %17 = getelementptr inbounds i32, i32* %14, i64 2
  store i32 3, i32* %17, align 4
  %18 = call i32 @pick(%struct.sts_array* %arr.hdr.1, i32 5)
  %19 = call i8* @sts_str_from_i32(i32 %18)
  call void @sts_print(i8* %19)
  call void @sts_arena_release(i64 %arena.mark)
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
