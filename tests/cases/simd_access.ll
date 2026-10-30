%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %b.addr = alloca <16 x i8>, align 8
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i32], align 8
  %w.addr = alloca <4 x i32>, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x double], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 20
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = mul nsw i32 %6, 3
  %8 = trunc i32 %7 to i8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 1)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %10
  store i8 %8, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = add i64 2, 16
  %26 = icmp ult i64 2, %24
  %27 = icmp ule i64 %25, %24
  %28 = and i1 %26, %27
  br i1 %28, label %bounds.ok, label %bounds.fail

bounds.fail:
  %29 = add i64 2, 15
  %30 = select i1 %26, i64 %29, i64 2
  call void @nish_panic_index(i64 %30, i64 %24)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i8*
  %34 = getelementptr inbounds i8, i8* %33, i64 2
  %35 = bitcast i8* %34 to <16 x i8>*
  %36 = load <16 x i8>, <16 x i8>* %35, align 1
  store <16 x i8> %36, <16 x i8>* %b.addr, align 8
  %37 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %38 = extractelement <16 x i8> %37, i32 0
  %39 = zext i8 %38 to i64
  %40 = call i8* @nish_str_from_u64(i64 %39)
  call void @nish_print(i8* %40)
  %41 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %42 = extractelement <16 x i8> %41, i32 15
  %43 = zext i8 %42 to i64
  %44 = call i8* @nish_str_from_u64(i64 %43)
  call void @nish_print(i8* %44)
  %45 = insertelement <16 x i8> undef, i8 1, i32 0
  %46 = insertelement <16 x i8> %45, i8 2, i32 1
  %47 = insertelement <16 x i8> %46, i8 3, i32 2
  %48 = insertelement <16 x i8> %47, i8 4, i32 3
  %49 = insertelement <16 x i8> %48, i8 5, i32 4
  %50 = insertelement <16 x i8> %49, i8 6, i32 5
  %51 = insertelement <16 x i8> %50, i8 7, i32 6
  %52 = insertelement <16 x i8> %51, i8 8, i32 7
  %53 = insertelement <16 x i8> %52, i8 9, i32 8
  %54 = insertelement <16 x i8> %53, i8 10, i32 9
  %55 = insertelement <16 x i8> %54, i8 11, i32 10
  %56 = insertelement <16 x i8> %55, i8 12, i32 11
  %57 = insertelement <16 x i8> %56, i8 13, i32 12
  %58 = insertelement <16 x i8> %57, i8 14, i32 13
  %59 = insertelement <16 x i8> %58, i8 15, i32 14
  %60 = insertelement <16 x i8> %59, i8 255, i32 15
  %61 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = add i64 4, 16
  %65 = icmp ult i64 4, %63
  %66 = icmp ule i64 %64, %63
  %67 = and i1 %65, %66
  br i1 %67, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  %68 = add i64 4, 15
  %69 = select i1 %65, i64 %68, i64 4
  call void @nish_panic_index(i64 %69, i64 %63)
  unreachable

bounds.ok.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to i8*
  %73 = getelementptr inbounds i8, i8* %72, i64 4
  %74 = bitcast i8* %73 to <16 x i8>*
  store <16 x i8> %60, <16 x i8>* %74, align 1
  %75 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = icmp ult i64 3, %77
  br i1 %78, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 3, i64 %77)
  unreachable

bounds.ok.2:
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %81 = bitcast i8* %80 to i8*
  %82 = getelementptr inbounds i8, i8* %81, i64 3
  %83 = load i8, i8* %82, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %84 = zext i8 %83 to i64
  %85 = call i8* @nish_str_from_u64(i64 %84)
  call void @nish_print(i8* %85)
  %86 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 0
  %88 = load i64, i64* %87, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %89 = icmp ult i64 4, %88
  br i1 %89, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 4, i64 %88)
  unreachable

bounds.ok.3:
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %92 = bitcast i8* %91 to i8*
  %93 = getelementptr inbounds i8, i8* %92, i64 4
  %94 = load i8, i8* %93, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %95 = zext i8 %94 to i64
  %96 = call i8* @nish_str_from_u64(i64 %95)
  call void @nish_print(i8* %96)
  %97 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = icmp ult i64 19, %99
  br i1 %100, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 19, i64 %99)
  unreachable

bounds.ok.4:
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %103 = bitcast i8* %102 to i8*
  %104 = getelementptr inbounds i8, i8* %103, i64 19
  %105 = load i8, i8* %104, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %106 = zext i8 %105 to i64
  %107 = call i8* @nish_str_from_u64(i64 %106)
  call void @nish_print(i8* %107)
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 6, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 6, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %110 = bitcast [6 x i32]* %arr.data to i8*
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %110, i8** %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %112 = bitcast i8* %110 to i32*
  %113 = getelementptr inbounds i32, i32* %112, i64 0
  store i32 1, i32* %113, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %114 = getelementptr inbounds i32, i32* %112, i64 1
  store i32 2, i32* %114, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %115 = getelementptr inbounds i32, i32* %112, i64 2
  store i32 3, i32* %115, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %116 = getelementptr inbounds i32, i32* %112, i64 3
  store i32 4, i32* %116, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %117 = getelementptr inbounds i32, i32* %112, i64 4
  store i32 5, i32* %117, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %118 = getelementptr inbounds i32, i32* %112, i64 5
  store i32 6, i32* %118, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %words.addr, align 8
  %119 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %122 = add i64 2, 4
  %123 = icmp ult i64 2, %121
  %124 = icmp ule i64 %122, %121
  %125 = and i1 %123, %124
  br i1 %125, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  %126 = add i64 2, 3
  %127 = select i1 %123, i64 %126, i64 2
  call void @nish_panic_index(i64 %127, i64 %121)
  unreachable

bounds.ok.5:
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %129 = load i8*, i8** %128, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %130 = bitcast i8* %129 to i32*
  %131 = getelementptr inbounds i32, i32* %130, i64 2
  %132 = bitcast i32* %131 to <4 x i32>*
  %133 = load <4 x i32>, <4 x i32>* %132, align 4
  %134 = insertelement <4 x i32> %133, i32 100, i32 3
  store <4 x i32> %134, <4 x i32>* %w.addr, align 8
  %135 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %136 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 0
  %138 = load i64, i64* %137, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %139 = add i64 0, 4
  %140 = icmp ult i64 0, %138
  %141 = icmp ule i64 %139, %138
  %142 = and i1 %140, %141
  br i1 %142, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  %143 = add i64 0, 3
  %144 = select i1 %140, i64 %143, i64 0
  call void @nish_panic_index(i64 %144, i64 %138)
  unreachable

bounds.ok.6:
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %147 = bitcast i8* %146 to i32*
  %148 = getelementptr inbounds i32, i32* %147, i64 0
  %149 = bitcast i32* %148 to <4 x i32>*
  store <4 x i32> %135, <4 x i32>* %149, align 4
  %150 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %150, i64 0, i32 0
  %152 = load i64, i64* %151, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %153 = icmp ult i64 0, %152
  br i1 %153, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 0, i64 %152)
  unreachable

bounds.ok.7:
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %150, i64 0, i32 2
  %155 = load i8*, i8** %154, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %156 = bitcast i8* %155 to i32*
  %157 = getelementptr inbounds i32, i32* %156, i64 0
  %158 = load i32, i32* %157, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %159 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %159, i64 0, i32 0
  %161 = load i64, i64* %160, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %162 = icmp ult i64 3, %161
  br i1 %162, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 3, i64 %161)
  unreachable

bounds.ok.8:
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %159, i64 0, i32 2
  %164 = load i8*, i8** %163, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %165 = bitcast i8* %164 to i32*
  %166 = getelementptr inbounds i32, i32* %165, i64 3
  %167 = load i32, i32* %166, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %168 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %158, i32 %167)
  %169 = extractvalue { i32, i1 } %168, 0
  %170 = extractvalue { i32, i1 } %168, 1
  br i1 %170, label %ovf.fail, label %ovf.ok

ovf.ok:
  %171 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 0
  %173 = load i64, i64* %172, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %174 = icmp ult i64 5, %173
  br i1 %174, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 5, i64 %173)
  unreachable

bounds.ok.9:
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 2
  %176 = load i8*, i8** %175, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %177 = bitcast i8* %176 to i32*
  %178 = getelementptr inbounds i32, i32* %177, i64 5
  %179 = load i32, i32* %178, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %180 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %169, i32 %179)
  %181 = extractvalue { i32, i1 } %180, 0
  %182 = extractvalue { i32, i1 } %180, 1
  br i1 %182, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %183 = call i8* @nish_str_from_i32(i32 %181)
  call void @nish_print(i8* %183)
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %184, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %185, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %186 = bitcast [2 x double]* %arr.data.1 to i8*
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %186, i8** %187, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %188 = bitcast i8* %186 to double*
  %189 = getelementptr inbounds double, double* %188, i64 0
  store double 0x3FE0000000000000, double* %189, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %190 = getelementptr inbounds double, double* %188, i64 1
  store double 0x3FF8000000000000, double* %190, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %xs.addr, align 8
  %191 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 0
  %193 = load i64, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %194 = add i64 0, 2
  %195 = icmp ult i64 0, %193
  %196 = icmp ule i64 %194, %193
  %197 = and i1 %195, %196
  br i1 %197, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  %198 = add i64 0, 1
  %199 = select i1 %195, i64 %198, i64 0
  call void @nish_panic_index(i64 %199, i64 %193)
  unreachable

bounds.ok.10:
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 2
  %201 = load i8*, i8** %200, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %202 = bitcast i8* %201 to double*
  %203 = getelementptr inbounds double, double* %202, i64 0
  %204 = bitcast double* %203 to <2 x double>*
  %205 = load <2 x double>, <2 x double>* %204, align 8
  %206 = extractelement <2 x double> %205, i32 1
  %207 = call i8* @nish_str_from_f64(double %206)
  call void @nish_print(i8* %207)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!19, !20, !21, !22, !23}
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
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
