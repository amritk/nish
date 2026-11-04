%struct.Grid = type { i32, { i64, i8* } }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal void @Grid.constructor(%struct.Grid* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !4
  %1 = sext i32 %n to i64
  %2 = icmp ule i64 %1, 2147483647
  br i1 %2, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %3 = mul i64 %1, 16
  %4 = call i8* @nish_alloc_struct(i64 %3)
  call void @llvm.memset.p0i8.i64(i8* align 8 %4, i8 0, i64 %3, i1 false), !alias.scope !9, !noalias !8
  %5 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 1
  %6 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %5, i32 0, i32 0
  store i64 %1, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %5, i32 0, i32 1
  store i8* %4, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x <4 x i32>], align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x <2 x double>], align 8
  %bs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x <16 x i8>], align 8
  %g.addr = alloca %struct.Grid*, align 8
  %Grid.obj = alloca %struct.Grid, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %2 = mul i64 3, 16
  %3 = bitcast [3 x <4 x i32>]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !9, !noalias !8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %9 = bitcast i8* %8 to <4 x i32>*
  %10 = getelementptr inbounds <4 x i32>, <4 x i32>* %9, i64 0
  %11 = load <4 x i32>, <4 x i32>* %10, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %12 = insertelement <4 x i32> %11, i32 4, i32 1
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %15 = icmp ult i64 0, %14
  br i1 %15, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %14)
  unreachable

bounds.ok:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %18 = bitcast i8* %17 to <4 x i32>*
  %19 = getelementptr inbounds <4 x i32>, <4 x i32>* %18, i64 0
  store <4 x i32> %12, <4 x i32>* %19, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %20 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %23 = bitcast i8* %22 to <4 x i32>*
  %24 = getelementptr inbounds <4 x i32>, <4 x i32>* %23, i64 0
  %25 = load <4 x i32>, <4 x i32>* %24, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %26 = extractelement <4 x i32> %25, i32 1
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %29 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %32 = icmp ult i64 1, %31
  br i1 %32, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %31)
  unreachable

bounds.ok.1:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %35 = bitcast i8* %34 to <4 x i32>*
  %36 = getelementptr inbounds <4 x i32>, <4 x i32>* %35, i64 1
  %37 = load <4 x i32>, <4 x i32>* %36, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %38 = extractelement <4 x i32> %37, i32 1
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %28, i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %42 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %45 = icmp ult i64 2, %44
  br i1 %45, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %44)
  unreachable

bounds.ok.2:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %48 = bitcast i8* %47 to <4 x i32>*
  %49 = getelementptr inbounds <4 x i32>, <4 x i32>* %48, i64 2
  %50 = load <4 x i32>, <4 x i32>* %49, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %51 = extractelement <4 x i32> %50, i32 3
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* %41, i8* %52)
  call void @nish_print(i8* %53)
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %54, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %55, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %56 = mul i64 2, 16
  %57 = bitcast [2 x <2 x double>]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %57, i8 0, i64 %56, i1 false), !alias.scope !9, !noalias !8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %57, i8** %58, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ys.addr, align 8
  %59 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %60 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %63 = bitcast i8* %62 to <2 x double>*
  %64 = getelementptr inbounds <2 x double>, <2 x double>* %63, i64 1
  %65 = load <2 x double>, <2 x double>* %64, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %66 = insertelement <2 x double> %65, double 0x4004000000000000, i32 0
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %69 = icmp ult i64 1, %68
  br i1 %69, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %68)
  unreachable

bounds.ok.3:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %72 = bitcast i8* %71 to <2 x double>*
  %73 = getelementptr inbounds <2 x double>, <2 x double>* %72, i64 1
  store <2 x double> %66, <2 x double>* %73, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %74 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %77 = bitcast i8* %76 to <2 x double>*
  %78 = getelementptr inbounds <2 x double>, <2 x double>* %77, i64 0
  %79 = load <2 x double>, <2 x double>* %78, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %80 = extractelement <2 x double> %79, i32 0
  %81 = call i8* @nish_str_from_f64(double %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %83 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %86 = icmp ult i64 1, %85
  br i1 %86, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %85)
  unreachable

bounds.ok.4:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %89 = bitcast i8* %88 to <2 x double>*
  %90 = getelementptr inbounds <2 x double>, <2 x double>* %89, i64 1
  %91 = load <2 x double>, <2 x double>* %90, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %92 = extractelement <2 x double> %91, i32 0
  %93 = call i8* @nish_str_from_f64(double %92)
  %94 = call i8* @nish_str_concat(i8* %82, i8* %93)
  %95 = call i8* @nish_str_concat(i8* %94, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %96 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %99 = icmp ult i64 1, %98
  br i1 %99, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %98)
  unreachable

bounds.ok.5:
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 2
  %101 = load i8*, i8** %100, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %102 = bitcast i8* %101 to <2 x double>*
  %103 = getelementptr inbounds <2 x double>, <2 x double>* %102, i64 1
  %104 = load <2 x double>, <2 x double>* %103, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %105 = extractelement <2 x double> %104, i32 1
  %106 = call i8* @nish_str_from_f64(double %105)
  %107 = call i8* @nish_str_concat(i8* %95, i8* %106)
  call void @nish_print(i8* %107)
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %108, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %109, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %110 = mul i64 2, 16
  %111 = bitcast [2 x <16 x i8>]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %111, i8 0, i64 %110, i1 false), !alias.scope !9, !noalias !8
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %111, i8** %112, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %bs.addr, align 8
  %113 = load %struct.nish_array*, %struct.nish_array** %bs.addr, align 8
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %116 = bitcast i8* %115 to <16 x i8>*
  %117 = getelementptr inbounds <16 x i8>, <16 x i8>* %116, i64 1
  %118 = load <16 x i8>, <16 x i8>* %117, align 8, !alias.scope !9, !noalias !8, !tbaa !24
  %119 = extractelement <16 x i8> %118, i32 15
  %120 = zext i8 %119 to i64
  %121 = call i8* @nish_str_from_u64(i64 %120)
  %122 = call i8* @nish_str_concat(i8* %121, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %123 = load %struct.nish_array*, %struct.nish_array** %bs.addr, align 8
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %123, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %126 = trunc i64 %125 to i32
  %127 = call i8* @nish_str_from_i32(i32 %126)
  %128 = call i8* @nish_str_concat(i8* %122, i8* %127)
  call void @nish_print(i8* %128)
  %129 = getelementptr inbounds %struct.Grid, %struct.Grid* %Grid.obj, i32 0, i32 1
  %130 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %129, i32 0, i32 0
  store i64 0, i64* %130, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %131 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %129, i32 0, i32 1
  store i8* null, i8** %131, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  call void @Grid.constructor(%struct.Grid* %Grid.obj, i32 2)
  store %struct.Grid* %Grid.obj, %struct.Grid** %g.addr, align 8
  %132 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %133 = getelementptr inbounds %struct.Grid, %struct.Grid* %132, i32 0, i32 1
  %134 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %135 = getelementptr inbounds %struct.Grid, %struct.Grid* %134, i32 0, i32 1
  %136 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %135, i32 0, i32 0
  %137 = load i64, i64* %136, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %138 = icmp ult i64 1, %137
  br i1 %138, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 1, i64 %137)
  unreachable

bounds.ok.6:
  %139 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %135, i32 0, i32 1
  %140 = load i8*, i8** %139, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %141 = bitcast i8* %140 to <4 x i32>*
  %142 = getelementptr inbounds <4 x i32>, <4 x i32>* %141, i64 1
  %143 = load <4 x i32>, <4 x i32>* %142, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %144 = insertelement <4 x i32> %143, i32 7, i32 3
  %145 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %133, i32 0, i32 0
  %146 = load i64, i64* %145, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %147 = icmp ult i64 1, %146
  br i1 %147, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 1, i64 %146)
  unreachable

bounds.ok.7:
  %148 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %133, i32 0, i32 1
  %149 = load i8*, i8** %148, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %150 = bitcast i8* %149 to <4 x i32>*
  %151 = getelementptr inbounds <4 x i32>, <4 x i32>* %150, i64 1
  store <4 x i32> %144, <4 x i32>* %151, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %152 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %153 = getelementptr inbounds %struct.Grid, %struct.Grid* %152, i32 0, i32 1
  %154 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %153, i32 0, i32 0
  %155 = load i64, i64* %154, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %156 = icmp ult i64 0, %155
  br i1 %156, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 0, i64 %155)
  unreachable

bounds.ok.8:
  %157 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %153, i32 0, i32 1
  %158 = load i8*, i8** %157, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %159 = bitcast i8* %158 to <4 x i32>*
  %160 = getelementptr inbounds <4 x i32>, <4 x i32>* %159, i64 0
  %161 = load <4 x i32>, <4 x i32>* %160, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %162 = extractelement <4 x i32> %161, i32 3
  %163 = call i8* @nish_str_from_i32(i32 %162)
  %164 = call i8* @nish_str_concat(i8* %163, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %165 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %166 = getelementptr inbounds %struct.Grid, %struct.Grid* %165, i32 0, i32 1
  %167 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %166, i32 0, i32 0
  %168 = load i64, i64* %167, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %169 = icmp ult i64 1, %168
  br i1 %169, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 1, i64 %168)
  unreachable

bounds.ok.9:
  %170 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %166, i32 0, i32 1
  %171 = load i8*, i8** %170, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %172 = bitcast i8* %171 to <4 x i32>*
  %173 = getelementptr inbounds <4 x i32>, <4 x i32>* %172, i64 1
  %174 = load <4 x i32>, <4 x i32>* %173, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %175 = extractelement <4 x i32> %174, i32 3
  %176 = call i8* @nish_str_from_i32(i32 %175)
  %177 = call i8* @nish_str_concat(i8* %164, i8* %176)
  %178 = call i8* @nish_str_concat(i8* %177, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %179 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %180 = getelementptr inbounds %struct.Grid, %struct.Grid* %179, i32 0, i32 0
  %181 = load i32, i32* %180, align 4, !tbaa !4
  %182 = call i8* @nish_str_from_i32(i32 %181)
  %183 = call i8* @nish_str_concat(i8* %178, i8* %182)
  call void @nish_print(i8* %183)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!25, !26, !27, !28, !29}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Grid", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array slice", !10, i64 0, !11, i64 8}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !11, i64 8}
!15 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!16 = !{!15, !10, i64 0}
!17 = !{!15, !10, i64 8}
!18 = !{!15, !11, i64 16}
!19 = !{!"element <4 x i32>", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"element <2 x double>", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!"element <16 x i8>", !1, i64 0}
!24 = !{!23, !23, i64 0}
!25 = !{i32 8, !"cf-protection-branch", i32 1}
!26 = !{i32 8, !"cf-protection-return", i32 1}
!27 = !{i32 8, !"branch-target-enforcement", i32 1}
!28 = !{i32 8, !"sign-return-address", i32 1}
!29 = !{i32 4, !"probe-stack", !"inline-asm"}
