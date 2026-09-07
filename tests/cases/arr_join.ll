%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"alpha\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"beta\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"solo\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@sts_arena = external global %struct.sts_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #1
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #2 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef nonnull align 8 i8* @report(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %parts) #0 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %parts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8
  %2 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*) to i64*
  %3 = load i64, i64* %2, align 8
  %4 = sub i64 %1, 1
  %5 = mul i64 %3, %4
  %6 = icmp eq i64 %1, 0
  %7 = select i1 %6, i64 0, i64 %5
  store i64 %7, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %8 = load i64, i64* %join.at, align 8
  %9 = icmp ult i64 %8, %1
  br i1 %9, label %join.sum.body, label %join.copy

join.sum.body:
  %10 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %parts, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %8
  %14 = load i8*, i8** %13, align 8
  %15 = load i64, i64* %join.total, align 8
  %16 = bitcast i8* %14 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = add i64 %15, %17
  store i64 %18, i64* %join.total, align 8
  %19 = add i64 %8, 1
  store i64 %19, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %20 = load i64, i64* %join.total, align 8
  %21 = add i64 %20, 9
  %22 = call i8* @sts_alloc_struct(i64 %21)
  %23 = bitcast i8* %22 to i64*
  store i64 %20, i64* %23, align 8
  %24 = getelementptr inbounds i8, i8* %22, i64 8
  store i8* %24, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %25 = load i64, i64* %join.at, align 8
  %26 = icmp ult i64 %25, %1
  br i1 %26, label %join.part, label %join.end

join.part:
  %27 = load i8*, i8** %join.p, align 8
  %28 = icmp eq i64 %25, 0
  %29 = select i1 %28, i64 0, i64 %3
  %30 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %27, i8* %30, i64 %29, i1 false)
  %31 = getelementptr inbounds i8, i8* %27, i64 %29
  %32 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %parts, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8
  %34 = bitcast i8* %33 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 %25
  %36 = load i8*, i8** %35, align 8
  %37 = bitcast i8* %36 to i64*
  %38 = load i64, i64* %37, align 8
  %39 = getelementptr inbounds i8, i8* %36, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %31, i8* %39, i64 %38, i1 false)
  %40 = getelementptr inbounds i8, i8* %31, i64 %38
  store i8* %40, i8** %join.p, align 8
  %41 = add i64 %25, 1
  store i64 %41, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %42 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %42, align 1
  ret i8* %22
}

define noundef i32 @test() #0 {
entry:
  %parts.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %empty.addr = alloca %struct.sts_array*, align 8
  %arr.hdr.1 = alloca %struct.sts_array, align 8
  %one.addr = alloca %struct.sts_array*, align 8
  %arr.hdr.2 = alloca %struct.sts_array, align 8
  %arr.data = alloca [1 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %join.total.1 = alloca i64, align 8
  %join.at.1 = alloca i64, align 8
  %join.p.1 = alloca i8*, align 8
  %join.total.2 = alloca i64, align 8
  %join.at.2 = alloca i64, align 8
  %join.p.2 = alloca i8*, align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %parts.addr, align 8
  %3 = load %struct.sts_array*, %struct.sts_array** %parts.addr, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8
  %6 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %3, i64 0, i32 1
  %7 = load i64, i64* %6, align 8
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @sts_array_grow(%struct.sts_array* %3, i64 8)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %3, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 %5
  store i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8** %12, align 8
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8
  %14 = trunc i64 %13 to i32
  %15 = load %struct.sts_array*, %struct.sts_array** %parts.addr, align 8
  %16 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8
  %18 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @sts_array_grow(%struct.sts_array* %15, i64 8)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8
  %23 = bitcast i8* %22 to i8**
  %24 = getelementptr inbounds i8*, i8** %23, i64 %17
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %24, align 8
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %27, align 8
  %28 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %28, align 8
  %29 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %29, align 8
  store %struct.sts_array* %arr.hdr.1, %struct.sts_array** %empty.addr, align 8
  %30 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr.2, i64 0, i32 0
  store i64 1, i64* %30, align 8
  %31 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr.2, i64 0, i32 1
  store i64 1, i64* %31, align 8
  %32 = bitcast [1 x i8*]* %arr.data to i8*
  %33 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr.2, i64 0, i32 2
  store i8* %32, i8** %33, align 8
  %34 = bitcast i8* %32 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %35, align 8
  store %struct.sts_array* %arr.hdr.2, %struct.sts_array** %one.addr, align 8
  %36 = load %struct.sts_array*, %struct.sts_array** %parts.addr, align 8
  %37 = call i8* @report(%struct.sts_array* %36)
  %38 = bitcast i8* %37 to i64*
  %39 = load i64, i64* %38, align 8
  %40 = trunc i64 %39 to i32
  %41 = mul i32 %40, 1000
  %42 = load %struct.sts_array*, %struct.sts_array** %one.addr, align 8
  %43 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8
  %45 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %46 = load i64, i64* %45, align 8
  %47 = sub i64 %44, 1
  %48 = mul i64 %46, %47
  %49 = icmp eq i64 %44, 0
  %50 = select i1 %49, i64 0, i64 %48
  store i64 %50, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %51 = load i64, i64* %join.at, align 8
  %52 = icmp ult i64 %51, %44
  br i1 %52, label %join.sum.body, label %join.copy

join.sum.body:
  %53 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %42, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8
  %55 = bitcast i8* %54 to i8**
  %56 = getelementptr inbounds i8*, i8** %55, i64 %51
  %57 = load i8*, i8** %56, align 8
  %58 = load i64, i64* %join.total, align 8
  %59 = bitcast i8* %57 to i64*
  %60 = load i64, i64* %59, align 8
  %61 = add i64 %58, %60
  store i64 %61, i64* %join.total, align 8
  %62 = add i64 %51, 1
  store i64 %62, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %63 = load i64, i64* %join.total, align 8
  %64 = add i64 %63, 9
  %65 = call i8* @sts_alloc_struct(i64 %64)
  %66 = bitcast i8* %65 to i64*
  store i64 %63, i64* %66, align 8
  %67 = getelementptr inbounds i8, i8* %65, i64 8
  store i8* %67, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %68 = load i64, i64* %join.at, align 8
  %69 = icmp ult i64 %68, %44
  br i1 %69, label %join.part, label %join.end

join.part:
  %70 = load i8*, i8** %join.p, align 8
  %71 = icmp eq i64 %68, 0
  %72 = select i1 %71, i64 0, i64 %46
  %73 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %70, i8* %73, i64 %72, i1 false)
  %74 = getelementptr inbounds i8, i8* %70, i64 %72
  %75 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %42, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8
  %77 = bitcast i8* %76 to i8**
  %78 = getelementptr inbounds i8*, i8** %77, i64 %68
  %79 = load i8*, i8** %78, align 8
  %80 = bitcast i8* %79 to i64*
  %81 = load i64, i64* %80, align 8
  %82 = getelementptr inbounds i8, i8* %79, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %74, i8* %82, i64 %81, i1 false)
  %83 = getelementptr inbounds i8, i8* %74, i64 %81
  store i8* %83, i8** %join.p, align 8
  %84 = add i64 %68, 1
  store i64 %84, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %85 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %85, align 1
  %86 = bitcast i8* %65 to i64*
  %87 = load i64, i64* %86, align 8
  %88 = trunc i64 %87 to i32
  %89 = mul i32 %88, 10
  %90 = add i32 %41, %89
  %91 = load %struct.sts_array*, %struct.sts_array** %empty.addr, align 8
  %92 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %91, i64 0, i32 0
  %93 = load i64, i64* %92, align 8
  %94 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %95 = load i64, i64* %94, align 8
  %96 = sub i64 %93, 1
  %97 = mul i64 %95, %96
  %98 = icmp eq i64 %93, 0
  %99 = select i1 %98, i64 0, i64 %97
  store i64 %99, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %100 = load i64, i64* %join.at.1, align 8
  %101 = icmp ult i64 %100, %93
  br i1 %101, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %102 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %91, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8
  %104 = bitcast i8* %103 to i8**
  %105 = getelementptr inbounds i8*, i8** %104, i64 %100
  %106 = load i8*, i8** %105, align 8
  %107 = load i64, i64* %join.total.1, align 8
  %108 = bitcast i8* %106 to i64*
  %109 = load i64, i64* %108, align 8
  %110 = add i64 %107, %109
  store i64 %110, i64* %join.total.1, align 8
  %111 = add i64 %100, 1
  store i64 %111, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %112 = load i64, i64* %join.total.1, align 8
  %113 = add i64 %112, 9
  %114 = call i8* @sts_alloc_struct(i64 %113)
  %115 = bitcast i8* %114 to i64*
  store i64 %112, i64* %115, align 8
  %116 = getelementptr inbounds i8, i8* %114, i64 8
  store i8* %116, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %117 = load i64, i64* %join.at.1, align 8
  %118 = icmp ult i64 %117, %93
  br i1 %118, label %join.part.1, label %join.end.1

join.part.1:
  %119 = load i8*, i8** %join.p.1, align 8
  %120 = icmp eq i64 %117, 0
  %121 = select i1 %120, i64 0, i64 %95
  %122 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %119, i8* %122, i64 %121, i1 false)
  %123 = getelementptr inbounds i8, i8* %119, i64 %121
  %124 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %91, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8
  %126 = bitcast i8* %125 to i8**
  %127 = getelementptr inbounds i8*, i8** %126, i64 %117
  %128 = load i8*, i8** %127, align 8
  %129 = bitcast i8* %128 to i64*
  %130 = load i64, i64* %129, align 8
  %131 = getelementptr inbounds i8, i8* %128, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %123, i8* %131, i64 %130, i1 false)
  %132 = getelementptr inbounds i8, i8* %123, i64 %130
  store i8* %132, i8** %join.p.1, align 8
  %133 = add i64 %117, 1
  store i64 %133, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %134 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %134, align 1
  %135 = bitcast i8* %114 to i64*
  %136 = load i64, i64* %135, align 8
  %137 = trunc i64 %136 to i32
  %138 = add i32 %90, %137
  %139 = load %struct.sts_array*, %struct.sts_array** %parts.addr, align 8
  %140 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %139, i64 0, i32 0
  %141 = load i64, i64* %140, align 8
  %142 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*) to i64*
  %143 = load i64, i64* %142, align 8
  %144 = sub i64 %141, 1
  %145 = mul i64 %143, %144
  %146 = icmp eq i64 %141, 0
  %147 = select i1 %146, i64 0, i64 %145
  store i64 %147, i64* %join.total.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.sum.2

join.sum.2:
  %148 = load i64, i64* %join.at.2, align 8
  %149 = icmp ult i64 %148, %141
  br i1 %149, label %join.sum.body.2, label %join.copy.2

join.sum.body.2:
  %150 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %139, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8
  %152 = bitcast i8* %151 to i8**
  %153 = getelementptr inbounds i8*, i8** %152, i64 %148
  %154 = load i8*, i8** %153, align 8
  %155 = load i64, i64* %join.total.2, align 8
  %156 = bitcast i8* %154 to i64*
  %157 = load i64, i64* %156, align 8
  %158 = add i64 %155, %157
  store i64 %158, i64* %join.total.2, align 8
  %159 = add i64 %148, 1
  store i64 %159, i64* %join.at.2, align 8
  br label %join.sum.2

join.copy.2:
  %160 = load i64, i64* %join.total.2, align 8
  %161 = add i64 %160, 9
  %162 = call i8* @sts_alloc_struct(i64 %161)
  %163 = bitcast i8* %162 to i64*
  store i64 %160, i64* %163, align 8
  %164 = getelementptr inbounds i8, i8* %162, i64 8
  store i8* %164, i8** %join.p.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.copy.body.2:
  %165 = load i64, i64* %join.at.2, align 8
  %166 = icmp ult i64 %165, %141
  br i1 %166, label %join.part.2, label %join.end.2

join.part.2:
  %167 = load i8*, i8** %join.p.2, align 8
  %168 = icmp eq i64 %165, 0
  %169 = select i1 %168, i64 0, i64 %143
  %170 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %167, i8* %170, i64 %169, i1 false)
  %171 = getelementptr inbounds i8, i8* %167, i64 %169
  %172 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %139, i64 0, i32 2
  %173 = load i8*, i8** %172, align 8
  %174 = bitcast i8* %173 to i8**
  %175 = getelementptr inbounds i8*, i8** %174, i64 %165
  %176 = load i8*, i8** %175, align 8
  %177 = bitcast i8* %176 to i64*
  %178 = load i64, i64* %177, align 8
  %179 = getelementptr inbounds i8, i8* %176, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %171, i8* %179, i64 %178, i1 false)
  %180 = getelementptr inbounds i8, i8* %171, i64 %178
  store i8* %180, i8** %join.p.2, align 8
  %181 = add i64 %165, 1
  store i64 %181, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.end.2:
  %182 = load i8*, i8** %join.p.2, align 8
  store i8 0, i8* %182, align 1
  %183 = bitcast i8* %162 to i64*
  %184 = load i64, i64* %183, align 8
  %185 = trunc i64 %184 to i32
  %186 = add i32 %138, %185
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 %186
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }
