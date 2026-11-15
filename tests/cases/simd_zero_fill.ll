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
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %15 = bitcast i8* %14 to <4 x i32>*
  %16 = getelementptr inbounds <4 x i32>, <4 x i32>* %15, i64 0
  store <4 x i32> %12, <4 x i32>* %16, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %17 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %20 = bitcast i8* %19 to <4 x i32>*
  %21 = getelementptr inbounds <4 x i32>, <4 x i32>* %20, i64 0
  %22 = load <4 x i32>, <4 x i32>* %21, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %23 = extractelement <4 x i32> %22, i32 1
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %29 = bitcast i8* %28 to <4 x i32>*
  %30 = getelementptr inbounds <4 x i32>, <4 x i32>* %29, i64 1
  %31 = load <4 x i32>, <4 x i32>* %30, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %32 = extractelement <4 x i32> %31, i32 1
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %25, i8* %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %36 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %39 = bitcast i8* %38 to <4 x i32>*
  %40 = getelementptr inbounds <4 x i32>, <4 x i32>* %39, i64 2
  %41 = load <4 x i32>, <4 x i32>* %40, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %42 = extractelement <4 x i32> %41, i32 3
  %43 = call i8* @nish_str_from_i32(i32 %42)
  %44 = call i8* @nish_str_concat(i8* %35, i8* %43)
  call void @nish_print(i8* %44)
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %45, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %46, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %47 = mul i64 2, 16
  %48 = bitcast [2 x <2 x double>]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %48, i8 0, i64 %47, i1 false), !alias.scope !9, !noalias !8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %48, i8** %49, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ys.addr, align 8
  %50 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %51 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %54 = bitcast i8* %53 to <2 x double>*
  %55 = getelementptr inbounds <2 x double>, <2 x double>* %54, i64 1
  %56 = load <2 x double>, <2 x double>* %55, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %57 = insertelement <2 x double> %56, double 0x4004000000000000, i32 0
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %60 = bitcast i8* %59 to <2 x double>*
  %61 = getelementptr inbounds <2 x double>, <2 x double>* %60, i64 1
  store <2 x double> %57, <2 x double>* %61, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %62 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %65 = bitcast i8* %64 to <2 x double>*
  %66 = getelementptr inbounds <2 x double>, <2 x double>* %65, i64 0
  %67 = load <2 x double>, <2 x double>* %66, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %68 = extractelement <2 x double> %67, i32 0
  %69 = call i8* @nish_str_from_f64(double %68)
  %70 = call i8* @nish_str_concat(i8* %69, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %71 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %74 = bitcast i8* %73 to <2 x double>*
  %75 = getelementptr inbounds <2 x double>, <2 x double>* %74, i64 1
  %76 = load <2 x double>, <2 x double>* %75, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %77 = extractelement <2 x double> %76, i32 0
  %78 = call i8* @nish_str_from_f64(double %77)
  %79 = call i8* @nish_str_concat(i8* %70, i8* %78)
  %80 = call i8* @nish_str_concat(i8* %79, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %81 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %83 = load i8*, i8** %82, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %84 = bitcast i8* %83 to <2 x double>*
  %85 = getelementptr inbounds <2 x double>, <2 x double>* %84, i64 1
  %86 = load <2 x double>, <2 x double>* %85, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %87 = extractelement <2 x double> %86, i32 1
  %88 = call i8* @nish_str_from_f64(double %87)
  %89 = call i8* @nish_str_concat(i8* %80, i8* %88)
  call void @nish_print(i8* %89)
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %90, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %91, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %92 = mul i64 2, 16
  %93 = bitcast [2 x <16 x i8>]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %93, i8 0, i64 %92, i1 false), !alias.scope !9, !noalias !8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %93, i8** %94, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %bs.addr, align 8
  %95 = load %struct.nish_array*, %struct.nish_array** %bs.addr, align 8
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %98 = bitcast i8* %97 to <16 x i8>*
  %99 = getelementptr inbounds <16 x i8>, <16 x i8>* %98, i64 1
  %100 = load <16 x i8>, <16 x i8>* %99, align 8, !alias.scope !9, !noalias !8, !tbaa !24
  %101 = extractelement <16 x i8> %100, i32 15
  %102 = zext i8 %101 to i64
  %103 = call i8* @nish_str_from_u64(i64 %102)
  %104 = call i8* @nish_str_concat(i8* %103, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %105 = load %struct.nish_array*, %struct.nish_array** %bs.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %108 = trunc i64 %107 to i32
  %109 = call i8* @nish_str_from_i32(i32 %108)
  %110 = call i8* @nish_str_concat(i8* %104, i8* %109)
  call void @nish_print(i8* %110)
  %111 = getelementptr inbounds %struct.Grid, %struct.Grid* %Grid.obj, i32 0, i32 1
  %112 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %111, i32 0, i32 0
  store i64 0, i64* %112, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %113 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %111, i32 0, i32 1
  store i8* null, i8** %113, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  call void @Grid.constructor(%struct.Grid* %Grid.obj, i32 2)
  store %struct.Grid* %Grid.obj, %struct.Grid** %g.addr, align 8
  %114 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %115 = getelementptr inbounds %struct.Grid, %struct.Grid* %114, i32 0, i32 1
  %116 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %117 = getelementptr inbounds %struct.Grid, %struct.Grid* %116, i32 0, i32 1
  %118 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %117, i32 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %120 = icmp ult i64 1, %119
  br i1 %120, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %119)
  unreachable

bounds.ok:
  %121 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %117, i32 0, i32 1
  %122 = load i8*, i8** %121, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %123 = bitcast i8* %122 to <4 x i32>*
  %124 = getelementptr inbounds <4 x i32>, <4 x i32>* %123, i64 1
  %125 = load <4 x i32>, <4 x i32>* %124, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %126 = insertelement <4 x i32> %125, i32 7, i32 3
  %127 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %115, i32 0, i32 1
  %128 = load i8*, i8** %127, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %129 = bitcast i8* %128 to <4 x i32>*
  %130 = getelementptr inbounds <4 x i32>, <4 x i32>* %129, i64 1
  store <4 x i32> %126, <4 x i32>* %130, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %131 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %132 = getelementptr inbounds %struct.Grid, %struct.Grid* %131, i32 0, i32 1
  %133 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %132, i32 0, i32 1
  %134 = load i8*, i8** %133, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %135 = bitcast i8* %134 to <4 x i32>*
  %136 = getelementptr inbounds <4 x i32>, <4 x i32>* %135, i64 0
  %137 = load <4 x i32>, <4 x i32>* %136, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %138 = extractelement <4 x i32> %137, i32 3
  %139 = call i8* @nish_str_from_i32(i32 %138)
  %140 = call i8* @nish_str_concat(i8* %139, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %141 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %142 = getelementptr inbounds %struct.Grid, %struct.Grid* %141, i32 0, i32 1
  %143 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %142, i32 0, i32 1
  %144 = load i8*, i8** %143, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %145 = bitcast i8* %144 to <4 x i32>*
  %146 = getelementptr inbounds <4 x i32>, <4 x i32>* %145, i64 1
  %147 = load <4 x i32>, <4 x i32>* %146, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %148 = extractelement <4 x i32> %147, i32 3
  %149 = call i8* @nish_str_from_i32(i32 %148)
  %150 = call i8* @nish_str_concat(i8* %140, i8* %149)
  %151 = call i8* @nish_str_concat(i8* %150, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %152 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %153 = getelementptr inbounds %struct.Grid, %struct.Grid* %152, i32 0, i32 0
  %154 = load i32, i32* %153, align 4, !tbaa !4
  %155 = call i8* @nish_str_from_i32(i32 %154)
  %156 = call i8* @nish_str_concat(i8* %151, i8* %155)
  call void @nish_print(i8* %156)
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
