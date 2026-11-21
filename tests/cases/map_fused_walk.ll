%struct.Map$f64$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #1

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
  %m.addr = alloca %struct.Map$f64$f64*, align 8
  %k.addr = alloca double, align 8
  %walk.idx = alloca i32, align 4
  %next.addr = alloca double, align 8
  %k.addr.1 = alloca double, align 8
  %walk.idx.1 = alloca i32, align 4
  %s.addr = alloca %struct.Set$f64*, align 8
  %added.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %walk.idx.2 = alloca i32, align 4
  %y.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$f64$f64*
  call void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* %1)
  store %struct.Map$f64$f64* %1, %struct.Map$f64$f64** %m.addr, align 8
  %2 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  %3 = call %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* %2, double 0x3FF0000000000000, double 0x0000000000000000)
  %4 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  %5 = call %struct.Map$f64$f64* @nish.Map$f64$f64.set(%struct.Map$f64$f64* %4, double 0x4000000000000000, double 0x0000000000000000)
  %6 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %6)
  %7 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %6, i32 0)
  store i32 %7, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %8 = load i32, i32* %walk.idx, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %walk.body, label %walk.end

walk.body:
  %10 = call double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* %6, i32 %8, double zeroinitializer)
  store double %10, double* %k.addr, align 8
  %11 = load double, double* %k.addr, align 8
  %12 = fmul double %11, 0x4000000000000000
  store double %12, double* %next.addr, align 8
  %13 = load double, double* %next.addr, align 8
  %14 = fcmp olt double %13, 0x4024000000000000
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  %16 = load double, double* %next.addr, align 8
  %17 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %15, double %16)
  %18 = icmp sge i64 %17, 0
  br i1 %18, label %nullish.value, label %nullish.default

nullish.value:
  %19 = trunc i64 %17 to i32
  %20 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %15, i32 %19, double zeroinitializer)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %21 = phi double [ %20, %nullish.value ], [ 0x0000000000000000, %nullish.default ]
  %22 = fadd double %21, 0x3FF0000000000000
  br i1 %18, label %set.found, label %set.insert

set.found:
  %23 = trunc i64 %17 to i32
  call void @nish.Map$f64$f64.setValueAt(%struct.Map$f64$f64* %15, i32 %23, double %22)
  br label %set.end

set.insert:
  call void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* %15, i64 %17, double %16, double %22)
  br label %set.end

set.end:
  br label %if.end

if.end:
  br label %walk.inc

walk.inc:
  %24 = add i32 %8, 1
  %25 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %6, i32 %24)
  store i32 %25, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %6)
  %26 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  call void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* %26)
  %27 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %26, i32 0)
  store i32 %27, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.cond.1:
  %28 = load i32, i32* %walk.idx.1, align 4
  %29 = icmp sge i32 %28, 0
  br i1 %29, label %walk.body.1, label %walk.end.1

walk.body.1:
  %30 = call double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* %26, i32 %28, double zeroinitializer)
  store double %30, double* %k.addr.1, align 8
  %31 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %32 = load i8*, i8** %31, align 8
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %34 = load i64, i64* %33, align 8
  %35 = load double, double* %k.addr.1, align 8
  %36 = call i8* @nish_str_from_f64(double %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %38 = load %struct.Map$f64$f64*, %struct.Map$f64$f64** %m.addr, align 8
  %39 = load double, double* %k.addr.1, align 8
  %40 = call i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* %38, double %39)
  %41 = icmp sge i64 %40, 0
  br i1 %41, label %nullish.value.1, label %nullish.default.1

nullish.value.1:
  %42 = trunc i64 %40 to i32
  %43 = call double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* %38, i32 %42, double zeroinitializer)
  br label %nullish.end.1

nullish.default.1:
  %44 = fneg double 0x3FF0000000000000
  br label %nullish.end.1

nullish.end.1:
  %45 = phi double [ %43, %nullish.value.1 ], [ %44, %nullish.default.1 ]
  %46 = call i8* @nish_str_from_f64(double %45)
  %47 = call i8* @nish_str_concat(i8* %37, i8* %46)
  call void @nish_print(i8* %47)
  %48 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %49 = load i8*, i8** %48, align 8
  %50 = icmp eq i8* %49, %32
  br i1 %50, label %pass.rewind, label %pass.free

pass.rewind:
  %51 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %34, i64* %51, align 8
  br label %pass.done

pass.free:
  %52 = ptrtoint i8* %32 to i64
  %53 = add i64 %52, %34
  call void @nish_arena_release(i64 %53)
  br label %pass.done

pass.done:
  br label %walk.inc.1

walk.inc.1:
  %54 = add i32 %28, 1
  %55 = call i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* %26, i32 %54)
  store i32 %55, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.end.1:
  call void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* %26)
  %56 = call i8* @nish_alloc_struct(i64 48)
  %57 = bitcast i8* %56 to %struct.Set$f64*
  call void @nish.Set$f64.constructor(%struct.Set$f64* %57)
  store %struct.Set$f64* %57, %struct.Set$f64** %s.addr, align 8
  %58 = load %struct.Set$f64*, %struct.Set$f64** %s.addr, align 8
  %59 = call %struct.Set$f64* @nish.Set$f64.add(%struct.Set$f64* %58, double 0x4008000000000000)
  store double 0x0000000000000000, double* %added.addr, align 8
  %60 = load %struct.Set$f64*, %struct.Set$f64** %s.addr, align 8
  call void @nish.Set$f64.walkOpen(%struct.Set$f64* %60)
  %61 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %60, i32 0)
  store i32 %61, i32* %walk.idx.2, align 4
  br label %walk.cond.2

walk.cond.2:
  %62 = load i32, i32* %walk.idx.2, align 4
  %63 = icmp sge i32 %62, 0
  br i1 %63, label %walk.body.2, label %walk.end.2

walk.body.2:
  %64 = call double @nish.Set$f64.keyAt(%struct.Set$f64* %60, i32 %62, double zeroinitializer)
  store double %64, double* %x.addr, align 8
  %65 = load double, double* %x.addr, align 8
  %66 = fadd double %65, 0x4008000000000000
  store double %66, double* %y.addr, align 8
  %67 = load %struct.Set$f64*, %struct.Set$f64** %s.addr, align 8
  %68 = load double, double* %y.addr, align 8
  %69 = call i64 @nish.Set$f64.probe(%struct.Set$f64* %67, double %68)
  %70 = icmp sge i64 %69, 0
  %71 = xor i1 %70, true
  br i1 %71, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.Set$f64.insertAt(%struct.Set$f64* %67, i64 %69, double %68)
  %72 = load double, double* %added.addr, align 8
  %73 = fadd double %72, 0x3FF0000000000000
  store double %73, double* %added.addr, align 8
  br label %if.end.1

if.end.1:
  %74 = load %struct.Set$f64*, %struct.Set$f64** %s.addr, align 8
  %75 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %74, i32 0, i32 0
  %76 = load double, double* %75, align 8, !tbaa !6
  %77 = fcmp ogt double %76, 0x4014000000000000
  br i1 %77, label %if.then.2, label %if.end.2

if.then.2:
  br label %walk.end.2

if.end.2:
  br label %walk.inc.2

walk.inc.2:
  %78 = add i32 %62, 1
  %79 = call i32 @nish.Set$f64.walkNext(%struct.Set$f64* %60, i32 %78)
  store i32 %79, i32* %walk.idx.2, align 4
  br label %walk.cond.2

walk.end.2:
  call void @nish.Set$f64.walkClose(%struct.Set$f64* %60)
  %80 = load %struct.Set$f64*, %struct.Set$f64** %s.addr, align 8
  %81 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %80, i32 0, i32 0
  %82 = load double, double* %81, align 8, !tbaa !6
  %83 = call i8* @nish_str_from_f64(double %82)
  %84 = call i8* @nish_str_concat(i8* %83, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %85 = load double, double* %added.addr, align 8
  %86 = call i8* @nish_str_from_f64(double %85)
  %87 = call i8* @nish_str_concat(i8* %84, i8* %86)
  call void @nish_print(i8* %87)
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

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #1 {
entry:
  %0 = xor i32 %mask, -1
  %1 = and i32 %h, %0
  %2 = add i32 %index, 1
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
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = zext i32 %h to i64
  %3 = or i64 %1, %2
  %4 = xor i64 %3, -1
  ret i64 %4
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
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
  %4 = load i64, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %while.cond

while.cond:
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = sitofp i64 %4 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp slt i32 %9, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %b.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %19 = icmp eq i32 %18, 0
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %b.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = load i32, i32* %word.addr, align 4
  %23 = bitcast i8* %6 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %21
  store i32 %22, i32* %24, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  ret void

if.end:
  %25 = load i32, i32* %bucket.addr, align 4
  %26 = add i32 %25, 1
  %27 = load i32, i32* %low.addr, align 4
  %28 = and i32 %26, %27
  store i32 %28, i32* %bucket.addr, align 4
  %29 = load i32, i32* %bucket.addr, align 4
  store i32 %29, i32* %b.addr, align 4
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
  br i1 %37, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %40 = sitofp i64 %39 to double
  %41 = fcmp ogt double %40, 0x0000000000000000
  br label %land.end.2

land.end.2:
  %42 = phi i1 [ false, %while.cond ], [ %41, %land.rhs.2 ]
  br i1 %42, label %while.body, label %while.end

while.body:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %45 = sub i64 %44, 1
  store i64 %45, i64* %43, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %45
  %50 = load i32, i32* %49, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
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
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = sitofp i64 %5 to double
  %7 = call i32 @llvm.fptosi.sat.i32.f64(double %6)
  store i32 %7, i32* %n.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %n.addr, align 4
  %11 = icmp slt i32 %10, 32768
  br label %land.end

land.end:
  %12 = phi i1 [ false, %if.end ], [ %11, %land.rhs ]
  br i1 %12, label %if.then.1, label %if.end.1

if.then.1:
  %13 = load i32, i32* %n.addr, align 4
  %14 = mul nsw i32 %13, 2
  %15 = trunc i32 %14 to i16
  %16 = zext i16 %15 to i64
  %17 = call i8* @nish_alloc_struct(i64 24)
  %18 = bitcast i8* %17 to %struct.nish_array*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 %16, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 %16, i64* %20, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %21 = mul i64 %16, 4
  %22 = call i8* @nish_alloc_struct(i64 %21)
  call void @llvm.memset.p0i8.i64(i8* align 8 %22, i8 0, i64 %21, i1 false), !alias.scope !11, !noalias !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  ret %struct.nish_array* %18

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2)
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #2 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %k.addr, align 4
  %5 = icmp slt i32 %4, %times
  br i1 %5, label %for.body, label %for.end

for.body:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond.1

for.cond.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %for.body.1, label %for.end.1

for.body.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 0, i32* %17, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %19 = sitofp i64 %18 to double
  br label %for.inc.1

for.inc.1:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %k.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
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
  ret i32 -1
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #2 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = sitofp i64 %5 to double
  %7 = call i32 @llvm.fptosi.sat.i32.f64(double %6)
  store i32 %7, i32* %size.addr, align 4
  %8 = load i32, i32* %used.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = mul nsw i64 %9, 4
  %11 = load i32, i32* %size.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = mul nsw i64 %12, 3
  %14 = icmp sgt i64 %10, %13
  br i1 %14, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %15 = icmp slt i32 %bucket, 0
  br label %lor.end.1

lor.end.1:
  %16 = phi i1 [ true, %entry ], [ %15, %lor.rhs.1 ]
  br i1 %16, label %lor.end, label %lor.rhs

lor.rhs:
  %17 = load i32, i32* %size.addr, align 4
  %18 = icmp sge i32 %bucket, %17
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %lor.end.1 ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %20 = load i32, i32* %used.addr, align 4
  %21 = icmp sgt i32 %20, 0
  br i1 %21, label %if.then.1, label %if.end.1

if.then.1:
  %22 = sext i32 %bucket to i64
  %23 = load i32, i32* %used.addr, align 4
  %24 = sub nsw i32 %23, 1
  %25 = sext i32 %24 to i64
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %25
  %30 = load i32, i32* %29, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %31 = load i32, i32* %used.addr, align 4
  %32 = sub nsw i32 %31, 1
  %33 = call i32 @nish.slotWord(i32 %30, i32 %mask, i32 %32)
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %22
  store i32 %33, i32* %37, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  br label %if.end.1

if.end.1:
  ret i1 true
}

define internal void @nish.Map$f64$f64.constructor(%struct.Map$f64$f64* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !21
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !22
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !23
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !24
  %4 = fptosi double 0x4020000000000000 to i64
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
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !25
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %18 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !26
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !27
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %30 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !28
  ret void
}

define internal noundef i64 @nish.Map$f64$f64.probe(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, double noundef %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !22
  %4 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !28
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !26
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

define internal void @nish.Map$f64$f64.walkOpen(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !24
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !24
  ret void
}

define internal noundef i32 @nish.Map$f64$f64.walkNext(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$f64$f64.walkClose(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !24
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !24
  ret void
}

define internal noundef double @nish.Map$f64$f64.keyAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
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
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !26
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  ret double %16

if.end:
  ret double %none
}

define internal noundef double @nish.Map$f64$f64.valueAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !27
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
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !27
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  ret double %16

if.end:
  ret double %none
}

define internal void @nish.Map$f64$f64.setValueAt(%struct.Map$f64$f64* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, double noundef %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !27
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
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !27
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  store double %value, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$f64.insertAt(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, double noundef %key, double noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = fadd double %key, 0.000000e+00
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = bitcast i8* %10 to double*
  %12 = getelementptr inbounds double, double* %11, i64 %5
  store double %3, double* %12, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %14 = sitofp i64 %13 to double
  %15 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !27
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %16, i64 8)
  br label %push.store.1

push.store.1:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = bitcast i8* %23 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %18
  store double %value, double* %25, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %27 = sitofp i64 %26 to double
  %28 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !28
  %30 = load i64, i64* %packed.addr, align 8
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  %35 = load i64, i64* %34, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %36 = icmp eq i64 %33, %35
  br i1 %36, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %29, i64 4)
  br label %push.store.2

push.store.2:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %33
  store i32 %31, i32* %40, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %41 = add i64 %33, 1
  store i64 %41, i64* %32, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %42 = sitofp i64 %41 to double
  call void @nish.Map$f64$f64.addOne(%struct.Map$f64$f64* %this)
  %43 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !25
  %45 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  %46 = load i32, i32* %45, align 4, !tbaa !22
  %47 = load i64, i64* %packed.addr, align 8
  %48 = ashr i64 %47, 32
  %49 = trunc i64 %48 to i32
  %50 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %51 = load %struct.nish_array*, %struct.nish_array** %50, align 8, !tbaa !28
  %52 = call i1 @nish.fileAppended(%struct.nish_array* %44, i32 %46, i32 %49, %struct.nish_array* %51)
  %53 = xor i1 %52, true
  br i1 %53, label %if.then, label %if.end

if.then:
  call void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f64$f64.addOne(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #2 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !23
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !23
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  %8 = load double, double* %7, align 8, !tbaa !21
  store double %8, double* %size.addr, align 8
  %9 = load double, double* %size.addr, align 8
  %10 = fcmp olt double %9, 0x41DFFFFFFFC00000
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load double, double* %size.addr, align 8
  %12 = fadd double %11, 0x3FF0000000000000
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 0
  store double %12, double* %13, align 8, !tbaa !21
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Map$f64$f64.rebuild(%struct.Map$f64$f64* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !26
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 7
  %7 = load i32, i32* %6, align 4, !tbaa !24
  %8 = icmp ugt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !25
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
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
  %20 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !23
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !26
  %27 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !28
  call void @nish.compactEntries$f64(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !27
  %31 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !28
  call void @nish.compactEntries$f64(%struct.nish_array* %30, %struct.nish_array* %32)
  %33 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !28
  call void @nish.compactHashes(%struct.nish_array* %34)
  br label %if.end

if.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 1
  store %struct.nish_array* %35, %struct.nish_array** %36, align 8, !tbaa !25
  %37 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %40 = sitofp i64 %39 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = sub nsw i32 %41, 1
  %43 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 2
  store i32 %42, i32* %43, align 4, !tbaa !22
  %44 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %45 = getelementptr inbounds %struct.Map$f64$f64, %struct.Map$f64$f64* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !28
  call void @nish.refile(%struct.nish_array* %44, %struct.nish_array* %46)
  ret void
}

define internal void @nish.Set$f64.constructor(%struct.Set$f64* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !31
  %2 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !32
  %3 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !33
  %4 = fptosi double 0x4020000000000000 to i64
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
  %12 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !34
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %18 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !35
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %24 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !36
  ret void
}

define internal noundef i64 @nish.Set$f64.probe(%struct.Set$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, double noundef %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !34
  %2 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !31
  %4 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !36
  %6 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !35
  %8 = call i64 @nish.probeTable$f64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, double %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$f64* @nish.Set$f64.add(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) %this, double noundef %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Set$f64.probe(%struct.Set$f64* %this, double %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i64, i64* %found.addr, align 8
  call void @nish.Set$f64.insertAt(%struct.Set$f64* %this, i64 %3, double %key)
  br label %if.end

if.end:
  ret %struct.Set$f64* %this
}

define internal void @nish.Set$f64.walkOpen(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !33
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !33
  ret void
}

define internal noundef i32 @nish.Set$f64.walkNext(%struct.Set$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !36
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Set$f64.walkClose(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !33
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !33
  ret void
}

define internal noundef double @nish.Set$f64.keyAt(%struct.Set$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index, double noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !35
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
  %9 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !35
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  %16 = load double, double* %15, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  ret double %16

if.end:
  ret double %none
}

define internal void @nish.Set$f64.insertAt(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, double noundef %key) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !35
  %3 = fadd double %key, 0.000000e+00
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %7 = load i64, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %8 = icmp eq i64 %5, %7
  br i1 %8, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %11 = bitcast i8* %10 to double*
  %12 = getelementptr inbounds double, double* %11, i64 %5
  store double %3, double* %12, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %13 = add i64 %5, 1
  store i64 %13, i64* %4, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %14 = sitofp i64 %13 to double
  %15 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !36
  %17 = load i64, i64* %packed.addr, align 8
  %18 = trunc i64 %17 to i32
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !10, !noalias !11, !tbaa !19
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %16, i64 4)
  br label %push.store.1

push.store.1:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %20
  store i32 %18, i32* %27, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %29 = sitofp i64 %28 to double
  call void @nish.Set$f64.addOne(%struct.Set$f64* %this)
  %30 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !34
  %32 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 2
  %33 = load i32, i32* %32, align 4, !tbaa !31
  %34 = load i64, i64* %packed.addr, align 8
  %35 = ashr i64 %34, 32
  %36 = trunc i64 %35 to i32
  %37 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %38 = load %struct.nish_array*, %struct.nish_array** %37, align 8, !tbaa !36
  %39 = call i1 @nish.fileAppended(%struct.nish_array* %31, i32 %33, i32 %36, %struct.nish_array* %38)
  %40 = xor i1 %39, true
  br i1 %40, label %if.then, label %if.end

if.then:
  call void @nish.Set$f64.rebuild(%struct.Set$f64* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Set$f64.addOne(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !32
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !32
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 0
  %8 = load double, double* %7, align 8, !tbaa !6
  store double %8, double* %size.addr, align 8
  %9 = load double, double* %size.addr, align 8
  %10 = fcmp olt double %9, 0x41DFFFFFFFC00000
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load double, double* %size.addr, align 8
  %12 = fadd double %11, 0x3FF0000000000000
  %13 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 0
  store double %12, double* %13, align 8, !tbaa !6
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Set$f64.rebuild(%struct.Set$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !35
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 6
  %7 = load i32, i32* %6, align 4, !tbaa !33
  %8 = icmp ugt i32 %7, 0
  store i1 %8, i1* %walking.addr, align 1
  %9 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !34
  %11 = load i1, i1* %walking.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %13 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !32
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
  %20 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 3
  %21 = load i32, i32* %20, align 4, !tbaa !32
  %22 = load i32, i32* %used.addr, align 4
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %cond.end ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 4
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !35
  %27 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !36
  call void @nish.compactEntries$f64(%struct.nish_array* %26, %struct.nish_array* %28)
  %29 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !36
  call void @nish.compactHashes(%struct.nish_array* %30)
  br label %if.end

if.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %32 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 1
  store %struct.nish_array* %31, %struct.nish_array** %32, align 8, !tbaa !34
  %33 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %36 = sitofp i64 %35 to double
  %37 = call i32 @llvm.fptosi.sat.i32.f64(double %36)
  %38 = sub nsw i32 %37, 1
  %39 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 2
  store i32 %38, i32* %39, align 4, !tbaa !31
  %40 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %41 = getelementptr inbounds %struct.Set$f64, %struct.Set$f64* %this, i32 0, i32 5
  %42 = load %struct.nish_array*, %struct.nish_array** %41, align 8, !tbaa !36
  call void @nish.refile(%struct.nish_array* %40, %struct.nish_array* %42)
  ret void
}

define internal noundef i64 @nish.probeTable$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, double noundef %key) #3 {
entry:
  %h.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
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
  store i32 %mask, i32* %low.addr, align 4
  %18 = load i32, i32* %h.addr, align 4
  %19 = load i32, i32* %low.addr, align 4
  %20 = xor i32 %19, -1
  %21 = and i32 %18, %20
  store i32 %21, i32* %fingerprint.addr, align 4
  %22 = load i32, i32* %h.addr, align 4
  %23 = call i32 @nish.homeBucket(i32 %22, i32 %mask)
  store i32 %23, i32* %bucket.addr, align 4
  %24 = load i32, i32* %bucket.addr, align 4
  store i32 %24, i32* %b.addr, align 4
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  br label %while.cond

while.cond:
  %37 = load i32, i32* %b.addr, align 4
  %38 = icmp sge i32 %37, 0
  br i1 %38, label %land.rhs, label %land.end

land.rhs:
  %39 = load i32, i32* %b.addr, align 4
  %40 = sitofp i64 %26 to double
  %41 = call i32 @llvm.fptosi.sat.i32.f64(double %40)
  %42 = icmp slt i32 %39, %41
  br label %land.end

land.end:
  %43 = phi i1 [ false, %while.cond ], [ %42, %land.rhs ]
  br i1 %43, label %while.body, label %while.end

while.body:
  %44 = load i32, i32* %b.addr, align 4
  %45 = sext i32 %44 to i64
  %46 = bitcast i8* %28 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %45
  %48 = load i32, i32* %47, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  store i32 %48, i32* %word.addr, align 4
  %49 = load i32, i32* %word.addr, align 4
  %50 = icmp eq i32 %49, 0
  br i1 %50, label %if.then, label %if.end

if.then:
  %51 = load i32, i32* %b.addr, align 4
  %52 = load i32, i32* %h.addr, align 4
  %53 = tail call i64 @nish.absentAt(i32 %51, i32 %52)
  ret i64 %53

if.end:
  %54 = load i32, i32* %word.addr, align 4
  %55 = load i32, i32* %low.addr, align 4
  %56 = xor i32 %55, -1
  %57 = and i32 %54, %56
  %58 = load i32, i32* %fingerprint.addr, align 4
  %59 = icmp eq i32 %57, %58
  br i1 %59, label %if.then.1, label %if.end.1

if.then.1:
  %60 = load i32, i32* %word.addr, align 4
  %61 = load i32, i32* %low.addr, align 4
  %62 = and i32 %60, %61
  %63 = sub i32 %62, 1
  store i32 %63, i32* %at.addr, align 4
  %64 = load i32, i32* %at.addr, align 4
  %65 = icmp sge i32 %64, 0
  br i1 %65, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %66 = load i32, i32* %at.addr, align 4
  %67 = sitofp i64 %30 to double
  %68 = call i32 @llvm.fptosi.sat.i32.f64(double %67)
  %69 = icmp slt i32 %66, %68
  br label %land.end.4

land.end.4:
  %70 = phi i1 [ false, %if.then.1 ], [ %69, %land.rhs.4 ]
  br i1 %70, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %71 = load i32, i32* %at.addr, align 4
  %72 = sext i32 %71 to i64
  %73 = bitcast i8* %32 to i32*
  %74 = getelementptr inbounds i32, i32* %73, i64 %72
  %75 = load i32, i32* %74, align 4, !alias.scope !11, !noalias !10, !tbaa !18
  %76 = load i32, i32* %h.addr, align 4
  %77 = icmp eq i32 %75, %76
  br label %land.end.3

land.end.3:
  %78 = phi i1 [ false, %land.end.4 ], [ %77, %land.rhs.3 ]
  br i1 %78, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %79 = load i32, i32* %at.addr, align 4
  %80 = sitofp i64 %34 to double
  %81 = call i32 @llvm.fptosi.sat.i32.f64(double %80)
  %82 = icmp slt i32 %79, %81
  br label %land.end.2

land.end.2:
  %83 = phi i1 [ false, %land.end.3 ], [ %82, %land.rhs.2 ]
  br i1 %83, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %84 = load i32, i32* %at.addr, align 4
  %85 = sext i32 %84 to i64
  %86 = bitcast i8* %36 to double*
  %87 = getelementptr inbounds double, double* %86, i64 %85
  %88 = load double, double* %87, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %89 = fcmp oeq double %88, %key
  %90 = fcmp uno double %88, %88
  %91 = fcmp uno double %key, %key
  %92 = and i1 %90, %91
  %93 = or i1 %89, %92
  br label %land.end.1

land.end.1:
  %94 = phi i1 [ false, %land.end.2 ], [ %93, %land.rhs.1 ]
  br i1 %94, label %if.then.2, label %if.end.2

if.then.2:
  %95 = load i32, i32* %b.addr, align 4
  %96 = load i32, i32* %at.addr, align 4
  %97 = tail call i64 @nish.foundAt(i32 %95, i32 %96)
  ret i64 %97

if.end.2:
  br label %if.end.1

if.end.1:
  %98 = load i32, i32* %bucket.addr, align 4
  %99 = add i32 %98, 1
  %100 = load i32, i32* %low.addr, align 4
  %101 = and i32 %99, %100
  store i32 %101, i32* %bucket.addr, align 4
  %102 = load i32, i32* %bucket.addr, align 4
  store i32 %102, i32* %b.addr, align 4
  br label %while.cond

while.end:
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %104 = load i64, i64* %103, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %105 = sitofp i64 %104 to double
  %106 = call i32 @llvm.fptosi.sat.i32.f64(double %105)
  %107 = load i32, i32* %h.addr, align 4
  %108 = tail call i64 @nish.absentAt(i32 %106, i32 %107)
  ret i64 %108
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
  %44 = load double, double* %43, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  %45 = bitcast i8* %11 to double*
  %46 = getelementptr inbounds double, double* %45, i64 %39
  store double %44, double* %46, align 8, !alias.scope !11, !noalias !10, !tbaa !30
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
  br i1 %56, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %59 = sitofp i64 %58 to double
  %60 = fcmp ogt double %59, 0x0000000000000000
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %while.cond ], [ %60, %land.rhs.4 ]
  br i1 %61, label %while.body, label %while.end

while.body:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %64 = sub i64 %63, 1
  store i64 %64, i64* %62, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %67 = bitcast i8* %66 to double*
  %68 = getelementptr inbounds double, double* %67, i64 %64
  %69 = load double, double* %68, align 8, !alias.scope !11, !noalias !10, !tbaa !30
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!37, !38, !39, !40, !41}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Set$f64", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !4, i64 40}
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
!20 = !{!"Map$f64$f64", !2, i64 0, !3, i64 8, !4, i64 16, !4, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !4, i64 48}
!21 = !{!20, !2, i64 0}
!22 = !{!20, !4, i64 16}
!23 = !{!20, !4, i64 20}
!24 = !{!20, !4, i64 48}
!25 = !{!20, !3, i64 8}
!26 = !{!20, !3, i64 24}
!27 = !{!20, !3, i64 32}
!28 = !{!20, !3, i64 40}
!29 = !{!"element double", !1, i64 0}
!30 = !{!29, !29, i64 0}
!31 = !{!5, !4, i64 16}
!32 = !{!5, !4, i64 20}
!33 = !{!5, !4, i64 40}
!34 = !{!5, !3, i64 8}
!35 = !{!5, !3, i64 24}
!36 = !{!5, !3, i64 32}
!37 = !{i32 8, !"cf-protection-branch", i32 1}
!38 = !{i32 8, !"cf-protection-return", i32 1}
!39 = !{i32 8, !"branch-target-enforcement", i32 1}
!40 = !{i32 8, !"sign-return-address", i32 1}
!41 = !{i32 4, !"probe-stack", !"inline-asm"}
