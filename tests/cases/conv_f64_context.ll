%struct.Config = type { double, %struct.sts_array* }
%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2
declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_f64(double noundef) #0
declare void @sts_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define void @Config.constructor(%struct.Config* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Config, %struct.Config* %this, i32 0, i32 0
  store double 0x3FD0000000000000, double* %0, align 8
  %1 = call i8* @sts_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.sts_array*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 0
  store i64 3, i64* %3, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 1
  store i64 3, i64* %4, align 8
  %5 = call i8* @sts_alloc_struct(i64 24)
  %6 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8
  %7 = bitcast i8* %5 to double*
  %8 = getelementptr inbounds double, double* %7, i64 0
  store double 0x3FE0000000000000, double* %8, align 8
  %9 = getelementptr inbounds double, double* %7, i64 1
  store double 0x3FF8000000000000, double* %9, align 8
  %10 = getelementptr inbounds double, double* %7, i64 2
  store double 0x4004000000000000, double* %10, align 8
  %11 = getelementptr inbounds %struct.Config, %struct.Config* %this, i32 0, i32 1
  store %struct.sts_array* %2, %struct.sts_array** %11, align 8
  ret void
}

define noundef i32 @sts_main() #1 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [2 x double], align 8
  %c.addr = alloca %struct.Config*, align 8
  %Config.obj = alloca %struct.Config, align 8
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8
  %2 = bitcast [2 x double]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8
  %4 = bitcast i8* %2 to double*
  %5 = getelementptr inbounds double, double* %4, i64 0
  store double 0x3FE0000000000000, double* %5, align 8
  %6 = getelementptr inbounds double, double* %4, i64 1
  store double 0x3FF8000000000000, double* %6, align 8
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %xs.addr, align 8
  call void @Config.constructor(%struct.Config* %Config.obj)
  store %struct.Config* %Config.obj, %struct.Config** %c.addr, align 8
  %7 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %8 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8
  %10 = icmp ult i64 0, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 0, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8
  %13 = bitcast i8* %12 to double*
  %14 = getelementptr inbounds double, double* %13, i64 0
  %15 = load double, double* %14, align 8
  %16 = load %struct.Config*, %struct.Config** %c.addr, align 8
  %17 = getelementptr inbounds %struct.Config, %struct.Config* %16, i32 0, i32 0
  %18 = load double, double* %17, align 8
  %19 = fadd double %15, %18
  %20 = load %struct.Config*, %struct.Config** %c.addr, align 8
  %21 = getelementptr inbounds %struct.Config, %struct.Config* %20, i32 0, i32 1
  %22 = load %struct.sts_array*, %struct.sts_array** %21, align 8
  %23 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8
  %25 = icmp ult i64 2, %24
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 2, i64 %24)
  unreachable

bounds.ok.1:
  %26 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8
  %28 = bitcast i8* %27 to double*
  %29 = getelementptr inbounds double, double* %28, i64 2
  %30 = load double, double* %29, align 8
  %31 = fadd double %19, %30
  %32 = call i8* @sts_str_from_f64(double %31)
  call void @sts_print(i8* %32)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
