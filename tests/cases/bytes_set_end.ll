%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare i64 @llvm.fptosi.sat.i64.f64(double) #3

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
  %25 = call i64 @llvm.fptosi.sat.i64.f64(double %24)
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
  %53 = call i64 @llvm.fptosi.sat.i64.f64(double %52)
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
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 2, i64* %132, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 2, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %134 = bitcast [2 x i32]* %arr.data.3 to i8*
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %134, i8** %135, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %136 = bitcast i8* %134 to i32*
  %137 = getelementptr inbounds i32, i32* %136, i64 0
  store i32 -1, i32* %137, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %138 = getelementptr inbounds i32, i32* %136, i64 1
  store i32 70000, i32* %138, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %pair.addr, align 8
  %139 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %140 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %141 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF0000000000000)
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 0
  %143 = load i64, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = add i64 %141, %143
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 0
  %146 = load i64, i64* %145, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %147 = icmp ule i64 %141, %144
  %148 = icmp ule i64 %144, %146
  %149 = and i1 %147, %148
  br i1 %149, label %set.ok.2, label %set.fail.2

set.fail.2:
  call void @nish_panic_slice(i64 %141, i64 %144, i64 %146)
  unreachable

set.ok.2:
  %150 = mul i64 %143, 4
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  %152 = load i8*, i8** %151, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %153 = bitcast i8* %152 to i32*
  %154 = getelementptr inbounds i32, i32* %153, i64 %141
  %155 = bitcast i32* %154 to i8*
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 2
  %157 = load i8*, i8** %156, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %158 = bitcast i8* %157 to i32*
  %159 = getelementptr inbounds i32, i32* %158, i64 0
  %160 = bitcast i32* %159 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %155, i8* %160, i64 %150, i1 false), !alias.scope !4, !noalias !3
  %161 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %162 = fptosi double 0x0000000000000000 to i64
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 0
  %164 = load i64, i64* %163, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %165 = icmp ult i64 %162, %164
  br i1 %165, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %162, i64 %164)
  unreachable

bounds.ok.4:
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 2
  %167 = load i8*, i8** %166, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %168 = bitcast i8* %167 to i32*
  %169 = getelementptr inbounds i32, i32* %168, i64 %162
  %170 = load i32, i32* %169, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %171 = call i8* @nish_str_from_i32(i32 %170)
  %172 = call i8* @nish_str_concat(i8* %171, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %173 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %174 = fptosi double 0x3FF0000000000000 to i64
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 0
  %176 = load i64, i64* %175, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %177 = icmp ult i64 %174, %176
  br i1 %177, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %174, i64 %176)
  unreachable

bounds.ok.5:
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 2
  %179 = load i8*, i8** %178, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %180 = bitcast i8* %179 to i32*
  %181 = getelementptr inbounds i32, i32* %180, i64 %174
  %182 = load i32, i32* %181, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %183 = call i8* @nish_str_from_i32(i32 %182)
  %184 = call i8* @nish_str_concat(i8* %172, i8* %183)
  %185 = call i8* @nish_str_concat(i8* %184, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %186 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %187 = fptosi double 0x4000000000000000 to i64
  %188 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %186, i64 0, i32 0
  %189 = load i64, i64* %188, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %190 = icmp ult i64 %187, %189
  br i1 %190, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 %187, i64 %189)
  unreachable

bounds.ok.6:
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %186, i64 0, i32 2
  %192 = load i8*, i8** %191, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %193 = bitcast i8* %192 to i32*
  %194 = getelementptr inbounds i32, i32* %193, i64 %187
  %195 = load i32, i32* %194, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %196 = call i8* @nish_str_from_i32(i32 %195)
  %197 = call i8* @nish_str_concat(i8* %185, i8* %196)
  call void @nish_print(i8* %197)
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 2, i64* %198, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 2, i64* %199, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %200 = bitcast [2 x double]* %arr.data.4 to i8*
  %201 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %200, i8** %201, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %202 = bitcast i8* %200 to double*
  %203 = getelementptr inbounds double, double* %202, i64 0
  store double 0x3FE0000000000000, double* %203, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %204 = getelementptr inbounds double, double* %202, i64 1
  store double 0x3FD0000000000000, double* %204, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %reals.addr, align 8
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 1, i64* %205, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %206 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 1, i64* %206, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %207 = bitcast [1 x double]* %arr.data.5 to i8*
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %207, i8** %208, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %209 = bitcast i8* %207 to double*
  %210 = getelementptr inbounds double, double* %209, i64 0
  store double 0x3FF8000000000000, double* %210, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.6, %struct.nish_array** %halves.addr, align 8
  %211 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %212 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  %213 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF0000000000000)
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %212, i64 0, i32 0
  %215 = load i64, i64* %214, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %216 = add i64 %213, %215
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 0
  %218 = load i64, i64* %217, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %219 = icmp ule i64 %213, %216
  %220 = icmp ule i64 %216, %218
  %221 = and i1 %219, %220
  br i1 %221, label %set.ok.3, label %set.fail.3

set.fail.3:
  call void @nish_panic_slice(i64 %213, i64 %216, i64 %218)
  unreachable

set.ok.3:
  %222 = mul i64 %215, 8
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 2
  %224 = load i8*, i8** %223, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %225 = bitcast i8* %224 to double*
  %226 = getelementptr inbounds double, double* %225, i64 %213
  %227 = bitcast double* %226 to i8*
  %228 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %212, i64 0, i32 2
  %229 = load i8*, i8** %228, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %230 = bitcast i8* %229 to double*
  %231 = getelementptr inbounds double, double* %230, i64 0
  %232 = bitcast double* %231 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %227, i8* %232, i64 %222, i1 false), !alias.scope !4, !noalias !3
  %233 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %234 = fptosi double 0x0000000000000000 to i64
  %235 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %233, i64 0, i32 0
  %236 = load i64, i64* %235, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %237 = icmp ult i64 %234, %236
  br i1 %237, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 %234, i64 %236)
  unreachable

bounds.ok.7:
  %238 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %233, i64 0, i32 2
  %239 = load i8*, i8** %238, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %240 = bitcast i8* %239 to double*
  %241 = getelementptr inbounds double, double* %240, i64 %234
  %242 = load double, double* %241, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %243 = call i8* @nish_str_from_f64(double %242)
  %244 = call i8* @nish_str_concat(i8* %243, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %245 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %246 = fptosi double 0x3FF0000000000000 to i64
  %247 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %245, i64 0, i32 0
  %248 = load i64, i64* %247, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %249 = icmp ult i64 %246, %248
  br i1 %249, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 %246, i64 %248)
  unreachable

bounds.ok.8:
  %250 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %245, i64 0, i32 2
  %251 = load i8*, i8** %250, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %252 = bitcast i8* %251 to double*
  %253 = getelementptr inbounds double, double* %252, i64 %246
  %254 = load double, double* %253, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %255 = call i8* @nish_str_from_f64(double %254)
  %256 = call i8* @nish_str_concat(i8* %244, i8* %255)
  call void @nish_print(i8* %256)
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
attributes #3 = { nounwind willreturn readnone }

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
