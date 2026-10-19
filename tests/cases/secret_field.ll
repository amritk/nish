%struct.Rec = type { i32, i32 }
%struct.Holder = type { %struct.Secret$arr.u8*, %struct.Secret$$Rec*, i8* }
%struct.Secret$arr.u8 = type { %struct.nish_array* }
%struct.Secret$$Rec = type { %struct.Rec* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal void @Rec.constructor(%struct.Rec* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Rec, %struct.Rec* %this, i32 0, i32 0
  store i32 %a, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Rec, %struct.Rec* %this, i32 0, i32 1
  store i32 %b, i32* %1, align 4, !tbaa !5
  ret void
}

define hidden noundef i32 @sum$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %t.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 %9
  %12 = load i8, i8* %11, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %13 = zext i8 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = load i32, i32* %t.addr, align 4
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @recSum$(%struct.Rec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %r) #1 {
entry:
  %0 = getelementptr inbounds %struct.Rec, %struct.Rec* %r, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = getelementptr inbounds %struct.Rec, %struct.Rec* %r, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i8 noundef %seed, i8* noundef nonnull noalias readonly align 8 %label) #0 {
entry:
  %0 = trunc i32 1 to i8
  %1 = trunc i32 2 to i8
  %2 = trunc i32 3 to i8
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 4, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 4, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %7 = call i8* @nish_alloc_struct(i64 4)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %9 = bitcast i8* %7 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 0
  store i8 %seed, i8* %10, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %11 = getelementptr inbounds i8, i8* %9, i64 1
  store i8 %0, i8* %11, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %12 = getelementptr inbounds i8, i8* %9, i64 2
  store i8 %1, i8* %12, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %13 = getelementptr inbounds i8, i8* %9, i64 3
  store i8 %2, i8* %13, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %14 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %4)
  %15 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.Secret$arr.u8* %14, %struct.Secret$arr.u8** %15, align 8, !tbaa !21
  %16 = call i8* @nish_alloc_struct(i64 8)
  %17 = bitcast i8* %16 to %struct.Rec*
  %18 = zext i8 %seed to i32
  call void @Rec.constructor(%struct.Rec* %17, i32 %18, i32 7)
  %19 = call %struct.Secret$$Rec* @nish.secret$$Rec(%struct.Rec* %17)
  %20 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store %struct.Secret$$Rec* %19, %struct.Secret$$Rec** %20, align 8, !tbaa !22
  %21 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 2
  store i8* %label, i8** %21, align 8, !tbaa !23
  ret void
}

define internal void @Holder.refill(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i8 noundef %by) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %0, align 8, !tbaa !21
  %2 = call i32 @nish.exposeWith$arr.u8$u8$i32$fn.20.Holder.refill$arrow0(%struct.Secret$arr.u8* %1, i8 %by)
  ret void
}

define internal noundef i32 @Holder.tag(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %0, align 8, !tbaa !21
  %2 = call i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* %1)
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  %4 = load %struct.Secret$$Rec*, %struct.Secret$$Rec** %3, align 8, !tbaa !22
  %5 = call i32 @nish.expose$$Rec$i32$fn.6.recSum(%struct.Secret$$Rec* %4)
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %7

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Holder.wipe(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %0, align 8, !tbaa !21
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %1)
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  %3 = load %struct.Secret$$Rec*, %struct.Secret$$Rec** %2, align 8, !tbaa !22
  call void @nish.wipe$$Secret$$Rec(%struct.Secret$$Rec* %3)
  ret void
}

define internal noundef i32 @borrowed(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
entry:
  %0 = call i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* %k)
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %g.addr = alloca %struct.Holder*, align 8
  %all.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Holder*], align 8
  %alias.addr = alloca %struct.Holder*, align 8
  %x.addr = alloca %struct.Holder*, align 8
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Holder*
  call void @Holder.constructor(%struct.Holder* %1, i8 5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  store %struct.Holder* %1, %struct.Holder** %h.addr, align 8
  %2 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %3 = call i32 @Holder.tag(%struct.Holder* %2)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %6 = trunc i32 1 to i8
  call void @Holder.refill(%struct.Holder* %5, i8 %6)
  %7 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %8 = call i32 @Holder.tag(%struct.Holder* %7)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %10, i32 0, i32 0
  %12 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %11, align 8, !tbaa !21
  %13 = call i32 @borrowed(%struct.Secret$arr.u8* %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  %15 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %16 = getelementptr inbounds %struct.Holder, %struct.Holder* %15, i32 0, i32 0
  %17 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %16, align 8, !tbaa !21
  %18 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %19 = getelementptr inbounds %struct.Holder, %struct.Holder* %18, i32 0, i32 0
  %20 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %19, align 8, !tbaa !21
  %21 = icmp eq %struct.Secret$arr.u8* %17, %20
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %22)
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.Holder*
  call void @Holder.constructor(%struct.Holder* %24, i8 9, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  store %struct.Holder* %24, %struct.Holder** %g.addr, align 8
  %25 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %26 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %28, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %29 = bitcast [2 x %struct.Holder*]* %arr.data to i8*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %31 = bitcast i8* %29 to %struct.Holder**
  %32 = getelementptr inbounds %struct.Holder*, %struct.Holder** %31, i64 0
  store %struct.Holder* %25, %struct.Holder** %32, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  %33 = getelementptr inbounds %struct.Holder*, %struct.Holder** %31, i64 1
  store %struct.Holder* %26, %struct.Holder** %33, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %all.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %37 = bitcast i8* %36 to %struct.Holder**
  %38 = getelementptr inbounds %struct.Holder*, %struct.Holder** %37, i64 1
  %39 = load %struct.Holder*, %struct.Holder** %38, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  store %struct.Holder* %39, %struct.Holder** %alias.addr, align 8
  %40 = load %struct.Holder*, %struct.Holder** %alias.addr, align 8
  %41 = getelementptr inbounds %struct.Holder, %struct.Holder* %40, i32 0, i32 0
  %42 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %41, align 8, !tbaa !21
  %43 = call i32 @borrowed(%struct.Secret$arr.u8* %42)
  %44 = call i8* @nish_str_from_i32(i32 %43)
  call void @nish_print(i8* %44)
  %45 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %46 = getelementptr inbounds %struct.Holder, %struct.Holder* %45, i32 0, i32 0
  %47 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %46, align 8, !tbaa !21
  %48 = load %struct.Holder*, %struct.Holder** %alias.addr, align 8
  %49 = getelementptr inbounds %struct.Holder, %struct.Holder* %48, i32 0, i32 0
  %50 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %49, align 8, !tbaa !21
  %51 = icmp eq %struct.Secret$arr.u8* %47, %50
  %52 = select i1 %51, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %52)
  %53 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %56 = icmp ult i64 0, %55
  br i1 %56, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %55)
  unreachable

bounds.ok:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %59 = bitcast i8* %58 to %struct.Holder**
  %60 = getelementptr inbounds %struct.Holder*, %struct.Holder** %59, i64 0
  %61 = load %struct.Holder*, %struct.Holder** %60, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  %62 = getelementptr inbounds %struct.Holder, %struct.Holder* %61, i32 0, i32 0
  %63 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %62, align 8, !tbaa !21
  %64 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %65 = getelementptr inbounds %struct.Holder, %struct.Holder* %64, i32 0, i32 0
  %66 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %65, align 8, !tbaa !21
  %67 = icmp eq %struct.Secret$arr.u8* %63, %66
  %68 = select i1 %67, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %68)
  %69 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %72 = trunc i64 %71 to i32
  %73 = call i8* @nish_str_from_i32(i32 %72)
  call void @nish_print(i8* %73)
  %74 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %75 = load i64, i64* %forof.idx, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %78 = icmp ult i64 %75, %77
  br i1 %78, label %forof.body, label %forof.end

forof.body:
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %81 = bitcast i8* %80 to %struct.Holder**
  %82 = getelementptr inbounds %struct.Holder*, %struct.Holder** %81, i64 %75
  %83 = load %struct.Holder*, %struct.Holder** %82, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  store %struct.Holder* %83, %struct.Holder** %x.addr, align 8
  %84 = load %struct.Holder*, %struct.Holder** %x.addr, align 8
  call void @Holder.wipe(%struct.Holder* %84)
  br label %forof.inc

forof.inc:
  %85 = load i64, i64* %forof.idx, align 8
  %86 = add i64 %85, 1
  store i64 %86, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @Holder.refill$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %v, i8 noundef %d) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %v, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %v, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = load i32, i32* %i.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %3 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %10
  %13 = load i8, i8* %12, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %14 = add i8 %13, %d
  %15 = bitcast i8* %3 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %8
  store i8 %14, i8* %16, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !27
  ret void
}

define internal void @nish.Secret$$Rec.constructor(%struct.Secret$$Rec* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Rec* noundef nonnull align 8 dereferenceable(8) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Rec, %struct.Secret$$Rec* %this, i32 0, i32 0
  store %struct.Rec* %value, %struct.Rec** %0, align 8, !tbaa !29
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$arr.u8*
  call void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* %1, %struct.nish_array* %value)
  ret %struct.Secret$arr.u8* %1
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$$Rec* @nish.secret$$Rec(%struct.Rec* noundef nonnull align 8 dereferenceable(8) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$$Rec*
  call void @nish.Secret$$Rec.constructor(%struct.Secret$$Rec* %1, %struct.Rec* %value)
  ret %struct.Secret$$Rec* %1
}

define internal noundef i32 @nish.exposeWith$arr.u8$u8$i32$fn.20.Holder.refill$arrow0(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s, i8 noundef %arg) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = call i32 @Holder.refill$arrow0(%struct.nish_array* %1, i8 %arg)
  ret i32 %2
}

define internal noundef i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = call i32 @sum$(%struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @nish.expose$$Rec$i32$fn.6.recSum(%struct.Secret$$Rec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Rec, %struct.Secret$$Rec* %s, i32 0, i32 0
  %1 = load %struct.Rec*, %struct.Rec** %0, align 8, !tbaa !29
  %2 = call i32 @recSum$(%struct.Rec* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %_target, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 2
  %5 = load i8*, i8** %4, align 8
  call void @llvm.memset.p0i8.i64(i8* %5, i8 0, i64 %3, i1 true)
  ret void
}

define internal void @nish.wipe$$Secret$$Rec(%struct.Secret$$Rec* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Rec, %struct.Secret$$Rec* %_target, i32 0, i32 0
  %1 = load %struct.Rec*, %struct.Rec** %0, align 8
  %2 = bitcast %struct.Rec* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* %2, i8 0, i64 8, i1 true)
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Rec", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !12, i64 16}
!16 = !{!"element i8", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!13, !11, i64 8}
!19 = !{!"ptr", !1, i64 0}
!20 = !{!"Holder", !19, i64 0, !19, i64 8, !19, i64 16}
!21 = !{!20, !19, i64 0}
!22 = !{!20, !19, i64 8}
!23 = !{!20, !19, i64 16}
!24 = !{!"element ptr", !1, i64 0}
!25 = !{!24, !24, i64 0}
!26 = !{!"Secret$arr.u8", !19, i64 0}
!27 = !{!26, !19, i64 0}
!28 = !{!"Secret$$Rec", !19, i64 0}
!29 = !{!28, !19, i64 0}
