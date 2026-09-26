%struct.Node = type { i8* }
%struct.Map$str$$Node = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"made \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"filled \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"overwrite \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare i32 @llvm.fptosi.sat.i32.f64(double) #2
declare i64 @llvm.fptosi.sat.i64.f64(double) #2

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

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %label) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i8* %label, i8** %0, align 8, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Node* @pick(%struct.Map$str$$Node* noundef nonnull readonly align 8 dereferenceable(56) nocapture %m, i8* noundef nonnull noalias readonly align 8 %k) #1 {
entry:
  %0 = call i64 @nish.Map$str$$Node.probe(%struct.Map$str$$Node* %m, i8* %k)
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %nullish.value, label %nullish.default

nullish.value:
  %2 = trunc i64 %0 to i32
  %3 = call %struct.Node* @nish.Map$str$$Node.valueAt(%struct.Map$str$$Node* %m, i32 %2)
  br label %nullish.end

nullish.default:
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Node*
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %k)
  call void @Node.constructor(%struct.Node* %5, i8* %6)
  br label %nullish.end

nullish.end:
  %7 = phi %struct.Node* [ %3, %nullish.value ], [ %5, %nullish.default ]
  ret %struct.Node* %7
}

define internal void @fill(%struct.Map$str$$Node* noundef nonnull align 8 dereferenceable(56) %m, i8* noundef nonnull noalias readonly align 8 %k) #1 {
entry:
  %0 = call i64 @nish.Map$str$$Node.probe(%struct.Map$str$$Node* %m, i8* %k)
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %nullish.value, label %nullish.default

nullish.value:
  %2 = trunc i64 %0 to i32
  %3 = call %struct.Node* @nish.Map$str$$Node.valueAt(%struct.Map$str$$Node* %m, i32 %2)
  br label %nullish.end

nullish.default:
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Node*
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %k)
  call void @Node.constructor(%struct.Node* %5, i8* %6)
  br label %nullish.end

nullish.end:
  %7 = phi %struct.Node* [ %3, %nullish.value ], [ %5, %nullish.default ]
  %8 = call %struct.Map$str$$Node* @nish.Map$str$$Node.set(%struct.Map$str$$Node* %m, i8* %k, %struct.Node* %7)
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %m.addr = alloca %struct.Map$str$$Node*, align 8
  %p.addr = alloca %struct.Node*, align 8
  %junk.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$$Node*
  call void @nish.Map$str$$Node.constructor(%struct.Map$str$$Node* %1)
  store %struct.Map$str$$Node* %1, %struct.Map$str$$Node** %m.addr, align 8
  %2 = load %struct.Map$str$$Node*, %struct.Map$str$$Node** %m.addr, align 8
  call void @fill(%struct.Map$str$$Node* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %3 = load %struct.Map$str$$Node*, %struct.Map$str$$Node** %m.addr, align 8
  %4 = call %struct.Node* @pick(%struct.Map$str$$Node* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  store %struct.Node* %4, %struct.Node** %p.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %junk.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %8 = load double, double* %i.addr, align 8
  %9 = fcmp olt double %8, 0x4059000000000000
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %11 = load double, double* %i.addr, align 8
  %12 = call i8* @nish_str_from_f64(double %11)
  %13 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.4 to i8*), i8* %12)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  %17 = load i64, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %18 = icmp eq i64 %15, %17
  br i1 %18, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %10, i64 8)
  br label %push.store

push.store:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %21 = bitcast i8* %20 to i8**
  %22 = getelementptr inbounds i8*, i8** %21, i64 %15
  store i8* %13, i8** %22, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %23 = add i64 %15, 1
  store i64 %23, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %24 = sitofp i64 %23 to double
  br label %for.inc

for.inc:
  %25 = load double, double* %i.addr, align 8
  %26 = fadd double %25, 0x3FF0000000000000
  store double %26, double* %i.addr, align 8
  br label %for.cond

for.end:
  %27 = load %struct.Map$str$$Node*, %struct.Map$str$$Node** %m.addr, align 8
  %28 = call i64 @nish.Map$str$$Node.probe(%struct.Map$str$$Node* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %29 = icmp sge i64 %28, 0
  br i1 %29, label %get.found, label %get.end

get.found:
  %30 = trunc i64 %28 to i32
  %31 = call %struct.Node* @nish.Map$str$$Node.valueAt(%struct.Map$str$$Node* %27, i32 %30)
  br label %get.end

get.end:
  %32 = phi %struct.Node* [ %31, %get.found ], [ null, %for.end ]
  br i1 %29, label %if.then, label %if.end

if.then:
  %33 = getelementptr inbounds %struct.Node, %struct.Node* %32, i32 0, i32 0
  %34 = load i8*, i8** %33, align 8, !tbaa !4
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %36 = load %struct.Node*, %struct.Node** %p.addr, align 8
  %37 = getelementptr inbounds %struct.Node, %struct.Node* %36, i32 0, i32 0
  %38 = load i8*, i8** %37, align 8, !tbaa !4
  %39 = call i8* @nish_str_concat(i8* %35, i8* %38)
  %40 = call i8* @nish_str_concat(i8* %39, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %41 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %44 = sitofp i64 %43 to double
  %45 = call i8* @nish_str_from_f64(double %44)
  %46 = call i8* @nish_str_concat(i8* %40, i8* %45)
  call void @nish_print(i8* %46)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #2 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #2 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = add nsw i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #2 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #2 {
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

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #1 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %17 = load i32, i32* %16, align 4, !alias.scope !9, !noalias !8, !tbaa !19
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %bucket.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %5 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !19
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

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %13 = load i32, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !19
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
  store i32 %25, i32* %27, align 4, !alias.scope !9, !noalias !8, !tbaa !19
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
  %33 = load i64, i64* %32, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %34 = sitofp i64 %33 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = load i32, i32* %to.addr, align 4
  %37 = icmp sgt i32 %35, %36
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %40 = icmp eq i64 %39, 0
  br i1 %40, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %41 = sub i64 %39, 1
  store i64 %41, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %41
  %46 = load i32, i32* %45, align 4, !alias.scope !9, !noalias !8, !tbaa !19
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
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
  store i64 %8, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %8, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = mul i64 %8, 4
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !9, !noalias !8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  ret %struct.nish_array* %10
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  %4 = sub nsw i32 %3, 1
  store i32 %4, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %17 = load i32, i32* %16, align 4, !alias.scope !9, !noalias !8, !tbaa !19
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

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  store i32 0, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !19
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #1 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
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
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %7
  store i32 %9, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !19
  br label %if.end

if.else:
  %14 = sub nsw i32 %used, 1
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %14)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$$Node.constructor(%struct.Map$str$$Node* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !23
  %1 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !24
  %2 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !25
  %3 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !26
  %4 = sext i32 8 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !9, !noalias !8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %12 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !27
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %18 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !28
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %24 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !29
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %30 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 6
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !30
  ret void
}

define internal noundef i64 @nish.Map$str$$Node.probe(%struct.Map$str$$Node* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !24
  %4 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !30
  %6 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !28
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$str$$Node* @nish.Map$str$$Node.set(%struct.Map$str$$Node* noundef nonnull align 8 dereferenceable(56) %this, i8* noundef nonnull noalias readonly align 8 %key, %struct.Node* noundef nonnull align 8 dereferenceable(8) %value) #1 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$str$$Node.probe(%struct.Map$str$$Node* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$str$$Node.setValueAt(%struct.Map$str$$Node* %this, i32 %4, %struct.Node* %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$str$$Node.insertAt(%struct.Map$str$$Node* %this, i64 %5, i8* %key, %struct.Node* %value)
  br label %if.end

if.end:
  ret %struct.Map$str$$Node* %this
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Node* @nish.Map$str$$Node.valueAt(%struct.Map$str$$Node* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #1 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !29
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !29
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %17 = bitcast i8* %16 to %struct.Node**
  %18 = getelementptr inbounds %struct.Node*, %struct.Node** %17, i64 %11
  %19 = load %struct.Node*, %struct.Node** %18, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  ret %struct.Node* %19
}

define internal void @nish.Map$str$$Node.setValueAt(%struct.Map$str$$Node* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Node* noundef nonnull align 8 dereferenceable(8) %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !29
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !29
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %14 = bitcast i8* %13 to %struct.Node**
  %15 = getelementptr inbounds %struct.Node*, %struct.Node** %14, i64 %11
  store %struct.Node* %value, %struct.Node** %15, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$$Node.insertAt(%struct.Map$str$$Node* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, %struct.Node* noundef nonnull align 8 dereferenceable(8) %value) #1 {
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
  %7 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 4
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !28
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %11 = sitofp i64 %10 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp sge i32 %12, 16777215
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 3
  %15 = load i32, i32* %14, align 4, !tbaa !25
  %16 = icmp sge i32 %15, 16777215
  br i1 %16, label %lor.end, label %lor.rhs

lor.rhs:
  %17 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 7
  %18 = load i32, i32* %17, align 4, !tbaa !26
  %19 = icmp sgt i32 %18, 0
  br label %lor.end

lor.end:
  %20 = phi i1 [ true, %if.then ], [ %19, %lor.rhs ]
  br i1 %20, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$str$$Node.rebuild(%struct.Map$str$$Node* %this)
  %21 = sub nsw i32 0, 1
  store i32 %21, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %22 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 4
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !28
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %23, i64 8)
  br label %push.store

push.store:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %31 = bitcast i8* %30 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 %25
  store i8* %key, i8** %32, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %34 = sitofp i64 %33 to double
  %35 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 5
  %36 = load %struct.nish_array*, %struct.nish_array** %35, align 8, !tbaa !29
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  %40 = load i64, i64* %39, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %41 = icmp eq i64 %38, %40
  br i1 %41, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %36, i64 8)
  br label %push.store.1

push.store.1:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %44 = bitcast i8* %43 to %struct.Node**
  %45 = getelementptr inbounds %struct.Node*, %struct.Node** %44, i64 %38
  store %struct.Node* %value, %struct.Node** %45, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %46 = add i64 %38, 1
  store i64 %46, i64* %37, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %47 = sitofp i64 %46 to double
  %48 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 6
  %49 = load %struct.nish_array*, %struct.nish_array** %48, align 8, !tbaa !30
  %50 = load i32, i32* %h.addr, align 4
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 1
  %54 = load i64, i64* %53, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %55 = icmp eq i64 %52, %54
  br i1 %55, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %49, i64 4)
  br label %push.store.2

push.store.2:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %52
  store i32 %50, i32* %59, align 4, !alias.scope !9, !noalias !8, !tbaa !19
  %60 = add i64 %52, 1
  store i64 %60, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %61 = sitofp i64 %60 to double
  %62 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 3
  %63 = load i32, i32* %62, align 4, !tbaa !25
  %64 = add nsw i32 %63, 1
  %65 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 3
  store i32 %64, i32* %65, align 4, !tbaa !25
  %66 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 0
  %67 = load double, double* %66, align 8, !tbaa !23
  %68 = fadd double %67, 0x3FF0000000000000
  %69 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 0
  store double %68, double* %69, align 8, !tbaa !23
  %70 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 4
  %71 = load %struct.nish_array*, %struct.nish_array** %70, align 8, !tbaa !28
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %74 = sitofp i64 %73 to double
  %75 = call i32 @llvm.fptosi.sat.i32.f64(double %74)
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = mul nsw i32 %76, 4
  %78 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 1
  %79 = load %struct.nish_array*, %struct.nish_array** %78, align 8, !tbaa !27
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %82 = sitofp i64 %81 to double
  %83 = call i32 @llvm.fptosi.sat.i32.f64(double %82)
  %84 = mul nsw i32 %83, 3
  %85 = icmp sgt i32 %77, %84
  br i1 %85, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$$Node.rebuild(%struct.Map$str$$Node* %this)
  br label %if.end.2

if.else:
  %86 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 1
  %87 = load %struct.nish_array*, %struct.nish_array** %86, align 8, !tbaa !27
  %88 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 2
  %89 = load i32, i32* %88, align 4, !tbaa !24
  %90 = load i32, i32* %bucket.addr, align 4
  %91 = load i32, i32* %h.addr, align 4
  %92 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %87, i32 %89, i32 %90, i32 %91, i32 %92)
  br label %if.end.2

if.end.2:
  ret void
}

define internal void @nish.Map$str$$Node.rebuild(%struct.Map$str$$Node* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !26
  %8 = icmp sgt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !27
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !25
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
  %20 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !25
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !28
  %27 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !30
  call void @nish.compactEntries$str(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !29
  %31 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !30
  call void @nish.compactEntries$$Node(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !30
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !27
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !24
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$str$$Node, %struct.Map$str$$Node* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !30
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
  ret void
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #1 {
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
  %20 = load i64, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %42 = load i32, i32* %41, align 4, !alias.scope !9, !noalias !8, !tbaa !19
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
  %54 = sub nsw i32 %53, 1
  store i32 %54, i32* %at.addr, align 4
  %55 = load i32, i32* %at.addr, align 4
  %56 = icmp sge i32 %55, 0
  br i1 %56, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %57 = load i32, i32* %at.addr, align 4
  %58 = sitofp i64 %24 to double
  %59 = call i32 @llvm.fptosi.sat.i32.f64(double %58)
  %60 = icmp slt i32 %57, %59
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %if.then.1 ], [ %60, %land.rhs.4 ]
  br i1 %61, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %62 = load i32, i32* %at.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %26 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %63
  %66 = load i32, i32* %65, align 4, !alias.scope !9, !noalias !8, !tbaa !19
  %67 = load i32, i32* %h.addr, align 4
  %68 = icmp eq i32 %66, %67
  br label %land.end.3

land.end.3:
  %69 = phi i1 [ false, %land.end.4 ], [ %68, %land.rhs.3 ]
  br i1 %69, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %70 = load i32, i32* %at.addr, align 4
  %71 = sitofp i64 %28 to double
  %72 = call i32 @llvm.fptosi.sat.i32.f64(double %71)
  %73 = icmp slt i32 %70, %72
  br label %land.end.2

land.end.2:
  %74 = phi i1 [ false, %land.end.3 ], [ %73, %land.rhs.2 ]
  br i1 %74, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %75 = load i32, i32* %at.addr, align 4
  %76 = sext i32 %75 to i64
  %77 = bitcast i8* %30 to i8**
  %78 = getelementptr inbounds i8*, i8** %77, i64 %76
  %79 = load i8*, i8** %78, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %80 = call zeroext i1 @nish_str_eq(i8* %79, i8* %key)
  br label %land.end.1

land.end.1:
  %81 = phi i1 [ false, %land.end.2 ], [ %80, %land.rhs.1 ]
  br i1 %81, label %if.then.2, label %if.end.2

if.then.2:
  %82 = load i32, i32* %bucket.addr, align 4
  %83 = load i32, i32* %at.addr, align 4
  %84 = tail call i64 @nish.foundAt(i32 %82, i32 %83)
  ret i64 %84

if.end.2:
  br label %if.end.1

if.end.1:
  %85 = load i32, i32* %bucket.addr, align 4
  %86 = add nsw i32 %85, 1
  %87 = and i32 %86, %mask
  store i32 %87, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.8 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %24 = load i32, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !19
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
  %44 = load i8*, i8** %43, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %45 = bitcast i8* %11 to i8**
  %46 = getelementptr inbounds i8*, i8** %45, i64 %39
  store i8* %44, i8** %46, align 8, !alias.scope !9, !noalias !8, !tbaa !17
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
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %60
  %65 = load i8*, i8** %64, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$$Node(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %24 = load i32, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !19
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
  %42 = bitcast i8* %11 to %struct.Node**
  %43 = getelementptr inbounds %struct.Node*, %struct.Node** %42, i64 %41
  %44 = load %struct.Node*, %struct.Node** %43, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %45 = bitcast i8* %11 to %struct.Node**
  %46 = getelementptr inbounds %struct.Node*, %struct.Node** %45, i64 %39
  store %struct.Node* %44, %struct.Node** %46, align 8, !alias.scope !9, !noalias !8, !tbaa !17
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
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %63 = bitcast i8* %62 to %struct.Node**
  %64 = getelementptr inbounds %struct.Node*, %struct.Node** %63, i64 %60
  %65 = load %struct.Node*, %struct.Node** %64, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Node", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element ptr", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!"double", !1, i64 0}
!21 = !{!"i32", !1, i64 0}
!22 = !{!"Map$str$$Node", !20, i64 0, !2, i64 8, !21, i64 16, !21, i64 20, !2, i64 24, !2, i64 32, !2, i64 40, !21, i64 48}
!23 = !{!22, !20, i64 0}
!24 = !{!22, !21, i64 16}
!25 = !{!22, !21, i64 20}
!26 = !{!22, !21, i64 48}
!27 = !{!22, !2, i64 8}
!28 = !{!22, !2, i64 24}
!29 = !{!22, !2, i64 32}
!30 = !{!22, !2, i64 40}
