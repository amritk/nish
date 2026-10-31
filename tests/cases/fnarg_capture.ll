%struct.Type = type { i32, i8*, %struct.nish_array* }
%struct.IndexInfo = type { %struct.Type*, %struct.Type* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"union\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"string\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"symbol\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"number\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"boolean\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

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

define internal void @Type.constructor(%struct.Type* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #0 {
entry:
  %0 = getelementptr inbounds %struct.Type, %struct.Type* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Type, %struct.Type* %this, i32 0, i32 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.Type, %struct.Type* %this, i32 0, i32 1
  store i8* %text, i8** %2, align 8, !tbaa !6
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %8 = getelementptr inbounds %struct.Type, %struct.Type* %this, i32 0, i32 2
  store %struct.nish_array* %4, %struct.nish_array** %8, align 8, !tbaa !18
  ret void
}

define internal void @IndexInfo.constructor(%struct.IndexInfo* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Type* noundef nonnull align 8 dereferenceable(24) %k, %struct.Type* noundef nonnull align 8 dereferenceable(24) %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.IndexInfo, %struct.IndexInfo* %this, i32 0, i32 0
  store %struct.Type* %k, %struct.Type** %0, align 8, !tbaa !20
  %1 = getelementptr inbounds %struct.IndexInfo, %struct.IndexInfo* %this, i32 0, i32 1
  store %struct.Type* %v, %struct.Type** %1, align 8, !tbaa !21
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.Type* @template(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %texts, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %types, i32 noundef %unionIndex) #1 {
entry:
  %0 = sext i32 %unionIndex to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %types, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %types, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %6 = bitcast i8* %5 to %struct.Type**
  %7 = getelementptr inbounds %struct.Type*, %struct.Type** %6, i64 %0
  %8 = load %struct.Type*, %struct.Type** %7, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %9 = call %struct.Type* @mapType$fn.15.template$arrow0(%struct.Type* %8, %struct.nish_array* %texts)
  ret %struct.Type* %9
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @collect(%struct.Type* noundef nonnull align 8 dereferenceable(24) %keys, %struct.Type* noundef nonnull align 8 dereferenceable(24) %valueType) #1 {
entry:
  %infos.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  store %struct.nish_array* %1, %struct.nish_array** %infos.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %infos.addr, align 8
  call void @forEachType$fn.14.collect$arrow0(%struct.Type* %keys, %struct.nish_array* %5, %struct.Type* %valueType)
  %6 = load %struct.nish_array*, %struct.nish_array** %infos.addr, align 8
  ret %struct.nish_array* %6
}

define noundef i32 @nish_main() #1 {
entry:
  %ab.addr = alloca %struct.Type*, align 8
  %m.addr = alloca %struct.Type*, align 8
  %forof.idx = alloca i64, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x %struct.Type*], align 8
  %keys.addr = alloca %struct.Type*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Type*
  call void @Type.constructor(%struct.Type* %1, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  store %struct.Type* %1, %struct.Type** %ab.addr, align 8
  %2 = load %struct.Type*, %struct.Type** %ab.addr, align 8
  %3 = getelementptr inbounds %struct.Type, %struct.Type* %2, i32 0, i32 0
  store i32 1, i32* %3, align 4, !tbaa !5
  %4 = load %struct.Type*, %struct.Type** %ab.addr, align 8
  %5 = getelementptr inbounds %struct.Type, %struct.Type* %4, i32 0, i32 2
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !18
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.Type*
  call void @Type.constructor(%struct.Type* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %6, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %16 = bitcast i8* %15 to %struct.Type**
  %17 = getelementptr inbounds %struct.Type*, %struct.Type** %16, i64 %10
  store %struct.Type* %8, %struct.Type** %17, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %19 = trunc i64 %18 to i32
  %20 = load %struct.Type*, %struct.Type** %ab.addr, align 8
  %21 = getelementptr inbounds %struct.Type, %struct.Type* %20, i32 0, i32 2
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !18
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.Type*
  call void @Type.constructor(%struct.Type* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1
  %28 = load i64, i64* %27, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %29 = icmp eq i64 %26, %28
  br i1 %29, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %22, i64 8)
  br label %push.store.1

push.store.1:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %32 = bitcast i8* %31 to %struct.Type**
  %33 = getelementptr inbounds %struct.Type*, %struct.Type** %32, i64 %26
  store %struct.Type* %24, %struct.Type** %33, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %34 = add i64 %26, 1
  store i64 %34, i64* %25, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %35 = trunc i64 %34 to i32
  %36 = call i8* @nish_alloc_struct(i64 24)
  %37 = bitcast i8* %36 to %struct.nish_array*
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  store i64 2, i64* %38, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 1
  store i64 2, i64* %39, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %40 = call i8* @nish_alloc_struct(i64 16)
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  store i8* %40, i8** %41, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %42 = bitcast i8* %40 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8** %43, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %44 = getelementptr inbounds i8*, i8** %42, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i8** %44, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %45 = load %struct.Type*, %struct.Type** %ab.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %46, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %47, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %48 = bitcast [1 x %struct.Type*]* %arr.data to i8*
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %48, i8** %49, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %50 = bitcast i8* %48 to %struct.Type**
  %51 = getelementptr inbounds %struct.Type*, %struct.Type** %50, i64 0
  store %struct.Type* %45, %struct.Type** %51, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %52 = call %struct.Type* @template(%struct.nish_array* %37, %struct.nish_array* %arr.hdr, i32 0)
  %53 = getelementptr inbounds %struct.Type, %struct.Type* %52, i32 0, i32 2
  %54 = load %struct.nish_array*, %struct.nish_array** %53, align 8, !tbaa !18
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %55 = load i64, i64* %forof.idx, align 8
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %58 = icmp ult i64 %55, %57
  br i1 %58, label %forof.body, label %forof.end

forof.body:
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %61 = bitcast i8* %60 to %struct.Type**
  %62 = getelementptr inbounds %struct.Type*, %struct.Type** %61, i64 %55
  %63 = load %struct.Type*, %struct.Type** %62, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  store %struct.Type* %63, %struct.Type** %m.addr, align 8
  %64 = load %struct.Type*, %struct.Type** %m.addr, align 8
  %65 = getelementptr inbounds %struct.Type, %struct.Type* %64, i32 0, i32 1
  %66 = load i8*, i8** %65, align 8, !tbaa !6
  call void @nish_print(i8* %66)
  br label %forof.inc

forof.inc:
  %67 = load i64, i64* %forof.idx, align 8
  %68 = add i64 %67, 1
  store i64 %68, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %69 = call i8* @nish_alloc_struct(i64 24)
  %70 = bitcast i8* %69 to %struct.Type*
  call void @Type.constructor(%struct.Type* %70, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  store %struct.Type* %70, %struct.Type** %keys.addr, align 8
  %71 = load %struct.Type*, %struct.Type** %keys.addr, align 8
  %72 = getelementptr inbounds %struct.Type, %struct.Type* %71, i32 0, i32 0
  store i32 1, i32* %72, align 4, !tbaa !5
  %73 = load %struct.Type*, %struct.Type** %keys.addr, align 8
  %74 = getelementptr inbounds %struct.Type, %struct.Type* %73, i32 0, i32 2
  %75 = load %struct.nish_array*, %struct.nish_array** %74, align 8, !tbaa !18
  %76 = call i8* @nish_alloc_struct(i64 24)
  %77 = bitcast i8* %76 to %struct.Type*
  call void @Type.constructor(%struct.Type* %77, i8* bitcast ({ i64, [7 x i8] }* @.str.6 to i8*))
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 1
  %81 = load i64, i64* %80, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %82 = icmp eq i64 %79, %81
  br i1 %82, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %75, i64 8)
  br label %push.store.2

push.store.2:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %85 = bitcast i8* %84 to %struct.Type**
  %86 = getelementptr inbounds %struct.Type*, %struct.Type** %85, i64 %79
  store %struct.Type* %77, %struct.Type** %86, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %87 = add i64 %79, 1
  store i64 %87, i64* %78, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %88 = trunc i64 %87 to i32
  %89 = load %struct.Type*, %struct.Type** %keys.addr, align 8
  %90 = getelementptr inbounds %struct.Type, %struct.Type* %89, i32 0, i32 2
  %91 = load %struct.nish_array*, %struct.nish_array** %90, align 8, !tbaa !18
  %92 = call i8* @nish_alloc_struct(i64 24)
  %93 = bitcast i8* %92 to %struct.Type*
  call void @Type.constructor(%struct.Type* %93, i8* bitcast ({ i64, [7 x i8] }* @.str.7 to i8*))
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 1
  %97 = load i64, i64* %96, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %98 = icmp eq i64 %95, %97
  br i1 %98, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %91, i64 8)
  br label %push.store.3

push.store.3:
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  %100 = load i8*, i8** %99, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %101 = bitcast i8* %100 to %struct.Type**
  %102 = getelementptr inbounds %struct.Type*, %struct.Type** %101, i64 %95
  store %struct.Type* %93, %struct.Type** %102, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %103 = add i64 %95, 1
  store i64 %103, i64* %94, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %104 = trunc i64 %103 to i32
  %105 = load %struct.Type*, %struct.Type** %keys.addr, align 8
  %106 = getelementptr inbounds %struct.Type, %struct.Type* %105, i32 0, i32 2
  %107 = load %struct.nish_array*, %struct.nish_array** %106, align 8, !tbaa !18
  %108 = call i8* @nish_alloc_struct(i64 24)
  %109 = bitcast i8* %108 to %struct.Type*
  call void @Type.constructor(%struct.Type* %109, i8* bitcast ({ i64, [7 x i8] }* @.str.8 to i8*))
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %111 = load i64, i64* %110, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 1
  %113 = load i64, i64* %112, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %114 = icmp eq i64 %111, %113
  br i1 %114, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %107, i64 8)
  br label %push.store.4

push.store.4:
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %116 = load i8*, i8** %115, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %117 = bitcast i8* %116 to %struct.Type**
  %118 = getelementptr inbounds %struct.Type*, %struct.Type** %117, i64 %111
  store %struct.Type* %109, %struct.Type** %118, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %119 = add i64 %111, 1
  store i64 %119, i64* %110, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %120 = trunc i64 %119 to i32
  %121 = load %struct.Type*, %struct.Type** %keys.addr, align 8
  %122 = call i8* @nish_alloc_struct(i64 24)
  %123 = bitcast i8* %122 to %struct.Type*
  call void @Type.constructor(%struct.Type* %123, i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*))
  %124 = call %struct.nish_array* @collect(%struct.Type* %121, %struct.Type* %123)
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 0
  %126 = load i64, i64* %125, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %127 = trunc i64 %126 to i32
  %128 = call i8* @nish_str_from_i32(i32 %127)
  call void @nish_print(i8* %128)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.Type* @template$arrow0(%struct.Type* noundef nonnull readonly align 8 dereferenceable(24) nocapture %t, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %texts) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Type*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %texts, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %texts, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %7 = bitcast i8* %6 to i8**
  %8 = getelementptr inbounds i8*, i8** %7, i64 0
  %9 = load i8*, i8** %8, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %10 = getelementptr inbounds %struct.Type, %struct.Type* %t, i32 0, i32 1
  %11 = load i8*, i8** %10, align 8, !tbaa !6
  %12 = call i8* @nish_str_concat(i8* %9, i8* %11)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %texts, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %15 = icmp ult i64 1, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %14)
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %texts, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 1
  %20 = load i8*, i8** %19, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %21 = call i8* @nish_str_concat(i8* %12, i8* %20)
  call void @Type.constructor(%struct.Type* %1, i8* %21)
  ret %struct.Type* %1
}

define internal void @collect$arrow0(%struct.Type* noundef nonnull align 8 dereferenceable(24) %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %infos, %struct.Type* noundef nonnull align 8 dereferenceable(24) %valueType) #0 {
entry:
  %0 = getelementptr inbounds %struct.Type, %struct.Type* %k, i32 0, i32 1
  %1 = load i8*, i8** %0, align 8, !tbaa !6
  %2 = call zeroext i1 @nish_str_eq(i8* %1, i8* bitcast ({ i64, [7 x i8] }* @.str.6 to i8*))
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = getelementptr inbounds %struct.Type, %struct.Type* %k, i32 0, i32 1
  %4 = load i8*, i8** %3, align 8, !tbaa !6
  %5 = call zeroext i1 @nish_str_eq(i8* %4, i8* bitcast ({ i64, [7 x i8] }* @.str.8 to i8*))
  br label %lor.end

lor.end:
  %6 = phi i1 [ true, %entry ], [ %5, %lor.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = call i8* @nish_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.IndexInfo*
  call void @IndexInfo.constructor(%struct.IndexInfo* %8, %struct.Type* %k, %struct.Type* %valueType)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %infos, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %infos, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %infos, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %infos, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %16 = bitcast i8* %15 to %struct.IndexInfo**
  %17 = getelementptr inbounds %struct.IndexInfo*, %struct.IndexInfo** %16, i64 %10
  store %struct.IndexInfo* %8, %struct.IndexInfo** %17, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %19 = trunc i64 %18 to i32
  br label %if.end

if.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.Type* @mapType$fn.15.template$arrow0(%struct.Type* noundef nonnull readonly align 8 dereferenceable(24) nocapture %t, %struct.nish_array* noundef %cap.0) #1 {
entry:
  %u.addr = alloca %struct.Type*, align 8
  %m.addr = alloca %struct.Type*, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Type, %struct.Type* %t, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !5
  %2 = and i32 %1, 1
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = call %struct.Type* @template$arrow0(%struct.Type* %t, %struct.nish_array* %cap.0)
  ret %struct.Type* %4

if.end:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.Type*
  call void @Type.constructor(%struct.Type* %6, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  store %struct.Type* %6, %struct.Type** %u.addr, align 8
  %7 = load %struct.Type*, %struct.Type** %u.addr, align 8
  %8 = getelementptr inbounds %struct.Type, %struct.Type* %7, i32 0, i32 0
  store i32 1, i32* %8, align 4, !tbaa !5
  %9 = getelementptr inbounds %struct.Type, %struct.Type* %t, i32 0, i32 2
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !18
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %11 = load i64, i64* %forof.idx, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %forof.body, label %forof.end

forof.body:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %17 = bitcast i8* %16 to %struct.Type**
  %18 = getelementptr inbounds %struct.Type*, %struct.Type** %17, i64 %11
  %19 = load %struct.Type*, %struct.Type** %18, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  store %struct.Type* %19, %struct.Type** %m.addr, align 8
  %20 = load %struct.Type*, %struct.Type** %u.addr, align 8
  %21 = getelementptr inbounds %struct.Type, %struct.Type* %20, i32 0, i32 2
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !18
  %23 = load %struct.Type*, %struct.Type** %m.addr, align 8
  %24 = call %struct.Type* @template$arrow0(%struct.Type* %23, %struct.nish_array* %cap.0)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1
  %28 = load i64, i64* %27, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %29 = icmp eq i64 %26, %28
  br i1 %29, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %22, i64 8)
  br label %push.store

push.store:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %32 = bitcast i8* %31 to %struct.Type**
  %33 = getelementptr inbounds %struct.Type*, %struct.Type** %32, i64 %26
  store %struct.Type* %24, %struct.Type** %33, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  %34 = add i64 %26, 1
  store i64 %34, i64* %25, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %35 = trunc i64 %34 to i32
  br label %forof.inc

forof.inc:
  %36 = load i64, i64* %forof.idx, align 8
  %37 = add i64 %36, 1
  store i64 %37, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %38 = load %struct.Type*, %struct.Type** %u.addr, align 8
  ret %struct.Type* %38
}

define internal void @forEachType$fn.14.collect$arrow0(%struct.Type* noundef nonnull align 8 dereferenceable(24) %t, %struct.nish_array* noundef %cap.0, %struct.Type* noundef %cap.1) #1 {
entry:
  %m.addr = alloca %struct.Type*, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Type, %struct.Type* %t, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !5
  %2 = and i32 %1, 1
  %3 = icmp ne i32 %2, 0
  br i1 %3, label %if.then, label %if.else

if.then:
  %4 = getelementptr inbounds %struct.Type, %struct.Type* %t, i32 0, i32 2
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !18
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %6 = load i64, i64* %forof.idx, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %forof.body, label %forof.end

forof.body:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %12 = bitcast i8* %11 to %struct.Type**
  %13 = getelementptr inbounds %struct.Type*, %struct.Type** %12, i64 %6
  %14 = load %struct.Type*, %struct.Type** %13, align 8, !alias.scope !11, !noalias !10, !tbaa !23
  store %struct.Type* %14, %struct.Type** %m.addr, align 8
  %15 = load %struct.Type*, %struct.Type** %m.addr, align 8
  call void @collect$arrow0(%struct.Type* %15, %struct.nish_array* %cap.0, %struct.Type* %cap.1)
  br label %forof.inc

forof.inc:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = add i64 %16, 1
  store i64 %17, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %if.end

if.else:
  call void @collect$arrow0(%struct.Type* %t, %struct.nish_array* %cap.0, %struct.Type* %cap.1)
  br label %if.end

if.end:
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!24, !25, !26, !27, !28}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Type", !2, i64 0, !3, i64 8, !3, i64 16}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!4, !3, i64 16}
!19 = !{!"IndexInfo", !3, i64 0, !3, i64 8}
!20 = !{!19, !3, i64 0}
!21 = !{!19, !3, i64 8}
!22 = !{!"element ptr", !1, i64 0}
!23 = !{!22, !22, i64 0}
!24 = !{i32 8, !"cf-protection-branch", i32 1}
!25 = !{i32 8, !"cf-protection-return", i32 1}
!26 = !{i32 8, !"branch-target-enforcement", i32 1}
!27 = !{i32 8, !"sign-return-address", i32 1}
!28 = !{i32 4, !"probe-stack", !"inline-asm"}
