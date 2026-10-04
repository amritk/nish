%struct.Map$str$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Map$f64$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i64 @llvm.fptosi.sat.i64.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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
  %names.addr = alloca %struct.Map$str$f64*, align 8
  %codes.addr = alloca %struct.Map$f64$f64*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$f64*
  call void @nish.Map$str$f64.constructor(%struct.Map$str$f64* %1)
  store %struct.Map$str$f64* %1, %struct.Map$str$f64** %names.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 56)
  %3 = bitcast i8* %2 to %struct.Map$f64$f64*
  call void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* %3)
  store %struct.Map$f64$f64* %3, %struct.Map$f64$f64** %codes.addr, align 8
  %4 = load %struct.Map$str$f64*, %struct.Map$str$f64** %names.addr, align 8
  %5 = call double @intern$str(%struct.Map$str$f64* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %6 = call i8* @nish_str_from_f64(double %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %8 = load %struct.Map$str$f64*, %struct.Map$str$f64** %names.addr, align 8
  %9 = call double @intern$str(%struct.Map$str$f64* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %10 = call i8* @nish_str_from_f64(double %9)
  %11 = call i8* @nish_str_concat(i8* %7, i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %13 = load %struct.Map$str$f64*, %struct.Map$str$f64** %names.addr, align 8
  %14 = call double @intern$str(%struct.Map$str$f64* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = call i8* @nish_str_from_f64(double %14)
  %16 = call i8* @nish_str_concat(i8* %12, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %18 = load %struct.Map$str$f64*, %struct.Map$str$f64** %names.addr, align 8
  %19 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %18, i32 0, i32 0
  %20 = load double, double* %19, align 8, !tbaa !6
  %21 = call i8* @nish_str_from_f64(double %20)
  %22 = call i8* @nish_str_concat(i8* %17, i8* %21)
  call void @nish_print(i8* %22)
  %23 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %codes.addr, align 8
  %24 = call double @intern$f64(%struct.Map$f64$f64* %23, double 0x4044000000000000)
  %25 = call i8* @nish_str_from_f64(double %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %27 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %codes.addr, align 8
  %28 = call double @intern$f64(%struct.Map$f64$f64* %27, double 0x4044000000000000)
  %29 = call i8* @nish_str_from_f64(double %28)
  %30 = call i8* @nish_str_concat(i8* %26, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %32 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %codes.addr, align 8
  %33 = call double @intern$f64(%struct.Map$f64$f64* %32, double 0x4000000000000000)
  %34 = call i8* @nish_str_from_f64(double %33)
  %35 = call i8* @nish_str_concat(i8* %31, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %37 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %codes.addr, align 8
  %38 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %37, i32 0, i32 0
  %39 = load double, double* %38, align 8, !tbaa !8
  %40 = call i8* @nish_str_from_f64(double %39)
  %41 = call i8* @nish_str_concat(i8* %36, i8* %40)
  call void @nish_print(i8* %41)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef double @intern$str(%struct.Map$str$f64* noundef nonnull align 8 dereferenceable(56) %ids, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  call void @nish.Map$str$f64.reserveSlots(%struct.Map$str$f64* %ids, double 0x4030000000000000)
  %0 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %ids, i32 0, i32 0
  %1 = load double, double* %0, align 8, !tbaa !6
  %2 = call i64 @nish.Map$str$f64.probe(%struct.Map$str$f64* %ids, i8* %key)
  %3 = icmp sge i64 %2, 0
  br i1 %3, label %get.found, label %get.insert

get.found:
  %4 = trunc i64 %2 to i32
  %5 = call double @nish.Map$str$f64.valueAt(%struct.Map$str$f64* %ids, i32 %4)
  br label %get.end

get.insert:
  call void @nish.Map$str$f64.insertAt(%struct.Map$str$f64* %ids, i64 %2, i8* %key, double %1)
  br label %get.end

get.end:
  %6 = phi double [ %5, %get.found ], [ %1, %get.insert ]
  ret double %6
}

define internal noundef double @intern$f64(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) %ids, double noundef %key) #0 {
entry:
  call void @nish.Map$f64$f64.reserveSlots(%struct.Map$f64$f64* %ids, double 0x4030000000000000)
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %ids, i32 0, i32 0
  %1 = load double, double* %0, align 8, !tbaa !8
  %2 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %ids, double %key)
  %3 = icmp sge i64 %2, 0
  br i1 %3, label %get.found, label %get.insert

get.found:
  %4 = trunc i64 %2 to i32
  %5 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %ids, i32 %4)
  br label %get.end

get.insert:
  call void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* %ids, i64 %2, double %key, double %1)
  br label %get.end

get.end:
  %6 = phi double [ %5, %get.found ], [ %1, %get.insert ]
  ret double %6
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #0 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %index, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = or i32 %1, %3
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #0 {
entry:
  %0 = fneg double 0x3FF0000000000000
  %1 = call i64 @llvm.fptosi.sat.i64.f64(double %0)
  %2 = sext i32 %bucket to i64
  %3 = shl i64 %2, 32
  %4 = zext i32 %h to i64
  %5 = or i64 %3, %4
  %6 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %1, i64 %5)
  %7 = extractvalue { i64, i1 } %6, 0
  %8 = extractvalue { i64, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %7

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
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
  %3 = load i64, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !12, !noalias !13, !tbaa !18
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
  %17 = load i32, i32* %16, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %bucket.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %5 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !13, !noalias !12, !tbaa !20
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

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !12, !noalias !13, !tbaa !18
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
  %13 = load i32, i32* %12, align 4, !alias.scope !13, !noalias !12, !tbaa !20
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
  store i32 %25, i32* %27, align 4, !alias.scope !13, !noalias !12, !tbaa !20
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
  %33 = load i64, i64* %32, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %34 = sitofp i64 %33 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = load i32, i32* %to.addr, align 4
  %37 = icmp sgt i32 %35, %36
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %40 = icmp eq i64 %39, 0
  br i1 %40, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %41 = sub i64 %39, 1
  store i64 %41, i64* %38, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %41
  %46 = load i32, i32* %45, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = icmp slt i32 %5, %used
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %8 = load i32, i32* %n.addr, align 4
  %9 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %8, i32 2)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = sext i32 %10 to i64
  %13 = icmp ule i64 %12, 9007199254740992
  br i1 %13, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 %12, i64* %16, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 %12, i64* %17, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %18 = mul i64 %12, 4
  %19 = call i8* @nish_alloc_struct(i64 %18)
  call void @llvm.memset.p0i8.i64(i8* align 8 %19, i8 0, i64 %18, i1 false), !alias.scope !13, !noalias !12
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  ret %struct.nish_array* %15

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  %4 = sub nsw i32 %3, 1
  store i32 %4, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = sitofp i64 %6 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp slt i32 %9, %11
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %8 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  store i32 %17, i32* %h.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = icmp ne i32 %18, 0
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %mask.addr, align 4
  %21 = load i32, i32* %h.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %20, i32 %21, i32 %22)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = sitofp i64 %1 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %4, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  store i32 0, i32* %11, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = sitofp i64 %2 to double
  %4 = call i32 @llvm.fptosi.sat.i32.f64(double %3)
  %5 = icmp slt i32 %bucket, %4
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.else

if.then:
  %7 = sext i32 %bucket to i64
  %8 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call i32 @nish.slotWord(i32 %h, i32 %9)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %7
  store i32 %11, i32* %15, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  br label %if.end

if.else:
  %16 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %17)
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.Map$str$f64.constructor(%struct.Map$str$f64* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !22
  %2 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !23
  %3 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !24
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 9007199254740992
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !13, !noalias !12
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %13 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !25
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %19 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !26
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %25 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !27
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %31 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !28
  ret void
}

define internal noundef i64 @nish.Map$str$f64.probe(%struct.Map$str$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !22
  %4 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !28
  %6 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !26
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef double @nish.Map$str$f64.valueAt(%struct.Map$str$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !27
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !27
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %17 = bitcast i8* %16 to double*
  %18 = getelementptr inbounds double, double* %17, i64 %11
  %19 = load double, double* %18, align 8, !alias.scope !13, !noalias !12, !tbaa !30
  ret double %19
}

define internal void @nish.Map$str$f64.insertAt(%struct.Map$str$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, double noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !26
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %10 = sitofp i64 %9 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !23
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %lor.end, label %lor.rhs

lor.rhs:
  %16 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 7
  %17 = load i32, i32* %16, align 4, !tbaa !24
  %18 = icmp sgt i32 %17, 0
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$str$f64.rebuild(%struct.Map$str$f64* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %20 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !26
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %21, i64 8)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 %23
  store i8* %key, i8** %30, align 8, !alias.scope !13, !noalias !12, !tbaa !32
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %32 = sitofp i64 %31 to double
  %33 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !27
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %34, i64 8)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %42 = bitcast i8* %41 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %36
  store double %value, double* %43, align 8, !alias.scope !13, !noalias !12, !tbaa !30
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %45 = sitofp i64 %44 to double
  %46 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !tbaa !28
  %48 = load i32, i32* %h.addr, align 4
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %52 = load i64, i64* %51, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %53 = icmp eq i64 %50, %52
  br i1 %53, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %47, i64 4)
  br label %push.store.2

push.store.2:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 %50
  store i32 %48, i32* %57, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %58 = add i64 %50, 1
  store i64 %58, i64* %49, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %59 = sitofp i64 %58 to double
  %60 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  %61 = load i32, i32* %60, align 4, !tbaa !23
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 1)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok

ovf.ok:
  %65 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  store i32 %63, i32* %65, align 4, !tbaa !23
  %66 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 0
  %67 = load double, double* %66, align 8, !tbaa !6
  %68 = fadd double %67, 0x3FF0000000000000
  %69 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 0
  store double %68, double* %69, align 8, !tbaa !6
  %70 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %71 = load %struct.nish_array*, %struct.nish_array** %70, align 8, !tbaa !26
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %74 = sitofp i64 %73 to double
  %75 = call i32 @llvm.fptosi.sat.i32.f64(double %74)
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %80 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !25
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %84 = sitofp i64 %83 to double
  %85 = call i32 @llvm.fptosi.sat.i32.f64(double %84)
  %86 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %85, i32 3)
  %87 = extractvalue { i32, i1 } %86, 0
  %88 = extractvalue { i32, i1 } %86, 1
  br i1 %88, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %89 = icmp sgt i32 %78, %87
  br i1 %89, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$f64.rebuild(%struct.Map$str$f64* %this)
  br label %if.end.2

if.else:
  %90 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  %91 = load %struct.nish_array*, %struct.nish_array** %90, align 8, !tbaa !25
  %92 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 2
  %93 = load i32, i32* %92, align 4, !tbaa !22
  %94 = load i32, i32* %bucket.addr, align 4
  %95 = load i32, i32* %h.addr, align 4
  %96 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %91, i32 %93, i32 %94, i32 %95, i32 %96)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$str$f64.rebuild(%struct.Map$str$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !24
  %8 = icmp sgt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !23
  br label %cond.end

cond.end:
  %15 = phi i32 [ %12, %cond.true ], [ %14, %cond.false ]
  %16 = load i32, i32* %used.addr, align 4
  %17 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %10, i32 %15, i32 %16)
  store %struct.nish_array* %17, %struct.nish_array** %slots.addr, align 8
  %18 = load i1, i1* %walking.addr, align 1
  %19 = xor i1 %18, true
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !23
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !26
  %27 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !28
  call void @nish.compactEntries$str(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !27
  %31 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !28
  call void @nish.compactEntries$f64(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !28
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !25
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !22
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !28
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
  ret void
}

define internal void @nish.Map$str$f64.reserveSlots(%struct.Map$str$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, double noundef %n) #0 {
entry:
  %want.addr = alloca i32, align 4
  %have.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = fcmp ogt double %n, 0x0000000000000000
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %2 = fcmp oge double %n, 0x416FFFFFE0000000
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %n)
  br label %cond.end

cond.end:
  %4 = phi i32 [ 16777215, %cond.true ], [ %3, %cond.false ]
  store i32 %4, i32* %want.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !25
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %9 = sitofp i64 %8 to double
  %10 = call i32 @llvm.fptosi.sat.i32.f64(double %9)
  store i32 %10, i32* %have.addr, align 4
  %11 = load i32, i32* %have.addr, align 4
  store i32 %11, i32* %size.addr, align 4
  br label %while.cond

while.cond:
  %12 = load i32, i32* %want.addr, align 4
  %13 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %12, i32 4)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = load i32, i32* %size.addr, align 4
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 3)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %20 = icmp sgt i32 %14, %18
  br i1 %20, label %while.body, label %while.end

while.body:
  %21 = load i32, i32* %size.addr, align 4
  %22 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %21, i32 2)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %23, i32* %size.addr, align 4
  br label %while.cond

while.end:
  %25 = load i32, i32* %size.addr, align 4
  %26 = load i32, i32* %have.addr, align 4
  %27 = icmp sgt i32 %25, %26
  br i1 %27, label %if.then.1, label %if.end.1

if.then.1:
  %28 = load i32, i32* %size.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = icmp ule i64 %29, 9007199254740992
  br i1 %30, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %31 = call i8* @nish_alloc_struct(i64 24)
  %32 = bitcast i8* %31 to %struct.nish_array*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  store i64 %29, i64* %33, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  store i64 %29, i64* %34, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %35 = mul i64 %29, 4
  %36 = call i8* @nish_alloc_struct(i64 %35)
  call void @llvm.memset.p0i8.i64(i8* align 8 %36, i8 0, i64 %35, i1 false), !alias.scope !13, !noalias !12
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  store i8* %36, i8** %37, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  store %struct.nish_array* %32, %struct.nish_array** %slots.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %39 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  store %struct.nish_array* %38, %struct.nish_array** %39, align 8, !tbaa !25
  %40 = load i32, i32* %size.addr, align 4
  %41 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %40, i32 1)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %44 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 2
  store i32 %42, i32* %44, align 4, !tbaa !22
  %45 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %46 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !tbaa !28
  call void @nish.refile(%struct.nish_array* %45, %struct.nish_array* %47)
  br label %if.end.1

if.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %while.cond ], [ 2, %ovf.ok ], [ 2, %while.body ], [ 1, %len.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !8
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !33
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !34
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !35
  %4 = sext i32 8 to i64
  %5 = icmp ule i64 %4, 9007199254740992
  br i1 %5, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 %4, i64* %8, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 %4, i64* %9, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %10 = mul i64 %4, 4
  %11 = call i8* @nish_alloc_struct(i64 %10)
  call void @llvm.memset.p0i8.i64(i8* align 8 %11, i8 0, i64 %10, i1 false), !alias.scope !13, !noalias !12
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %13, align 8, !tbaa !36
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %19 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !37
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %25 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !38
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %31 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !39
  ret void
}

define internal noundef i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, double noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !36
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !33
  %4 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !39
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !37
  %8 = call i64 @nish.probeTable$f64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, double %key)
  ret i64 %8
}

define internal noundef double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !38
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !38
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %17 = bitcast i8* %16 to double*
  %18 = getelementptr inbounds double, double* %17, i64 %11
  %19 = load double, double* %18, align 8, !alias.scope !13, !noalias !12, !tbaa !30
  ret double %19
}

define internal void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, double noundef %key, double noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !37
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %10 = sitofp i64 %9 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !34
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %lor.end, label %lor.rhs

lor.rhs:
  %16 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %17 = load i32, i32* %16, align 4, !tbaa !35
  %18 = icmp sgt i32 %17, 0
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %20 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !37
  %22 = fadd double %key, 0.000000e+00
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %26 = load i64, i64* %25, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %27 = icmp eq i64 %24, %26
  br i1 %27, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %21, i64 8)
  br label %push.store

push.store:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %30 = bitcast i8* %29 to double*
  %31 = getelementptr inbounds double, double* %30, i64 %24
  store double %22, double* %31, align 8, !alias.scope !13, !noalias !12, !tbaa !30
  %32 = add i64 %24, 1
  store i64 %32, i64* %23, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %33 = sitofp i64 %32 to double
  %34 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !38
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 1
  %39 = load i64, i64* %38, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %40 = icmp eq i64 %37, %39
  br i1 %40, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %35, i64 8)
  br label %push.store.1

push.store.1:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %43 = bitcast i8* %42 to double*
  %44 = getelementptr inbounds double, double* %43, i64 %37
  store double %value, double* %44, align 8, !alias.scope !13, !noalias !12, !tbaa !30
  %45 = add i64 %37, 1
  store i64 %45, i64* %36, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %46 = sitofp i64 %45 to double
  %47 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %48 = load %struct.nish_array*, %struct.nish_array** %47, align 8, !tbaa !39
  %49 = load i32, i32* %h.addr, align 4
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1
  %53 = load i64, i64* %52, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %54 = icmp eq i64 %51, %53
  br i1 %54, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %48, i64 4)
  br label %push.store.2

push.store.2:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 %51
  store i32 %49, i32* %58, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %59 = add i64 %51, 1
  store i64 %59, i64* %50, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %60 = sitofp i64 %59 to double
  %61 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %62 = load i32, i32* %61, align 4, !tbaa !34
  %63 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %62, i32 1)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok

ovf.ok:
  %66 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 %64, i32* %66, align 4, !tbaa !34
  %67 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  %68 = load double, double* %67, align 8, !tbaa !8
  %69 = fadd double %68, 0x3FF0000000000000
  %70 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double %69, double* %70, align 8, !tbaa !8
  %71 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !37
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %75 = sitofp i64 %74 to double
  %76 = call i32 @llvm.fptosi.sat.i32.f64(double %75)
  store i32 %76, i32* %used.addr, align 4
  %77 = load i32, i32* %used.addr, align 4
  %78 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %77, i32 4)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %81 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %82 = load %struct.nish_array*, %struct.nish_array** %81, align 8, !tbaa !36
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %85 = sitofp i64 %84 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %86, i32 3)
  %88 = extractvalue { i32, i1 } %87, 0
  %89 = extractvalue { i32, i1 } %87, 1
  br i1 %89, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %90 = icmp sgt i32 %79, %88
  br i1 %90, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* %this)
  br label %if.end.2

if.else:
  %91 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %92 = load %struct.nish_array*, %struct.nish_array** %91, align 8, !tbaa !36
  %93 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %94 = load i32, i32* %93, align 4, !tbaa !33
  %95 = load i32, i32* %bucket.addr, align 4
  %96 = load i32, i32* %h.addr, align 4
  %97 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %92, i32 %94, i32 %95, i32 %96, i32 %97)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !37
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !35
  %8 = icmp sgt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !36
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !34
  br label %cond.end

cond.end:
  %15 = phi i32 [ %12, %cond.true ], [ %14, %cond.false ]
  %16 = load i32, i32* %used.addr, align 4
  %17 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %10, i32 %15, i32 %16)
  store %struct.nish_array* %17, %struct.nish_array** %slots.addr, align 8
  %18 = load i1, i1* %walking.addr, align 1
  %19 = xor i1 %18, true
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !34
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !37
  %27 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !39
  call void @nish.compactEntries$f64(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !38
  %31 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !39
  call void @nish.compactEntries$f64(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !39
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !36
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !33
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !39
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
  ret void
}

define internal void @nish.Map$f64$f64.reserveSlots(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, double noundef %n) #0 {
entry:
  %want.addr = alloca i32, align 4
  %have.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = fcmp ogt double %n, 0x0000000000000000
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %2 = fcmp oge double %n, 0x416FFFFFE0000000
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %n)
  br label %cond.end

cond.end:
  %4 = phi i32 [ 16777215, %cond.true ], [ %3, %cond.false ]
  store i32 %4, i32* %want.addr, align 4
  %5 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !36
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %9 = sitofp i64 %8 to double
  %10 = call i32 @llvm.fptosi.sat.i32.f64(double %9)
  store i32 %10, i32* %have.addr, align 4
  %11 = load i32, i32* %have.addr, align 4
  store i32 %11, i32* %size.addr, align 4
  br label %while.cond

while.cond:
  %12 = load i32, i32* %want.addr, align 4
  %13 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %12, i32 4)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = load i32, i32* %size.addr, align 4
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 3)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %20 = icmp sgt i32 %14, %18
  br i1 %20, label %while.body, label %while.end

while.body:
  %21 = load i32, i32* %size.addr, align 4
  %22 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %21, i32 2)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %23, i32* %size.addr, align 4
  br label %while.cond

while.end:
  %25 = load i32, i32* %size.addr, align 4
  %26 = load i32, i32* %have.addr, align 4
  %27 = icmp sgt i32 %25, %26
  br i1 %27, label %if.then.1, label %if.end.1

if.then.1:
  %28 = load i32, i32* %size.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = icmp ule i64 %29, 9007199254740992
  br i1 %30, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %31 = call i8* @nish_alloc_struct(i64 24)
  %32 = bitcast i8* %31 to %struct.nish_array*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  store i64 %29, i64* %33, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  store i64 %29, i64* %34, align 8, !alias.scope !12, !noalias !13, !tbaa !21
  %35 = mul i64 %29, 4
  %36 = call i8* @nish_alloc_struct(i64 %35)
  call void @llvm.memset.p0i8.i64(i8* align 8 %36, i8 0, i64 %35, i1 false), !alias.scope !13, !noalias !12
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  store i8* %36, i8** %37, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  store %struct.nish_array* %32, %struct.nish_array** %slots.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %39 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %38, %struct.nish_array** %39, align 8, !tbaa !36
  %40 = load i32, i32* %size.addr, align 4
  %41 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %40, i32 1)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %44 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 %42, i32* %44, align 4, !tbaa !33
  %45 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %46 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !tbaa !39
  call void @nish.refile(%struct.nish_array* %45, %struct.nish_array* %47)
  br label %if.end.1

if.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %while.cond ], [ 2, %ovf.ok ], [ 2, %while.body ], [ 1, %len.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  store i64 0, i64* %hash.i, align 8
  store i32 -2128831035, i32* %hash.h, align 4
  br label %hash.test

hash.test:
  %3 = load i64, i64* %hash.i, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %hash.byte, label %hash.done

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = zext i8 %6 to i32
  %8 = load i32, i32* %hash.h, align 4
  %9 = xor i32 %8, %7
  %10 = mul i32 %9, 16777619
  store i32 %10, i32* %hash.h, align 4
  %11 = add i64 %3, 1
  store i64 %11, i64* %hash.i, align 8
  br label %hash.test

hash.done:
  %12 = load i32, i32* %hash.h, align 4
  %13 = icmp eq i32 %12, 0
  %14 = select i1 %13, i32 1, i32 %12
  store i32 %14, i32* %h.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = lshr i32 %15, 24
  store i32 %16, i32* %fingerprint.addr, align 4
  %17 = load i32, i32* %h.addr, align 4
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask)
  store i32 %18, i32* %bucket.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  br label %while.cond

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = icmp sge i32 %31, 0
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4
  %34 = sitofp i64 %20 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end

land.end:
  %37 = phi i1 [ false, %while.cond ], [ %36, %land.rhs ]
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = load i32, i32* %bucket.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = bitcast i8* %22 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %39
  %42 = load i32, i32* %41, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  store i32 %42, i32* %word.addr, align 4
  %43 = load i32, i32* %word.addr, align 4
  %44 = icmp eq i32 %43, 0
  br i1 %44, label %if.then, label %if.end

if.then:
  %45 = load i32, i32* %bucket.addr, align 4
  %46 = load i32, i32* %h.addr, align 4
  %47 = tail call i64 @nish.absentAt(i32 %45, i32 %46)
  ret i64 %47

if.end:
  %48 = load i32, i32* %word.addr, align 4
  %49 = lshr i32 %48, 24
  %50 = load i32, i32* %fingerprint.addr, align 4
  %51 = icmp eq i32 %49, %50
  br i1 %51, label %if.then.1, label %if.end.1

if.then.1:
  %52 = load i32, i32* %word.addr, align 4
  %53 = and i32 %52, 16777215
  %54 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %53, i32 1)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %55, i32* %at.addr, align 4
  %57 = load i32, i32* %at.addr, align 4
  %58 = icmp sge i32 %57, 0
  br i1 %58, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %59 = load i32, i32* %at.addr, align 4
  %60 = sitofp i64 %24 to double
  %61 = call i32 @llvm.fptosi.sat.i32.f64(double %60)
  %62 = icmp slt i32 %59, %61
  br label %land.end.4

land.end.4:
  %63 = phi i1 [ false, %ovf.ok ], [ %62, %land.rhs.4 ]
  br i1 %63, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %64 = load i32, i32* %at.addr, align 4
  %65 = sext i32 %64 to i64
  %66 = bitcast i8* %26 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 %65
  %68 = load i32, i32* %67, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %69 = load i32, i32* %h.addr, align 4
  %70 = icmp eq i32 %68, %69
  br label %land.end.3

land.end.3:
  %71 = phi i1 [ false, %land.end.4 ], [ %70, %land.rhs.3 ]
  br i1 %71, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %72 = load i32, i32* %at.addr, align 4
  %73 = sitofp i64 %28 to double
  %74 = call i32 @llvm.fptosi.sat.i32.f64(double %73)
  %75 = icmp slt i32 %72, %74
  br label %land.end.2

land.end.2:
  %76 = phi i1 [ false, %land.end.3 ], [ %75, %land.rhs.2 ]
  br i1 %76, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %77 = load i32, i32* %at.addr, align 4
  %78 = sext i32 %77 to i64
  %79 = bitcast i8* %30 to i8**
  %80 = getelementptr inbounds i8*, i8** %79, i64 %78
  %81 = load i8*, i8** %80, align 8, !alias.scope !13, !noalias !12, !tbaa !32
  %82 = call zeroext i1 @nish_str_eq(i8* %81, i8* %key)
  br label %land.end.1

land.end.1:
  %83 = phi i1 [ false, %land.end.2 ], [ %82, %land.rhs.1 ]
  br i1 %83, label %if.then.2, label %if.end.2

if.then.2:
  %84 = load i32, i32* %bucket.addr, align 4
  %85 = load i32, i32* %at.addr, align 4
  %86 = tail call i64 @nish.foundAt(i32 %84, i32 %85)
  ret i64 %86

if.end.2:
  br label %if.end.1

if.end.1:
  %87 = load i32, i32* %bucket.addr, align 4
  %88 = add nsw i32 %87, 1
  %89 = and i32 %88, %mask
  store i32 %89, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !12, !noalias !13, !tbaa !18
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
  %24 = load i32, i32* %23, align 4, !alias.scope !13, !noalias !12, !tbaa !20
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
  %44 = load i8*, i8** %43, align 8, !alias.scope !13, !noalias !12, !tbaa !32
  %45 = bitcast i8* %11 to i8**
  %46 = getelementptr inbounds i8*, i8** %45, i64 %39
  store i8* %44, i8** %46, align 8, !alias.scope !13, !noalias !12, !tbaa !32
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
  %52 = load i64, i64* %51, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %60
  %65 = load i8*, i8** %64, align 8, !alias.scope !13, !noalias !12, !tbaa !32
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !12, !noalias !13, !tbaa !18
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
  %24 = load i32, i32* %23, align 4, !alias.scope !13, !noalias !12, !tbaa !20
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
  %44 = load double, double* %43, align 8, !alias.scope !13, !noalias !12, !tbaa !30
  %45 = bitcast i8* %11 to double*
  %46 = getelementptr inbounds double, double* %45, i64 %39
  store double %44, double* %46, align 8, !alias.scope !13, !noalias !12, !tbaa !30
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
  %52 = load i64, i64* %51, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %63 = bitcast i8* %62 to double*
  %64 = getelementptr inbounds double, double* %63, i64 %60
  %65 = load double, double* %64, align 8, !alias.scope !13, !noalias !12, !tbaa !30
  br label %while.cond

while.end:
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
  %23 = load i64, i64* %22, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !12, !noalias !13, !tbaa !18
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
  %45 = load i32, i32* %44, align 4, !alias.scope !13, !noalias !12, !tbaa !20
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
  %57 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %56, i32 1)
  %58 = extractvalue { i32, i1 } %57, 0
  %59 = extractvalue { i32, i1 } %57, 1
  br i1 %59, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %58, i32* %at.addr, align 4
  %60 = load i32, i32* %at.addr, align 4
  %61 = icmp sge i32 %60, 0
  br i1 %61, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %62 = load i32, i32* %at.addr, align 4
  %63 = sitofp i64 %27 to double
  %64 = call i32 @llvm.fptosi.sat.i32.f64(double %63)
  %65 = icmp slt i32 %62, %64
  br label %land.end.4

land.end.4:
  %66 = phi i1 [ false, %ovf.ok ], [ %65, %land.rhs.4 ]
  br i1 %66, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %67 = load i32, i32* %at.addr, align 4
  %68 = sext i32 %67 to i64
  %69 = bitcast i8* %29 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 %68
  %71 = load i32, i32* %70, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %72 = load i32, i32* %h.addr, align 4
  %73 = icmp eq i32 %71, %72
  br label %land.end.3

land.end.3:
  %74 = phi i1 [ false, %land.end.4 ], [ %73, %land.rhs.3 ]
  br i1 %74, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %75 = load i32, i32* %at.addr, align 4
  %76 = sitofp i64 %31 to double
  %77 = call i32 @llvm.fptosi.sat.i32.f64(double %76)
  %78 = icmp slt i32 %75, %77
  br label %land.end.2

land.end.2:
  %79 = phi i1 [ false, %land.end.3 ], [ %78, %land.rhs.2 ]
  br i1 %79, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %80 = load i32, i32* %at.addr, align 4
  %81 = sext i32 %80 to i64
  %82 = bitcast i8* %33 to double*
  %83 = getelementptr inbounds double, double* %82, i64 %81
  %84 = load double, double* %83, align 8, !alias.scope !13, !noalias !12, !tbaa !30
  %85 = fcmp oeq double %84, %key
  %86 = fcmp uno double %84, %84
  %87 = fcmp uno double %key, %key
  %88 = and i1 %86, %87
  %89 = or i1 %85, %88
  br label %land.end.1

land.end.1:
  %90 = phi i1 [ false, %land.end.2 ], [ %89, %land.rhs.1 ]
  br i1 %90, label %if.then.2, label %if.end.2

if.then.2:
  %91 = load i32, i32* %bucket.addr, align 4
  %92 = load i32, i32* %at.addr, align 4
  %93 = tail call i64 @nish.foundAt(i32 %91, i32 %92)
  ret i64 %93

if.end.2:
  br label %if.end.1

if.end.1:
  %94 = load i32, i32* %bucket.addr, align 4
  %95 = add nsw i32 %94, 1
  %96 = and i32 %95, %mask
  store i32 %96, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Map$str$f64", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !4, i64 48}
!6 = !{!5, !2, i64 0}
!7 = !{!"Map$f64$f64", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !4, i64 48}
!8 = !{!7, !2, i64 0}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !15, i64 16}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!16, !14, i64 8}
!22 = !{!5, !4, i64 16}
!23 = !{!5, !4, i64 20}
!24 = !{!5, !4, i64 48}
!25 = !{!5, !3, i64 8}
!26 = !{!5, !3, i64 24}
!27 = !{!5, !3, i64 32}
!28 = !{!5, !3, i64 40}
!29 = !{!"element double", !1, i64 0}
!30 = !{!29, !29, i64 0}
!31 = !{!"element ptr", !1, i64 0}
!32 = !{!31, !31, i64 0}
!33 = !{!7, !4, i64 16}
!34 = !{!7, !4, i64 20}
!35 = !{!7, !4, i64 48}
!36 = !{!7, !3, i64 8}
!37 = !{!7, !3, i64 24}
!38 = !{!7, !3, i64 32}
!39 = !{!7, !3, i64 40}
