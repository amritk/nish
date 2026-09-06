%struct.sts_array = type { i64, i64, i8* }

declare void @sts_free_arena() #2
declare noundef i64 @sts_arena_mark() #2
declare void @sts_arena_release(i64 noundef) #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_f64(double noundef) #2
declare void @sts_panic_index(i64 noundef, i64 noundef) #3

define noundef double @mean(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %total.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  store double 0x0000000000000000, double* %total.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to double*
  %7 = getelementptr inbounds double, double* %6, i64 %0
  %8 = load double, double* %7, align 8
  store double %8, double* %x.addr, align 8
  %9 = load double, double* %total.addr, align 8
  %10 = load double, double* %x.addr, align 8
  %11 = fadd double %9, %10
  store double %11, double* %total.addr, align 8
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load double, double* %total.addr, align 8
  %15 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %16 = load i64, i64* %15, align 8
  %17 = sitofp i64 %16 to double
  %18 = fdiv double %14, %17
  ret double %18
}

define void @sts_main() #1 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %arr.hdr = alloca %struct.sts_array, align 8
  %arr.data = alloca [3 x double], align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8
  %2 = bitcast [3 x double]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8
  %4 = bitcast i8* %2 to double*
  %5 = getelementptr inbounds double, double* %4, i64 0
  store double 0x3FF8000000000000, double* %5, align 8
  %6 = getelementptr inbounds double, double* %4, i64 1
  store double 0x4004000000000000, double* %6, align 8
  %7 = getelementptr inbounds double, double* %4, i64 2
  store double 0x4014000000000000, double* %7, align 8
  store %struct.sts_array* %arr.hdr, %struct.sts_array** %xs.addr, align 8
  %8 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %9 = call double @mean(%struct.sts_array* %8)
  %10 = call i8* @sts_str_from_f64(double %9)
  call void @sts_print(i8* %10)
  %11 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %12 = fptosi double 0x3FF0000000000000 to i64
  %13 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %12, i64 %14)
  unreachable

bounds.ok:
  %16 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8
  %18 = bitcast i8* %17 to double*
  %19 = getelementptr inbounds double, double* %18, i64 %12
  %20 = load double, double* %19, align 8
  %21 = call i8* @sts_str_from_f64(double %20)
  call void @sts_print(i8* %21)
  call void @sts_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @sts_main()
  call void @sts_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
