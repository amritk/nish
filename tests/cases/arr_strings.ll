%struct.sts_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"world\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"goodbye\00" }, align 8

declare void @sts_free_arena() #0
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @sts_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @sts_panic_index(i64 noundef, i64 noundef) #3

define noundef nonnull align 8 i8* @join(%struct.sts_array* noundef nonnull align 8 readonly nocapture %words) #0 {
entry:
  %out.addr = alloca i8*, align 8
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %out.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %words, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %words, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %0
  %8 = load i8*, i8** %7, align 8
  store i8* %8, i8** %w.addr, align 8
  %9 = load i8*, i8** %out.addr, align 8
  %10 = load i8*, i8** %w.addr, align 8
  %11 = call i8* @sts_str_concat(i8* %9, i8* %10)
  store i8* %11, i8** %out.addr, align 8
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load i8*, i8** %out.addr, align 8
  ret i8* %14
}

define noundef i32 @sts_main() #1 {
entry:
  %words.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [3 x i8*], align 8
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8
  %2 = bitcast [3 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8** %5, align 8
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*), i8** %6, align 8
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8** %7, align 8
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %words.addr, align 8
  %8 = load %struct.sts_array*, %struct.sts_array** %words.addr, align 8
  %9 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8
  %11 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %8, i64 0, i32 1
  %12 = load i64, i64* %11, align 8
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @sts_array_grow(%struct.sts_array* %8, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %8, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8
  %16 = bitcast i8* %15 to i8**
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10
  store i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8** %17, align 8
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8
  %19 = trunc i64 %18 to i32
  %20 = load %struct.sts_array*, %struct.sts_array** %words.addr, align 8
  %21 = call i8* @join(%struct.sts_array* %20)
  call void @sts_print(i8* %21)
  %22 = load %struct.sts_array*, %struct.sts_array** %words.addr, align 8
  %23 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8
  %25 = icmp ult i64 3, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 3, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 3
  %30 = load i8*, i8** %29, align 8
  %31 = call zeroext i1 @sts_str_eq(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %32 = select i1 %31, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  call void @sts_print(i8* %32)
  %33 = load %struct.sts_array*, %struct.sts_array** %words.addr, align 8
  %34 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8
  %36 = icmp ult i64 0, %35
  br i1 %36, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok.1:
  %37 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8
  %39 = bitcast i8* %38 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 0
  store i8* bitcast ({ i64, [8 x i8] }* @.str.7 to i8*), i8** %40, align 8
  %41 = load %struct.sts_array*, %struct.sts_array** %words.addr, align 8
  %42 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8
  %44 = icmp ult i64 0, %43
  br i1 %44, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @sts_panic_index(i64 0, i64 %43)
  unreachable

bounds.ok.2:
  %45 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %41, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8
  %47 = bitcast i8* %46 to i8**
  %48 = getelementptr inbounds i8*, i8** %47, i64 0
  %49 = load i8*, i8** %48, align 8
  call void @sts_print(i8* %49)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
