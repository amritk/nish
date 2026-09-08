%struct.amrit_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8

declare zeroext i1 @amrit_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @amrit_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @test() #0 {
entry:
  %names.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [3 x i8*], align 8
  %last.addr = alloca i8*, align 8
  %nums.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr.1 = alloca %struct.amrit_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %idx.at = alloca i64, align 8
  %idx.at.1 = alloca i64, align 8
  %idx.at.2 = alloca i64, align 8
  %idx.at.3 = alloca i64, align 8
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8
  %2 = bitcast [3 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %5, align 8
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %6, align 8
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %7, align 8
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %names.addr, align 8
  %8 = load %struct.amrit_array*, %struct.amrit_array** %names.addr, align 8
  %9 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8
  %11 = icmp eq i64 %10, 0
  br i1 %11, label %pop.empty, label %pop.ok

pop.empty:
  call void @amrit_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %12 = sub i64 %10, 1
  store i64 %12, i64* %9, align 8
  %13 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %8, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %12
  %17 = load i8*, i8** %16, align 8
  store i8* %17, i8** %last.addr, align 8
  %18 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %18, align 8
  %19 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %19, align 8
  %20 = bitcast [3 x i32]* %arr.data.1 to i8*
  %21 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 2
  store i8* %20, i8** %21, align 8
  %22 = bitcast i8* %20 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 0
  store i32 4, i32* %23, align 4
  %24 = getelementptr inbounds i32, i32* %22, i64 1
  store i32 8, i32* %24, align 4
  %25 = getelementptr inbounds i32, i32* %22, i64 2
  store i32 15, i32* %25, align 4
  store %struct.amrit_array* %arr.hdr.1, %struct.amrit_array** %nums.addr, align 8
  %26 = load %struct.amrit_array*, %struct.amrit_array** %names.addr, align 8
  %27 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8
  %29 = trunc i64 %28 to i32
  %30 = mul i32 %29, 100000
  %31 = load %struct.amrit_array*, %struct.amrit_array** %names.addr, align 8
  %32 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8
  store i64 0, i64* %idx.at, align 8
  br label %idx.scan

idx.scan:
  %34 = load i64, i64* %idx.at, align 8
  %35 = icmp ult i64 %34, %33
  br i1 %35, label %idx.test, label %idx.miss

idx.test:
  %36 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %31, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8
  %38 = bitcast i8* %37 to i8**
  %39 = getelementptr inbounds i8*, i8** %38, i64 %34
  %40 = load i8*, i8** %39, align 8
  %41 = call zeroext i1 @amrit_str_eq(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  br i1 %41, label %idx.found, label %idx.next

idx.next:
  %42 = add i64 %34, 1
  store i64 %42, i64* %idx.at, align 8
  br label %idx.scan

idx.miss:
  br label %idx.found

idx.found:
  %43 = phi i64 [ %34, %idx.test ], [ -1, %idx.miss ]
  %44 = trunc i64 %43 to i32
  %45 = mul i32 %44, 10000
  %46 = add i32 %30, %45
  %47 = load i8*, i8** %last.addr, align 8
  %48 = call zeroext i1 @amrit_str_eq(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  br i1 %48, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %49 = phi i32 [ 1000, %cond.true ], [ 0, %cond.false ]
  %50 = add i32 %46, %49
  %51 = load %struct.amrit_array*, %struct.amrit_array** %nums.addr, align 8
  %52 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %51, i64 0, i32 0
  %53 = load i64, i64* %52, align 8
  store i64 0, i64* %idx.at.1, align 8
  br label %idx.scan.1

idx.scan.1:
  %54 = load i64, i64* %idx.at.1, align 8
  %55 = icmp ult i64 %54, %53
  br i1 %55, label %idx.test.1, label %idx.miss.1

idx.test.1:
  %56 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %51, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %54
  %60 = load i32, i32* %59, align 4
  %61 = icmp eq i32 %60, 15
  br i1 %61, label %idx.found.1, label %idx.next.1

idx.next.1:
  %62 = add i64 %54, 1
  store i64 %62, i64* %idx.at.1, align 8
  br label %idx.scan.1

idx.miss.1:
  br label %idx.found.1

idx.found.1:
  %63 = phi i64 [ %54, %idx.test.1 ], [ -1, %idx.miss.1 ]
  %64 = trunc i64 %63 to i32
  %65 = add i32 %64, 1
  %66 = mul i32 %65, 100
  %67 = add i32 %50, %66
  %68 = load %struct.amrit_array*, %struct.amrit_array** %nums.addr, align 8
  %69 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %68, i64 0, i32 0
  %70 = load i64, i64* %69, align 8
  store i64 0, i64* %idx.at.2, align 8
  br label %idx.scan.2

idx.scan.2:
  %71 = load i64, i64* %idx.at.2, align 8
  %72 = icmp ult i64 %71, %70
  br i1 %72, label %idx.test.2, label %idx.miss.2

idx.test.2:
  %73 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %68, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8
  %75 = bitcast i8* %74 to i32*
  %76 = getelementptr inbounds i32, i32* %75, i64 %71
  %77 = load i32, i32* %76, align 4
  %78 = icmp eq i32 %77, 99
  br i1 %78, label %idx.found.2, label %idx.next.2

idx.next.2:
  %79 = add i64 %71, 1
  store i64 %79, i64* %idx.at.2, align 8
  br label %idx.scan.2

idx.miss.2:
  br label %idx.found.2

idx.found.2:
  %80 = phi i64 [ %71, %idx.test.2 ], [ -1, %idx.miss.2 ]
  %81 = trunc i64 %80 to i32
  %82 = add i32 %81, 1
  %83 = mul i32 %82, 10
  %84 = add i32 %67, %83
  %85 = load %struct.amrit_array*, %struct.amrit_array** %names.addr, align 8
  %86 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %85, i64 0, i32 0
  %87 = load i64, i64* %86, align 8
  store i64 0, i64* %idx.at.3, align 8
  br label %idx.scan.3

idx.scan.3:
  %88 = load i64, i64* %idx.at.3, align 8
  %89 = icmp ult i64 %88, %87
  br i1 %89, label %idx.test.3, label %idx.miss.3

idx.test.3:
  %90 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %85, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8
  %92 = bitcast i8* %91 to i8**
  %93 = getelementptr inbounds i8*, i8** %92, i64 %88
  %94 = load i8*, i8** %93, align 8
  %95 = call zeroext i1 @amrit_str_eq(i8* %94, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  br i1 %95, label %idx.found.3, label %idx.next.3

idx.next.3:
  %96 = add i64 %88, 1
  store i64 %96, i64* %idx.at.3, align 8
  br label %idx.scan.3

idx.miss.3:
  br label %idx.found.3

idx.found.3:
  %97 = phi i64 [ %88, %idx.test.3 ], [ -1, %idx.miss.3 ]
  %98 = trunc i64 %97 to i32
  %99 = add i32 %98, 1
  %100 = add i32 %84, %99
  ret i32 %100
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn memory(argmem: read) }
attributes #2 = { nounwind noreturn cold }
