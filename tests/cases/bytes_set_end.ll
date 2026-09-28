%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %two.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i8], align 8
  %wide.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i32], align 8
  %pair.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [2 x i32], align 8
  %reals.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [2 x double], align 8
  %halves.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [1 x double], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 0, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 0, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 0, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 0, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %dst.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %empty.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast [2 x i8]* %arr.data.1 to i8*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %14 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 0
  store i8 6, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i8, i8* %16, i64 1
  store i8 7, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %two.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = sitofp i64 %23 to double
  %25 = fptosi double %24 to i64
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = add i64 %25, %27
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = icmp ule i64 %25, %28
  %32 = icmp ule i64 %28, %30
  %33 = and i1 %31, %32
  br i1 %33, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 %25, i64 %28, i64 %30)
  unreachable

set.ok:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i8*
  %37 = getelementptr inbounds i8, i8* %36, i64 %25
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i8*
  %41 = getelementptr inbounds i8, i8* %40, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %37, i8* %41, i64 %27, i1 false), !alias.scope !4, !noalias !3
  %42 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %43 = load %struct.nish_array*, %struct.nish_array** %two.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = sitofp i64 %46 to double
  %48 = load %struct.nish_array*, %struct.nish_array** %two.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = sitofp i64 %50 to double
  %52 = fsub double %47, %51
  %53 = fptosi double %52 to i64
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = add i64 %53, %55
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = icmp ule i64 %53, %56
  %60 = icmp ule i64 %56, %58
  %61 = and i1 %59, %60
  br i1 %61, label %set.ok.1, label %set.fail.1

set.fail.1:
  call void @nish_panic_slice(i64 %53, i64 %56, i64 %58)
  unreachable

set.ok.1:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = bitcast i8* %63 to i8*
  %65 = getelementptr inbounds i8, i8* %64, i64 %53
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %68 = bitcast i8* %67 to i8*
  %69 = getelementptr inbounds i8, i8* %68, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %65, i8* %69, i64 %55, i1 false), !alias.scope !4, !noalias !3
  %70 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %71 = fptosi double 0x0000000000000000 to i64
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = icmp ult i64 %71, %73
  br i1 %74, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %71, i64 %73)
  unreachable

bounds.ok:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = bitcast i8* %76 to i8*
  %78 = getelementptr inbounds i8, i8* %77, i64 %71
  %79 = load i8, i8* %78, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %80 = zext i8 %79 to i64
  %81 = call i8* @nish_str_from_u64(i64 %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %83 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %84 = fptosi double 0x3FF0000000000000 to i64
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %87 = icmp ult i64 %84, %86
  br i1 %87, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %84, i64 %86)
  unreachable

bounds.ok.1:
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %90 = bitcast i8* %89 to i8*
  %91 = getelementptr inbounds i8, i8* %90, i64 %84
  %92 = load i8, i8* %91, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %93 = zext i8 %92 to i64
  %94 = call i8* @nish_str_from_u64(i64 %93)
  %95 = call i8* @nish_str_concat(i8* %82, i8* %94)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %97 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %98 = fptosi double 0x4000000000000000 to i64
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %100 = load i64, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = icmp ult i64 %98, %100
  br i1 %101, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %98, i64 %100)
  unreachable

bounds.ok.2:
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %104 = bitcast i8* %103 to i8*
  %105 = getelementptr inbounds i8, i8* %104, i64 %98
  %106 = load i8, i8* %105, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %107 = zext i8 %106 to i64
  %108 = call i8* @nish_str_from_u64(i64 %107)
  %109 = call i8* @nish_str_concat(i8* %96, i8* %108)
  %110 = call i8* @nish_str_concat(i8* %109, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %111 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %112 = fptosi double 0x4008000000000000 to i64
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %114 = load i64, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = icmp ult i64 %112, %114
  br i1 %115, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %112, i64 %114)
  unreachable

bounds.ok.3:
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  %117 = load i8*, i8** %116, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %118 = bitcast i8* %117 to i8*
  %119 = getelementptr inbounds i8, i8* %118, i64 %112
  %120 = load i8, i8* %119, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %121 = zext i8 %120 to i64
  %122 = call i8* @nish_str_from_u64(i64 %121)
  %123 = call i8* @nish_str_concat(i8* %110, i8* %122)
  call void @nish_print(i8* %123)
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 3, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 3, i64* %125, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %126 = bitcast [3 x i32]* %arr.data.2 to i8*
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %126, i8** %127, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %128 = bitcast i8* %126 to i32*
  %129 = getelementptr inbounds i32, i32* %128, i64 0
  store i32 0, i32* %129, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %130 = getelementptr inbounds i32, i32* %128, i64 1
  store i32 0, i32* %130, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %131 = getelementptr inbounds i32, i32* %128, i64 2
  store i32 0, i32* %131, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %wide.addr, align 8
  %132 = sub nsw i32 0, 1
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 2, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 2, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %135 = bitcast [2 x i32]* %arr.data.3 to i8*
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %135, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %137 = bitcast i8* %135 to i32*
  %138 = getelementptr inbounds i32, i32* %137, i64 0
  store i32 %132, i32* %138, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %139 = getelementptr inbounds i32, i32* %137, i64 1
  store i32 70000, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %pair.addr, align 8
  %140 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %141 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %142 = fptosi double 0x3FF0000000000000 to i64
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = add i64 %142, %144
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 0
  %147 = load i64, i64* %146, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %148 = icmp ule i64 %142, %145
  %149 = icmp ule i64 %145, %147
  %150 = and i1 %148, %149
  br i1 %150, label %set.ok.2, label %set.fail.2

set.fail.2:
  call void @nish_panic_slice(i64 %142, i64 %145, i64 %147)
  unreachable

set.ok.2:
  %151 = mul i64 %144, 4
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 2
  %153 = load i8*, i8** %152, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %154 = bitcast i8* %153 to i32*
  %155 = getelementptr inbounds i32, i32* %154, i64 %142
  %156 = bitcast i32* %155 to i8*
  %157 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 2
  %158 = load i8*, i8** %157, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %159 = bitcast i8* %158 to i32*
  %160 = getelementptr inbounds i32, i32* %159, i64 0
  %161 = bitcast i32* %160 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %156, i8* %161, i64 %151, i1 false), !alias.scope !4, !noalias !3
  %162 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %163 = fptosi double 0x0000000000000000 to i64
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %162, i64 0, i32 0
  %165 = load i64, i64* %164, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %166 = icmp ult i64 %163, %165
  br i1 %166, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %163, i64 %165)
  unreachable

bounds.ok.4:
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %162, i64 0, i32 2
  %168 = load i8*, i8** %167, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %169 = bitcast i8* %168 to i32*
  %170 = getelementptr inbounds i32, i32* %169, i64 %163
  %171 = load i32, i32* %170, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %172 = call i8* @nish_str_from_i32(i32 %171)
  %173 = call i8* @nish_str_concat(i8* %172, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %174 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %175 = fptosi double 0x3FF0000000000000 to i64
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %174, i64 0, i32 0
  %177 = load i64, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %178 = icmp ult i64 %175, %177
  br i1 %178, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %175, i64 %177)
  unreachable

bounds.ok.5:
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %174, i64 0, i32 2
  %180 = load i8*, i8** %179, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %181 = bitcast i8* %180 to i32*
  %182 = getelementptr inbounds i32, i32* %181, i64 %175
  %183 = load i32, i32* %182, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %184 = call i8* @nish_str_from_i32(i32 %183)
  %185 = call i8* @nish_str_concat(i8* %173, i8* %184)
  %186 = call i8* @nish_str_concat(i8* %185, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %187 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %188 = fptosi double 0x4000000000000000 to i64
  %189 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %187, i64 0, i32 0
  %190 = load i64, i64* %189, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %191 = icmp ult i64 %188, %190
  br i1 %191, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 %188, i64 %190)
  unreachable

bounds.ok.6:
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %187, i64 0, i32 2
  %193 = load i8*, i8** %192, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %194 = bitcast i8* %193 to i32*
  %195 = getelementptr inbounds i32, i32* %194, i64 %188
  %196 = load i32, i32* %195, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %197 = call i8* @nish_str_from_i32(i32 %196)
  %198 = call i8* @nish_str_concat(i8* %186, i8* %197)
  call void @nish_print(i8* %198)
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 2, i64* %199, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 2, i64* %200, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %201 = bitcast [2 x double]* %arr.data.4 to i8*
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %201, i8** %202, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %203 = bitcast i8* %201 to double*
  %204 = getelementptr inbounds double, double* %203, i64 0
  store double 0x3FE0000000000000, double* %204, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %205 = getelementptr inbounds double, double* %203, i64 1
  store double 0x3FD0000000000000, double* %205, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %reals.addr, align 8
  %206 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 1, i64* %206, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %207 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 1, i64* %207, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %208 = bitcast [1 x double]* %arr.data.5 to i8*
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %208, i8** %209, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %210 = bitcast i8* %208 to double*
  %211 = getelementptr inbounds double, double* %210, i64 0
  store double 0x3FF8000000000000, double* %211, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.6, %struct.nish_array** %halves.addr, align 8
  %212 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %213 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  %214 = fptosi double 0x3FF0000000000000 to i64
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %213, i64 0, i32 0
  %216 = load i64, i64* %215, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %217 = add i64 %214, %216
  %218 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %212, i64 0, i32 0
  %219 = load i64, i64* %218, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %220 = icmp ule i64 %214, %217
  %221 = icmp ule i64 %217, %219
  %222 = and i1 %220, %221
  br i1 %222, label %set.ok.3, label %set.fail.3

set.fail.3:
  call void @nish_panic_slice(i64 %214, i64 %217, i64 %219)
  unreachable

set.ok.3:
  %223 = mul i64 %216, 8
  %224 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %212, i64 0, i32 2
  %225 = load i8*, i8** %224, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %226 = bitcast i8* %225 to double*
  %227 = getelementptr inbounds double, double* %226, i64 %214
  %228 = bitcast double* %227 to i8*
  %229 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %213, i64 0, i32 2
  %230 = load i8*, i8** %229, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %231 = bitcast i8* %230 to double*
  %232 = getelementptr inbounds double, double* %231, i64 0
  %233 = bitcast double* %232 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %228, i8* %233, i64 %223, i1 false), !alias.scope !4, !noalias !3
  %234 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %235 = fptosi double 0x0000000000000000 to i64
  %236 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %234, i64 0, i32 0
  %237 = load i64, i64* %236, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %238 = icmp ult i64 %235, %237
  br i1 %238, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 %235, i64 %237)
  unreachable

bounds.ok.7:
  %239 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %234, i64 0, i32 2
  %240 = load i8*, i8** %239, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %241 = bitcast i8* %240 to double*
  %242 = getelementptr inbounds double, double* %241, i64 %235
  %243 = load double, double* %242, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %244 = call i8* @nish_str_from_f64(double %243)
  %245 = call i8* @nish_str_concat(i8* %244, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %246 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %247 = fptosi double 0x3FF0000000000000 to i64
  %248 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %246, i64 0, i32 0
  %249 = load i64, i64* %248, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %250 = icmp ult i64 %247, %249
  br i1 %250, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 %247, i64 %249)
  unreachable

bounds.ok.8:
  %251 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %246, i64 0, i32 2
  %252 = load i8*, i8** %251, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %253 = bitcast i8* %252 to double*
  %254 = getelementptr inbounds double, double* %253, i64 %247
  %255 = load double, double* %254, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %256 = call i8* @nish_str_from_f64(double %255)
  %257 = call i8* @nish_str_concat(i8* %245, i8* %256)
  call void @nish_print(i8* %257)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element double", !6, i64 0}
!18 = !{!17, !17, i64 0}
