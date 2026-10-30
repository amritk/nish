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
  call void @nish_panic_index(i64 2, i64 %24)
  unreachable

bounds.ok:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 2
  %33 = bitcast i8* %32 to <16 x i8>*
  %34 = load <16 x i8>, <16 x i8>* %33, align 1
  store <16 x i8> %34, <16 x i8>* %b.addr, align 8
  %35 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %36 = extractelement <16 x i8> %35, i32 0
  %37 = zext i8 %36 to i64
  %38 = call i8* @nish_str_from_u64(i64 %37)
  call void @nish_print(i8* %38)
  %39 = load <16 x i8>, <16 x i8>* %b.addr, align 8
  %40 = extractelement <16 x i8> %39, i32 15
  %41 = zext i8 %40 to i64
  %42 = call i8* @nish_str_from_u64(i64 %41)
  call void @nish_print(i8* %42)
  %43 = insertelement <16 x i8> undef, i8 1, i32 0
  %44 = insertelement <16 x i8> %43, i8 2, i32 1
  %45 = insertelement <16 x i8> %44, i8 3, i32 2
  %46 = insertelement <16 x i8> %45, i8 4, i32 3
  %47 = insertelement <16 x i8> %46, i8 5, i32 4
  %48 = insertelement <16 x i8> %47, i8 6, i32 5
  %49 = insertelement <16 x i8> %48, i8 7, i32 6
  %50 = insertelement <16 x i8> %49, i8 8, i32 7
  %51 = insertelement <16 x i8> %50, i8 9, i32 8
  %52 = insertelement <16 x i8> %51, i8 10, i32 9
  %53 = insertelement <16 x i8> %52, i8 11, i32 10
  %54 = insertelement <16 x i8> %53, i8 12, i32 11
  %55 = insertelement <16 x i8> %54, i8 13, i32 12
  %56 = insertelement <16 x i8> %55, i8 14, i32 13
  %57 = insertelement <16 x i8> %56, i8 15, i32 14
  %58 = insertelement <16 x i8> %57, i8 255, i32 15
  %59 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = add i64 4, 16
  %63 = icmp ult i64 4, %61
  %64 = icmp ule i64 %62, %61
  %65 = and i1 %63, %64
  br i1 %65, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 4, i64 %61)
  unreachable

bounds.ok.1:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %68 = bitcast i8* %67 to i8*
  %69 = getelementptr inbounds i8, i8* %68, i64 4
  %70 = bitcast i8* %69 to <16 x i8>*
  store <16 x i8> %58, <16 x i8>* %70, align 1
  %71 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = icmp ult i64 3, %73
  br i1 %74, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 3, i64 %73)
  unreachable

bounds.ok.2:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = bitcast i8* %76 to i8*
  %78 = getelementptr inbounds i8, i8* %77, i64 3
  %79 = load i8, i8* %78, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %80 = zext i8 %79 to i64
  %81 = call i8* @nish_str_from_u64(i64 %80)
  call void @nish_print(i8* %81)
  %82 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = icmp ult i64 4, %84
  br i1 %85, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 4, i64 %84)
  unreachable

bounds.ok.3:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %88 = bitcast i8* %87 to i8*
  %89 = getelementptr inbounds i8, i8* %88, i64 4
  %90 = load i8, i8* %89, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %91 = zext i8 %90 to i64
  %92 = call i8* @nish_str_from_u64(i64 %91)
  call void @nish_print(i8* %92)
  %93 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = icmp ult i64 19, %95
  br i1 %96, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 19, i64 %95)
  unreachable

bounds.ok.4:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = bitcast i8* %98 to i8*
  %100 = getelementptr inbounds i8, i8* %99, i64 19
  %101 = load i8, i8* %100, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %102 = zext i8 %101 to i64
  %103 = call i8* @nish_str_from_u64(i64 %102)
  call void @nish_print(i8* %103)
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 6, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 6, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %106 = bitcast [6 x i32]* %arr.data to i8*
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %106, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %108 = bitcast i8* %106 to i32*
  %109 = getelementptr inbounds i32, i32* %108, i64 0
  store i32 1, i32* %109, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %110 = getelementptr inbounds i32, i32* %108, i64 1
  store i32 2, i32* %110, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %111 = getelementptr inbounds i32, i32* %108, i64 2
  store i32 3, i32* %111, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %112 = getelementptr inbounds i32, i32* %108, i64 3
  store i32 4, i32* %112, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %113 = getelementptr inbounds i32, i32* %108, i64 4
  store i32 5, i32* %113, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %114 = getelementptr inbounds i32, i32* %108, i64 5
  store i32 6, i32* %114, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %words.addr, align 8
  %115 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 0
  %117 = load i64, i64* %116, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %118 = add i64 2, 4
  %119 = icmp ult i64 2, %117
  %120 = icmp ule i64 %118, %117
  %121 = and i1 %119, %120
  br i1 %121, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 2, i64 %117)
  unreachable

bounds.ok.5:
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %124 = bitcast i8* %123 to i32*
  %125 = getelementptr inbounds i32, i32* %124, i64 2
  %126 = bitcast i32* %125 to <4 x i32>*
  %127 = load <4 x i32>, <4 x i32>* %126, align 4
  %128 = insertelement <4 x i32> %127, i32 100, i32 3
  store <4 x i32> %128, <4 x i32>* %w.addr, align 8
  %129 = load <4 x i32>, <4 x i32>* %w.addr, align 8
  %130 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %130, i64 0, i32 0
  %132 = load i64, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = add i64 0, 4
  %134 = icmp ult i64 0, %132
  %135 = icmp ule i64 %133, %132
  %136 = and i1 %134, %135
  br i1 %136, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %132)
  unreachable

bounds.ok.6:
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %130, i64 0, i32 2
  %138 = load i8*, i8** %137, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %139 = bitcast i8* %138 to i32*
  %140 = getelementptr inbounds i32, i32* %139, i64 0
  %141 = bitcast i32* %140 to <4 x i32>*
  store <4 x i32> %129, <4 x i32>* %141, align 4
  %142 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = icmp ult i64 0, %144
  br i1 %145, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 0, i64 %144)
  unreachable

bounds.ok.7:
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 2
  %147 = load i8*, i8** %146, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %148 = bitcast i8* %147 to i32*
  %149 = getelementptr inbounds i32, i32* %148, i64 0
  %150 = load i32, i32* %149, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %151 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 0
  %153 = load i64, i64* %152, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %154 = icmp ult i64 3, %153
  br i1 %154, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 3, i64 %153)
  unreachable

bounds.ok.8:
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %157 = bitcast i8* %156 to i32*
  %158 = getelementptr inbounds i32, i32* %157, i64 3
  %159 = load i32, i32* %158, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %160 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %150, i32 %159)
  %161 = extractvalue { i32, i1 } %160, 0
  %162 = extractvalue { i32, i1 } %160, 1
  br i1 %162, label %ovf.fail, label %ovf.ok

ovf.ok:
  %163 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 0
  %165 = load i64, i64* %164, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %166 = icmp ult i64 5, %165
  br i1 %166, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 5, i64 %165)
  unreachable

bounds.ok.9:
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 2
  %168 = load i8*, i8** %167, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %169 = bitcast i8* %168 to i32*
  %170 = getelementptr inbounds i32, i32* %169, i64 5
  %171 = load i32, i32* %170, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %172 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %161, i32 %171)
  %173 = extractvalue { i32, i1 } %172, 0
  %174 = extractvalue { i32, i1 } %172, 1
  br i1 %174, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %175 = call i8* @nish_str_from_i32(i32 %173)
  call void @nish_print(i8* %175)
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %177, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %178 = bitcast [2 x double]* %arr.data.1 to i8*
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %178, i8** %179, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %180 = bitcast i8* %178 to double*
  %181 = getelementptr inbounds double, double* %180, i64 0
  store double 0x3FE0000000000000, double* %181, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %182 = getelementptr inbounds double, double* %180, i64 1
  store double 0x3FF8000000000000, double* %182, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %xs.addr, align 8
  %183 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 0
  %185 = load i64, i64* %184, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %186 = add i64 0, 2
  %187 = icmp ult i64 0, %185
  %188 = icmp ule i64 %186, %185
  %189 = and i1 %187, %188
  br i1 %189, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 0, i64 %185)
  unreachable

bounds.ok.10:
  %190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 2
  %191 = load i8*, i8** %190, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %192 = bitcast i8* %191 to double*
  %193 = getelementptr inbounds double, double* %192, i64 0
  %194 = bitcast double* %193 to <2 x double>*
  %195 = load <2 x double>, <2 x double>* %194, align 8
  %196 = extractelement <2 x double> %195, i32 1
  %197 = call i8* @nish_str_from_f64(double %196)
  call void @nish_print(i8* %197)
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
