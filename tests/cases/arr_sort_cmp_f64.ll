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
declare i32 @llvm.fptosi.sat.i32.f64(double) #3

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
  %0 = add i32 %lo, 1
  store i32 %0, i32* %d.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond

while.cond:
  %5 = load i32, i32* %d.addr, align 4
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp slt i32 %7, %hi
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %while.cond ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %d.addr, align 4
  %11 = sitofp i64 %2 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp slt i32 %10, %12
  br label %land.end

land.end:
  %14 = phi i1 [ false, %land.end.1 ], [ %13, %land.rhs ]
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %d.addr, align 4
  %16 = sub nsw i32 %15, 1
  store i32 %16, i32* %p.addr, align 4
  %17 = load i32, i32* %p.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %4 to double*
  %20 = getelementptr inbounds double, double* %19, i64 %18
  %21 = load double, double* %20, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %22 = load i32, i32* %d.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %4 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %23
  %26 = load double, double* %25, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %27 = call double @nish_main$arrow0(double %21, double %26)
  %28 = fcmp ogt double %27, 0x0000000000000000
  %29 = xor i1 %28, true
  br i1 %29, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %30 = load i32, i32* %d.addr, align 4
  %31 = add i32 %30, 1
  store i32 %31, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = icmp sge i32 %32, %hi
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = sub i32 %hi, 1
  store i32 %34, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp sge i32 %43, 0
  br i1 %44, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %45 = load i32, i32* %k.addr, align 4
  %46 = icmp slt i32 %45, %hi
  br label %land.end.5

land.end.5:
  %47 = phi i1 [ false, %for.cond ], [ %46, %land.rhs.5 ]
  br i1 %47, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %48 = load i32, i32* %k.addr, align 4
  %49 = sitofp i64 %36 to double
  %50 = call i32 @llvm.fptosi.sat.i32.f64(double %49)
  %51 = icmp slt i32 %48, %50
  br label %land.end.4

land.end.4:
  %52 = phi i1 [ false, %land.end.5 ], [ %51, %land.rhs.4 ]
  br i1 %52, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %53 = load i32, i32* %r.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %r.addr, align 4
  %57 = sitofp i64 %40 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %land.end.3 ], [ %59, %land.rhs.2 ]
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = load i32, i32* %k.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = load i32, i32* %r.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %42 to double*
  %66 = getelementptr inbounds double, double* %65, i64 %64
  %67 = load double, double* %66, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %68 = bitcast i8* %38 to double*
  %69 = getelementptr inbounds double, double* %68, i64 %62
  store double %67, double* %69, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %70 = load i32, i32* %r.addr, align 4
  %71 = sub i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %72 = load i32, i32* %k.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond.1

for.cond.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %84 = load i32, i32* %i.addr, align 4
  %85 = icmp slt i32 %84, %hi
  br label %land.end.6

land.end.6:
  %86 = phi i1 [ false, %for.cond.1 ], [ %85, %land.rhs.6 ]
  br i1 %86, label %for.body.1, label %for.end.1

for.body.1:
  %87 = load i32, i32* %i.addr, align 4
  store i32 %87, i32* %j.addr, align 4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond.1

while.cond.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = icmp sgt i32 %96, %lo
  br i1 %97, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br label %land.end.9

land.end.9:
  %100 = phi i1 [ false, %while.cond.1 ], [ %99, %land.rhs.9 ]
  br i1 %100, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %101 = load i32, i32* %j.addr, align 4
  %102 = sitofp i64 %89 to double
  %103 = call i32 @llvm.fptosi.sat.i32.f64(double %102)
  %104 = icmp slt i32 %101, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = sitofp i64 %93 to double
  %108 = call i32 @llvm.fptosi.sat.i32.f64(double %107)
  %109 = icmp slt i32 %106, %108
  br label %land.end.7

land.end.7:
  %110 = phi i1 [ false, %land.end.8 ], [ %109, %land.rhs.7 ]
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %j.addr, align 4
  %112 = sub nsw i32 %111, 1
  store i32 %112, i32* %k.addr.1, align 4
  %113 = load i32, i32* %k.addr.1, align 4
  %114 = sext i32 %113 to i64
  %115 = bitcast i8* %91 to double*
  %116 = getelementptr inbounds double, double* %115, i64 %114
  %117 = load double, double* %116, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %118 = load i32, i32* %i.addr, align 4
  %119 = sext i32 %118 to i64
  %120 = bitcast i8* %95 to double*
  %121 = getelementptr inbounds double, double* %120, i64 %119
  %122 = load double, double* %121, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %123 = call double @nish_main$arrow0(double %117, double %122)
  %124 = fcmp ogt double %123, 0x0000000000000000
  %125 = xor i1 %124, true
  br i1 %125, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %126 = load i32, i32* %k.addr.1, align 4
  %127 = icmp slt i32 %126, 0
  br label %lor.end.2

lor.end.2:
  %128 = phi i1 [ true, %while.body.1 ], [ %127, %lor.rhs.2 ]
  br i1 %128, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %129 = load i32, i32* %k.addr.1, align 4
  %130 = sitofp i64 %89 to double
  %131 = call i32 @llvm.fptosi.sat.i32.f64(double %130)
  %132 = icmp sge i32 %129, %131
  br label %lor.end.1

lor.end.1:
  %133 = phi i1 [ true, %lor.end.2 ], [ %132, %lor.rhs.1 ]
  br i1 %133, label %lor.end, label %lor.rhs

lor.rhs:
  %134 = load i32, i32* %j.addr, align 4
  %135 = sitofp i64 %89 to double
  %136 = call i32 @llvm.fptosi.sat.i32.f64(double %135)
  %137 = icmp sge i32 %134, %136
  br label %lor.end

lor.end:
  %138 = phi i1 [ true, %lor.end.1 ], [ %137, %lor.rhs ]
  br i1 %138, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %139 = load i32, i32* %j.addr, align 4
  %140 = sext i32 %139 to i64
  %141 = load i32, i32* %k.addr.1, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %91 to double*
  %144 = getelementptr inbounds double, double* %143, i64 %142
  %145 = load double, double* %144, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %146 = bitcast i8* %91 to double*
  %147 = getelementptr inbounds double, double* %146, i64 %140
  store double %145, double* %147, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %148 = load i32, i32* %k.addr.1, align 4
  store i32 %148, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %149 = load i32, i32* %i.addr, align 4
  %150 = sitofp i64 %79 to double
  %151 = call i32 @llvm.fptosi.sat.i32.f64(double %150)
  %152 = icmp slt i32 %149, %151
  br i1 %152, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %153 = load i32, i32* %j.addr, align 4
  %154 = icmp sge i32 %153, 0
  br label %land.end.11

land.end.11:
  %155 = phi i1 [ false, %while.end.1 ], [ %154, %land.rhs.11 ]
  br i1 %155, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sitofp i64 %75 to double
  %158 = call i32 @llvm.fptosi.sat.i32.f64(double %157)
  %159 = icmp slt i32 %156, %158
  br label %land.end.10

land.end.10:
  %160 = phi i1 [ false, %land.end.11 ], [ %159, %land.rhs.10 ]
  br i1 %160, label %if.then.3, label %if.end.3

if.then.3:
  %161 = load i32, i32* %j.addr, align 4
  %162 = sext i32 %161 to i64
  %163 = load i32, i32* %i.addr, align 4
  %164 = sext i32 %163 to i64
  %165 = bitcast i8* %81 to double*
  %166 = getelementptr inbounds double, double* %165, i64 %164
  %167 = load double, double* %166, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %168 = bitcast i8* %77 to double*
  %169 = getelementptr inbounds double, double* %168, i64 %162
  store double %167, double* %169, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %170 = load i32, i32* %i.addr, align 4
  %171 = add nsw i32 %170, 1
  store i32 %171, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void
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
  %0 = add i32 %lo, 1
  store i32 %0, i32* %d.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond

while.cond:
  %5 = load i32, i32* %d.addr, align 4
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp slt i32 %7, %hi
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %while.cond ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %d.addr, align 4
  %11 = sitofp i64 %2 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp slt i32 %10, %12
  br label %land.end

land.end:
  %14 = phi i1 [ false, %land.end.1 ], [ %13, %land.rhs ]
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %d.addr, align 4
  %16 = sub nsw i32 %15, 1
  store i32 %16, i32* %p.addr, align 4
  %17 = load i32, i32* %p.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %4 to double*
  %20 = getelementptr inbounds double, double* %19, i64 %18
  %21 = load double, double* %20, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %22 = load i32, i32* %d.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %4 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %23
  %26 = load double, double* %25, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %27 = call double @nish_main$arrow1(double %21, double %26)
  %28 = fcmp ogt double %27, 0x0000000000000000
  %29 = xor i1 %28, true
  br i1 %29, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %30 = load i32, i32* %d.addr, align 4
  %31 = add i32 %30, 1
  store i32 %31, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = icmp sge i32 %32, %hi
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = sub i32 %hi, 1
  store i32 %34, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp sge i32 %43, 0
  br i1 %44, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %45 = load i32, i32* %k.addr, align 4
  %46 = icmp slt i32 %45, %hi
  br label %land.end.5

land.end.5:
  %47 = phi i1 [ false, %for.cond ], [ %46, %land.rhs.5 ]
  br i1 %47, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %48 = load i32, i32* %k.addr, align 4
  %49 = sitofp i64 %36 to double
  %50 = call i32 @llvm.fptosi.sat.i32.f64(double %49)
  %51 = icmp slt i32 %48, %50
  br label %land.end.4

land.end.4:
  %52 = phi i1 [ false, %land.end.5 ], [ %51, %land.rhs.4 ]
  br i1 %52, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %53 = load i32, i32* %r.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %r.addr, align 4
  %57 = sitofp i64 %40 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %land.end.3 ], [ %59, %land.rhs.2 ]
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = load i32, i32* %k.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = load i32, i32* %r.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %42 to double*
  %66 = getelementptr inbounds double, double* %65, i64 %64
  %67 = load double, double* %66, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %68 = bitcast i8* %38 to double*
  %69 = getelementptr inbounds double, double* %68, i64 %62
  store double %67, double* %69, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %70 = load i32, i32* %r.addr, align 4
  %71 = sub i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %72 = load i32, i32* %k.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond.1

for.cond.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %84 = load i32, i32* %i.addr, align 4
  %85 = icmp slt i32 %84, %hi
  br label %land.end.6

land.end.6:
  %86 = phi i1 [ false, %for.cond.1 ], [ %85, %land.rhs.6 ]
  br i1 %86, label %for.body.1, label %for.end.1

for.body.1:
  %87 = load i32, i32* %i.addr, align 4
  store i32 %87, i32* %j.addr, align 4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond.1

while.cond.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = icmp sgt i32 %96, %lo
  br i1 %97, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br label %land.end.9

land.end.9:
  %100 = phi i1 [ false, %while.cond.1 ], [ %99, %land.rhs.9 ]
  br i1 %100, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %101 = load i32, i32* %j.addr, align 4
  %102 = sitofp i64 %89 to double
  %103 = call i32 @llvm.fptosi.sat.i32.f64(double %102)
  %104 = icmp slt i32 %101, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = sitofp i64 %93 to double
  %108 = call i32 @llvm.fptosi.sat.i32.f64(double %107)
  %109 = icmp slt i32 %106, %108
  br label %land.end.7

land.end.7:
  %110 = phi i1 [ false, %land.end.8 ], [ %109, %land.rhs.7 ]
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %j.addr, align 4
  %112 = sub nsw i32 %111, 1
  store i32 %112, i32* %k.addr.1, align 4
  %113 = load i32, i32* %k.addr.1, align 4
  %114 = sext i32 %113 to i64
  %115 = bitcast i8* %91 to double*
  %116 = getelementptr inbounds double, double* %115, i64 %114
  %117 = load double, double* %116, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %118 = load i32, i32* %i.addr, align 4
  %119 = sext i32 %118 to i64
  %120 = bitcast i8* %95 to double*
  %121 = getelementptr inbounds double, double* %120, i64 %119
  %122 = load double, double* %121, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %123 = call double @nish_main$arrow1(double %117, double %122)
  %124 = fcmp ogt double %123, 0x0000000000000000
  %125 = xor i1 %124, true
  br i1 %125, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %126 = load i32, i32* %k.addr.1, align 4
  %127 = icmp slt i32 %126, 0
  br label %lor.end.2

lor.end.2:
  %128 = phi i1 [ true, %while.body.1 ], [ %127, %lor.rhs.2 ]
  br i1 %128, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %129 = load i32, i32* %k.addr.1, align 4
  %130 = sitofp i64 %89 to double
  %131 = call i32 @llvm.fptosi.sat.i32.f64(double %130)
  %132 = icmp sge i32 %129, %131
  br label %lor.end.1

lor.end.1:
  %133 = phi i1 [ true, %lor.end.2 ], [ %132, %lor.rhs.1 ]
  br i1 %133, label %lor.end, label %lor.rhs

lor.rhs:
  %134 = load i32, i32* %j.addr, align 4
  %135 = sitofp i64 %89 to double
  %136 = call i32 @llvm.fptosi.sat.i32.f64(double %135)
  %137 = icmp sge i32 %134, %136
  br label %lor.end

lor.end:
  %138 = phi i1 [ true, %lor.end.1 ], [ %137, %lor.rhs ]
  br i1 %138, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %139 = load i32, i32* %j.addr, align 4
  %140 = sext i32 %139 to i64
  %141 = load i32, i32* %k.addr.1, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %91 to double*
  %144 = getelementptr inbounds double, double* %143, i64 %142
  %145 = load double, double* %144, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %146 = bitcast i8* %91 to double*
  %147 = getelementptr inbounds double, double* %146, i64 %140
  store double %145, double* %147, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %148 = load i32, i32* %k.addr.1, align 4
  store i32 %148, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %149 = load i32, i32* %i.addr, align 4
  %150 = sitofp i64 %79 to double
  %151 = call i32 @llvm.fptosi.sat.i32.f64(double %150)
  %152 = icmp slt i32 %149, %151
  br i1 %152, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %153 = load i32, i32* %j.addr, align 4
  %154 = icmp sge i32 %153, 0
  br label %land.end.11

land.end.11:
  %155 = phi i1 [ false, %while.end.1 ], [ %154, %land.rhs.11 ]
  br i1 %155, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sitofp i64 %75 to double
  %158 = call i32 @llvm.fptosi.sat.i32.f64(double %157)
  %159 = icmp slt i32 %156, %158
  br label %land.end.10

land.end.10:
  %160 = phi i1 [ false, %land.end.11 ], [ %159, %land.rhs.10 ]
  br i1 %160, label %if.then.3, label %if.end.3

if.then.3:
  %161 = load i32, i32* %j.addr, align 4
  %162 = sext i32 %161 to i64
  %163 = load i32, i32* %i.addr, align 4
  %164 = sext i32 %163 to i64
  %165 = bitcast i8* %81 to double*
  %166 = getelementptr inbounds double, double* %165, i64 %164
  %167 = load double, double* %166, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %168 = bitcast i8* %77 to double*
  %169 = getelementptr inbounds double, double* %168, i64 %162
  store double %167, double* %169, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %170 = load i32, i32* %i.addr, align 4
  %171 = add nsw i32 %170, 1
  store i32 %171, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void
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
  %0 = add i32 %lo, 1
  store i32 %0, i32* %d.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond

while.cond:
  %5 = load i32, i32* %d.addr, align 4
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %d.addr, align 4
  %8 = icmp slt i32 %7, %hi
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %while.cond ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %d.addr, align 4
  %11 = sitofp i64 %2 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp slt i32 %10, %12
  br label %land.end

land.end:
  %14 = phi i1 [ false, %land.end.1 ], [ %13, %land.rhs ]
  br i1 %14, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %d.addr, align 4
  %16 = sub nsw i32 %15, 1
  store i32 %16, i32* %p.addr, align 4
  %17 = load i32, i32* %p.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %4 to %struct.Item**
  %20 = getelementptr inbounds %struct.Item*, %struct.Item** %19, i64 %18
  %21 = load %struct.Item*, %struct.Item** %20, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %22 = load i32, i32* %d.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %4 to %struct.Item**
  %25 = getelementptr inbounds %struct.Item*, %struct.Item** %24, i64 %23
  %26 = load %struct.Item*, %struct.Item** %25, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %27 = call double @byKey$(%struct.Item* %21, %struct.Item* %26)
  %28 = fcmp ogt double %27, 0x0000000000000000
  %29 = xor i1 %28, true
  br i1 %29, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %30 = load i32, i32* %d.addr, align 4
  %31 = add i32 %30, 1
  store i32 %31, i32* %d.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %d.addr, align 4
  %33 = icmp sge i32 %32, %hi
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = sub i32 %hi, 1
  store i32 %34, i32* %r.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %43 = load i32, i32* %k.addr, align 4
  %44 = icmp sge i32 %43, 0
  br i1 %44, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %45 = load i32, i32* %k.addr, align 4
  %46 = icmp slt i32 %45, %hi
  br label %land.end.5

land.end.5:
  %47 = phi i1 [ false, %for.cond ], [ %46, %land.rhs.5 ]
  br i1 %47, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %48 = load i32, i32* %k.addr, align 4
  %49 = sitofp i64 %36 to double
  %50 = call i32 @llvm.fptosi.sat.i32.f64(double %49)
  %51 = icmp slt i32 %48, %50
  br label %land.end.4

land.end.4:
  %52 = phi i1 [ false, %land.end.5 ], [ %51, %land.rhs.4 ]
  br i1 %52, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %53 = load i32, i32* %r.addr, align 4
  %54 = icmp sge i32 %53, 0
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %r.addr, align 4
  %57 = sitofp i64 %40 to double
  %58 = call i32 @llvm.fptosi.sat.i32.f64(double %57)
  %59 = icmp slt i32 %56, %58
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %land.end.3 ], [ %59, %land.rhs.2 ]
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = load i32, i32* %k.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = load i32, i32* %r.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = bitcast i8* %42 to %struct.Item**
  %66 = getelementptr inbounds %struct.Item*, %struct.Item** %65, i64 %64
  %67 = load %struct.Item*, %struct.Item** %66, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %68 = bitcast i8* %38 to %struct.Item**
  %69 = getelementptr inbounds %struct.Item*, %struct.Item** %68, i64 %62
  store %struct.Item* %67, %struct.Item** %69, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %70 = load i32, i32* %r.addr, align 4
  %71 = sub i32 %70, 1
  store i32 %71, i32* %r.addr, align 4
  br label %for.inc

for.inc:
  %72 = load i32, i32* %k.addr, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void

if.end.1:
  store i32 %lo, i32* %i.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond.1

for.cond.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = icmp sge i32 %82, 0
  br i1 %83, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %84 = load i32, i32* %i.addr, align 4
  %85 = icmp slt i32 %84, %hi
  br label %land.end.6

land.end.6:
  %86 = phi i1 [ false, %for.cond.1 ], [ %85, %land.rhs.6 ]
  br i1 %86, label %for.body.1, label %for.end.1

for.body.1:
  %87 = load i32, i32* %i.addr, align 4
  store i32 %87, i32* %j.addr, align 4
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %while.cond.1

while.cond.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = icmp sgt i32 %96, %lo
  br i1 %97, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br label %land.end.9

land.end.9:
  %100 = phi i1 [ false, %while.cond.1 ], [ %99, %land.rhs.9 ]
  br i1 %100, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %101 = load i32, i32* %j.addr, align 4
  %102 = sitofp i64 %89 to double
  %103 = call i32 @llvm.fptosi.sat.i32.f64(double %102)
  %104 = icmp slt i32 %101, %103
  br label %land.end.8

land.end.8:
  %105 = phi i1 [ false, %land.end.9 ], [ %104, %land.rhs.8 ]
  br i1 %105, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %106 = load i32, i32* %i.addr, align 4
  %107 = sitofp i64 %93 to double
  %108 = call i32 @llvm.fptosi.sat.i32.f64(double %107)
  %109 = icmp slt i32 %106, %108
  br label %land.end.7

land.end.7:
  %110 = phi i1 [ false, %land.end.8 ], [ %109, %land.rhs.7 ]
  br i1 %110, label %while.body.1, label %while.end.1

while.body.1:
  %111 = load i32, i32* %j.addr, align 4
  %112 = sub nsw i32 %111, 1
  store i32 %112, i32* %k.addr.1, align 4
  %113 = load i32, i32* %k.addr.1, align 4
  %114 = sext i32 %113 to i64
  %115 = bitcast i8* %91 to %struct.Item**
  %116 = getelementptr inbounds %struct.Item*, %struct.Item** %115, i64 %114
  %117 = load %struct.Item*, %struct.Item** %116, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %118 = load i32, i32* %i.addr, align 4
  %119 = sext i32 %118 to i64
  %120 = bitcast i8* %95 to %struct.Item**
  %121 = getelementptr inbounds %struct.Item*, %struct.Item** %120, i64 %119
  %122 = load %struct.Item*, %struct.Item** %121, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %123 = call double @byKey$(%struct.Item* %117, %struct.Item* %122)
  %124 = fcmp ogt double %123, 0x0000000000000000
  %125 = xor i1 %124, true
  br i1 %125, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %126 = load i32, i32* %k.addr.1, align 4
  %127 = icmp slt i32 %126, 0
  br label %lor.end.2

lor.end.2:
  %128 = phi i1 [ true, %while.body.1 ], [ %127, %lor.rhs.2 ]
  br i1 %128, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %129 = load i32, i32* %k.addr.1, align 4
  %130 = sitofp i64 %89 to double
  %131 = call i32 @llvm.fptosi.sat.i32.f64(double %130)
  %132 = icmp sge i32 %129, %131
  br label %lor.end.1

lor.end.1:
  %133 = phi i1 [ true, %lor.end.2 ], [ %132, %lor.rhs.1 ]
  br i1 %133, label %lor.end, label %lor.rhs

lor.rhs:
  %134 = load i32, i32* %j.addr, align 4
  %135 = sitofp i64 %89 to double
  %136 = call i32 @llvm.fptosi.sat.i32.f64(double %135)
  %137 = icmp sge i32 %134, %136
  br label %lor.end

lor.end:
  %138 = phi i1 [ true, %lor.end.1 ], [ %137, %lor.rhs ]
  br i1 %138, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.end.1

if.end.2:
  %139 = load i32, i32* %j.addr, align 4
  %140 = sext i32 %139 to i64
  %141 = load i32, i32* %k.addr.1, align 4
  %142 = sext i32 %141 to i64
  %143 = bitcast i8* %91 to %struct.Item**
  %144 = getelementptr inbounds %struct.Item*, %struct.Item** %143, i64 %142
  %145 = load %struct.Item*, %struct.Item** %144, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %146 = bitcast i8* %91 to %struct.Item**
  %147 = getelementptr inbounds %struct.Item*, %struct.Item** %146, i64 %140
  store %struct.Item* %145, %struct.Item** %147, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %148 = load i32, i32* %k.addr.1, align 4
  store i32 %148, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %149 = load i32, i32* %i.addr, align 4
  %150 = sitofp i64 %79 to double
  %151 = call i32 @llvm.fptosi.sat.i32.f64(double %150)
  %152 = icmp slt i32 %149, %151
  br i1 %152, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %153 = load i32, i32* %j.addr, align 4
  %154 = icmp sge i32 %153, 0
  br label %land.end.11

land.end.11:
  %155 = phi i1 [ false, %while.end.1 ], [ %154, %land.rhs.11 ]
  br i1 %155, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %156 = load i32, i32* %j.addr, align 4
  %157 = sitofp i64 %75 to double
  %158 = call i32 @llvm.fptosi.sat.i32.f64(double %157)
  %159 = icmp slt i32 %156, %158
  br label %land.end.10

land.end.10:
  %160 = phi i1 [ false, %land.end.11 ], [ %159, %land.rhs.10 ]
  br i1 %160, label %if.then.3, label %if.end.3

if.then.3:
  %161 = load i32, i32* %j.addr, align 4
  %162 = sext i32 %161 to i64
  %163 = load i32, i32* %i.addr, align 4
  %164 = sext i32 %163 to i64
  %165 = bitcast i8* %81 to %struct.Item**
  %166 = getelementptr inbounds %struct.Item*, %struct.Item** %165, i64 %164
  %167 = load %struct.Item*, %struct.Item** %166, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  %168 = bitcast i8* %77 to %struct.Item**
  %169 = getelementptr inbounds %struct.Item*, %struct.Item** %168, i64 %162
  store %struct.Item* %167, %struct.Item** %169, align 8, !alias.scope !10, !noalias !9, !tbaa !20
  br label %if.end.3

if.end.3:
  br label %for.inc.1

for.inc.1:
  %170 = load i32, i32* %i.addr, align 4
  %171 = add nsw i32 %170, 1
  store i32 %171, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  ret void
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
