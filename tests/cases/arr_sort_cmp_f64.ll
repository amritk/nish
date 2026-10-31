%struct.Item = type { double, double }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i32 @llvm.fptosi.sat.i32.f64(double) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3

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

define internal void @Item.constructor(%struct.Item* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, double noundef %key, double noundef %tag) #0 {
entry:
  %0 = getelementptr inbounds %struct.Item, %struct.Item* %this, i32 0, i32 0
  store double %key, double* %0, align 8, !tbaa !4
  %1 = getelementptr inbounds %struct.Item, %struct.Item* %this, i32 0, i32 1
  store double %tag, double* %1, align 8, !tbaa !5
  ret void
}

define hidden noundef double @byKey$(%struct.Item* noundef nonnull readonly align 8 dereferenceable(16) nocapture %a, %struct.Item* noundef nonnull readonly align 8 dereferenceable(16) nocapture %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.Item, %struct.Item* %a, i32 0, i32 0
  %1 = load double, double* %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.Item, %struct.Item* %b, i32 0, i32 0
  %3 = load double, double* %2, align 8, !tbaa !4
  %4 = fsub double %1, %3
  ret double %4
}

define void @nish_main() #2 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [7 x double], align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x double], align 8
  %items.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %i.addr = alloca double, align 8
  %sum.addr = alloca double, align 8
  %item.addr = alloca %struct.Item*, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 7, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 7, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %2 = bitcast [7 x double]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %4 = bitcast i8* %2 to double*
  %5 = getelementptr inbounds double, double* %4, i64 0
  store double 0x3FE0000000000000, double* %5, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %6 = getelementptr inbounds double, double* %4, i64 1
  store double 0x3FD0000000000000, double* %6, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %7 = getelementptr inbounds double, double* %4, i64 2
  store double 0x3FE8000000000000, double* %7, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %8 = getelementptr inbounds double, double* %4, i64 3
  store double 0x3FD3333333333333, double* %8, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %9 = getelementptr inbounds double, double* %4, i64 4
  store double 0x3FB999999999999A, double* %9, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %10 = getelementptr inbounds double, double* %4, i64 5
  store double 0x3FECCCCCCCCCCCCD, double* %10, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %11 = getelementptr inbounds double, double* %4, i64 6
  store double 0x3FC999999999999A, double* %11, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = call %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow0(%struct.nish_array* %12)
  %14 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %15 = fptosi double 0x0000000000000000 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %18 = icmp ult i64 %15, %17
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %15, i64 %17)
  unreachable

bounds.ok:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %21 = bitcast i8* %20 to double*
  %22 = getelementptr inbounds double, double* %21, i64 %15
  %23 = load double, double* %22, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %24 = call i8* @nish_str_from_f64(double %23)
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = fptosi double 0x3FF0000000000000 to i64
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %30 = icmp ult i64 %27, %29
  br i1 %30, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %27, i64 %29)
  unreachable

bounds.ok.1:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %33 = bitcast i8* %32 to double*
  %34 = getelementptr inbounds double, double* %33, i64 %27
  %35 = load double, double* %34, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %36 = call i8* @nish_str_from_f64(double %35)
  %37 = call i8* @nish_str_concat(i8* %25, i8* %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %39 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %40 = fptosi double 0x4000000000000000 to i64
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %43 = icmp ult i64 %40, %42
  br i1 %43, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %40, i64 %42)
  unreachable

bounds.ok.2:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %46 = bitcast i8* %45 to double*
  %47 = getelementptr inbounds double, double* %46, i64 %40
  %48 = load double, double* %47, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %49 = call i8* @nish_str_from_f64(double %48)
  %50 = call i8* @nish_str_concat(i8* %38, i8* %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %52 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %53 = fptosi double 0x4008000000000000 to i64
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %56 = icmp ult i64 %53, %55
  br i1 %56, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %53, i64 %55)
  unreachable

bounds.ok.3:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %59 = bitcast i8* %58 to double*
  %60 = getelementptr inbounds double, double* %59, i64 %53
  %61 = load double, double* %60, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %62 = call i8* @nish_str_from_f64(double %61)
  %63 = call i8* @nish_str_concat(i8* %51, i8* %62)
  %64 = call i8* @nish_str_concat(i8* %63, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %65 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %66 = fptosi double 0x4010000000000000 to i64
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %69 = icmp ult i64 %66, %68
  br i1 %69, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %66, i64 %68)
  unreachable

bounds.ok.4:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %72 = bitcast i8* %71 to double*
  %73 = getelementptr inbounds double, double* %72, i64 %66
  %74 = load double, double* %73, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %75 = call i8* @nish_str_from_f64(double %74)
  %76 = call i8* @nish_str_concat(i8* %64, i8* %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %78 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %79 = fptosi double 0x4014000000000000 to i64
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %82 = icmp ult i64 %79, %81
  br i1 %82, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %79, i64 %81)
  unreachable

bounds.ok.5:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %85 = bitcast i8* %84 to double*
  %86 = getelementptr inbounds double, double* %85, i64 %79
  %87 = load double, double* %86, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %88 = call i8* @nish_str_from_f64(double %87)
  %89 = call i8* @nish_str_concat(i8* %77, i8* %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %91 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %92 = fptosi double 0x4018000000000000 to i64
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %95 = icmp ult i64 %92, %94
  br i1 %95, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 %92, i64 %94)
  unreachable

bounds.ok.6:
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %98 = bitcast i8* %97 to double*
  %99 = getelementptr inbounds double, double* %98, i64 %92
  %100 = load double, double* %99, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %101 = call i8* @nish_str_from_f64(double %100)
  %102 = call i8* @nish_str_concat(i8* %90, i8* %101)
  call void @nish_print(i8* %102)
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %103, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %104, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %105 = bitcast [4 x double]* %arr.data.1 to i8*
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %105, i8** %106, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %107 = bitcast i8* %105 to double*
  %108 = getelementptr inbounds double, double* %107, i64 0
  store double 0x4008000000000000, double* %108, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %109 = getelementptr inbounds double, double* %107, i64 1
  store double 0x3FF0000000000000, double* %109, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %110 = getelementptr inbounds double, double* %107, i64 2
  store double 0x4000000000000000, double* %110, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %111 = getelementptr inbounds double, double* %107, i64 3
  store double 0x4010000000000000, double* %111, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ys.addr, align 8
  %112 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %113 = call %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow1(%struct.nish_array* %112)
  %114 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %115 = fptosi double 0x0000000000000000 to i64
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 0
  %117 = load i64, i64* %116, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %118 = icmp ult i64 %115, %117
  br i1 %118, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 %115, i64 %117)
  unreachable

bounds.ok.7:
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %121 = bitcast i8* %120 to double*
  %122 = getelementptr inbounds double, double* %121, i64 %115
  %123 = load double, double* %122, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %124 = call i8* @nish_str_from_f64(double %123)
  %125 = call i8* @nish_str_concat(i8* %124, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %126 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %127 = fptosi double 0x3FF0000000000000 to i64
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 0
  %129 = load i64, i64* %128, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %130 = icmp ult i64 %127, %129
  br i1 %130, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 %127, i64 %129)
  unreachable

bounds.ok.8:
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %133 = bitcast i8* %132 to double*
  %134 = getelementptr inbounds double, double* %133, i64 %127
  %135 = load double, double* %134, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %136 = call i8* @nish_str_from_f64(double %135)
  %137 = call i8* @nish_str_concat(i8* %125, i8* %136)
  %138 = call i8* @nish_str_concat(i8* %137, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %139 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %140 = fptosi double 0x4000000000000000 to i64
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 0
  %142 = load i64, i64* %141, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %143 = icmp ult i64 %140, %142
  br i1 %143, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 %140, i64 %142)
  unreachable

bounds.ok.9:
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  %145 = load i8*, i8** %144, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %146 = bitcast i8* %145 to double*
  %147 = getelementptr inbounds double, double* %146, i64 %140
  %148 = load double, double* %147, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %149 = call i8* @nish_str_from_f64(double %148)
  %150 = call i8* @nish_str_concat(i8* %138, i8* %149)
  %151 = call i8* @nish_str_concat(i8* %150, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %152 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %153 = fptosi double 0x4008000000000000 to i64
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %152, i64 0, i32 0
  %155 = load i64, i64* %154, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %156 = icmp ult i64 %153, %155
  br i1 %156, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 %153, i64 %155)
  unreachable

bounds.ok.10:
  %157 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %152, i64 0, i32 2
  %158 = load i8*, i8** %157, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %159 = bitcast i8* %158 to double*
  %160 = getelementptr inbounds double, double* %159, i64 %153
  %161 = load double, double* %160, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %162 = call i8* @nish_str_from_f64(double %161)
  %163 = call i8* @nish_str_concat(i8* %151, i8* %162)
  call void @nish_print(i8* %163)
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %164, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %165, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %166, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %items.addr, align 8
  store double 0x0000000000000000, double* %i.addr, align 8
  br label %for.cond

for.cond:
  %167 = load double, double* %i.addr, align 8
  %168 = fcmp olt double %167, 0x40C3880000000000
  br i1 %168, label %for.body, label %for.end

for.body:
  %169 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %170 = call i8* @nish_alloc_struct(i64 16)
  %171 = bitcast i8* %170 to %struct.Item*
  %172 = load double, double* %i.addr, align 8
  %173 = fmul double %172, 0x40BEEF0000000000
  %174 = frem double %173, 0x4058400000000000
  %175 = load double, double* %i.addr, align 8
  call void @Item.constructor(%struct.Item* %171, double %174, double %175)
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %169, i64 0, i32 0
  %177 = load i64, i64* %176, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %169, i64 0, i32 1
  %179 = load i64, i64* %178, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %180 = icmp eq i64 %177, %179
  br i1 %180, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %169, i64 8)
  br label %push.store

push.store:
  %181 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %169, i64 0, i32 2
  %182 = load i8*, i8** %181, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %183 = bitcast i8* %182 to %struct.Item**
  %184 = getelementptr inbounds %struct.Item*, %struct.Item** %183, i64 %177
  store %struct.Item* %171, %struct.Item** %184, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %185 = add i64 %177, 1
  store i64 %185, i64* %176, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %186 = sitofp i64 %185 to double
  br label %for.inc

for.inc:
  %187 = load double, double* %i.addr, align 8
  %188 = fadd double %187, 0x3FF0000000000000
  store double %188, double* %i.addr, align 8
  br label %for.cond

for.end:
  %189 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %190 = call %struct.nish_array* @nish.sortWith$$Item$fn.5.byKey(%struct.nish_array* %189)
  store double 0x0000000000000000, double* %sum.addr, align 8
  %191 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %192 = load i64, i64* %forof.idx, align 8
  %193 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 0
  %194 = load i64, i64* %193, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %195 = icmp ult i64 %192, %194
  br i1 %195, label %forof.body, label %forof.end

forof.body:
  %196 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %191, i64 0, i32 2
  %197 = load i8*, i8** %196, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %198 = bitcast i8* %197 to %struct.Item**
  %199 = getelementptr inbounds %struct.Item*, %struct.Item** %198, i64 %192
  %200 = load %struct.Item*, %struct.Item** %199, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  store %struct.Item* %200, %struct.Item** %item.addr, align 8
  %201 = load double, double* %sum.addr, align 8
  %202 = fmul double %201, 0x403F000000000000
  %203 = load %struct.Item*, %struct.Item** %item.addr, align 8
  %204 = getelementptr inbounds %struct.Item, %struct.Item* %203, i32 0, i32 0
  %205 = load double, double* %204, align 8, !tbaa !4
  %206 = fmul double %205, 0x40C38B8000000000
  %207 = fadd double %202, %206
  %208 = load %struct.Item*, %struct.Item** %item.addr, align 8
  %209 = getelementptr inbounds %struct.Item, %struct.Item* %208, i32 0, i32 1
  %210 = load double, double* %209, align 8, !tbaa !5
  %211 = fadd double %207, %210
  %212 = frem double %211, 0x41CDCD6503800000
  store double %212, double* %sum.addr, align 8
  br label %forof.inc

forof.inc:
  %213 = load i64, i64* %forof.idx, align 8
  %214 = add i64 %213, 1
  store i64 %214, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %215 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %216 = fptosi double 0x0000000000000000 to i64
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 0
  %218 = load i64, i64* %217, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %219 = icmp ult i64 %216, %218
  br i1 %219, label %bounds.ok.11, label %bounds.fail.11

bounds.fail.11:
  call void @nish_panic_index(i64 %216, i64 %218)
  unreachable

bounds.ok.11:
  %220 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 2
  %221 = load i8*, i8** %220, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %222 = bitcast i8* %221 to %struct.Item**
  %223 = getelementptr inbounds %struct.Item*, %struct.Item** %222, i64 %216
  %224 = load %struct.Item*, %struct.Item** %223, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %225 = getelementptr inbounds %struct.Item, %struct.Item* %224, i32 0, i32 1
  %226 = load double, double* %225, align 8, !tbaa !5
  %227 = call i8* @nish_str_from_f64(double %226)
  %228 = call i8* @nish_str_concat(i8* %227, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %229 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %230 = fptosi double 0x3FF0000000000000 to i64
  %231 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %229, i64 0, i32 0
  %232 = load i64, i64* %231, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %233 = icmp ult i64 %230, %232
  br i1 %233, label %bounds.ok.12, label %bounds.fail.12

bounds.fail.12:
  call void @nish_panic_index(i64 %230, i64 %232)
  unreachable

bounds.ok.12:
  %234 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %229, i64 0, i32 2
  %235 = load i8*, i8** %234, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %236 = bitcast i8* %235 to %struct.Item**
  %237 = getelementptr inbounds %struct.Item*, %struct.Item** %236, i64 %230
  %238 = load %struct.Item*, %struct.Item** %237, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %239 = getelementptr inbounds %struct.Item, %struct.Item* %238, i32 0, i32 1
  %240 = load double, double* %239, align 8, !tbaa !5
  %241 = call i8* @nish_str_from_f64(double %240)
  %242 = call i8* @nish_str_concat(i8* %228, i8* %241)
  %243 = call i8* @nish_str_concat(i8* %242, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %244 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %245 = fptosi double 0x40C3878000000000 to i64
  %246 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %244, i64 0, i32 0
  %247 = load i64, i64* %246, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %248 = icmp ult i64 %245, %247
  br i1 %248, label %bounds.ok.13, label %bounds.fail.13

bounds.fail.13:
  call void @nish_panic_index(i64 %245, i64 %247)
  unreachable

bounds.ok.13:
  %249 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %244, i64 0, i32 2
  %250 = load i8*, i8** %249, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %251 = bitcast i8* %250 to %struct.Item**
  %252 = getelementptr inbounds %struct.Item*, %struct.Item** %251, i64 %245
  %253 = load %struct.Item*, %struct.Item** %252, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %254 = getelementptr inbounds %struct.Item, %struct.Item* %253, i32 0, i32 0
  %255 = load double, double* %254, align 8, !tbaa !4
  %256 = call i8* @nish_str_from_f64(double %255)
  %257 = call i8* @nish_str_concat(i8* %243, i8* %256)
  %258 = call i8* @nish_str_concat(i8* %257, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %259 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %260 = fptosi double 0x40C3878000000000 to i64
  %261 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %259, i64 0, i32 2
  %262 = load i8*, i8** %261, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %263 = bitcast i8* %262 to %struct.Item**
  %264 = getelementptr inbounds %struct.Item*, %struct.Item** %263, i64 %260
  %265 = load %struct.Item*, %struct.Item** %264, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %266 = getelementptr inbounds %struct.Item, %struct.Item* %265, i32 0, i32 1
  %267 = load double, double* %266, align 8, !tbaa !5
  %268 = call i8* @nish_str_from_f64(double %267)
  %269 = call i8* @nish_str_concat(i8* %258, i8* %268)
  %270 = call i8* @nish_str_concat(i8* %269, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %271 = load double, double* %sum.addr, align 8
  %272 = call i8* @nish_str_from_f64(double %271)
  %273 = call i8* @nish_str_concat(i8* %270, i8* %272)
  call void @nish_print(i8* %273)
  ret void
}

define hidden noundef double @nish_main$arrow0(double noundef %a, double noundef %b) #3 {
entry:
  %0 = fsub double %a, %b
  %1 = fdiv double %0, 0x4010000000000000
  ret double %1
}

define hidden noundef double @nish_main$arrow1(double noundef %a, double noundef %b) #3 {
entry:
  %0 = fsub double %a, %b
  %1 = fdiv double 0x0000000000000000, 0x0000000000000000
  %2 = fmul double %0, %1
  ret double %2
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal noundef i32 @nish.stepTo(i32 noundef %lo, i32 noundef %step, i32 noundef %n) #3 {
entry:
  %0 = sub i32 %n, %lo
  %1 = icmp sgt i32 %0, %step
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = add i32 %lo, %step
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %2, %cond.true ], [ %n, %cond.false ]
  ret i32 %3
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #2 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %9 = load i64, i64* %forof.idx, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = icmp ult i64 %9, %11
  br i1 %12, label %forof.body, label %forof.end

forof.body:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %15 = bitcast i8* %14 to double*
  %16 = getelementptr inbounds double, double* %15, i64 %9
  %17 = load double, double* %16, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  store double %17, double* %x.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %19 = load double, double* %x.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %18, i64 8)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %27 = bitcast i8* %26 to double*
  %28 = getelementptr inbounds double, double* %27, i64 %21
  store double %19, double* %28, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %30 = sitofp i64 %29 to double
  br label %forof.inc

forof.inc:
  %31 = load i64, i64* %forof.idx, align 8
  %32 = add i64 %31, 1
  store i64 %32, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %33 = load i32, i32* %lo.addr, align 4
  %34 = icmp sge i32 %33, 0
  br i1 %34, label %land.rhs, label %land.end

land.rhs:
  %35 = load i32, i32* %lo.addr, align 4
  %36 = load i32, i32* %n.addr, align 4
  %37 = icmp slt i32 %35, %36
  br label %land.end

land.end:
  %38 = phi i1 [ false, %while.cond ], [ %37, %land.rhs ]
  br i1 %38, label %while.body, label %while.end

while.body:
  %39 = load i32, i32* %lo.addr, align 4
  %40 = load i32, i32* %n.addr, align 4
  %41 = call i32 @nish.stepTo(i32 %39, i32 32, i32 %40)
  store i32 %41, i32* %hi.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %43 = load i32, i32* %lo.addr, align 4
  %44 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$f64$fn.16.nish_main$arrow0(%struct.nish_array* %42, %struct.nish_array* %xs, i32 %43, i32 %44)
  %45 = load i32, i32* %hi.addr, align 4
  store i32 %45, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %46 = load i32, i32* %width.addr, align 4
  %47 = icmp sgt i32 %46, 0
  br i1 %47, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %48 = load i32, i32* %width.addr, align 4
  %49 = load i32, i32* %n.addr, align 4
  %50 = icmp slt i32 %48, %49
  br label %land.end.1

land.end.1:
  %51 = phi i1 [ false, %while.cond.1 ], [ %50, %land.rhs.1 ]
  br i1 %51, label %while.body.1, label %while.end.1

while.body.1:
  %52 = load i1, i1* %inTmp.addr, align 1
  br i1 %52, label %if.then.1, label %if.else

if.then.1:
  %53 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %54 = load i32, i32* %n.addr, align 4
  %55 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow0(%struct.nish_array* %53, %struct.nish_array* %xs, i32 %54, i32 %55)
  br label %if.end.1

if.else:
  %56 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %57 = load i32, i32* %n.addr, align 4
  %58 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow0(%struct.nish_array* %xs, %struct.nish_array* %56, i32 %57, i32 %58)
  br label %if.end.1

if.end.1:
  %59 = load i1, i1* %inTmp.addr, align 1
  %60 = xor i1 %59, true
  store i1 %60, i1* %inTmp.addr, align 1
  %61 = load i32, i32* %width.addr, align 4
  %62 = load i32, i32* %width.addr, align 4
  %63 = load i32, i32* %n.addr, align 4
  %64 = call i32 @nish.stepTo(i32 %61, i32 %62, i32 %63)
  store i32 %64, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %65 = load i1, i1* %inTmp.addr, align 1
  br i1 %65, label %if.then.2, label %if.end.2

if.then.2:
  %66 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %67 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %66, %struct.nish_array* %xs, i32 0, i32 %67)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #2 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %9 = load i64, i64* %forof.idx, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = icmp ult i64 %9, %11
  br i1 %12, label %forof.body, label %forof.end

forof.body:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %15 = bitcast i8* %14 to double*
  %16 = getelementptr inbounds double, double* %15, i64 %9
  %17 = load double, double* %16, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  store double %17, double* %x.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %19 = load double, double* %x.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %18, i64 8)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %27 = bitcast i8* %26 to double*
  %28 = getelementptr inbounds double, double* %27, i64 %21
  store double %19, double* %28, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %30 = sitofp i64 %29 to double
  br label %forof.inc

forof.inc:
  %31 = load i64, i64* %forof.idx, align 8
  %32 = add i64 %31, 1
  store i64 %32, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %33 = load i32, i32* %lo.addr, align 4
  %34 = icmp sge i32 %33, 0
  br i1 %34, label %land.rhs, label %land.end

land.rhs:
  %35 = load i32, i32* %lo.addr, align 4
  %36 = load i32, i32* %n.addr, align 4
  %37 = icmp slt i32 %35, %36
  br label %land.end

land.end:
  %38 = phi i1 [ false, %while.cond ], [ %37, %land.rhs ]
  br i1 %38, label %while.body, label %while.end

while.body:
  %39 = load i32, i32* %lo.addr, align 4
  %40 = load i32, i32* %n.addr, align 4
  %41 = call i32 @nish.stepTo(i32 %39, i32 32, i32 %40)
  store i32 %41, i32* %hi.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %43 = load i32, i32* %lo.addr, align 4
  %44 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$f64$fn.16.nish_main$arrow1(%struct.nish_array* %42, %struct.nish_array* %xs, i32 %43, i32 %44)
  %45 = load i32, i32* %hi.addr, align 4
  store i32 %45, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %46 = load i32, i32* %width.addr, align 4
  %47 = icmp sgt i32 %46, 0
  br i1 %47, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %48 = load i32, i32* %width.addr, align 4
  %49 = load i32, i32* %n.addr, align 4
  %50 = icmp slt i32 %48, %49
  br label %land.end.1

land.end.1:
  %51 = phi i1 [ false, %while.cond.1 ], [ %50, %land.rhs.1 ]
  br i1 %51, label %while.body.1, label %while.end.1

while.body.1:
  %52 = load i1, i1* %inTmp.addr, align 1
  br i1 %52, label %if.then.1, label %if.else

if.then.1:
  %53 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %54 = load i32, i32* %n.addr, align 4
  %55 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow1(%struct.nish_array* %53, %struct.nish_array* %xs, i32 %54, i32 %55)
  br label %if.end.1

if.else:
  %56 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %57 = load i32, i32* %n.addr, align 4
  %58 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$f64$fn.16.nish_main$arrow1(%struct.nish_array* %xs, %struct.nish_array* %56, i32 %57, i32 %58)
  br label %if.end.1

if.end.1:
  %59 = load i1, i1* %inTmp.addr, align 1
  %60 = xor i1 %59, true
  store i1 %60, i1* %inTmp.addr, align 1
  %61 = load i32, i32* %width.addr, align 4
  %62 = load i32, i32* %width.addr, align 4
  %63 = load i32, i32* %n.addr, align 4
  %64 = call i32 @nish.stepTo(i32 %61, i32 %62, i32 %63)
  store i32 %64, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %65 = load i1, i1* %inTmp.addr, align 1
  br i1 %65, label %if.then.2, label %if.end.2

if.then.2:
  %66 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %67 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$f64(%struct.nish_array* %66, %struct.nish_array* %xs, i32 0, i32 %67)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sortWith$$Item$fn.5.byKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #2 {
entry:
  %n.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca %struct.Item*, align 8
  %forof.idx = alloca i64, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %inTmp.addr = alloca i1, align 1
  %width.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs

if.end:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %9 = load i64, i64* %forof.idx, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = icmp ult i64 %9, %11
  br i1 %12, label %forof.body, label %forof.end

forof.body:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %15 = bitcast i8* %14 to %struct.Item**
  %16 = getelementptr inbounds %struct.Item*, %struct.Item** %15, i64 %9
  %17 = load %struct.Item*, %struct.Item** %16, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  store %struct.Item* %17, %struct.Item** %x.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %19 = load %struct.Item*, %struct.Item** %x.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %18, i64 8)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %27 = bitcast i8* %26 to %struct.Item**
  %28 = getelementptr inbounds %struct.Item*, %struct.Item** %27, i64 %21
  store %struct.Item* %19, %struct.Item** %28, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %30 = sitofp i64 %29 to double
  br label %forof.inc

forof.inc:
  %31 = load i64, i64* %forof.idx, align 8
  %32 = add i64 %31, 1
  store i64 %32, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %33 = load i32, i32* %lo.addr, align 4
  %34 = icmp sge i32 %33, 0
  br i1 %34, label %land.rhs, label %land.end

land.rhs:
  %35 = load i32, i32* %lo.addr, align 4
  %36 = load i32, i32* %n.addr, align 4
  %37 = icmp slt i32 %35, %36
  br label %land.end

land.end:
  %38 = phi i1 [ false, %while.cond ], [ %37, %land.rhs ]
  br i1 %38, label %while.body, label %while.end

while.body:
  %39 = load i32, i32* %lo.addr, align 4
  %40 = load i32, i32* %n.addr, align 4
  %41 = call i32 @nish.stepTo(i32 %39, i32 32, i32 %40)
  store i32 %41, i32* %hi.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %43 = load i32, i32* %lo.addr, align 4
  %44 = load i32, i32* %hi.addr, align 4
  call void @nish.insertionRun$$Item$fn.5.byKey(%struct.nish_array* %42, %struct.nish_array* %xs, i32 %43, i32 %44)
  %45 = load i32, i32* %hi.addr, align 4
  store i32 %45, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  store i1 false, i1* %inTmp.addr, align 1
  store i32 32, i32* %width.addr, align 4
  br label %while.cond.1

while.cond.1:
  %46 = load i32, i32* %width.addr, align 4
  %47 = icmp sgt i32 %46, 0
  br i1 %47, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %48 = load i32, i32* %width.addr, align 4
  %49 = load i32, i32* %n.addr, align 4
  %50 = icmp slt i32 %48, %49
  br label %land.end.1

land.end.1:
  %51 = phi i1 [ false, %while.cond.1 ], [ %50, %land.rhs.1 ]
  br i1 %51, label %while.body.1, label %while.end.1

while.body.1:
  %52 = load i1, i1* %inTmp.addr, align 1
  br i1 %52, label %if.then.1, label %if.else

if.then.1:
  %53 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %54 = load i32, i32* %n.addr, align 4
  %55 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$$Item$fn.5.byKey(%struct.nish_array* %53, %struct.nish_array* %xs, i32 %54, i32 %55)
  br label %if.end.1

if.else:
  %56 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %57 = load i32, i32* %n.addr, align 4
  %58 = load i32, i32* %width.addr, align 4
  call void @nish.mergePass$$Item$fn.5.byKey(%struct.nish_array* %xs, %struct.nish_array* %56, i32 %57, i32 %58)
  br label %if.end.1

if.end.1:
  %59 = load i1, i1* %inTmp.addr, align 1
  %60 = xor i1 %59, true
  store i1 %60, i1* %inTmp.addr, align 1
  %61 = load i32, i32* %width.addr, align 4
  %62 = load i32, i32* %width.addr, align 4
  %63 = load i32, i32* %n.addr, align 4
  %64 = call i32 @nish.stepTo(i32 %61, i32 %62, i32 %63)
  store i32 %64, i32* %width.addr, align 4
  br label %while.cond.1

while.end.1:
  %65 = load i1, i1* %inTmp.addr, align 1
  br i1 %65, label %if.then.2, label %if.end.2

if.then.2:
  %66 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %67 = load i32, i32* %n.addr, align 4
  call void @nish.copyRun$$Item(%struct.nish_array* %66, %struct.nish_array* %xs, i32 0, i32 %67)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.nish_array* %xs
}

define internal void @nish.insertionRun$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #2 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %d.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond

while.cond:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %d.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %d.addr, align 4
  %13 = sitofp i64 %4 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %12, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %land.end.1 ], [ %15, %land.rhs ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %d.addr, align 4
  %18 = sub nsw i32 %17, 1
  store i32 %18, i32* %p.addr, align 4
  %19 = load i32, i32* %p.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = bitcast i8* %6 to double*
  %22 = getelementptr inbounds double, double* %21, i64 %20
  %23 = load double, double* %22, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %24 = load i32, i32* %d.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %6 to double*
  %27 = getelementptr inbounds double, double* %26, i64 %25
  %28 = load double, double* %27, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %29 = call double @nish_main$arrow0(double %23, double %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br i1 %31, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %34 = load i32, i32* %d.addr, align 4
  %35 = icmp sge i32 %34, %hi
  br i1 %35, label %if.then.1, label %if.end.1

if.then.1:
  %36 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %hi, i32 1)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %37, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %47 = load i32, i32* %k.addr, align 4
  %48 = icmp sge i32 %47, 0
  br i1 %48, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %49 = load i32, i32* %k.addr, align 4
  %50 = icmp slt i32 %49, %hi
  br label %land.end.5

land.end.5:
  %51 = phi i1 [ false, %for.cond ], [ %50, %land.rhs.5 ]
  br i1 %51, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %52 = load i32, i32* %k.addr, align 4
  %53 = sitofp i64 %40 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = icmp slt i32 %52, %54
  br label %land.end.4

land.end.4:
  %56 = phi i1 [ false, %land.end.5 ], [ %55, %land.rhs.4 ]
  br i1 %56, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %57 = load i32, i32* %r.addr, align 4
  %58 = icmp sge i32 %57, 0
  br label %land.end.3

land.end.3:
  %59 = phi i1 [ false, %land.end.4 ], [ %58, %land.rhs.3 ]
  br i1 %59, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %60 = load i32, i32* %r.addr, align 4
  %61 = sitofp i64 %44 to double
  %62 = call i32 @llvm.fptosi.sat.i32.f64(double %61)
  %63 = icmp slt i32 %60, %62
  br label %land.end.2

land.end.2:
  %64 = phi i1 [ false, %land.end.3 ], [ %63, %land.rhs.2 ]
  br i1 %64, label %for.body, label %for.end

for.body:
  %65 = load i32, i32* %k.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = load i32, i32* %r.addr, align 4
  %68 = sext i32 %67 to i64
  %69 = bitcast i8* %46 to double*
  %70 = getelementptr inbounds double, double* %69, i64 %68
  %71 = load double, double* %70, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %72 = bitcast i8* %42 to double*
  %73 = getelementptr inbounds double, double* %72, i64 %66
  store double %71, double* %73, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %74 = load i32, i32* %r.addr, align 4
  %75 = sub nsw i32 %74, 1
  store i32 %75, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %76 = load i32, i32* %k.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond.1

for.cond.1:
  %86 = load i32, i32* %i.addr, align 4
  %87 = icmp sge i32 %86, 0
  br i1 %87, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %88 = load i32, i32* %i.addr, align 4
  %89 = icmp slt i32 %88, %hi
  br label %land.end.6

land.end.6:
  %90 = phi i1 [ false, %for.cond.1 ], [ %89, %land.rhs.6 ]
  br i1 %90, label %for.body.1, label %for.end.1

for.body.1:
  %91 = load i32, i32* %i.addr, align 4
  store i32 %91, i32* %j.addr, align 4
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond.1

while.cond.1:
  %100 = load i32, i32* %j.addr, align 4
  %101 = icmp sgt i32 %100, %lo
  br i1 %101, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %102 = load i32, i32* %j.addr, align 4
  %103 = icmp sgt i32 %102, 0
  br label %land.end.9

land.end.9:
  %104 = phi i1 [ false, %while.cond.1 ], [ %103, %land.rhs.9 ]
  br i1 %104, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %105 = load i32, i32* %j.addr, align 4
  %106 = sitofp i64 %93 to double
  %107 = call i32 @llvm.fptosi.sat.i32.f64(double %106)
  %108 = icmp slt i32 %105, %107
  br label %land.end.8

land.end.8:
  %109 = phi i1 [ false, %land.end.9 ], [ %108, %land.rhs.8 ]
  br i1 %109, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %110 = load i32, i32* %i.addr, align 4
  %111 = sitofp i64 %97 to double
  %112 = call i32 @llvm.fptosi.sat.i32.f64(double %111)
  %113 = icmp slt i32 %110, %112
  br label %land.end.7

land.end.7:
  %114 = phi i1 [ false, %land.end.8 ], [ %113, %land.rhs.7 ]
  br i1 %114, label %while.body.1, label %while.end.1

while.body.1:
  %115 = load i32, i32* %j.addr, align 4
  %116 = sub nsw i32 %115, 1
  store i32 %116, i32* %k.addr.1, align 4
  %117 = load i32, i32* %k.addr.1, align 4
  %118 = sext i32 %117 to i64
  %119 = bitcast i8* %95 to double*
  %120 = getelementptr inbounds double, double* %119, i64 %118
  %121 = load double, double* %120, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %122 = load i32, i32* %i.addr, align 4
  %123 = sext i32 %122 to i64
  %124 = bitcast i8* %99 to double*
  %125 = getelementptr inbounds double, double* %124, i64 %123
  %126 = load double, double* %125, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %127 = call double @nish_main$arrow0(double %121, double %126)
  %128 = fcmp ogt double %127, 0x0000000000000000
  %129 = xor i1 %128, true
  br i1 %129, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %130 = load i32, i32* %k.addr.1, align 4
  %131 = icmp slt i32 %130, 0
  br label %lor.end.2

lor.end.2:
  %132 = phi i1 [ true, %while.body.1 ], [ %131, %lor.rhs.2 ]
  br i1 %132, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %133 = load i32, i32* %k.addr.1, align 4
  %134 = sitofp i64 %93 to double
  %135 = call i32 @llvm.fptosi.sat.i32.f64(double %134)
  %136 = icmp sge i32 %133, %135
  br label %lor.end.1

lor.end.1:
  %137 = phi i1 [ true, %lor.end.2 ], [ %136, %lor.rhs.1 ]
  br i1 %137, label %lor.end, label %lor.rhs

lor.rhs:
  %138 = load i32, i32* %j.addr, align 4
  %139 = sitofp i64 %93 to double
  %140 = call i32 @llvm.fptosi.sat.i32.f64(double %139)
  %141 = icmp sge i32 %138, %140
  br label %lor.end

lor.end:
  %142 = phi i1 [ true, %lor.end.1 ], [ %141, %lor.rhs ]
  br i1 %142, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %143 = load i32, i32* %j.addr, align 4
  %144 = sext i32 %143 to i64
  %145 = load i32, i32* %k.addr.1, align 4
  %146 = sext i32 %145 to i64
  %147 = bitcast i8* %95 to double*
  %148 = getelementptr inbounds double, double* %147, i64 %146
  %149 = load double, double* %148, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %150 = bitcast i8* %95 to double*
  %151 = getelementptr inbounds double, double* %150, i64 %144
  store double %149, double* %151, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %152 = load i32, i32* %k.addr.1, align 4
  store i32 %152, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %153 = load i32, i32* %i.addr, align 4
  %154 = sitofp i64 %83 to double
  %155 = call i32 @llvm.fptosi.sat.i32.f64(double %154)
  %156 = icmp slt i32 %153, %155
  br i1 %156, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %157 = load i32, i32* %j.addr, align 4
  %158 = icmp sge i32 %157, 0
  br label %land.end.11

land.end.11:
  %159 = phi i1 [ false, %while.end.1 ], [ %158, %land.rhs.11 ]
  br i1 %159, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %160 = load i32, i32* %j.addr, align 4
  %161 = sitofp i64 %79 to double
  %162 = call i32 @llvm.fptosi.sat.i32.f64(double %161)
  %163 = icmp slt i32 %160, %162
  br label %land.end.10

land.end.10:
  %164 = phi i1 [ false, %land.end.11 ], [ %163, %land.rhs.10 ]
  br i1 %164, label %if.then.3, label %if.end.3

if.then.3:
  %165 = load i32, i32* %j.addr, align 4
  %166 = sext i32 %165 to i64
  %167 = load i32, i32* %i.addr, align 4
  %168 = sext i32 %167 to i64
  %169 = bitcast i8* %85 to double*
  %170 = getelementptr inbounds double, double* %169, i64 %168
  %171 = load double, double* %170, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %172 = bitcast i8* %81 to double*
  %173 = getelementptr inbounds double, double* %172, i64 %166
  store double %171, double* %173, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %174 = load i32, i32* %i.addr, align 4
  %175 = add nsw i32 %174, 1
  store i32 %175, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %if.then.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.mergePass$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #2 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$f64$fn.16.nish_main$arrow0(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.copyRun$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #2 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %lo, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %k.addr, align 4
  %14 = sitofp i64 %1 to double
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  %16 = icmp slt i32 %13, %15
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %land.end.2 ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %k.addr, align 4
  %19 = sitofp i64 %5 to double
  %20 = call i32 @llvm.fptosi.sat.i32.f64(double %19)
  %21 = icmp slt i32 %18, %20
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %for.body, label %for.end

for.body:
  %23 = load i32, i32* %k.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %k.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = bitcast i8* %3 to double*
  %28 = getelementptr inbounds double, double* %27, i64 %26
  %29 = load double, double* %28, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %30 = bitcast i8* %7 to double*
  %31 = getelementptr inbounds double, double* %30, i64 %24
  store double %29, double* %31, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  br label %for.inc

for.inc:
  %32 = load i32, i32* %k.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.insertionRun$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #2 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %d.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond

while.cond:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %d.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %d.addr, align 4
  %13 = sitofp i64 %4 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %12, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %land.end.1 ], [ %15, %land.rhs ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %d.addr, align 4
  %18 = sub nsw i32 %17, 1
  store i32 %18, i32* %p.addr, align 4
  %19 = load i32, i32* %p.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = bitcast i8* %6 to double*
  %22 = getelementptr inbounds double, double* %21, i64 %20
  %23 = load double, double* %22, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %24 = load i32, i32* %d.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %6 to double*
  %27 = getelementptr inbounds double, double* %26, i64 %25
  %28 = load double, double* %27, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %29 = call double @nish_main$arrow1(double %23, double %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br i1 %31, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %34 = load i32, i32* %d.addr, align 4
  %35 = icmp sge i32 %34, %hi
  br i1 %35, label %if.then.1, label %if.end.1

if.then.1:
  %36 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %hi, i32 1)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %37, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %47 = load i32, i32* %k.addr, align 4
  %48 = icmp sge i32 %47, 0
  br i1 %48, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %49 = load i32, i32* %k.addr, align 4
  %50 = icmp slt i32 %49, %hi
  br label %land.end.5

land.end.5:
  %51 = phi i1 [ false, %for.cond ], [ %50, %land.rhs.5 ]
  br i1 %51, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %52 = load i32, i32* %k.addr, align 4
  %53 = sitofp i64 %40 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = icmp slt i32 %52, %54
  br label %land.end.4

land.end.4:
  %56 = phi i1 [ false, %land.end.5 ], [ %55, %land.rhs.4 ]
  br i1 %56, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %57 = load i32, i32* %r.addr, align 4
  %58 = icmp sge i32 %57, 0
  br label %land.end.3

land.end.3:
  %59 = phi i1 [ false, %land.end.4 ], [ %58, %land.rhs.3 ]
  br i1 %59, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %60 = load i32, i32* %r.addr, align 4
  %61 = sitofp i64 %44 to double
  %62 = call i32 @llvm.fptosi.sat.i32.f64(double %61)
  %63 = icmp slt i32 %60, %62
  br label %land.end.2

land.end.2:
  %64 = phi i1 [ false, %land.end.3 ], [ %63, %land.rhs.2 ]
  br i1 %64, label %for.body, label %for.end

for.body:
  %65 = load i32, i32* %k.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = load i32, i32* %r.addr, align 4
  %68 = sext i32 %67 to i64
  %69 = bitcast i8* %46 to double*
  %70 = getelementptr inbounds double, double* %69, i64 %68
  %71 = load double, double* %70, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %72 = bitcast i8* %42 to double*
  %73 = getelementptr inbounds double, double* %72, i64 %66
  store double %71, double* %73, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %74 = load i32, i32* %r.addr, align 4
  %75 = sub nsw i32 %74, 1
  store i32 %75, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %76 = load i32, i32* %k.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond.1

for.cond.1:
  %86 = load i32, i32* %i.addr, align 4
  %87 = icmp sge i32 %86, 0
  br i1 %87, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %88 = load i32, i32* %i.addr, align 4
  %89 = icmp slt i32 %88, %hi
  br label %land.end.6

land.end.6:
  %90 = phi i1 [ false, %for.cond.1 ], [ %89, %land.rhs.6 ]
  br i1 %90, label %for.body.1, label %for.end.1

for.body.1:
  %91 = load i32, i32* %i.addr, align 4
  store i32 %91, i32* %j.addr, align 4
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond.1

while.cond.1:
  %100 = load i32, i32* %j.addr, align 4
  %101 = icmp sgt i32 %100, %lo
  br i1 %101, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %102 = load i32, i32* %j.addr, align 4
  %103 = icmp sgt i32 %102, 0
  br label %land.end.9

land.end.9:
  %104 = phi i1 [ false, %while.cond.1 ], [ %103, %land.rhs.9 ]
  br i1 %104, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %105 = load i32, i32* %j.addr, align 4
  %106 = sitofp i64 %93 to double
  %107 = call i32 @llvm.fptosi.sat.i32.f64(double %106)
  %108 = icmp slt i32 %105, %107
  br label %land.end.8

land.end.8:
  %109 = phi i1 [ false, %land.end.9 ], [ %108, %land.rhs.8 ]
  br i1 %109, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %110 = load i32, i32* %i.addr, align 4
  %111 = sitofp i64 %97 to double
  %112 = call i32 @llvm.fptosi.sat.i32.f64(double %111)
  %113 = icmp slt i32 %110, %112
  br label %land.end.7

land.end.7:
  %114 = phi i1 [ false, %land.end.8 ], [ %113, %land.rhs.7 ]
  br i1 %114, label %while.body.1, label %while.end.1

while.body.1:
  %115 = load i32, i32* %j.addr, align 4
  %116 = sub nsw i32 %115, 1
  store i32 %116, i32* %k.addr.1, align 4
  %117 = load i32, i32* %k.addr.1, align 4
  %118 = sext i32 %117 to i64
  %119 = bitcast i8* %95 to double*
  %120 = getelementptr inbounds double, double* %119, i64 %118
  %121 = load double, double* %120, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %122 = load i32, i32* %i.addr, align 4
  %123 = sext i32 %122 to i64
  %124 = bitcast i8* %99 to double*
  %125 = getelementptr inbounds double, double* %124, i64 %123
  %126 = load double, double* %125, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %127 = call double @nish_main$arrow1(double %121, double %126)
  %128 = fcmp ogt double %127, 0x0000000000000000
  %129 = xor i1 %128, true
  br i1 %129, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %130 = load i32, i32* %k.addr.1, align 4
  %131 = icmp slt i32 %130, 0
  br label %lor.end.2

lor.end.2:
  %132 = phi i1 [ true, %while.body.1 ], [ %131, %lor.rhs.2 ]
  br i1 %132, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %133 = load i32, i32* %k.addr.1, align 4
  %134 = sitofp i64 %93 to double
  %135 = call i32 @llvm.fptosi.sat.i32.f64(double %134)
  %136 = icmp sge i32 %133, %135
  br label %lor.end.1

lor.end.1:
  %137 = phi i1 [ true, %lor.end.2 ], [ %136, %lor.rhs.1 ]
  br i1 %137, label %lor.end, label %lor.rhs

lor.rhs:
  %138 = load i32, i32* %j.addr, align 4
  %139 = sitofp i64 %93 to double
  %140 = call i32 @llvm.fptosi.sat.i32.f64(double %139)
  %141 = icmp sge i32 %138, %140
  br label %lor.end

lor.end:
  %142 = phi i1 [ true, %lor.end.1 ], [ %141, %lor.rhs ]
  br i1 %142, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %143 = load i32, i32* %j.addr, align 4
  %144 = sext i32 %143 to i64
  %145 = load i32, i32* %k.addr.1, align 4
  %146 = sext i32 %145 to i64
  %147 = bitcast i8* %95 to double*
  %148 = getelementptr inbounds double, double* %147, i64 %146
  %149 = load double, double* %148, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %150 = bitcast i8* %95 to double*
  %151 = getelementptr inbounds double, double* %150, i64 %144
  store double %149, double* %151, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %152 = load i32, i32* %k.addr.1, align 4
  store i32 %152, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %153 = load i32, i32* %i.addr, align 4
  %154 = sitofp i64 %83 to double
  %155 = call i32 @llvm.fptosi.sat.i32.f64(double %154)
  %156 = icmp slt i32 %153, %155
  br i1 %156, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %157 = load i32, i32* %j.addr, align 4
  %158 = icmp sge i32 %157, 0
  br label %land.end.11

land.end.11:
  %159 = phi i1 [ false, %while.end.1 ], [ %158, %land.rhs.11 ]
  br i1 %159, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %160 = load i32, i32* %j.addr, align 4
  %161 = sitofp i64 %79 to double
  %162 = call i32 @llvm.fptosi.sat.i32.f64(double %161)
  %163 = icmp slt i32 %160, %162
  br label %land.end.10

land.end.10:
  %164 = phi i1 [ false, %land.end.11 ], [ %163, %land.rhs.10 ]
  br i1 %164, label %if.then.3, label %if.end.3

if.then.3:
  %165 = load i32, i32* %j.addr, align 4
  %166 = sext i32 %165 to i64
  %167 = load i32, i32* %i.addr, align 4
  %168 = sext i32 %167 to i64
  %169 = bitcast i8* %85 to double*
  %170 = getelementptr inbounds double, double* %169, i64 %168
  %171 = load double, double* %170, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %172 = bitcast i8* %81 to double*
  %173 = getelementptr inbounds double, double* %172, i64 %166
  store double %171, double* %173, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %174 = load i32, i32* %i.addr, align 4
  %175 = add nsw i32 %174, 1
  store i32 %175, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %if.then.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.mergePass$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #2 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$f64$fn.16.nish_main$arrow1(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.insertionRun$$Item$fn.5.byKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #2 {
entry:
  %d.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %lo, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %d.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond

while.cond:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br i1 %8, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %9 = load i32, i32* %d.addr, align 4
  %10 = icmp slt i32 %9, %hi
  br label %land.end.1

land.end.1:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs.1 ]
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %d.addr, align 4
  %13 = sitofp i64 %4 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %12, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %land.end.1 ], [ %15, %land.rhs ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %d.addr, align 4
  %18 = sub nsw i32 %17, 1
  store i32 %18, i32* %p.addr, align 4
  %19 = load i32, i32* %p.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = bitcast i8* %6 to %struct.Item**
  %22 = getelementptr inbounds %struct.Item*, %struct.Item** %21, i64 %20
  %23 = load %struct.Item*, %struct.Item** %22, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %24 = load i32, i32* %d.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %6 to %struct.Item**
  %27 = getelementptr inbounds %struct.Item*, %struct.Item** %26, i64 %25
  %28 = load %struct.Item*, %struct.Item** %27, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %29 = call double @byKey$(%struct.Item* %23, %struct.Item* %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br i1 %31, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %34 = load i32, i32* %d.addr, align 4
  %35 = icmp sge i32 %34, %hi
  br i1 %35, label %if.then.1, label %if.end.1

if.then.1:
  %36 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %hi, i32 1)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %37, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %47 = load i32, i32* %k.addr, align 4
  %48 = icmp sge i32 %47, 0
  br i1 %48, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %49 = load i32, i32* %k.addr, align 4
  %50 = icmp slt i32 %49, %hi
  br label %land.end.5

land.end.5:
  %51 = phi i1 [ false, %for.cond ], [ %50, %land.rhs.5 ]
  br i1 %51, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %52 = load i32, i32* %k.addr, align 4
  %53 = sitofp i64 %40 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = icmp slt i32 %52, %54
  br label %land.end.4

land.end.4:
  %56 = phi i1 [ false, %land.end.5 ], [ %55, %land.rhs.4 ]
  br i1 %56, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %57 = load i32, i32* %r.addr, align 4
  %58 = icmp sge i32 %57, 0
  br label %land.end.3

land.end.3:
  %59 = phi i1 [ false, %land.end.4 ], [ %58, %land.rhs.3 ]
  br i1 %59, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %60 = load i32, i32* %r.addr, align 4
  %61 = sitofp i64 %44 to double
  %62 = call i32 @llvm.fptosi.sat.i32.f64(double %61)
  %63 = icmp slt i32 %60, %62
  br label %land.end.2

land.end.2:
  %64 = phi i1 [ false, %land.end.3 ], [ %63, %land.rhs.2 ]
  br i1 %64, label %for.body, label %for.end

for.body:
  %65 = load i32, i32* %k.addr, align 4
  %66 = sext i32 %65 to i64
  %67 = load i32, i32* %r.addr, align 4
  %68 = sext i32 %67 to i64
  %69 = bitcast i8* %46 to %struct.Item**
  %70 = getelementptr inbounds %struct.Item*, %struct.Item** %69, i64 %68
  %71 = load %struct.Item*, %struct.Item** %70, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %72 = bitcast i8* %42 to %struct.Item**
  %73 = getelementptr inbounds %struct.Item*, %struct.Item** %72, i64 %66
  store %struct.Item* %71, %struct.Item** %73, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %74 = load i32, i32* %r.addr, align 4
  %75 = sub nsw i32 %74, 1
  store i32 %75, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %76 = load i32, i32* %k.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond.1

for.cond.1:
  %86 = load i32, i32* %i.addr, align 4
  %87 = icmp sge i32 %86, 0
  br i1 %87, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %88 = load i32, i32* %i.addr, align 4
  %89 = icmp slt i32 %88, %hi
  br label %land.end.6

land.end.6:
  %90 = phi i1 [ false, %for.cond.1 ], [ %89, %land.rhs.6 ]
  br i1 %90, label %for.body.1, label %for.end.1

for.body.1:
  %91 = load i32, i32* %i.addr, align 4
  store i32 %91, i32* %j.addr, align 4
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond.1

while.cond.1:
  %100 = load i32, i32* %j.addr, align 4
  %101 = icmp sgt i32 %100, %lo
  br i1 %101, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %102 = load i32, i32* %j.addr, align 4
  %103 = icmp sgt i32 %102, 0
  br label %land.end.9

land.end.9:
  %104 = phi i1 [ false, %while.cond.1 ], [ %103, %land.rhs.9 ]
  br i1 %104, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %105 = load i32, i32* %j.addr, align 4
  %106 = sitofp i64 %93 to double
  %107 = call i32 @llvm.fptosi.sat.i32.f64(double %106)
  %108 = icmp slt i32 %105, %107
  br label %land.end.8

land.end.8:
  %109 = phi i1 [ false, %land.end.9 ], [ %108, %land.rhs.8 ]
  br i1 %109, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %110 = load i32, i32* %i.addr, align 4
  %111 = sitofp i64 %97 to double
  %112 = call i32 @llvm.fptosi.sat.i32.f64(double %111)
  %113 = icmp slt i32 %110, %112
  br label %land.end.7

land.end.7:
  %114 = phi i1 [ false, %land.end.8 ], [ %113, %land.rhs.7 ]
  br i1 %114, label %while.body.1, label %while.end.1

while.body.1:
  %115 = load i32, i32* %j.addr, align 4
  %116 = sub nsw i32 %115, 1
  store i32 %116, i32* %k.addr.1, align 4
  %117 = load i32, i32* %k.addr.1, align 4
  %118 = sext i32 %117 to i64
  %119 = bitcast i8* %95 to %struct.Item**
  %120 = getelementptr inbounds %struct.Item*, %struct.Item** %119, i64 %118
  %121 = load %struct.Item*, %struct.Item** %120, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %122 = load i32, i32* %i.addr, align 4
  %123 = sext i32 %122 to i64
  %124 = bitcast i8* %99 to %struct.Item**
  %125 = getelementptr inbounds %struct.Item*, %struct.Item** %124, i64 %123
  %126 = load %struct.Item*, %struct.Item** %125, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %127 = call double @byKey$(%struct.Item* %121, %struct.Item* %126)
  %128 = fcmp ogt double %127, 0x0000000000000000
  %129 = xor i1 %128, true
  br i1 %129, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %130 = load i32, i32* %k.addr.1, align 4
  %131 = icmp slt i32 %130, 0
  br label %lor.end.2

lor.end.2:
  %132 = phi i1 [ true, %while.body.1 ], [ %131, %lor.rhs.2 ]
  br i1 %132, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %133 = load i32, i32* %k.addr.1, align 4
  %134 = sitofp i64 %93 to double
  %135 = call i32 @llvm.fptosi.sat.i32.f64(double %134)
  %136 = icmp sge i32 %133, %135
  br label %lor.end.1

lor.end.1:
  %137 = phi i1 [ true, %lor.end.2 ], [ %136, %lor.rhs.1 ]
  br i1 %137, label %lor.end, label %lor.rhs

lor.rhs:
  %138 = load i32, i32* %j.addr, align 4
  %139 = sitofp i64 %93 to double
  %140 = call i32 @llvm.fptosi.sat.i32.f64(double %139)
  %141 = icmp sge i32 %138, %140
  br label %lor.end

lor.end:
  %142 = phi i1 [ true, %lor.end.1 ], [ %141, %lor.rhs ]
  br i1 %142, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %143 = load i32, i32* %j.addr, align 4
  %144 = sext i32 %143 to i64
  %145 = load i32, i32* %k.addr.1, align 4
  %146 = sext i32 %145 to i64
  %147 = bitcast i8* %95 to %struct.Item**
  %148 = getelementptr inbounds %struct.Item*, %struct.Item** %147, i64 %146
  %149 = load %struct.Item*, %struct.Item** %148, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %150 = bitcast i8* %95 to %struct.Item**
  %151 = getelementptr inbounds %struct.Item*, %struct.Item** %150, i64 %144
  store %struct.Item* %149, %struct.Item** %151, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %152 = load i32, i32* %k.addr.1, align 4
  store i32 %152, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %153 = load i32, i32* %i.addr, align 4
  %154 = sitofp i64 %83 to double
  %155 = call i32 @llvm.fptosi.sat.i32.f64(double %154)
  %156 = icmp slt i32 %153, %155
  br i1 %156, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %157 = load i32, i32* %j.addr, align 4
  %158 = icmp sge i32 %157, 0
  br label %land.end.11

land.end.11:
  %159 = phi i1 [ false, %while.end.1 ], [ %158, %land.rhs.11 ]
  br i1 %159, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %160 = load i32, i32* %j.addr, align 4
  %161 = sitofp i64 %79 to double
  %162 = call i32 @llvm.fptosi.sat.i32.f64(double %161)
  %163 = icmp slt i32 %160, %162
  br label %land.end.10

land.end.10:
  %164 = phi i1 [ false, %land.end.11 ], [ %163, %land.rhs.10 ]
  br i1 %164, label %if.then.3, label %if.end.3

if.then.3:
  %165 = load i32, i32* %j.addr, align 4
  %166 = sext i32 %165 to i64
  %167 = load i32, i32* %i.addr, align 4
  %168 = sext i32 %167 to i64
  %169 = bitcast i8* %85 to %struct.Item**
  %170 = getelementptr inbounds %struct.Item*, %struct.Item** %169, i64 %168
  %171 = load %struct.Item*, %struct.Item** %170, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %172 = bitcast i8* %81 to %struct.Item**
  %173 = getelementptr inbounds %struct.Item*, %struct.Item** %172, i64 %166
  store %struct.Item* %171, %struct.Item** %173, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %174 = load i32, i32* %i.addr, align 4
  %175 = add nsw i32 %174, 1
  store i32 %175, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %if.then.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.mergePass$$Item$fn.5.byKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %n, i32 noundef %width) #2 {
entry:
  %lo.addr = alloca i32, align 4
  %mid.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  store i32 0, i32* %lo.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %lo.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = load i32, i32* %lo.addr, align 4
  %3 = icmp slt i32 %2, %n
  br label %land.end

land.end:
  %4 = phi i1 [ false, %while.cond ], [ %3, %land.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %lo.addr, align 4
  %6 = call i32 @nish.stepTo(i32 %5, i32 %width, i32 %n)
  store i32 %6, i32* %mid.addr, align 4
  %7 = load i32, i32* %mid.addr, align 4
  %8 = call i32 @nish.stepTo(i32 %7, i32 %width, i32 %n)
  store i32 %8, i32* %hi.addr, align 4
  %9 = load i32, i32* %lo.addr, align 4
  %10 = load i32, i32* %mid.addr, align 4
  %11 = load i32, i32* %hi.addr, align 4
  call void @nish.mergeRuns$$Item$fn.5.byKey(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %9, i32 %10, i32 %11)
  %12 = load i32, i32* %hi.addr, align 4
  store i32 %12, i32* %lo.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.copyRun$$Item(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #2 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %lo, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %k.addr, align 4
  %14 = sitofp i64 %1 to double
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  %16 = icmp slt i32 %13, %15
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %land.end.2 ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %k.addr, align 4
  %19 = sitofp i64 %5 to double
  %20 = call i32 @llvm.fptosi.sat.i32.f64(double %19)
  %21 = icmp slt i32 %18, %20
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %for.body, label %for.end

for.body:
  %23 = load i32, i32* %k.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %k.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = bitcast i8* %3 to %struct.Item**
  %28 = getelementptr inbounds %struct.Item*, %struct.Item** %27, i64 %26
  %29 = load %struct.Item*, %struct.Item** %28, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %30 = bitcast i8* %7 to %struct.Item**
  %31 = getelementptr inbounds %struct.Item*, %struct.Item** %30, i64 %24
  store %struct.Item* %29, %struct.Item** %31, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  br label %for.inc

for.inc:
  %32 = load i32, i32* %k.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #2 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %mid, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = sub nsw i32 %mid, 1
  store i32 %9, i32* %last.addr, align 4
  %10 = load i32, i32* %last.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = sitofp i64 %12 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %10, %14
  br i1 %15, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %16 = load i32, i32* %last.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %20 = bitcast i8* %19 to double*
  %21 = getelementptr inbounds double, double* %20, i64 %17
  %22 = load double, double* %21, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %23 = sext i32 %mid to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %26 = bitcast i8* %25 to double*
  %27 = getelementptr inbounds double, double* %26, i64 %23
  %28 = load double, double* %27, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %29 = call double @nish_main$arrow0(double %22, double %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %if.then ], [ %31, %land.rhs.2 ]
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$f64(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp sge i32 %41, 0
  br i1 %42, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp slt i32 %43, %hi
  br label %land.end.3

land.end.3:
  %45 = phi i1 [ false, %for.cond ], [ %44, %land.rhs.3 ]
  br i1 %45, label %for.body, label %for.end

for.body:
  %46 = load i32, i32* %i.addr, align 4
  %47 = icmp sge i32 %46, %mid
  store i1 %47, i1* %right.addr, align 1
  %48 = load i1, i1* %right.addr, align 1
  %49 = xor i1 %48, true
  br i1 %49, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %50 = load i32, i32* %j.addr, align 4
  %51 = icmp slt i32 %50, %hi
  br label %land.end.8

land.end.8:
  %52 = phi i1 [ false, %for.body ], [ %51, %land.rhs.8 ]
  br i1 %52, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %53 = load i32, i32* %i.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.7

land.end.7:
  %55 = phi i1 [ false, %land.end.8 ], [ %54, %land.rhs.7 ]
  br i1 %55, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %56 = load i32, i32* %i.addr, align 4
  %57 = sitofp i64 %34 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.6

land.end.6:
  %60 = phi i1 [ false, %land.end.7 ], [ %59, %land.rhs.6 ]
  br i1 %60, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %61 = load i32, i32* %j.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.5

land.end.5:
  %63 = phi i1 [ false, %land.end.6 ], [ %62, %land.rhs.5 ]
  br i1 %63, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %64 = load i32, i32* %j.addr, align 4
  %65 = sitofp i64 %34 to double
  %66 = call i32 @llvm.fptosi.sat.i32.f64(double %65)
  %67 = icmp slt i32 %64, %66
  br label %land.end.4

land.end.4:
  %68 = phi i1 [ false, %land.end.5 ], [ %67, %land.rhs.4 ]
  br i1 %68, label %if.then.2, label %if.end.2

if.then.2:
  %69 = load i32, i32* %i.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %36 to double*
  %72 = getelementptr inbounds double, double* %71, i64 %70
  %73 = load double, double* %72, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %74 = load i32, i32* %j.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %36 to double*
  %77 = getelementptr inbounds double, double* %76, i64 %75
  %78 = load double, double* %77, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %79 = call double @nish_main$arrow0(double %73, double %78)
  %80 = fcmp ogt double %79, 0x0000000000000000
  store i1 %80, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %81 = load i1, i1* %right.addr, align 1
  br i1 %81, label %if.then.3, label %if.else

if.then.3:
  %82 = load i32, i32* %j.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %84 = load i32, i32* %j.addr, align 4
  %85 = sitofp i64 %34 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = icmp slt i32 %84, %86
  br label %land.end.10

land.end.10:
  %88 = phi i1 [ false, %if.then.3 ], [ %87, %land.rhs.10 ]
  br i1 %88, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %89 = load i32, i32* %k.addr, align 4
  %90 = sitofp i64 %38 to double
  %91 = call i32 @llvm.fptosi.sat.i32.f64(double %90)
  %92 = icmp slt i32 %89, %91
  br label %land.end.9

land.end.9:
  %93 = phi i1 [ false, %land.end.10 ], [ %92, %land.rhs.9 ]
  br i1 %93, label %if.then.4, label %if.end.4

if.then.4:
  %94 = load i32, i32* %k.addr, align 4
  %95 = sext i32 %94 to i64
  %96 = load i32, i32* %j.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = bitcast i8* %36 to double*
  %99 = getelementptr inbounds double, double* %98, i64 %97
  %100 = load double, double* %99, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %101 = bitcast i8* %40 to double*
  %102 = getelementptr inbounds double, double* %101, i64 %95
  store double %100, double* %102, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  br label %if.end.4

if.end.4:
  %103 = load i32, i32* %j.addr, align 4
  %104 = add i32 %103, 1
  store i32 %104, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %105 = load i32, i32* %i.addr, align 4
  %106 = icmp sge i32 %105, 0
  br i1 %106, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %107 = load i32, i32* %i.addr, align 4
  %108 = sitofp i64 %34 to double
  %109 = call i32 @llvm.fptosi.sat.i32.f64(double %108)
  %110 = icmp slt i32 %107, %109
  br label %land.end.12

land.end.12:
  %111 = phi i1 [ false, %if.else ], [ %110, %land.rhs.12 ]
  br i1 %111, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %112 = load i32, i32* %k.addr, align 4
  %113 = sitofp i64 %38 to double
  %114 = call i32 @llvm.fptosi.sat.i32.f64(double %113)
  %115 = icmp slt i32 %112, %114
  br label %land.end.11

land.end.11:
  %116 = phi i1 [ false, %land.end.12 ], [ %115, %land.rhs.11 ]
  br i1 %116, label %if.then.5, label %if.end.5

if.then.5:
  %117 = load i32, i32* %k.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = load i32, i32* %i.addr, align 4
  %120 = sext i32 %119 to i64
  %121 = bitcast i8* %36 to double*
  %122 = getelementptr inbounds double, double* %121, i64 %120
  %123 = load double, double* %122, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %124 = bitcast i8* %40 to double*
  %125 = getelementptr inbounds double, double* %124, i64 %118
  store double %123, double* %125, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  br label %if.end.5

if.end.5:
  %126 = load i32, i32* %i.addr, align 4
  %127 = add i32 %126, 1
  store i32 %127, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %128 = load i32, i32* %k.addr, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #2 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %mid, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = sub nsw i32 %mid, 1
  store i32 %9, i32* %last.addr, align 4
  %10 = load i32, i32* %last.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = sitofp i64 %12 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %10, %14
  br i1 %15, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %16 = load i32, i32* %last.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %20 = bitcast i8* %19 to double*
  %21 = getelementptr inbounds double, double* %20, i64 %17
  %22 = load double, double* %21, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %23 = sext i32 %mid to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %26 = bitcast i8* %25 to double*
  %27 = getelementptr inbounds double, double* %26, i64 %23
  %28 = load double, double* %27, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %29 = call double @nish_main$arrow1(double %22, double %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %if.then ], [ %31, %land.rhs.2 ]
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$f64(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp sge i32 %41, 0
  br i1 %42, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp slt i32 %43, %hi
  br label %land.end.3

land.end.3:
  %45 = phi i1 [ false, %for.cond ], [ %44, %land.rhs.3 ]
  br i1 %45, label %for.body, label %for.end

for.body:
  %46 = load i32, i32* %i.addr, align 4
  %47 = icmp sge i32 %46, %mid
  store i1 %47, i1* %right.addr, align 1
  %48 = load i1, i1* %right.addr, align 1
  %49 = xor i1 %48, true
  br i1 %49, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %50 = load i32, i32* %j.addr, align 4
  %51 = icmp slt i32 %50, %hi
  br label %land.end.8

land.end.8:
  %52 = phi i1 [ false, %for.body ], [ %51, %land.rhs.8 ]
  br i1 %52, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %53 = load i32, i32* %i.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.7

land.end.7:
  %55 = phi i1 [ false, %land.end.8 ], [ %54, %land.rhs.7 ]
  br i1 %55, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %56 = load i32, i32* %i.addr, align 4
  %57 = sitofp i64 %34 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.6

land.end.6:
  %60 = phi i1 [ false, %land.end.7 ], [ %59, %land.rhs.6 ]
  br i1 %60, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %61 = load i32, i32* %j.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.5

land.end.5:
  %63 = phi i1 [ false, %land.end.6 ], [ %62, %land.rhs.5 ]
  br i1 %63, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %64 = load i32, i32* %j.addr, align 4
  %65 = sitofp i64 %34 to double
  %66 = call i32 @llvm.fptosi.sat.i32.f64(double %65)
  %67 = icmp slt i32 %64, %66
  br label %land.end.4

land.end.4:
  %68 = phi i1 [ false, %land.end.5 ], [ %67, %land.rhs.4 ]
  br i1 %68, label %if.then.2, label %if.end.2

if.then.2:
  %69 = load i32, i32* %i.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %36 to double*
  %72 = getelementptr inbounds double, double* %71, i64 %70
  %73 = load double, double* %72, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %74 = load i32, i32* %j.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %36 to double*
  %77 = getelementptr inbounds double, double* %76, i64 %75
  %78 = load double, double* %77, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %79 = call double @nish_main$arrow1(double %73, double %78)
  %80 = fcmp ogt double %79, 0x0000000000000000
  store i1 %80, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %81 = load i1, i1* %right.addr, align 1
  br i1 %81, label %if.then.3, label %if.else

if.then.3:
  %82 = load i32, i32* %j.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %84 = load i32, i32* %j.addr, align 4
  %85 = sitofp i64 %34 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = icmp slt i32 %84, %86
  br label %land.end.10

land.end.10:
  %88 = phi i1 [ false, %if.then.3 ], [ %87, %land.rhs.10 ]
  br i1 %88, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %89 = load i32, i32* %k.addr, align 4
  %90 = sitofp i64 %38 to double
  %91 = call i32 @llvm.fptosi.sat.i32.f64(double %90)
  %92 = icmp slt i32 %89, %91
  br label %land.end.9

land.end.9:
  %93 = phi i1 [ false, %land.end.10 ], [ %92, %land.rhs.9 ]
  br i1 %93, label %if.then.4, label %if.end.4

if.then.4:
  %94 = load i32, i32* %k.addr, align 4
  %95 = sext i32 %94 to i64
  %96 = load i32, i32* %j.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = bitcast i8* %36 to double*
  %99 = getelementptr inbounds double, double* %98, i64 %97
  %100 = load double, double* %99, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %101 = bitcast i8* %40 to double*
  %102 = getelementptr inbounds double, double* %101, i64 %95
  store double %100, double* %102, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  br label %if.end.4

if.end.4:
  %103 = load i32, i32* %j.addr, align 4
  %104 = add i32 %103, 1
  store i32 %104, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %105 = load i32, i32* %i.addr, align 4
  %106 = icmp sge i32 %105, 0
  br i1 %106, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %107 = load i32, i32* %i.addr, align 4
  %108 = sitofp i64 %34 to double
  %109 = call i32 @llvm.fptosi.sat.i32.f64(double %108)
  %110 = icmp slt i32 %107, %109
  br label %land.end.12

land.end.12:
  %111 = phi i1 [ false, %if.else ], [ %110, %land.rhs.12 ]
  br i1 %111, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %112 = load i32, i32* %k.addr, align 4
  %113 = sitofp i64 %38 to double
  %114 = call i32 @llvm.fptosi.sat.i32.f64(double %113)
  %115 = icmp slt i32 %112, %114
  br label %land.end.11

land.end.11:
  %116 = phi i1 [ false, %land.end.12 ], [ %115, %land.rhs.11 ]
  br i1 %116, label %if.then.5, label %if.end.5

if.then.5:
  %117 = load i32, i32* %k.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = load i32, i32* %i.addr, align 4
  %120 = sext i32 %119 to i64
  %121 = bitcast i8* %36 to double*
  %122 = getelementptr inbounds double, double* %121, i64 %120
  %123 = load double, double* %122, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %124 = bitcast i8* %40 to double*
  %125 = getelementptr inbounds double, double* %124, i64 %118
  store double %123, double* %125, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  br label %if.end.5

if.end.5:
  %126 = load i32, i32* %i.addr, align 4
  %127 = add i32 %126, 1
  store i32 %127, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %128 = load i32, i32* %k.addr, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.mergeRuns$$Item$fn.5.byKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %mid, i32 noundef %hi) #2 {
entry:
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %right.addr = alloca i1, align 1
  %0 = icmp sgt i32 %mid, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %mid, %hi
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %mid, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = sub nsw i32 %mid, 1
  store i32 %9, i32* %last.addr, align 4
  %10 = load i32, i32* %last.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = sitofp i64 %12 to double
  %14 = call i32 @llvm.fptosi.sat.i32.f64(double %13)
  %15 = icmp slt i32 %10, %14
  br i1 %15, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %16 = load i32, i32* %last.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %20 = bitcast i8* %19 to %struct.Item**
  %21 = getelementptr inbounds %struct.Item*, %struct.Item** %20, i64 %17
  %22 = load %struct.Item*, %struct.Item** %21, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %23 = sext i32 %mid to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %26 = bitcast i8* %25 to %struct.Item**
  %27 = getelementptr inbounds %struct.Item*, %struct.Item** %26, i64 %23
  %28 = load %struct.Item*, %struct.Item** %27, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %29 = call double @byKey$(%struct.Item* %22, %struct.Item* %28)
  %30 = fcmp ogt double %29, 0x0000000000000000
  %31 = xor i1 %30, true
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %if.then ], [ %31, %land.rhs.2 ]
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.copyRun$$Item(%struct.nish_array* %src, %struct.nish_array* %dst, i32 %lo, i32 %hi)
  ret void

if.end.1:
  br label %if.end

if.end:
  store i32 %lo, i32* %i.addr, align 4
  store i32 %mid, i32* %j.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %41 = load i32, i32* %k.addr, align 4
  %42 = icmp sge i32 %41, 0
  br i1 %42, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp slt i32 %43, %hi
  br label %land.end.3

land.end.3:
  %45 = phi i1 [ false, %for.cond ], [ %44, %land.rhs.3 ]
  br i1 %45, label %for.body, label %for.end

for.body:
  %46 = load i32, i32* %i.addr, align 4
  %47 = icmp sge i32 %46, %mid
  store i1 %47, i1* %right.addr, align 1
  %48 = load i1, i1* %right.addr, align 1
  %49 = xor i1 %48, true
  br i1 %49, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %50 = load i32, i32* %j.addr, align 4
  %51 = icmp slt i32 %50, %hi
  br label %land.end.8

land.end.8:
  %52 = phi i1 [ false, %for.body ], [ %51, %land.rhs.8 ]
  br i1 %52, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %53 = load i32, i32* %i.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.7

land.end.7:
  %55 = phi i1 [ false, %land.end.8 ], [ %54, %land.rhs.7 ]
  br i1 %55, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %56 = load i32, i32* %i.addr, align 4
  %57 = sitofp i64 %34 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.6

land.end.6:
  %60 = phi i1 [ false, %land.end.7 ], [ %59, %land.rhs.6 ]
  br i1 %60, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %61 = load i32, i32* %j.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.5

land.end.5:
  %63 = phi i1 [ false, %land.end.6 ], [ %62, %land.rhs.5 ]
  br i1 %63, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %64 = load i32, i32* %j.addr, align 4
  %65 = sitofp i64 %34 to double
  %66 = call i32 @llvm.fptosi.sat.i32.f64(double %65)
  %67 = icmp slt i32 %64, %66
  br label %land.end.4

land.end.4:
  %68 = phi i1 [ false, %land.end.5 ], [ %67, %land.rhs.4 ]
  br i1 %68, label %if.then.2, label %if.end.2

if.then.2:
  %69 = load i32, i32* %i.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %36 to %struct.Item**
  %72 = getelementptr inbounds %struct.Item*, %struct.Item** %71, i64 %70
  %73 = load %struct.Item*, %struct.Item** %72, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %74 = load i32, i32* %j.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %36 to %struct.Item**
  %77 = getelementptr inbounds %struct.Item*, %struct.Item** %76, i64 %75
  %78 = load %struct.Item*, %struct.Item** %77, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %79 = call double @byKey$(%struct.Item* %73, %struct.Item* %78)
  %80 = fcmp ogt double %79, 0x0000000000000000
  store i1 %80, i1* %right.addr, align 1
  br label %if.end.2

if.end.2:
  %81 = load i1, i1* %right.addr, align 1
  br i1 %81, label %if.then.3, label %if.else

if.then.3:
  %82 = load i32, i32* %j.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %84 = load i32, i32* %j.addr, align 4
  %85 = sitofp i64 %34 to double
  %86 = call i32 @llvm.fptosi.sat.i32.f64(double %85)
  %87 = icmp slt i32 %84, %86
  br label %land.end.10

land.end.10:
  %88 = phi i1 [ false, %if.then.3 ], [ %87, %land.rhs.10 ]
  br i1 %88, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %89 = load i32, i32* %k.addr, align 4
  %90 = sitofp i64 %38 to double
  %91 = call i32 @llvm.fptosi.sat.i32.f64(double %90)
  %92 = icmp slt i32 %89, %91
  br label %land.end.9

land.end.9:
  %93 = phi i1 [ false, %land.end.10 ], [ %92, %land.rhs.9 ]
  br i1 %93, label %if.then.4, label %if.end.4

if.then.4:
  %94 = load i32, i32* %k.addr, align 4
  %95 = sext i32 %94 to i64
  %96 = load i32, i32* %j.addr, align 4
  %97 = sext i32 %96 to i64
  %98 = bitcast i8* %36 to %struct.Item**
  %99 = getelementptr inbounds %struct.Item*, %struct.Item** %98, i64 %97
  %100 = load %struct.Item*, %struct.Item** %99, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %101 = bitcast i8* %40 to %struct.Item**
  %102 = getelementptr inbounds %struct.Item*, %struct.Item** %101, i64 %95
  store %struct.Item* %100, %struct.Item** %102, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  br label %if.end.4

if.end.4:
  %103 = load i32, i32* %j.addr, align 4
  %104 = add i32 %103, 1
  store i32 %104, i32* %j.addr, align 4
  br label %if.end.3

if.else:
  %105 = load i32, i32* %i.addr, align 4
  %106 = icmp sge i32 %105, 0
  br i1 %106, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %107 = load i32, i32* %i.addr, align 4
  %108 = sitofp i64 %34 to double
  %109 = call i32 @llvm.fptosi.sat.i32.f64(double %108)
  %110 = icmp slt i32 %107, %109
  br label %land.end.12

land.end.12:
  %111 = phi i1 [ false, %if.else ], [ %110, %land.rhs.12 ]
  br i1 %111, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %112 = load i32, i32* %k.addr, align 4
  %113 = sitofp i64 %38 to double
  %114 = call i32 @llvm.fptosi.sat.i32.f64(double %113)
  %115 = icmp slt i32 %112, %114
  br label %land.end.11

land.end.11:
  %116 = phi i1 [ false, %land.end.12 ], [ %115, %land.rhs.11 ]
  br i1 %116, label %if.then.5, label %if.end.5

if.then.5:
  %117 = load i32, i32* %k.addr, align 4
  %118 = sext i32 %117 to i64
  %119 = load i32, i32* %i.addr, align 4
  %120 = sext i32 %119 to i64
  %121 = bitcast i8* %36 to %struct.Item**
  %122 = getelementptr inbounds %struct.Item*, %struct.Item** %121, i64 %120
  %123 = load %struct.Item*, %struct.Item** %122, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %124 = bitcast i8* %40 to %struct.Item**
  %125 = getelementptr inbounds %struct.Item*, %struct.Item** %124, i64 %118
  store %struct.Item* %123, %struct.Item** %125, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  br label %if.end.5

if.end.5:
  %126 = load i32, i32* %i.addr, align 4
  %127 = add i32 %126, 1
  store i32 %127, i32* %i.addr, align 4
  br label %if.end.3

if.end.3:
  br label %for.inc

for.inc:
  %128 = load i32, i32* %k.addr, align 4
  %129 = add nsw i32 %128, 1
  store i32 %129, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"Item", !2, i64 0, !2, i64 8}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 8}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !11, i64 8}
!16 = !{!13, !12, i64 16}
!17 = !{!"element double", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!"element ptr", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
