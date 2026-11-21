%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Map$str$un2.$Circle.$Square = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@nish_hash_key = external global [2 x i64], align 8
@.str.2 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"Map: the system's entropy source failed\00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.hash.seed, i8* null }]
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare i32 @getentropy(i8* noundef, i64 noundef)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #7
declare extern_weak void @nish_panic_overflow(i32 noundef) #7
declare i32 @llvm.fptosi.sat.i32.f64(double) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal void @nish.hash.seed() nounwind {
entry:
  %k = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  %filled = icmp ne i64 %k, 0
  br i1 %filled, label %done, label %fill
fill:
  %got = call i32 @getentropy(i8* bitcast ([2 x i64]* @nish_hash_key to i8*), i64 16)
  %failed = icmp ne i32 %got, 0
  br i1 %failed, label %fail, label %mark
fail:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.2 to i8*))
  unreachable
mark:
  %w = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  %set = or i64 %w, 1
  store i64 %set, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  br label %done
done:
  ret void
}

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #8 {
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

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %r, i32* %1, align 4, !tbaa !5
  ret void
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %side, i32* %1, align 4, !tbaa !8
  ret void
}

define internal noundef i32 @area(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %2 = bitcast %union.tagged* %s to %struct.Circle*
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %2, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !5
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = bitcast %union.tagged* %s to %struct.Circle*
  %9 = getelementptr inbounds %struct.Circle, %struct.Circle* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4, !tbaa !5
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %12

sw.case.1:
  %14 = bitcast %union.tagged* %s to %struct.Square*
  %15 = getelementptr inbounds %struct.Square, %struct.Square* %14, i32 0, i32 1
  %16 = load i32, i32* %15, align 4, !tbaa !8
  %17 = bitcast %union.tagged* %s to %struct.Square*
  %18 = getelementptr inbounds %struct.Square, %struct.Square* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4, !tbaa !8
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %21

sw.unreachable:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef %union.tagged* @pick(i32 noundef %n) #1 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 8)
  %2 = bitcast i8* %1 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %2, i32 %n)
  %3 = bitcast %struct.Circle* %2 to %union.tagged*
  br label %cond.end

cond.false:
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Square*
  %6 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %n)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @Square.constructor(%struct.Square* %5, i32 %7)
  %9 = bitcast %struct.Square* %5 to %union.tagged*
  br label %cond.end

cond.end:
  %10 = phi %union.tagged* [ %3, %cond.true ], [ %9, %ovf.ok ]
  ret %union.tagged* %10

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
}

define void @nish_main() #1 {
entry:
  %m.addr = alloca %struct.Map$str$un2.$Circle.$Square*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$str$un2.$Circle.$Square*
  call void @nish.Map$str$un2.$Circle.$Square.constructor(%struct.Map$str$un2.$Circle.$Square* %1)
  store %struct.Map$str$un2.$Circle.$Square* %1, %struct.Map$str$un2.$Circle.$Square** %m.addr, align 8
  %2 = load %struct.Map$str$un2.$Circle.$Square*, %struct.Map$str$un2.$Circle.$Square** %m.addr, align 8
  call void @nish.Map$str$un2.$Circle.$Square.reserveSlots(%struct.Map$str$un2.$Circle.$Square* %2, i32 4)
  %3 = load %struct.Map$str$un2.$Circle.$Square*, %struct.Map$str$un2.$Circle.$Square** %m.addr, align 8
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %5, i32 2)
  %6 = bitcast %struct.Circle* %5 to %union.tagged*
  %7 = call i64 @nish.Map$str$un2.$Circle.$Square.probe(%struct.Map$str$un2.$Circle.$Square* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %8 = icmp sge i64 %7, 0
  br i1 %8, label %get.found, label %get.insert

get.found:
  %9 = trunc i64 %7 to i32
  %10 = call %union.tagged* @nish.Map$str$un2.$Circle.$Square.valueAt(%struct.Map$str$un2.$Circle.$Square* %3, i32 %9, %union.tagged* zeroinitializer)
  br label %get.end

get.insert:
  call void @nish.Map$str$un2.$Circle.$Square.insertAt(%struct.Map$str$un2.$Circle.$Square* %3, i64 %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), %union.tagged* %6)
  br label %get.end

get.end:
  %11 = phi %union.tagged* [ %10, %get.found ], [ %6, %get.insert ]
  %12 = call i32 @area(%union.tagged* %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load %struct.Map$str$un2.$Circle.$Square*, %struct.Map$str$un2.$Circle.$Square** %m.addr, align 8
  %15 = call i8* @nish_alloc_struct(i64 8)
  %16 = bitcast i8* %15 to %struct.Square*
  call void @Square.constructor(%struct.Square* %16, i32 5)
  %17 = bitcast %struct.Square* %16 to %union.tagged*
  %18 = call i64 @nish.Map$str$un2.$Circle.$Square.probe(%struct.Map$str$un2.$Circle.$Square* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %19 = icmp sge i64 %18, 0
  br i1 %19, label %get.found.1, label %get.insert.1

get.found.1:
  %20 = trunc i64 %18 to i32
  %21 = call %union.tagged* @nish.Map$str$un2.$Circle.$Square.valueAt(%struct.Map$str$un2.$Circle.$Square* %14, i32 %20, %union.tagged* zeroinitializer)
  br label %get.end.1

get.insert.1:
  call void @nish.Map$str$un2.$Circle.$Square.insertAt(%struct.Map$str$un2.$Circle.$Square* %14, i64 %18, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), %union.tagged* %17)
  br label %get.end.1

get.end.1:
  %22 = phi %union.tagged* [ %21, %get.found.1 ], [ %17, %get.insert.1 ]
  %23 = call i32 @area(%union.tagged* %22)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  %25 = load %struct.Map$str$un2.$Circle.$Square*, %struct.Map$str$un2.$Circle.$Square** %m.addr, align 8
  %26 = call i8* @nish_alloc_struct(i64 8)
  %27 = bitcast i8* %26 to %struct.Square*
  call void @Square.constructor(%struct.Square* %27, i32 5)
  %28 = bitcast %struct.Square* %27 to %union.tagged*
  %29 = call i64 @nish.Map$str$un2.$Circle.$Square.probe(%struct.Map$str$un2.$Circle.$Square* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %30 = icmp sge i64 %29, 0
  br i1 %30, label %get.found.2, label %get.insert.2

get.found.2:
  %31 = trunc i64 %29 to i32
  %32 = call %union.tagged* @nish.Map$str$un2.$Circle.$Square.valueAt(%struct.Map$str$un2.$Circle.$Square* %25, i32 %31, %union.tagged* zeroinitializer)
  br label %get.end.2

get.insert.2:
  call void @nish.Map$str$un2.$Circle.$Square.insertAt(%struct.Map$str$un2.$Circle.$Square* %25, i64 %29, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), %union.tagged* %28)
  br label %get.end.2

get.end.2:
  %33 = phi %union.tagged* [ %32, %get.found.2 ], [ %28, %get.insert.2 ]
  %34 = call i32 @area(%union.tagged* %33)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %35)
  %36 = load %struct.Map$str$un2.$Circle.$Square*, %struct.Map$str$un2.$Circle.$Square** %m.addr, align 8
  %37 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %36, i32 0, i32 0
  %38 = load i32, i32* %37, align 4, !tbaa !11
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #2 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #2 {
entry:
  %0 = xor i32 %mask, -1
  %1 = and i32 %h, %0
  %2 = add i32 %index, 1
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
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = zext i32 %h to i64
  %3 = or i64 %1, %2
  %4 = xor i64 %3, -1
  ret i64 %4
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #1 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = load i32, i32* %bucket.addr, align 4
  store i32 %2, i32* %b.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  br label %while.cond

while.cond:
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = trunc i64 %4 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %b.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %6 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %b.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %6 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  ret void

if.end:
  %24 = load i32, i32* %bucket.addr, align 4
  %25 = add i32 %24, 1
  %26 = load i32, i32* %low.addr, align 4
  %27 = and i32 %25, %26
  store i32 %27, i32* %bucket.addr, align 4
  %28 = load i32, i32* %bucket.addr, align 4
  store i32 %28, i32* %b.addr, align 4
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
  %1 = load i64, i64* %0, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  br label %for.cond

for.cond:
  %5 = load i32, i32* %from.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %from.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4
  %16 = icmp sge i32 %15, 0
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %to.addr, align 4
  %19 = load i32, i32* %used.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %to.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %h.addr, align 4
  %25 = bitcast i8* %4 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  store i32 %24, i32* %26, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  %27 = load i32, i32* %to.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %from.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %38 = trunc i64 %37 to i32
  %39 = icmp sgt i32 %38, 0
  br label %land.end.2

land.end.2:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs.2 ]
  br i1 %40, label %while.body, label %while.end

while.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %43 = sub i64 %42, 1
  store i64 %43, i64* %41, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %43
  %48 = load i32, i32* %47, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = sext i32 %live to i64
  %1 = mul nsw i64 %0, 2
  %2 = sext i32 %used to i64
  %3 = icmp slt i64 %1, %2
  br i1 %3, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %n.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %9, 32768
  br label %land.end

land.end:
  %11 = phi i1 [ false, %if.end ], [ %10, %land.rhs ]
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  %12 = load i32, i32* %n.addr, align 4
  %13 = mul nsw i32 %12, 2
  %14 = trunc i32 %13 to i16
  %15 = zext i16 %14 to i64
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 %15, i64* %18, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 %15, i64* %19, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %20 = mul i64 %15, 4
  %21 = call i8* @nish_alloc_struct(i64 %20)
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !16, !noalias !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  ret %struct.nish_array* %17

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2)
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #0 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, %times
  br i1 %4, label %for.body, label %for.end

for.body:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond.1

for.cond.1:
  %5 = load i32, i32* %i.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body.1, label %for.end.1

for.body.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  store i32 0, i32* %16, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %18 = trunc i64 %17 to i32
  br label %for.inc.1

for.inc.1:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %k.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %5 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = icmp ne i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %mask.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  store i32 0, i32* %10, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %size.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = mul nsw i64 %7, 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = mul nsw i64 %10, 3
  %12 = icmp sgt i64 %8, %11
  br i1 %12, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %13 = icmp slt i32 %bucket, 0
  br label %lor.end.1

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ]
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = load i32, i32* %size.addr, align 4
  %16 = icmp sge i32 %bucket, %15
  br label %lor.end

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ]
  br i1 %17, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %18 = load i32, i32* %used.addr, align 4
  %19 = icmp sgt i32 %18, 0
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = sext i32 %bucket to i64
  %21 = load i32, i32* %used.addr, align 4
  %22 = sub nsw i32 %21, 1
  %23 = sext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %23
  %28 = load i32, i32* %27, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  %29 = load i32, i32* %used.addr, align 4
  %30 = sub nsw i32 %29, 1
  %31 = call i32 @nish.slotWord(i32 %28, i32 %mask, i32 %30)
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %20
  store i32 %31, i32* %35, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  br label %if.end.1

if.end.1:
  ret i1 true
}

define internal void @nish.Map$str$un2.$Circle.$Square.constructor(%struct.Map$str$un2.$Circle.$Square* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !11
  %1 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !25
  %2 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !26
  %3 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !27
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 8, i64* %6, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 8, i64* %7, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %8 = mul i64 8, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !16, !noalias !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %11 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !28
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %17 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !29
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %23 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !30
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %29 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !31
  ret void
}

define internal noundef i64 @nish.Map$str$un2.$Circle.$Square.probe(%struct.Map$str$un2.$Circle.$Square* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !25
  %4 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !31
  %6 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !29
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef %union.tagged* @nish.Map$str$un2.$Circle.$Square.valueAt(%struct.Map$str$un2.$Circle.$Square* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %union.tagged* noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !30
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !30
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %13 = bitcast i8* %12 to %union.tagged**
  %14 = getelementptr inbounds %union.tagged*, %union.tagged** %13, i64 %10
  %15 = load %union.tagged*, %union.tagged** %14, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  ret %union.tagged* %15

if.end:
  ret %union.tagged* %none
}

define internal void @nish.Map$str$un2.$Circle.$Square.insertAt(%struct.Map$str$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, %union.tagged* noundef %value) #1 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !29
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  store i8* %key, i8** %11, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %13 = trunc i64 %12 to i32
  %14 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 5
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !30
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 8)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %23 = bitcast i8* %22 to %union.tagged**
  %24 = getelementptr inbounds %union.tagged*, %union.tagged** %23, i64 %17
  store %union.tagged* %value, %union.tagged** %24, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !31
  %29 = load i64, i64* %packed.addr, align 8
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store.2

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %32
  store i32 %30, i32* %39, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %41 = trunc i64 %40 to i32
  call void @nish.Map$str$un2.$Circle.$Square.addOne(%struct.Map$str$un2.$Circle.$Square* %this)
  %42 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 1
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !28
  %44 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 2
  %45 = load i32, i32* %44, align 4, !tbaa !25
  %46 = load i64, i64* %packed.addr, align 8
  %47 = ashr i64 %46, 32
  %48 = trunc i64 %47 to i32
  %49 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !31
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50)
  %52 = xor i1 %51, true
  br i1 %52, label %if.then, label %if.end

if.then:
  call void @nish.Map$str$un2.$Circle.$Square.rebuild(%struct.Map$str$un2.$Circle.$Square* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$un2.$Circle.$Square.addOne(%struct.Map$str$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !26
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !26
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !11
  store i32 %8, i32* %size.addr, align 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = icmp slt i32 %9, 2147483647
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %size.addr, align 4
  %12 = add nsw i32 %11, 1
  %13 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 0
  store i32 %12, i32* %13, align 4, !tbaa !11
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Map$str$un2.$Circle.$Square.rebuild(%struct.Map$str$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !29
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !27
  %7 = icmp ugt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !28
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !26
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !26
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !29
  %26 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !31
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !30
  %30 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !31
  call void @nish.compactEntries$un2.$Circle.$Square(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !31
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !28
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !25
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !31
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Map$str$un2.$Circle.$Square.reserveSlots(%struct.Map$str$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(56) nocapture %this, i32 noundef %n) #1 {
entry:
  %want.addr = alloca double, align 8
  %have.addr = alloca double, align 8
  %size.addr = alloca double, align 8
  %wanted.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  %slots.addr.1 = alloca %struct.nish_array*, align 8
  %0 = sitofp i32 %n to double
  store double %0, double* %want.addr, align 8
  %1 = load double, double* %want.addr, align 8
  %2 = fcmp ogt double %1, 0x0000000000000000
  %3 = xor i1 %2, true
  br i1 %3, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %4 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 1
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !28
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %8 = trunc i64 %7 to i32
  %9 = sitofp i32 %8 to double
  store double %9, double* %have.addr, align 8
  %10 = load double, double* %have.addr, align 8
  store double %10, double* %size.addr, align 8
  br label %while.cond

while.cond:
  %11 = load double, double* %want.addr, align 8
  %12 = fmul double %11, 0x4010000000000000
  %13 = load double, double* %size.addr, align 8
  %14 = fmul double %13, 0x4008000000000000
  %15 = fcmp ogt double %12, %14
  br i1 %15, label %land.rhs, label %land.end

land.rhs:
  %16 = load double, double* %size.addr, align 8
  %17 = fcmp olt double %16, 0x41D0000000000000
  br label %land.end

land.end:
  %18 = phi i1 [ false, %while.cond ], [ %17, %land.rhs ]
  br i1 %18, label %while.body, label %while.end

while.body:
  %19 = load double, double* %size.addr, align 8
  %20 = fmul double %19, 0x4000000000000000
  store double %20, double* %size.addr, align 8
  br label %while.cond

while.end:
  %21 = load double, double* %size.addr, align 8
  %22 = load double, double* %have.addr, align 8
  %23 = fcmp ogt double %21, %22
  br i1 %23, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %24 = load double, double* %have.addr, align 8
  %25 = fcmp ogt double %24, 0x0000000000000000
  br label %land.end.1

land.end.1:
  %26 = phi i1 [ false, %while.end ], [ %25, %land.rhs.1 ]
  br i1 %26, label %if.then.1, label %if.end.1

if.then.1:
  %27 = load double, double* %size.addr, align 8
  %28 = call i32 @llvm.fptosi.sat.i32.f64(double %27)
  store i32 %28, i32* %wanted.addr, align 4
  %29 = load i32, i32* %wanted.addr, align 4
  %30 = icmp sgt i32 %29, 0
  br i1 %30, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %31 = load i32, i32* %wanted.addr, align 4
  %32 = icmp sle i32 %31, 65535
  br label %land.end.2

land.end.2:
  %33 = phi i1 [ false, %if.then.1 ], [ %32, %land.rhs.2 ]
  br i1 %33, label %if.then.2, label %if.end.2

if.then.2:
  %34 = load i32, i32* %wanted.addr, align 4
  %35 = trunc i32 %34 to i16
  %36 = zext i16 %35 to i64
  %37 = call i8* @nish_alloc_struct(i64 24)
  %38 = bitcast i8* %37 to %struct.nish_array*
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  store i64 %36, i64* %39, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 1
  store i64 %36, i64* %40, align 8, !alias.scope !15, !noalias !16, !tbaa !24
  %41 = mul i64 %36, 4
  %42 = call i8* @nish_alloc_struct(i64 %41)
  call void @llvm.memset.p0i8.i64(i8* align 8 %42, i8 0, i64 %41, i1 false), !alias.scope !16, !noalias !15
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  store i8* %42, i8** %43, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  store %struct.nish_array* %38, %struct.nish_array** %slots.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 1
  store %struct.nish_array* %44, %struct.nish_array** %45, align 8, !tbaa !28
  %46 = load i32, i32* %wanted.addr, align 4
  %47 = sub nsw i32 %46, 1
  %48 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 2
  store i32 %47, i32* %48, align 4, !tbaa !25
  %49 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %50 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  %51 = load %struct.nish_array*, %struct.nish_array** %50, align 8, !tbaa !31
  call void @nish.refile(%struct.nish_array* %49, %struct.nish_array* %51)
  ret void

if.end.2:
  %52 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 1
  %53 = load %struct.nish_array*, %struct.nish_array** %52, align 8, !tbaa !28
  store %struct.nish_array* %53, %struct.nish_array** %slots.addr.1, align 8
  %54 = load %struct.nish_array*, %struct.nish_array** %slots.addr.1, align 8
  %55 = load double, double* %size.addr, align 8
  %56 = load double, double* %have.addr, align 8
  %57 = fdiv double %55, %56
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  call void @nish.widenSlots(%struct.nish_array* %54, i32 %58)
  %59 = load %struct.nish_array*, %struct.nish_array** %slots.addr.1, align 8
  call void @nish.clearSlots(%struct.nish_array* %59)
  %60 = load %struct.nish_array*, %struct.nish_array** %slots.addr.1, align 8
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %63 = trunc i64 %62 to i32
  %64 = sub nsw i32 %63, 1
  %65 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 2
  store i32 %64, i32* %65, align 4, !tbaa !25
  %66 = load %struct.nish_array*, %struct.nish_array** %slots.addr.1, align 8
  %67 = getelementptr inbounds %struct.Map$str$un2.$Circle.$Square, %struct.Map$str$un2.$Circle.$Square* %this, i32 0, i32 6
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !31
  call void @nish.refile(%struct.nish_array* %66, %struct.nish_array* %68)
  br label %if.end.1

if.end.1:
  ret void
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #3 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.v0 = alloca i64, align 8
  %hash.v1 = alloca i64, align 8
  %hash.v2 = alloca i64, align 8
  %hash.v3 = alloca i64, align 8
  %hash.b = alloca i64, align 8
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  %3 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 0), align 8
  %4 = load i64, i64* getelementptr inbounds ([2 x i64], [2 x i64]* @nish_hash_key, i64 0, i64 1), align 8
  %5 = xor i64 %3, 8317987319222330741
  store i64 %5, i64* %hash.v0, align 8
  %6 = xor i64 %4, 7237128888997146477
  store i64 %6, i64* %hash.v1, align 8
  %7 = xor i64 %3, 7816392313619706465
  store i64 %7, i64* %hash.v2, align 8
  %8 = xor i64 %4, 8387220255154660723
  store i64 %8, i64* %hash.v3, align 8
  %9 = and i64 %1, -8
  store i64 0, i64* %hash.i, align 8
  br label %hash.test

hash.test:
  %10 = load i64, i64* %hash.i, align 8
  %11 = icmp ult i64 %10, %9
  br i1 %11, label %hash.word, label %hash.tail

hash.word:
  %12 = getelementptr inbounds i8, i8* %2, i64 %10
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 1
  %15 = load i64, i64* %hash.v3, align 8
  %16 = xor i64 %15, %14
  store i64 %16, i64* %hash.v3, align 8
  %17 = load i64, i64* %hash.v0, align 8
  %18 = load i64, i64* %hash.v1, align 8
  %19 = load i64, i64* %hash.v2, align 8
  %20 = load i64, i64* %hash.v3, align 8
  %21 = add i64 %17, %18
  %22 = shl i64 %18, 13
  %23 = lshr i64 %18, 51
  %24 = or i64 %22, %23
  %25 = xor i64 %24, %21
  %26 = shl i64 %21, 32
  %27 = lshr i64 %21, 32
  %28 = or i64 %26, %27
  %29 = add i64 %19, %20
  %30 = shl i64 %20, 16
  %31 = lshr i64 %20, 48
  %32 = or i64 %30, %31
  %33 = xor i64 %32, %29
  %34 = add i64 %28, %33
  %35 = shl i64 %33, 21
  %36 = lshr i64 %33, 43
  %37 = or i64 %35, %36
  %38 = xor i64 %37, %34
  %39 = add i64 %29, %25
  %40 = shl i64 %25, 17
  %41 = lshr i64 %25, 47
  %42 = or i64 %40, %41
  %43 = xor i64 %42, %39
  %44 = shl i64 %39, 32
  %45 = lshr i64 %39, 32
  %46 = or i64 %44, %45
  store i64 %34, i64* %hash.v0, align 8
  store i64 %43, i64* %hash.v1, align 8
  store i64 %46, i64* %hash.v2, align 8
  store i64 %38, i64* %hash.v3, align 8
  %47 = xor i64 %34, %14
  store i64 %47, i64* %hash.v0, align 8
  %48 = add i64 %10, 8
  store i64 %48, i64* %hash.i, align 8
  br label %hash.test

hash.tail:
  %49 = shl i64 %1, 56
  store i64 %49, i64* %hash.b, align 8
  br label %hash.more

hash.more:
  %50 = load i64, i64* %hash.i, align 8
  %51 = icmp ult i64 %50, %1
  br i1 %51, label %hash.byte, label %hash.done

hash.byte:
  %52 = getelementptr inbounds i8, i8* %2, i64 %50
  %53 = load i8, i8* %52
  %54 = zext i8 %53 to i64
  %55 = sub i64 %50, %9
  %56 = shl i64 %55, 3
  %57 = load i64, i64* %hash.b, align 8
  %58 = shl i64 %54, %56
  %59 = or i64 %57, %58
  store i64 %59, i64* %hash.b, align 8
  %60 = add i64 %50, 1
  store i64 %60, i64* %hash.i, align 8
  br label %hash.more

hash.done:
  %61 = load i64, i64* %hash.b, align 8
  %62 = load i64, i64* %hash.v3, align 8
  %63 = xor i64 %62, %61
  store i64 %63, i64* %hash.v3, align 8
  %64 = load i64, i64* %hash.v0, align 8
  %65 = load i64, i64* %hash.v1, align 8
  %66 = load i64, i64* %hash.v2, align 8
  %67 = load i64, i64* %hash.v3, align 8
  %68 = add i64 %64, %65
  %69 = shl i64 %65, 13
  %70 = lshr i64 %65, 51
  %71 = or i64 %69, %70
  %72 = xor i64 %71, %68
  %73 = shl i64 %68, 32
  %74 = lshr i64 %68, 32
  %75 = or i64 %73, %74
  %76 = add i64 %66, %67
  %77 = shl i64 %67, 16
  %78 = lshr i64 %67, 48
  %79 = or i64 %77, %78
  %80 = xor i64 %79, %76
  %81 = add i64 %75, %80
  %82 = shl i64 %80, 21
  %83 = lshr i64 %80, 43
  %84 = or i64 %82, %83
  %85 = xor i64 %84, %81
  %86 = add i64 %76, %72
  %87 = shl i64 %72, 17
  %88 = lshr i64 %72, 47
  %89 = or i64 %87, %88
  %90 = xor i64 %89, %86
  %91 = shl i64 %86, 32
  %92 = lshr i64 %86, 32
  %93 = or i64 %91, %92
  store i64 %81, i64* %hash.v0, align 8
  store i64 %90, i64* %hash.v1, align 8
  store i64 %93, i64* %hash.v2, align 8
  store i64 %85, i64* %hash.v3, align 8
  %94 = xor i64 %81, %61
  store i64 %94, i64* %hash.v0, align 8
  %95 = load i64, i64* %hash.v2, align 8
  %96 = xor i64 %95, 255
  store i64 %96, i64* %hash.v2, align 8
  %97 = load i64, i64* %hash.v0, align 8
  %98 = load i64, i64* %hash.v1, align 8
  %99 = load i64, i64* %hash.v2, align 8
  %100 = load i64, i64* %hash.v3, align 8
  %101 = add i64 %97, %98
  %102 = shl i64 %98, 13
  %103 = lshr i64 %98, 51
  %104 = or i64 %102, %103
  %105 = xor i64 %104, %101
  %106 = shl i64 %101, 32
  %107 = lshr i64 %101, 32
  %108 = or i64 %106, %107
  %109 = add i64 %99, %100
  %110 = shl i64 %100, 16
  %111 = lshr i64 %100, 48
  %112 = or i64 %110, %111
  %113 = xor i64 %112, %109
  %114 = add i64 %108, %113
  %115 = shl i64 %113, 21
  %116 = lshr i64 %113, 43
  %117 = or i64 %115, %116
  %118 = xor i64 %117, %114
  %119 = add i64 %109, %105
  %120 = shl i64 %105, 17
  %121 = lshr i64 %105, 47
  %122 = or i64 %120, %121
  %123 = xor i64 %122, %119
  %124 = shl i64 %119, 32
  %125 = lshr i64 %119, 32
  %126 = or i64 %124, %125
  %127 = add i64 %114, %123
  %128 = shl i64 %123, 13
  %129 = lshr i64 %123, 51
  %130 = or i64 %128, %129
  %131 = xor i64 %130, %127
  %132 = shl i64 %127, 32
  %133 = lshr i64 %127, 32
  %134 = or i64 %132, %133
  %135 = add i64 %126, %118
  %136 = shl i64 %118, 16
  %137 = lshr i64 %118, 48
  %138 = or i64 %136, %137
  %139 = xor i64 %138, %135
  %140 = add i64 %134, %139
  %141 = shl i64 %139, 21
  %142 = lshr i64 %139, 43
  %143 = or i64 %141, %142
  %144 = xor i64 %143, %140
  %145 = add i64 %135, %131
  %146 = shl i64 %131, 17
  %147 = lshr i64 %131, 47
  %148 = or i64 %146, %147
  %149 = xor i64 %148, %145
  %150 = shl i64 %145, 32
  %151 = lshr i64 %145, 32
  %152 = or i64 %150, %151
  %153 = add i64 %140, %149
  %154 = shl i64 %149, 13
  %155 = lshr i64 %149, 51
  %156 = or i64 %154, %155
  %157 = xor i64 %156, %153
  %158 = shl i64 %153, 32
  %159 = lshr i64 %153, 32
  %160 = or i64 %158, %159
  %161 = add i64 %152, %144
  %162 = shl i64 %144, 16
  %163 = lshr i64 %144, 48
  %164 = or i64 %162, %163
  %165 = xor i64 %164, %161
  %166 = add i64 %160, %165
  %167 = shl i64 %165, 21
  %168 = lshr i64 %165, 43
  %169 = or i64 %167, %168
  %170 = xor i64 %169, %166
  %171 = add i64 %161, %157
  %172 = shl i64 %157, 17
  %173 = lshr i64 %157, 47
  %174 = or i64 %172, %173
  %175 = xor i64 %174, %171
  %176 = shl i64 %171, 32
  %177 = lshr i64 %171, 32
  %178 = or i64 %176, %177
  store i64 %166, i64* %hash.v0, align 8
  store i64 %175, i64* %hash.v1, align 8
  store i64 %178, i64* %hash.v2, align 8
  store i64 %170, i64* %hash.v3, align 8
  %179 = xor i64 %166, %175
  %180 = xor i64 %178, %170
  %181 = xor i64 %179, %180
  %182 = trunc i64 %181 to i32
  %183 = lshr i64 %181, 32
  %184 = trunc i64 %183 to i32
  %185 = xor i32 %182, %184
  %186 = icmp eq i32 %185, 0
  %187 = select i1 %186, i32 1, i32 %185
  store i32 %187, i32* %h.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %188 = load i32, i32* %h.addr, align 4
  %189 = load i32, i32* %low.addr, align 4
  %190 = xor i32 %189, -1
  %191 = and i32 %188, %190
  store i32 %191, i32* %fingerprint.addr, align 4
  %192 = load i32, i32* %h.addr, align 4
  %193 = call i32 @nish.homeBucket(i32 %192, i32 %mask)
  store i32 %193, i32* %bucket.addr, align 4
  %194 = load i32, i32* %bucket.addr, align 4
  store i32 %194, i32* %b.addr, align 4
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %196 = load i64, i64* %195, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %198 = load i8*, i8** %197, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %200 = load i64, i64* %199, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %201 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %202 = load i8*, i8** %201, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %203 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %204 = load i64, i64* %203, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %206 = load i8*, i8** %205, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  br label %while.cond

while.cond:
  %207 = load i32, i32* %b.addr, align 4
  %208 = icmp sge i32 %207, 0
  br i1 %208, label %land.rhs, label %land.end

land.rhs:
  %209 = load i32, i32* %b.addr, align 4
  %210 = trunc i64 %196 to i32
  %211 = icmp slt i32 %209, %210
  br label %land.end

land.end:
  %212 = phi i1 [ false, %while.cond ], [ %211, %land.rhs ]
  br i1 %212, label %while.body, label %while.end

while.body:
  %213 = load i32, i32* %b.addr, align 4
  %214 = sext i32 %213 to i64
  %215 = bitcast i8* %198 to i32*
  %216 = getelementptr inbounds i32, i32* %215, i64 %214
  %217 = load i32, i32* %216, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  store i32 %217, i32* %word.addr, align 4
  %218 = load i32, i32* %word.addr, align 4
  %219 = icmp eq i32 %218, 0
  br i1 %219, label %if.then, label %if.end

if.then:
  %220 = load i32, i32* %b.addr, align 4
  %221 = load i32, i32* %h.addr, align 4
  %222 = tail call i64 @nish.absentAt(i32 %220, i32 %221)
  ret i64 %222

if.end:
  %223 = load i32, i32* %word.addr, align 4
  %224 = load i32, i32* %low.addr, align 4
  %225 = xor i32 %224, -1
  %226 = and i32 %223, %225
  %227 = load i32, i32* %fingerprint.addr, align 4
  %228 = icmp eq i32 %226, %227
  br i1 %228, label %if.then.1, label %if.end.1

if.then.1:
  %229 = load i32, i32* %word.addr, align 4
  %230 = load i32, i32* %low.addr, align 4
  %231 = and i32 %229, %230
  %232 = sub i32 %231, 1
  store i32 %232, i32* %at.addr, align 4
  %233 = load i32, i32* %at.addr, align 4
  %234 = icmp sge i32 %233, 0
  br i1 %234, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %235 = load i32, i32* %at.addr, align 4
  %236 = trunc i64 %200 to i32
  %237 = icmp slt i32 %235, %236
  br label %land.end.4

land.end.4:
  %238 = phi i1 [ false, %if.then.1 ], [ %237, %land.rhs.4 ]
  br i1 %238, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %239 = load i32, i32* %at.addr, align 4
  %240 = sext i32 %239 to i64
  %241 = bitcast i8* %202 to i32*
  %242 = getelementptr inbounds i32, i32* %241, i64 %240
  %243 = load i32, i32* %242, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  %244 = load i32, i32* %h.addr, align 4
  %245 = icmp eq i32 %243, %244
  br label %land.end.3

land.end.3:
  %246 = phi i1 [ false, %land.end.4 ], [ %245, %land.rhs.3 ]
  br i1 %246, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %247 = load i32, i32* %at.addr, align 4
  %248 = trunc i64 %204 to i32
  %249 = icmp slt i32 %247, %248
  br label %land.end.2

land.end.2:
  %250 = phi i1 [ false, %land.end.3 ], [ %249, %land.rhs.2 ]
  br i1 %250, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %251 = load i32, i32* %at.addr, align 4
  %252 = sext i32 %251 to i64
  %253 = bitcast i8* %206 to i8**
  %254 = getelementptr inbounds i8*, i8** %253, i64 %252
  %255 = load i8*, i8** %254, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  %256 = call zeroext i1 @nish_str_eq(i8* %255, i8* %key)
  br label %land.end.1

land.end.1:
  %257 = phi i1 [ false, %land.end.2 ], [ %256, %land.rhs.1 ]
  br i1 %257, label %if.then.2, label %if.end.2

if.then.2:
  %258 = load i32, i32* %b.addr, align 4
  %259 = load i32, i32* %at.addr, align 4
  %260 = tail call i64 @nish.foundAt(i32 %258, i32 %259)
  ret i64 %260

if.end.2:
  br label %if.end.1

if.end.1:
  %261 = load i32, i32* %bucket.addr, align 4
  %262 = add i32 %261, 1
  %263 = load i32, i32* %low.addr, align 4
  %264 = and i32 %262, %263
  store i32 %264, i32* %bucket.addr, align 4
  %265 = load i32, i32* %bucket.addr, align 4
  store i32 %265, i32* %b.addr, align 4
  br label %while.cond

while.end:
  %266 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %267 = load i64, i64* %266, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %268 = trunc i64 %267 to i32
  %269 = load i32, i32* %h.addr, align 4
  %270 = tail call i64 @nish.absentAt(i32 %268, i32 %269)
  ret i64 %270
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38
  %41 = load i8*, i8** %40, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  %42 = bitcast i8* %10 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* %41, i8** %43, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %60
  %65 = load i8*, i8** %64, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$un2.$Circle.$Square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !16, !noalias !15, !tbaa !23
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to %union.tagged**
  %40 = getelementptr inbounds %union.tagged*, %union.tagged** %39, i64 %38
  %41 = load %union.tagged*, %union.tagged** %40, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  %42 = bitcast i8* %10 to %union.tagged**
  %43 = getelementptr inbounds %union.tagged*, %union.tagged** %42, i64 %36
  store %union.tagged* %41, %union.tagged** %43, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %63 = bitcast i8* %62 to %union.tagged**
  %64 = getelementptr inbounds %union.tagged*, %union.tagged** %63, i64 %60
  %65 = load %union.tagged*, %union.tagged** %64, align 8, !alias.scope !16, !noalias !15, !tbaa !33
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #7 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #8 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!34, !35, !36, !37, !38}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Square", !2, i64 0, !2, i64 4}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
!9 = !{!"ptr", !1, i64 0}
!10 = !{!"Map$str$un2.$Circle.$Square", !2, i64 0, !9, i64 8, !2, i64 16, !2, i64 20, !9, i64 24, !9, i64 32, !9, i64 40, !2, i64 48}
!11 = !{!10, !2, i64 0}
!12 = !{!"nish array"}
!13 = !{!"header", !12}
!14 = !{!"elements", !12}
!15 = !{!13}
!16 = !{!14}
!17 = !{!"header i64", !1, i64 0}
!18 = !{!"header ptr", !1, i64 0}
!19 = !{!"array header", !17, i64 0, !17, i64 8, !18, i64 16}
!20 = !{!19, !17, i64 0}
!21 = !{!19, !18, i64 16}
!22 = !{!"element i32", !1, i64 0}
!23 = !{!22, !22, i64 0}
!24 = !{!19, !17, i64 8}
!25 = !{!10, !2, i64 16}
!26 = !{!10, !2, i64 20}
!27 = !{!10, !2, i64 48}
!28 = !{!10, !9, i64 8}
!29 = !{!10, !9, i64 24}
!30 = !{!10, !9, i64 32}
!31 = !{!10, !9, i64 40}
!32 = !{!"element ptr", !1, i64 0}
!33 = !{!32, !32, i64 0}
!34 = !{i32 8, !"cf-protection-branch", i32 1}
!35 = !{i32 8, !"cf-protection-return", i32 1}
!36 = !{i32 8, !"branch-target-enforcement", i32 1}
!37 = !{i32 8, !"sign-return-address", i32 1}
!38 = !{i32 4, !"probe-stack", !"inline-asm"}
