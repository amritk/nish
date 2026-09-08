%struct.amrit_array = type { i64, i64, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"alpha\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"beta\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"solo\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@amrit_arena = external global %struct.amrit_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #1
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @amrit_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare void @amrit_array_grow(%struct.amrit_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #2 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @amrit_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef nonnull align 8 i8* @report(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %parts) #0 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %parts, i64 0, i32 0
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
  %10 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %parts, i64 0, i32 2
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
  %22 = call i8* @amrit_alloc_struct(i64 %21)
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
  %32 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %parts, i64 0, i32 2
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
  %parts.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %empty.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr.1 = alloca %struct.amrit_array, align 8
  %one.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr.2 = alloca %struct.amrit_array, align 8
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
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8
  %2 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %parts.addr, align 8
  %3 = load %struct.amrit_array*, %struct.amrit_array** %parts.addr, align 8
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8
  %6 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %3, i64 0, i32 1
  %7 = load i64, i64* %6, align 8
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @amrit_array_grow(%struct.amrit_array* %3, i64 8)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %3, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 %5
  store i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8** %12, align 8
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8
  %14 = trunc i64 %13 to i32
  %15 = load %struct.amrit_array*, %struct.amrit_array** %parts.addr, align 8
  %16 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8
  %18 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @amrit_array_grow(%struct.amrit_array* %15, i64 8)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8
  %23 = bitcast i8* %22 to i8**
  %24 = getelementptr inbounds i8*, i8** %23, i64 %17
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %24, align 8
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %27, align 8
  %28 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %28, align 8
  %29 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %29, align 8
  store %struct.amrit_array* %arr.hdr.1, %struct.amrit_array** %empty.addr, align 8
  %30 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.2, i64 0, i32 0
  store i64 1, i64* %30, align 8
  %31 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.2, i64 0, i32 1
  store i64 1, i64* %31, align 8
  %32 = bitcast [1 x i8*]* %arr.data to i8*
  %33 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr.2, i64 0, i32 2
  store i8* %32, i8** %33, align 8
  %34 = bitcast i8* %32 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %35, align 8
  store %struct.amrit_array* %arr.hdr.2, %struct.amrit_array** %one.addr, align 8
  %36 = load %struct.amrit_array*, %struct.amrit_array** %parts.addr, align 8
  %37 = call i64 @amrit_arena_mark()
  %38 = call i8* @report(%struct.amrit_array* %36)
  %39 = call i8* @amrit_arena_keep(i64 %37, i8* %38)
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = trunc i64 %41 to i32
  %43 = mul nsw i32 %42, 1000
  %44 = load %struct.amrit_array*, %struct.amrit_array** %one.addr, align 8
  %45 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8
  %47 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %48 = load i64, i64* %47, align 8
  %49 = sub i64 %46, 1
  %50 = mul i64 %48, %49
  %51 = icmp eq i64 %46, 0
  %52 = select i1 %51, i64 0, i64 %50
  store i64 %52, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %53 = load i64, i64* %join.at, align 8
  %54 = icmp ult i64 %53, %46
  br i1 %54, label %join.sum.body, label %join.copy

join.sum.body:
  %55 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %44, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8
  %57 = bitcast i8* %56 to i8**
  %58 = getelementptr inbounds i8*, i8** %57, i64 %53
  %59 = load i8*, i8** %58, align 8
  %60 = load i64, i64* %join.total, align 8
  %61 = bitcast i8* %59 to i64*
  %62 = load i64, i64* %61, align 8
  %63 = add i64 %60, %62
  store i64 %63, i64* %join.total, align 8
  %64 = add i64 %53, 1
  store i64 %64, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %65 = load i64, i64* %join.total, align 8
  %66 = add i64 %65, 9
  %67 = call i8* @amrit_alloc_struct(i64 %66)
  %68 = bitcast i8* %67 to i64*
  store i64 %65, i64* %68, align 8
  %69 = getelementptr inbounds i8, i8* %67, i64 8
  store i8* %69, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %70 = load i64, i64* %join.at, align 8
  %71 = icmp ult i64 %70, %46
  br i1 %71, label %join.part, label %join.end

join.part:
  %72 = load i8*, i8** %join.p, align 8
  %73 = icmp eq i64 %70, 0
  %74 = select i1 %73, i64 0, i64 %48
  %75 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %72, i8* %75, i64 %74, i1 false)
  %76 = getelementptr inbounds i8, i8* %72, i64 %74
  %77 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %44, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8
  %79 = bitcast i8* %78 to i8**
  %80 = getelementptr inbounds i8*, i8** %79, i64 %70
  %81 = load i8*, i8** %80, align 8
  %82 = bitcast i8* %81 to i64*
  %83 = load i64, i64* %82, align 8
  %84 = getelementptr inbounds i8, i8* %81, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %76, i8* %84, i64 %83, i1 false)
  %85 = getelementptr inbounds i8, i8* %76, i64 %83
  store i8* %85, i8** %join.p, align 8
  %86 = add i64 %70, 1
  store i64 %86, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %87 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %87, align 1
  %88 = bitcast i8* %67 to i64*
  %89 = load i64, i64* %88, align 8
  %90 = trunc i64 %89 to i32
  %91 = mul nsw i32 %90, 10
  %92 = add nsw i32 %43, %91
  %93 = load %struct.amrit_array*, %struct.amrit_array** %empty.addr, align 8
  %94 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8
  %96 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %97 = load i64, i64* %96, align 8
  %98 = sub i64 %95, 1
  %99 = mul i64 %97, %98
  %100 = icmp eq i64 %95, 0
  %101 = select i1 %100, i64 0, i64 %99
  store i64 %101, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %102 = load i64, i64* %join.at.1, align 8
  %103 = icmp ult i64 %102, %95
  br i1 %103, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %104 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %93, i64 0, i32 2
  %105 = load i8*, i8** %104, align 8
  %106 = bitcast i8* %105 to i8**
  %107 = getelementptr inbounds i8*, i8** %106, i64 %102
  %108 = load i8*, i8** %107, align 8
  %109 = load i64, i64* %join.total.1, align 8
  %110 = bitcast i8* %108 to i64*
  %111 = load i64, i64* %110, align 8
  %112 = add i64 %109, %111
  store i64 %112, i64* %join.total.1, align 8
  %113 = add i64 %102, 1
  store i64 %113, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %114 = load i64, i64* %join.total.1, align 8
  %115 = add i64 %114, 9
  %116 = call i8* @amrit_alloc_struct(i64 %115)
  %117 = bitcast i8* %116 to i64*
  store i64 %114, i64* %117, align 8
  %118 = getelementptr inbounds i8, i8* %116, i64 8
  store i8* %118, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %119 = load i64, i64* %join.at.1, align 8
  %120 = icmp ult i64 %119, %95
  br i1 %120, label %join.part.1, label %join.end.1

join.part.1:
  %121 = load i8*, i8** %join.p.1, align 8
  %122 = icmp eq i64 %119, 0
  %123 = select i1 %122, i64 0, i64 %97
  %124 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %121, i8* %124, i64 %123, i1 false)
  %125 = getelementptr inbounds i8, i8* %121, i64 %123
  %126 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %93, i64 0, i32 2
  %127 = load i8*, i8** %126, align 8
  %128 = bitcast i8* %127 to i8**
  %129 = getelementptr inbounds i8*, i8** %128, i64 %119
  %130 = load i8*, i8** %129, align 8
  %131 = bitcast i8* %130 to i64*
  %132 = load i64, i64* %131, align 8
  %133 = getelementptr inbounds i8, i8* %130, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %125, i8* %133, i64 %132, i1 false)
  %134 = getelementptr inbounds i8, i8* %125, i64 %132
  store i8* %134, i8** %join.p.1, align 8
  %135 = add i64 %119, 1
  store i64 %135, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %136 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %136, align 1
  %137 = bitcast i8* %116 to i64*
  %138 = load i64, i64* %137, align 8
  %139 = trunc i64 %138 to i32
  %140 = add nsw i32 %92, %139
  %141 = load %struct.amrit_array*, %struct.amrit_array** %parts.addr, align 8
  %142 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %141, i64 0, i32 0
  %143 = load i64, i64* %142, align 8
  %144 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*) to i64*
  %145 = load i64, i64* %144, align 8
  %146 = sub i64 %143, 1
  %147 = mul i64 %145, %146
  %148 = icmp eq i64 %143, 0
  %149 = select i1 %148, i64 0, i64 %147
  store i64 %149, i64* %join.total.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.sum.2

join.sum.2:
  %150 = load i64, i64* %join.at.2, align 8
  %151 = icmp ult i64 %150, %143
  br i1 %151, label %join.sum.body.2, label %join.copy.2

join.sum.body.2:
  %152 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %141, i64 0, i32 2
  %153 = load i8*, i8** %152, align 8
  %154 = bitcast i8* %153 to i8**
  %155 = getelementptr inbounds i8*, i8** %154, i64 %150
  %156 = load i8*, i8** %155, align 8
  %157 = load i64, i64* %join.total.2, align 8
  %158 = bitcast i8* %156 to i64*
  %159 = load i64, i64* %158, align 8
  %160 = add i64 %157, %159
  store i64 %160, i64* %join.total.2, align 8
  %161 = add i64 %150, 1
  store i64 %161, i64* %join.at.2, align 8
  br label %join.sum.2

join.copy.2:
  %162 = load i64, i64* %join.total.2, align 8
  %163 = add i64 %162, 9
  %164 = call i8* @amrit_alloc_struct(i64 %163)
  %165 = bitcast i8* %164 to i64*
  store i64 %162, i64* %165, align 8
  %166 = getelementptr inbounds i8, i8* %164, i64 8
  store i8* %166, i8** %join.p.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.copy.body.2:
  %167 = load i64, i64* %join.at.2, align 8
  %168 = icmp ult i64 %167, %143
  br i1 %168, label %join.part.2, label %join.end.2

join.part.2:
  %169 = load i8*, i8** %join.p.2, align 8
  %170 = icmp eq i64 %167, 0
  %171 = select i1 %170, i64 0, i64 %145
  %172 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %169, i8* %172, i64 %171, i1 false)
  %173 = getelementptr inbounds i8, i8* %169, i64 %171
  %174 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %141, i64 0, i32 2
  %175 = load i8*, i8** %174, align 8
  %176 = bitcast i8* %175 to i8**
  %177 = getelementptr inbounds i8*, i8** %176, i64 %167
  %178 = load i8*, i8** %177, align 8
  %179 = bitcast i8* %178 to i64*
  %180 = load i64, i64* %179, align 8
  %181 = getelementptr inbounds i8, i8* %178, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %173, i8* %181, i64 %180, i1 false)
  %182 = getelementptr inbounds i8, i8* %173, i64 %180
  store i8* %182, i8** %join.p.2, align 8
  %183 = add i64 %167, 1
  store i64 %183, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.end.2:
  %184 = load i8*, i8** %join.p.2, align 8
  store i8 0, i8* %184, align 1
  %185 = bitcast i8* %164 to i64*
  %186 = load i64, i64* %185, align 8
  %187 = trunc i64 %186 to i32
  %188 = add nsw i32 %140, %187
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 %188
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }
