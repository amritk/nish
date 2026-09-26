%struct.Map$f64$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"size \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" flat \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_arena_used() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i64 @llvm.fptosi.sat.i64.f64(double) #1

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

define internal noundef zeroext i1 @churnsFlat(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) %m) #0 {
entry:
  %i.addr = alloca double, align 8
  %before.addr = alloca i64, align 8
  %i.addr.1 = alloca double, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %0 = load double, double* %i.addr, align 8
  %1 = fcmp olt double %0, 0x40D3880000000000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load double, double* %i.addr, align 8
  %3 = fadd double 0x40F86A0000000000, %2
  %4 = load double, double* %i.addr, align 8
  %5 = call %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* %m, double %3, double %4)
  %6 = load double, double* %i.addr, align 8
  %7 = fadd double 0x40F86A0000000000, %6
  %8 = call i1 @nish.Map$f64$f64.delete(%struct.Map$f64$f64* %m, double %7)
  br label %for.inc

for.inc:
  %9 = load double, double* %i.addr, align 8
  %10 = fadd double %9, 0x3FF0000000000000
  store double %10, double* %i.addr, align 8
  br label %for.cond

for.end:
  %11 = call i64 @nish_arena_used()
  store i64 %11, i64* %before.addr, align 8
  store double 0x0000000000000000, double* %i.addr.1, align 8
  br label %for.cond.1

for.cond.1:
  %12 = load double, double* %i.addr.1, align 8
  %13 = fcmp olt double %12, 0x40E3880000000000
  br i1 %13, label %for.body.1, label %for.end.1

for.body.1:
  %14 = load double, double* %i.addr.1, align 8
  %15 = fadd double 0x41086A0000000000, %14
  %16 = load double, double* %i.addr.1, align 8
  %17 = call %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* %m, double %15, double %16)
  %18 = load double, double* %i.addr.1, align 8
  %19 = fadd double 0x41086A0000000000, %18
  %20 = call i1 @nish.Map$f64$f64.delete(%struct.Map$f64$f64* %m, double %19)
  br label %for.inc.1

for.inc.1:
  %21 = load double, double* %i.addr.1, align 8
  %22 = fadd double %21, 0x3FF0000000000000
  store double %22, double* %i.addr.1, align 8
  br label %for.cond.1

for.end.1:
  %23 = call i64 @nish_arena_used()
  %24 = load i64, i64* %before.addr, align 8
  %25 = icmp eq i64 %23, %24
  ret i1 %25
}

define internal noundef double @sumAndGrow(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) %m, double noundef %extra) #0 {
entry:
  %sum.addr = alloca double, align 8
  %v.addr = alloca double, align 8
  %walk.idx = alloca i32, align 4
  store double 0x0000000000000000, double* %sum.addr, align 8
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %m)
  %0 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %m, i32 0)
  store i32 %0, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %1 = load i32, i32* %walk.idx, align 4
  %2 = icmp sge i32 %1, 0
  br i1 %2, label %walk.body, label %walk.end

walk.body:
  %3 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %m, i32 %1)
  store double %3, double* %v.addr, align 8
  %4 = load double, double* %sum.addr, align 8
  %5 = load double, double* %v.addr, align 8
  %6 = fadd double %4, %5
  store double %6, double* %sum.addr, align 8
  %7 = fsub double %extra, 0x4024000000000000
  %8 = call i1 @nish.Map$f64$f64.delete(%struct.Map$f64$f64* %m, double %7)
  %9 = call %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* %m, double %extra, double %extra)
  br label %walk.inc

walk.inc:
  %10 = load i32, i32* %walk.idx, align 4
  %11 = add i32 %10, 1
  %12 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %m, i32 %11)
  store i32 %12, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %m)
  %13 = load double, double* %sum.addr, align 8
  ret double %13
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Map$f64$f64*, align 8
  %i.addr = alloca double, align 8
  %extra.addr = alloca double, align 8
  %k.addr = alloca double, align 8
  %walk.idx = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$f64$f64*
  call void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* %1)
  store %struct.Map$f64$f64* %1, %struct.Map$f64$f64** %m.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %2 = load double, double* %i.addr, align 8
  %3 = fcmp olt double %2, 0x4014000000000000
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  %5 = load double, double* %i.addr, align 8
  %6 = call %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* %4, double %5, double 0x3FF0000000000000)
  br label %for.inc

for.inc:
  %7 = load double, double* %i.addr, align 8
  %8 = fadd double %7, 0x3FF0000000000000
  store double %8, double* %i.addr, align 8
  br label %for.cond

for.end:
  store double 0x4034000000000000, double* %extra.addr, align 8
  %9 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %9)
  %10 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %9, i32 0)
  store i32 %10, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %11 = load i32, i32* %walk.idx, align 4
  %12 = icmp sge i32 %11, 0
  br i1 %12, label %walk.body, label %walk.end

walk.body:
  %13 = call double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* %9, i32 %11)
  store double %13, double* %k.addr, align 8
  %14 = load double, double* %k.addr, align 8
  %15 = fcmp olt double %14, 0x4008000000000000
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load double, double* %k.addr, align 8
  %17 = call i8* @nish_str_from_f64(double %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %19 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  %20 = load double, double* %extra.addr, align 8
  %21 = call double @sumAndGrow(%struct.Map$f64$f64* %19, double %20)
  %22 = call i8* @nish_str_from_f64(double %21)
  %23 = call i8* @nish_str_concat(i8* %18, i8* %22)
  call void @nish_print(i8* %23)
  %24 = load double, double* %extra.addr, align 8
  %25 = fadd double %24, 0x3FF0000000000000
  store double %25, double* %extra.addr, align 8
  br label %if.end

if.end:
  br label %walk.inc

walk.inc:
  %26 = load i32, i32* %walk.idx, align 4
  %27 = add i32 %26, 1
  %28 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %9, i32 %27)
  store i32 %28, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %9)
  %29 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  %30 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %29, i32 0, i32 0
  %31 = load double, double* %30, align 8, !tbaa !6
  %32 = call i8* @nish_str_from_f64(double %31)
  %33 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  %35 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  %36 = call i1 @churnsFlat(%struct.Map$f64$f64* %35)
  %37 = select i1 %36, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %38 = call i8* @nish_str_concat(i8* %34, i8* %37)
  call void @nish_print(i8* %38)
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

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
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
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = mul nsw i32 %live, 2
  %5 = icmp slt i32 %4, %used
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %6 = load i32, i32* %n.addr, align 4
  %7 = mul nsw i32 %6, 2
  %8 = sext i32 %7 to i64
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %8, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %8, i64* %12, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %13 = mul i64 %8, 4
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !11, !noalias !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  ret %struct.nish_array* %10
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
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
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %8 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !11, !noalias !10, !tbaa !18
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

define internal void @nish.killEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes, i64 noundef %found) #2 {
entry:
  %at.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = trunc i64 %found to i32
  store i32 %0, i32* %at.addr, align 4
  %1 = ashr i64 %found, 32
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %bucket.addr, align 4
  %3 = load i32, i32* %bucket.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %bucket.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %8 = sitofp i64 %7 to double
  %9 = call i32 @llvm.fptosi.sat.i32.f64(double %8)
  %10 = icmp slt i32 %5, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %entry ], [ %10, %land.rhs ]
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load i32, i32* %bucket.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  store i32 16777216, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end

if.end:
  %18 = load i32, i32* %at.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %20 = load i32, i32* %at.addr, align 4
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %23 = sitofp i64 %22 to double
  %24 = call i32 @llvm.fptosi.sat.i32.f64(double %23)
  %25 = icmp slt i32 %20, %24
  br label %land.end.1

land.end.1:
  %26 = phi i1 [ false, %if.end ], [ %25, %land.rhs.1 ]
  br i1 %26, label %if.then.1, label %if.end.1

if.then.1:
  %27 = load i32, i32* %at.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 %28
  store i32 0, i32* %32, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !10, !noalias !11, !tbaa !16
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
  store i32 0, i32* %11, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #3 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sitofp i64 %1 to double
  %8 = call i32 @llvm.fptosi.sat.i32.f64(double %7)
  %9 = icmp slt i32 %6, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %for.cond ], [ %9, %land.rhs ]
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %3 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %16 = icmp ne i32 %15, 0
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = load i32, i32* %i.addr, align 4
  ret i32 %17

if.end:
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %20 = sub nsw i32 0, 1
  ret i32 %20
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = sitofp i64 %2 to double
  %4 = call i32 @llvm.fptosi.sat.i32.f64(double %3)
  %5 = icmp slt i32 %bucket, %4
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.else

if.then:
  %7 = sext i32 %bucket to i64
  %8 = sub nsw i32 %used, 1
  %9 = call i32 @nish.slotWord(i32 %h, i32 %8)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %7
  store i32 %9, i32* %13, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end

if.else:
  %14 = sub nsw i32 %used, 1
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %14)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !20
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !21
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !22
  %4 = sext i32 8 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !11, !noalias !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %12 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !23
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %18 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !24
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !25
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %30 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !26
  ret void
}

define internal noundef i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, double noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !20
  %4 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !26
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !24
  %8 = call i64 @nish.probeTable$f64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, double %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) %this, double noundef %key, double noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %this, double %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$f64$f64.setValueAt(%struct.Map$f64$f64* %this, i32 %4, double %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* %this, i64 %5, double %key, double %value)
  br label %if.end

if.end:
  ret %struct.Map$f64$f64* %this
}

define internal noundef zeroext i1 @nish.Map$f64$f64.delete(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, double noundef %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %this, double %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !23
  %5 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !26
  %7 = load i64, i64* %found.addr, align 8
  call void @nish.killEntry(%struct.nish_array* %4, %struct.nish_array* %6, i64 %7)
  %8 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %9 = load i32, i32* %8, align 4, !tbaa !21
  %10 = sub nsw i32 %9, 1
  %11 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 %10, i32* %11, align 4, !tbaa !21
  %12 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  %13 = load double, double* %12, align 8, !tbaa !6
  %14 = fsub double %13, 0x3FF0000000000000
  %15 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double %14, double* %15, align 8, !tbaa !6
  ret i1 true
}

define internal void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !22
  %2 = add nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !22
  ret void
}

define internal noundef i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !22
  %2 = sub nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !22
  ret void
}

define internal noundef double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !24
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !24
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %17 = bitcast i8* %16 to double*
  %18 = getelementptr inbounds double, double* %17, i64 %11
  %19 = load double, double* %18, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  ret double %19
}

define internal noundef double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !25
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %17 = bitcast i8* %16 to double*
  %18 = getelementptr inbounds double, double* %17, i64 %11
  %19 = load double, double* %18, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  ret double %19
}

define internal void @nish.Map$f64$f64.setValueAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !25
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
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  store double %value, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, double noundef %key, double noundef %value) #0 {
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
  %7 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !24
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = sitofp i64 %10 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp sge i32 %12, 16777215
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %15 = load i32, i32* %14, align 4, !tbaa !21
  %16 = icmp sge i32 %15, 16777215
  br i1 %16, label %lor.end, label %lor.rhs

lor.rhs:
  %17 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %18 = load i32, i32* %17, align 4, !tbaa !22
  %19 = icmp sgt i32 %18, 0
  br label %lor.end

lor.end:
  %20 = phi i1 [ true, %if.then ], [ %19, %lor.rhs ]
  br i1 %20, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* %this)
  %21 = sub nsw i32 0, 1
  store i32 %21, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %22 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !24
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %23, i64 8)
  br label %push.store

push.store:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %31 = bitcast i8* %30 to double*
  %32 = getelementptr inbounds double, double* %31, i64 %25
  store double %key, double* %32, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %34 = sitofp i64 %33 to double
  %35 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %36 = load %struct.nish_array*, %struct.nish_array** %35, align 8, !tbaa !25
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  %40 = load i64, i64* %39, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %41 = icmp eq i64 %38, %40
  br i1 %41, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %36, i64 8)
  br label %push.store.1

push.store.1:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %44 = bitcast i8* %43 to double*
  %45 = getelementptr inbounds double, double* %44, i64 %38
  store double %value, double* %45, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  %46 = add i64 %38, 1
  store i64 %46, i64* %37, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %47 = sitofp i64 %46 to double
  %48 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %49 = load %struct.nish_array*, %struct.nish_array** %48, align 8, !tbaa !26
  %50 = load i32, i32* %h.addr, align 4
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 1
  %54 = load i64, i64* %53, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %55 = icmp eq i64 %52, %54
  br i1 %55, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %49, i64 4)
  br label %push.store.2

push.store.2:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %52
  store i32 %50, i32* %59, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %60 = add i64 %52, 1
  store i64 %60, i64* %51, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %61 = sitofp i64 %60 to double
  %62 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %63 = load i32, i32* %62, align 4, !tbaa !21
  %64 = add nsw i32 %63, 1
  %65 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 %64, i32* %65, align 4, !tbaa !21
  %66 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  %67 = load double, double* %66, align 8, !tbaa !6
  %68 = fadd double %67, 0x3FF0000000000000
  %69 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double %68, double* %69, align 8, !tbaa !6
  %70 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %71 = load %struct.nish_array*, %struct.nish_array** %70, align 8, !tbaa !24
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %74 = sitofp i64 %73 to double
  %75 = call i32 @llvm.fptosi.sat.i32.f64(double %74)
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = mul nsw i32 %76, 4
  %78 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %79 = load %struct.nish_array*, %struct.nish_array** %78, align 8, !tbaa !23
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %82 = sitofp i64 %81 to double
  %83 = call i32 @llvm.fptosi.sat.i32.f64(double %82)
  %84 = mul nsw i32 %83, 3
  %85 = icmp sgt i32 %77, %84
  br i1 %85, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* %this)
  br label %if.end.2

if.else:
  %86 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %87 = load %struct.nish_array*, %struct.nish_array** %86, align 8, !tbaa !23
  %88 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %89 = load i32, i32* %88, align 4, !tbaa !20
  %90 = load i32, i32* %bucket.addr, align 4
  %91 = load i32, i32* %h.addr, align 4
  %92 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %87, i32 %89, i32 %90, i32 %91, i32 %92)
  br label %if.end.2

if.end.2:
  ret void
}

define internal void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !22
  %8 = icmp sgt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !23
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !21
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
  %21 = load i32, i32* %20, align 4, !tbaa !21
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !24
  %27 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !26
  call void @nish.compactEntries$f64(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !25
  %31 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !26
  call void @nish.compactEntries$f64(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !26
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !23
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !20
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !26
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
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
  %82 = load double, double* %81, align 8, !alias.scope !11, !noalias !10, !tbaa !28
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
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.7 to i8*), i32 2, i1 true)
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
  %44 = load double, double* %43, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  %45 = bitcast i8* %11 to double*
  %46 = getelementptr inbounds double, double* %45, i64 %39
  store double %44, double* %46, align 8, !alias.scope !11, !noalias !10, !tbaa !28
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
  %65 = load double, double* %64, align 8, !alias.scope !11, !noalias !10, !tbaa !28
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Map$f64$f64", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !4, i64 48}
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
!22 = !{!5, !4, i64 48}
!23 = !{!5, !3, i64 8}
!24 = !{!5, !3, i64 24}
!25 = !{!5, !3, i64 32}
!26 = !{!5, !3, i64 40}
!27 = !{!"element double", !1, i64 0}
!28 = !{!27, !27, i64 0}
