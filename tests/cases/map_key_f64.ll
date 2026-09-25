%struct.Map$f64$str = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"minus zero\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"nan\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"sum\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"plus zero\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"another nan\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"inf\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"-inf\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [32 x i8] } { i64 31, [32 x i8] c"Map: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_exit(i32 noundef) #4
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare double @llvm.sqrt.f64(double) #1
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i64 @llvm.fptosi.sat.i64.f64(double) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Map$f64$str*, align 8
  %zero.addr = alloca double, align 8
  %inf.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.Map$f64$str*
  call void @nish.Map$f64$str.constructor(%struct.Map$f64$str* %1)
  store %struct.Map$f64$str* %1, %struct.Map$f64$str** %m.addr, align 8
  store double 0x0000000000000000, double* %zero.addr, align 8
  %2 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %3 = load double, double* %zero.addr, align 8
  %4 = fneg double %3
  %5 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %2, double %4, i8* bitcast ({ i64, [11 x i8] }* @.str.0 to i8*))
  %6 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %7 = load double, double* %zero.addr, align 8
  %8 = load double, double* %zero.addr, align 8
  %9 = fdiv double %7, %8
  %10 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %6, double %9, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %11 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %12 = fadd double 0x3FB999999999999A, 0x3FC999999999999A
  %13 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %11, double %12, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %14 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %15 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %14, i32 0, i32 0
  %16 = load double, double* %15, align 8, !tbaa !6
  %17 = call i8* @nish_str_from_f64(double %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %19 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %20 = load double, double* %zero.addr, align 8
  %21 = call i1 @nish.Map$f64$str.has(%struct.Map$f64$str* %19, double %20)
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %23 = call i8* @nish_str_concat(i8* %18, i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %25 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %26 = fneg double 0x3FF0000000000000
  %27 = call double @llvm.sqrt.f64(double %26)
  %28 = call i1 @nish.Map$f64$str.has(%struct.Map$f64$str* %25, double %27)
  %29 = select i1 %28, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %30 = call i8* @nish_str_concat(i8* %24, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %32 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %33 = call i1 @nish.Map$f64$str.has(%struct.Map$f64$str* %32, double 0x3FD3333333333333)
  %34 = select i1 %33, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %35 = call i8* @nish_str_concat(i8* %31, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %37 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %38 = fadd double 0x3FB999999999999A, 0x3FC999999999999A
  %39 = call i1 @nish.Map$f64$str.has(%struct.Map$f64$str* %37, double %38)
  %40 = select i1 %39, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %41 = call i8* @nish_str_concat(i8* %36, i8* %40)
  call void @nish_print(i8* %41)
  %42 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %43 = load double, double* %zero.addr, align 8
  %44 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %42, double %43, i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*))
  %45 = load double, double* %zero.addr, align 8
  %46 = load double, double* %zero.addr, align 8
  %47 = fdiv double %45, %46
  %48 = fneg double %47
  %49 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %44, double %48, i8* bitcast ({ i64, [12 x i8] }* @.str.7 to i8*))
  %50 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %51 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %50, i32 0, i32 0
  %52 = load double, double* %51, align 8, !tbaa !6
  %53 = call i8* @nish_str_from_f64(double %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %55 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %56 = load double, double* %zero.addr, align 8
  %57 = fneg double %56
  %58 = call i1 @nish.Map$f64$str.delete(%struct.Map$f64$str* %55, double %57)
  %59 = select i1 %58, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %60 = call i8* @nish_str_concat(i8* %54, i8* %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %62 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %63 = load double, double* %zero.addr, align 8
  %64 = call i1 @nish.Map$f64$str.has(%struct.Map$f64$str* %62, double %63)
  %65 = select i1 %64, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %66 = call i8* @nish_str_concat(i8* %61, i8* %65)
  %67 = call i8* @nish_str_concat(i8* %66, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %68 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %69 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %68, i32 0, i32 0
  %70 = load double, double* %69, align 8, !tbaa !6
  %71 = call i8* @nish_str_from_f64(double %70)
  %72 = call i8* @nish_str_concat(i8* %67, i8* %71)
  call void @nish_print(i8* %72)
  %73 = load double, double* %zero.addr, align 8
  %74 = fdiv double 0x3FF0000000000000, %73
  store double %74, double* %inf.addr, align 8
  %75 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %76 = load double, double* %inf.addr, align 8
  %77 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %75, double %76, i8* bitcast ({ i64, [4 x i8] }* @.str.8 to i8*))
  %78 = load double, double* %inf.addr, align 8
  %79 = fneg double %78
  %80 = call %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* %77, double %79, i8* bitcast ({ i64, [5 x i8] }* @.str.9 to i8*))
  %81 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %82 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %81, i32 0, i32 0
  %83 = load double, double* %82, align 8, !tbaa !6
  %84 = call i8* @nish_str_from_f64(double %83)
  %85 = call i8* @nish_str_concat(i8* %84, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %86 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %87 = load double, double* %zero.addr, align 8
  %88 = fdiv double 0x3FF0000000000000, %87
  %89 = call i1 @nish.Map$f64$str.has(%struct.Map$f64$str* %86, double %88)
  %90 = select i1 %89, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %91 = call i8* @nish_str_concat(i8* %85, i8* %90)
  %92 = call i8* @nish_str_concat(i8* %91, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %93 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %94 = fneg double 0x3FF0000000000000
  %95 = load double, double* %zero.addr, align 8
  %96 = fdiv double %94, %95
  %97 = call i1 @nish.Map$f64$str.has(%struct.Map$f64$str* %93, double %96)
  %98 = select i1 %97, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %99 = call i8* @nish_str_concat(i8* %92, i8* %98)
  %100 = call i8* @nish_str_concat(i8* %99, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %101 = load %struct.Map$f64$str*, %struct.Map$f64$str** %m.addr, align 8
  %102 = call i1 @nish.Map$f64$str.has(%struct.Map$f64$str* %101, double 0x7FE1CCF385EBC8A0)
  %103 = select i1 %102, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %104 = call i8* @nish_str_concat(i8* %100, i8* %103)
  call void @nish_print(i8* %104)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = add nsw i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = fneg double 0x3FF0000000000000
  %1 = call i64 @llvm.fptosi.sat.i64.f64(double %0)
  %2 = sext i32 %bucket to i64
  %3 = shl i64 %2, 32
  %4 = zext i32 %h to i64
  %5 = or i64 %3, %4
  %6 = sub nsw i64 %1, %5
  ret i64 %6
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = sitofp i64 %3 to double
  %10 = call i32 @llvm.fptosi.sat.i32.f64(double %9)
  %11 = icmp slt i32 %8, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %bucket.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %5 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %bucket.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %5 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  ret void

if.end:
  %24 = load i32, i32* %bucket.addr, align 4
  %25 = add nsw i32 %24, 1
  %26 = and i32 %25, %mask
  store i32 %26, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal noundef i32 @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %6 = load i32, i32* %from.addr, align 4
  %7 = load i32, i32* %used.addr, align 4
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %from.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %5 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %10
  %13 = load i32, i32* %12, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  store i32 %13, i32* %h.addr, align 4
  %14 = load i32, i32* %h.addr, align 4
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %16 = load i32, i32* %to.addr, align 4
  %17 = icmp sge i32 %16, 0
  br label %land.end.1

land.end.1:
  %18 = phi i1 [ false, %for.body ], [ %17, %land.rhs.1 ]
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load i32, i32* %to.addr, align 4
  %20 = load i32, i32* %used.addr, align 4
  %21 = icmp slt i32 %19, %20
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %if.then, label %if.end

if.then:
  %23 = load i32, i32* %to.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %h.addr, align 4
  %26 = bitcast i8* %5 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %24
  store i32 %25, i32* %27, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %28 = load i32, i32* %to.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %from.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %34 = sitofp i64 %33 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = load i32, i32* %to.addr, align 4
  %37 = icmp sgt i32 %35, %36
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %40 = icmp eq i64 %39, 0
  br i1 %40, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %41 = sub i64 %39, 1
  store i64 %41, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %41
  %46 = load i32, i32* %45, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %while.cond

while.end:
  %47 = load i32, i32* %to.addr, align 4
  ret i32 %47
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #2 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = mul nsw i32 %live, 2
  %5 = icmp slt i32 %4, %used
  br i1 %5, label %if.then, label %if.end

if.then:
  store i32 0, i32* %i.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  store i32 0, i32* %14, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret %struct.nish_array* %slots

if.end:
  %17 = load i32, i32* %n.addr, align 4
  %18 = mul nsw i32 %17, 2
  %19 = sext i32 %18 to i64
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 %19, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 %19, i64* %23, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %24 = mul i64 %19, 4
  %25 = call i8* @nish_alloc_struct(i64 %24)
  call void @llvm.memset.p0i8.i64(i8* align 8 %25, i8 0, i64 %24, i1 false), !alias.scope !11, !noalias !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %25, i8** %26, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  ret %struct.nish_array* %21
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  %4 = sub nsw i32 %3, 1
  store i32 %4, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = sitofp i64 %6 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp slt i32 %9, %11
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %mask.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %8 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %19 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %13, i32 %18, i32 %19)
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.Map$f64$str.constructor(%struct.Map$f64$str* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !20
  %2 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !21
  %3 = sext i32 8 to i64
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 %3, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 %3, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %8 = mul i64 %3, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !11, !noalias !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !22
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %17 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !23
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %23 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !24
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %29 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !25
  ret void
}

define internal noundef i64 @nish.Map$f64$str.probe(%struct.Map$f64$str* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, double noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !22
  %2 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !20
  %4 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !25
  %6 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !23
  %8 = call i64 @nish.probeTable$f64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, double %key)
  ret i64 %8
}

define internal noundef zeroext i1 @nish.Map$f64$str.has(%struct.Map$f64$str* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, double noundef %key) #0 {
entry:
  %0 = call i64 @nish.Map$f64$str.probe(%struct.Map$f64$str* %this, double %key)
  %1 = icmp sge i64 %0, 0
  ret i1 %1
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Map$f64$str* @nish.Map$f64$str.set(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(48) %this, double noundef %key, i8* noundef nonnull noalias readonly align 8 %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$f64$str.probe(%struct.Map$f64$str* %this, double %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$f64$str.setValueAt(%struct.Map$f64$str* %this, i32 %4, i8* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$f64$str.insertAt(%struct.Map$f64$str* %this, i64 %5, double %key, i8* %value)
  br label %if.end

if.end:
  ret %struct.Map$f64$str* %this
}

define internal noundef zeroext i1 @nish.Map$f64$str.delete(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(48) nocapture %this, double noundef %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %at.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i64 @nish.Map$f64$str.probe(%struct.Map$f64$str* %this, double %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %at.addr, align 4
  %5 = load i64, i64* %found.addr, align 8
  %6 = ashr i64 %5, 32
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %bucket.addr, align 4
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %bucket.addr, align 4
  %11 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !22
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %15 = sitofp i64 %14 to double
  %16 = call i32 @llvm.fptosi.sat.i32.f64(double %15)
  %17 = icmp slt i32 %10, %16
  br label %land.end

land.end:
  %18 = phi i1 [ false, %if.end ], [ %17, %land.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  %19 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !22
  %21 = load i32, i32* %bucket.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %22
  store i32 16777216, i32* %26, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end.1

if.end.1:
  %27 = load i32, i32* %at.addr, align 4
  %28 = icmp sge i32 %27, 0
  br i1 %28, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %29 = load i32, i32* %at.addr, align 4
  %30 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !25
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %34 = sitofp i64 %33 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %29, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %if.end.1 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then.2, label %if.end.2

if.then.2:
  %38 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %39 = load %struct.nish_array*, %struct.nish_array** %38, align 8, !tbaa !25
  %40 = load i32, i32* %at.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %41
  store i32 0, i32* %45, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end.2

if.end.2:
  %46 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  %47 = load i32, i32* %46, align 4, !tbaa !21
  %48 = sub nsw i32 %47, 1
  %49 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  store i32 %48, i32* %49, align 4, !tbaa !21
  %50 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 0
  %51 = load double, double* %50, align 8, !tbaa !6
  %52 = fsub double %51, 0x3FF0000000000000
  %53 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 0
  store double %52, double* %53, align 8, !tbaa !6
  ret i1 true
}

define internal void @nish.Map$f64$str.setValueAt(%struct.Map$f64$str* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index, i8* noundef nonnull noalias readonly align 8 %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !24
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !24
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %11
  store i8* %value, i8** %15, align 8, !alias.scope !11, !noalias !10, !tbaa !27
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$str.insertAt(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, double noundef %key, i8* noundef nonnull noalias readonly align 8 %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 0, 1
  %1 = sub nsw i64 %0, %absent
  store i64 %1, i64* %packed.addr, align 8
  %2 = load i64, i64* %packed.addr, align 8
  %3 = ashr i64 %2, 32
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %bucket.addr, align 4
  %5 = load i64, i64* %packed.addr, align 8
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %h.addr, align 4
  %7 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !23
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = sitofp i64 %10 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp sge i32 %12, 16777215
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  %15 = load i32, i32* %14, align 4, !tbaa !21
  %16 = icmp sge i32 %15, 16777215
  br i1 %16, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.10 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$f64$str.rebuild(%struct.Map$f64$str* %this)
  %17 = sub nsw i32 0, 1
  store i32 %17, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %18 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !23
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %19, i64 8)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %27 = bitcast i8* %26 to double*
  %28 = getelementptr inbounds double, double* %27, i64 %21
  store double %key, double* %28, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %30 = sitofp i64 %29 to double
  %31 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !24
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  %36 = load i64, i64* %35, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %37 = icmp eq i64 %34, %36
  br i1 %37, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %32, i64 8)
  br label %push.store.1

push.store.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %40 = bitcast i8* %39 to i8**
  %41 = getelementptr inbounds i8*, i8** %40, i64 %34
  store i8* %value, i8** %41, align 8, !alias.scope !11, !noalias !10, !tbaa !27
  %42 = add i64 %34, 1
  store i64 %42, i64* %33, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %43 = sitofp i64 %42 to double
  %44 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %45 = load %struct.nish_array*, %struct.nish_array** %44, align 8, !tbaa !25
  %46 = load i32, i32* %h.addr, align 4
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 1
  %50 = load i64, i64* %49, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %51 = icmp eq i64 %48, %50
  br i1 %51, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %45, i64 4)
  br label %push.store.2

push.store.2:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 %48
  store i32 %46, i32* %55, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %56 = add i64 %48, 1
  store i64 %56, i64* %47, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %57 = sitofp i64 %56 to double
  %58 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  %59 = load i32, i32* %58, align 4, !tbaa !21
  %60 = add nsw i32 %59, 1
  %61 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  store i32 %60, i32* %61, align 4, !tbaa !21
  %62 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 0
  %63 = load double, double* %62, align 8, !tbaa !6
  %64 = fadd double %63, 0x3FF0000000000000
  %65 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 0
  store double %64, double* %65, align 8, !tbaa !6
  %66 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %67 = load %struct.nish_array*, %struct.nish_array** %66, align 8, !tbaa !23
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %70 = sitofp i64 %69 to double
  %71 = call i32 @llvm.fptosi.sat.i32.f64(double %70)
  store i32 %71, i32* %used.addr, align 4
  %72 = load i32, i32* %bucket.addr, align 4
  %73 = icmp sge i32 %72, 0
  br i1 %73, label %land.rhs, label %land.end

land.rhs:
  %74 = load i32, i32* %bucket.addr, align 4
  %75 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %76 = load %struct.nish_array*, %struct.nish_array** %75, align 8, !tbaa !22
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %79 = sitofp i64 %78 to double
  %80 = call i32 @llvm.fptosi.sat.i32.f64(double %79)
  %81 = icmp slt i32 %74, %80
  br label %land.end

land.end:
  %82 = phi i1 [ false, %push.store.2 ], [ %81, %land.rhs ]
  br i1 %82, label %if.then.2, label %if.else

if.then.2:
  %83 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %84 = load %struct.nish_array*, %struct.nish_array** %83, align 8, !tbaa !22
  %85 = load i32, i32* %bucket.addr, align 4
  %86 = sext i32 %85 to i64
  %87 = load i32, i32* %h.addr, align 4
  %88 = load i32, i32* %used.addr, align 4
  %89 = sub nsw i32 %88, 1
  %90 = call i32 @nish.slotWord(i32 %87, i32 %89)
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %93 = icmp ult i64 %86, %92
  br i1 %93, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %86, i64 %92)
  unreachable

bounds.ok:
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %96 = bitcast i8* %95 to i32*
  %97 = getelementptr inbounds i32, i32* %96, i64 %86
  store i32 %90, i32* %97, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end.2

if.else:
  %98 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %99 = load %struct.nish_array*, %struct.nish_array** %98, align 8, !tbaa !22
  %100 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 2
  %101 = load i32, i32* %100, align 4, !tbaa !20
  %102 = load i32, i32* %h.addr, align 4
  %103 = load i32, i32* %used.addr, align 4
  %104 = sub nsw i32 %103, 1
  call void @nish.fileEntry(%struct.nish_array* %99, i32 %101, i32 %102, i32 %104)
  br label %if.end.2

if.end.2:
  %105 = load i32, i32* %used.addr, align 4
  %106 = mul nsw i32 %105, 4
  %107 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %108 = load %struct.nish_array*, %struct.nish_array** %107, align 8, !tbaa !22
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %111 = sitofp i64 %110 to double
  %112 = call i32 @llvm.fptosi.sat.i32.f64(double %111)
  %113 = mul nsw i32 %112, 3
  %114 = icmp sgt i32 %106, %113
  br i1 %114, label %if.then.3, label %if.end.3

if.then.3:
  call void @nish.Map$f64$str.rebuild(%struct.Map$f64$str* %this)
  br label %if.end.3

if.end.3:
  ret void
}

define internal void @nish.Map$f64$str.rebuild(%struct.Map$f64$str* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !22
  %8 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  %9 = load i32, i32* %8, align 4, !tbaa !21
  %10 = load i32, i32* %used.addr, align 4
  %11 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %7, i32 %9, i32 %10)
  store %struct.nish_array* %11, %struct.nish_array** %slots.addr, align 8
  %12 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !21
  %14 = load i32, i32* %used.addr, align 4
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 4
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !tbaa !23
  %18 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !25
  call void @nish.compactEntries$f64(%struct.nish_array* %17, %struct.nish_array* %19)
  %20 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 5
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !24
  %22 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !25
  call void @nish.compactEntries$str(%struct.nish_array* %21, %struct.nish_array* %23)
  %24 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !25
  %26 = call i32 @nish.compactHashes(%struct.nish_array* %25)
  br label %if.end

if.end:
  %27 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %28 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 1
  store %struct.nish_array* %27, %struct.nish_array** %28, align 8, !tbaa !22
  %29 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %32 = sitofp i64 %31 to double
  %33 = call i32 @llvm.fptosi.sat.i32.f64(double %32)
  %34 = sub nsw i32 %33, 1
  %35 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 2
  store i32 %34, i32* %35, align 4, !tbaa !20
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.Map$f64$str, %struct.Map$f64$str* %this, i32 0, i32 6
  %38 = load %struct.nish_array*, %struct.nish_array** %37, align 8, !tbaa !25
  call void @nish.refile(%struct.nish_array* %36, %struct.nish_array* %38)
  ret void
}

define internal noundef i64 @nish.probeTable$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, double noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = fadd double %key, 0.000000e+00
  %1 = fcmp uno double %0, %0
  %2 = bitcast double %0 to i64
  %3 = select i1 %1, i64 9221120237041090560, i64 %2
  %4 = lshr i64 %3, 33
  %5 = xor i64 %3, %4
  %6 = mul i64 %5, -49064778989728563
  %7 = lshr i64 %6, 33
  %8 = xor i64 %6, %7
  %9 = mul i64 %8, -4265267296055464877
  %10 = lshr i64 %9, 33
  %11 = xor i64 %9, %10
  %12 = trunc i64 %11 to i32
  %13 = lshr i64 %11, 32
  %14 = trunc i64 %13 to i32
  %15 = xor i32 %12, %14
  %16 = icmp eq i32 %15, 0
  %17 = select i1 %16, i32 1, i32 %15
  store i32 %17, i32* %h.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = lshr i32 %18, 24
  store i32 %19, i32* %fingerprint.addr, align 4
  %20 = load i32, i32* %h.addr, align 4
  %21 = call i32 @nish.homeBucket(i32 %20, i32 %mask)
  store i32 %21, i32* %bucket.addr, align 4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %while.cond

while.cond:
  %34 = load i32, i32* %bucket.addr, align 4
  %35 = icmp sge i32 %34, 0
  br i1 %35, label %land.rhs, label %land.end

land.rhs:
  %36 = load i32, i32* %bucket.addr, align 4
  %37 = sitofp i64 %23 to double
  %38 = call i32 @llvm.fptosi.sat.i32.f64(double %37)
  %39 = icmp slt i32 %36, %38
  br label %land.end

land.end:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs ]
  br i1 %40, label %while.body, label %while.end

while.body:
  %41 = load i32, i32* %bucket.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = bitcast i8* %25 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %42
  %45 = load i32, i32* %44, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  store i32 %45, i32* %word.addr, align 4
  %46 = load i32, i32* %word.addr, align 4
  %47 = icmp eq i32 %46, 0
  br i1 %47, label %if.then, label %if.end

if.then:
  %48 = load i32, i32* %bucket.addr, align 4
  %49 = load i32, i32* %h.addr, align 4
  %50 = tail call i64 @nish.absentAt(i32 %48, i32 %49)
  ret i64 %50

if.end:
  %51 = load i32, i32* %word.addr, align 4
  %52 = lshr i32 %51, 24
  %53 = load i32, i32* %fingerprint.addr, align 4
  %54 = icmp eq i32 %52, %53
  br i1 %54, label %if.then.1, label %if.end.1

if.then.1:
  %55 = load i32, i32* %word.addr, align 4
  %56 = and i32 %55, 16777215
  %57 = sub nsw i32 %56, 1
  store i32 %57, i32* %at.addr, align 4
  %58 = load i32, i32* %at.addr, align 4
  %59 = icmp sge i32 %58, 0
  br i1 %59, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %60 = load i32, i32* %at.addr, align 4
  %61 = sitofp i64 %27 to double
  %62 = call i32 @llvm.fptosi.sat.i32.f64(double %61)
  %63 = icmp slt i32 %60, %62
  br label %land.end.4

land.end.4:
  %64 = phi i1 [ false, %if.then.1 ], [ %63, %land.rhs.4 ]
  br i1 %64, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %65 = load i32, i32* %at.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = bitcast i8* %29 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 %66
  %69 = load i32, i32* %68, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %70 = load i32, i32* %h.addr, align 4
  %71 = icmp eq i32 %69, %70
  br label %land.end.3

land.end.3:
  %72 = phi i1 [ false, %land.end.4 ], [ %71, %land.rhs.3 ]
  br i1 %72, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %73 = load i32, i32* %at.addr, align 4
  %74 = sitofp i64 %31 to double
  %75 = call i32 @llvm.fptosi.sat.i32.f64(double %74)
  %76 = icmp slt i32 %73, %75
  br label %land.end.2

land.end.2:
  %77 = phi i1 [ false, %land.end.3 ], [ %76, %land.rhs.2 ]
  br i1 %77, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %78 = load i32, i32* %at.addr, align 4
  %79 = sext i32 %78 to i64
  %80 = bitcast i8* %33 to double*
  %81 = getelementptr inbounds double, double* %80, i64 %79
  %82 = load double, double* %81, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %83 = fcmp oeq double %82, %key
  %84 = fcmp uno double %82, %82
  %85 = fcmp uno double %key, %key
  %86 = and i1 %84, %85
  %87 = or i1 %83, %86
  br label %land.end.1

land.end.1:
  %88 = phi i1 [ false, %land.end.2 ], [ %87, %land.rhs.1 ]
  br i1 %88, label %if.then.2, label %if.end.2

if.then.2:
  %89 = load i32, i32* %bucket.addr, align 4
  %90 = load i32, i32* %at.addr, align 4
  %91 = tail call i64 @nish.foundAt(i32 %89, i32 %90)
  ret i64 %91

if.end.2:
  br label %if.end.1

if.end.1:
  %92 = load i32, i32* %bucket.addr, align 4
  %93 = add nsw i32 %92, 1
  %94 = and i32 %93, %mask
  store i32 %94, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [32 x i8] }* @.str.11 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define internal void @nish.compactEntries$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %12 = load i32, i32* %from.addr, align 4
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %from.addr, align 4
  %16 = sitofp i64 %5 to double
  %17 = call i32 @llvm.fptosi.sat.i32.f64(double %16)
  %18 = icmp slt i32 %15, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %for.cond ], [ %18, %land.rhs ]
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %from.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %7 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = load i32, i32* %to.addr, align 4
  %27 = icmp sge i32 %26, 0
  br label %land.end.3

land.end.3:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.3 ]
  br i1 %28, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %29 = load i32, i32* %to.addr, align 4
  %30 = load i32, i32* %used.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %land.end.3 ], [ %31, %land.rhs.2 ]
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %from.addr, align 4
  %34 = sitofp i64 %9 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %to.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %from.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %11 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %41
  %44 = load double, double* %43, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %45 = bitcast i8* %11 to double*
  %46 = getelementptr inbounds double, double* %45, i64 %39
  store double %44, double* %46, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  %47 = load i32, i32* %to.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %from.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %63 = bitcast i8* %62 to double*
  %64 = getelementptr inbounds double, double* %63, i64 %60
  %65 = load double, double* %64, align 8, !alias.scope !11, !noalias !10, !tbaa !29
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %12 = load i32, i32* %from.addr, align 4
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %from.addr, align 4
  %16 = sitofp i64 %5 to double
  %17 = call i32 @llvm.fptosi.sat.i32.f64(double %16)
  %18 = icmp slt i32 %15, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %for.cond ], [ %18, %land.rhs ]
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %from.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %7 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = load i32, i32* %to.addr, align 4
  %27 = icmp sge i32 %26, 0
  br label %land.end.3

land.end.3:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.3 ]
  br i1 %28, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %29 = load i32, i32* %to.addr, align 4
  %30 = load i32, i32* %used.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %land.end.3 ], [ %31, %land.rhs.2 ]
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %from.addr, align 4
  %34 = sitofp i64 %9 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %to.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %from.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %11 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %41
  %44 = load i8*, i8** %43, align 8, !alias.scope !11, !noalias !10, !tbaa !27
  %45 = bitcast i8* %11 to i8**
  %46 = getelementptr inbounds i8*, i8** %45, i64 %39
  store i8* %44, i8** %46, align 8, !alias.scope !11, !noalias !10, !tbaa !27
  %47 = load i32, i32* %to.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %from.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %60
  %65 = load i8*, i8** %64, align 8, !alias.scope !11, !noalias !10, !tbaa !27
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Map$f64$str", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !3, i64 40}
!6 = !{!5, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !13, i64 16}
!17 = !{!"element i32", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!14, !12, i64 8}
!20 = !{!5, !4, i64 16}
!21 = !{!5, !4, i64 20}
!22 = !{!5, !3, i64 8}
!23 = !{!5, !3, i64 24}
!24 = !{!5, !3, i64 32}
!25 = !{!5, !3, i64 40}
!26 = !{!"element ptr", !1, i64 0}
!27 = !{!26, !26, i64 0}
!28 = !{!"element double", !1, i64 0}
!29 = !{!28, !28, i64 0}
