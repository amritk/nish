%struct.nish_result.f32.bool = type { i1, float, i1 }
%struct.nish_result.u8.u16 = type { i1, i8, i16 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0

define internal { i1, i32, i32 } @scale(float noundef %x) #0 {
entry:
  %0 = fcmp olt float %x, 0x0000000000000000
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = zext i1 true to i32
  %2 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %1, 2
  ret { i1, i32, i32 } %2

if.end:
  %3 = fmul float %x, 0x4000000000000000
  %4 = bitcast float %3 to i32
  %5 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %4, 1
  ret { i1, i32, i32 } %5
}

define internal { i1, i32, i32 } @narrow(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 255
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = trunc i32 1000 to i16
  %2 = zext i16 %1 to i32
  %3 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %2, 2
  ret { i1, i32, i32 } %3

if.end:
  %4 = trunc i32 %n to i8
  %5 = zext i8 %4 to i32
  %6 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %5, 1
  ret { i1, i32, i32 } %6
}

define noundef i32 @nish_main() #0 {
entry:
  %nish_result.f32.bool.obj = alloca %struct.nish_result.f32.bool, align 8
  %nish_result.f32.bool.obj.1 = alloca %struct.nish_result.f32.bool, align 8
  %small.addr = alloca %struct.nish_result.u8.u16*, align 8
  %nish_result.u8.u16.obj = alloca %struct.nish_result.u8.u16, align 8
  %big.addr = alloca %struct.nish_result.u8.u16*, align 8
  %nish_result.u8.u16.obj.1 = alloca %struct.nish_result.u8.u16, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call { i1, i32, i32 } @scale(float 0x3FF8000000000000)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = bitcast i32 %3 to float
  %5 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj, i32 0, i32 1
  store float %4, float* %5, align 4
  %6 = extractvalue { i1, i32, i32 } %0, 2
  %7 = trunc i32 %6 to i1
  %8 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj, i32 0, i32 2
  store i1 %7, i1* %8, align 1
  %9 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj, i32 0, i32 0
  %10 = load i1, i1* %9, align 1
  br i1 %10, label %res.ok, label %res.alt

res.ok:
  %11 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj, i32 0, i32 1
  %12 = load float, float* %11, align 4
  br label %res.end

res.alt:
  %13 = fneg float 0x3FF0000000000000
  br label %res.end

res.end:
  %14 = phi float [ %12, %res.ok ], [ %13, %res.alt ]
  %15 = fpext float %14 to double
  %16 = call i8* @nish_str_from_f64(double %15)
  call void @nish_print(i8* %16)
  %17 = fneg float 0x3FF0000000000000
  %18 = call { i1, i32, i32 } @scale(float %17)
  %19 = extractvalue { i1, i32, i32 } %18, 0
  %20 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj.1, i32 0, i32 0
  store i1 %19, i1* %20, align 1
  %21 = extractvalue { i1, i32, i32 } %18, 1
  %22 = bitcast i32 %21 to float
  %23 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj.1, i32 0, i32 1
  store float %22, float* %23, align 4
  %24 = extractvalue { i1, i32, i32 } %18, 2
  %25 = trunc i32 %24 to i1
  %26 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj.1, i32 0, i32 2
  store i1 %25, i1* %26, align 1
  %27 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj.1, i32 0, i32 0
  %28 = load i1, i1* %27, align 1
  br i1 %28, label %res.ok.1, label %res.alt.1

res.ok.1:
  %29 = getelementptr inbounds %struct.nish_result.f32.bool, %struct.nish_result.f32.bool* %nish_result.f32.bool.obj.1, i32 0, i32 1
  %30 = load float, float* %29, align 4
  br label %res.end.1

res.alt.1:
  %31 = fneg float 0x3FF0000000000000
  br label %res.end.1

res.end.1:
  %32 = phi float [ %30, %res.ok.1 ], [ %31, %res.alt.1 ]
  %33 = fpext float %32 to double
  %34 = call i8* @nish_str_from_f64(double %33)
  call void @nish_print(i8* %34)
  %35 = call { i1, i32, i32 } @narrow(i32 200)
  %36 = extractvalue { i1, i32, i32 } %35, 0
  %37 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %nish_result.u8.u16.obj, i32 0, i32 0
  store i1 %36, i1* %37, align 1
  %38 = extractvalue { i1, i32, i32 } %35, 1
  %39 = trunc i32 %38 to i8
  %40 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %nish_result.u8.u16.obj, i32 0, i32 1
  store i8 %39, i8* %40, align 1
  %41 = extractvalue { i1, i32, i32 } %35, 2
  %42 = trunc i32 %41 to i16
  %43 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %nish_result.u8.u16.obj, i32 0, i32 2
  store i16 %42, i16* %43, align 2
  store %struct.nish_result.u8.u16* %nish_result.u8.u16.obj, %struct.nish_result.u8.u16** %small.addr, align 8
  %44 = load %struct.nish_result.u8.u16*, %struct.nish_result.u8.u16** %small.addr, align 8
  %45 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %44, i32 0, i32 0
  %46 = load i1, i1* %45, align 1
  br i1 %46, label %if.then, label %if.end

if.then:
  %47 = load %struct.nish_result.u8.u16*, %struct.nish_result.u8.u16** %small.addr, align 8
  %48 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %47, i32 0, i32 1
  %49 = load i8, i8* %48, align 1
  %50 = zext i8 %49 to i64
  %51 = call i8* @nish_str_from_u64(i64 %50)
  call void @nish_print(i8* %51)
  br label %if.end

if.end:
  %52 = call { i1, i32, i32 } @narrow(i32 300)
  %53 = extractvalue { i1, i32, i32 } %52, 0
  %54 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %nish_result.u8.u16.obj.1, i32 0, i32 0
  store i1 %53, i1* %54, align 1
  %55 = extractvalue { i1, i32, i32 } %52, 1
  %56 = trunc i32 %55 to i8
  %57 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %nish_result.u8.u16.obj.1, i32 0, i32 1
  store i8 %56, i8* %57, align 1
  %58 = extractvalue { i1, i32, i32 } %52, 2
  %59 = trunc i32 %58 to i16
  %60 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %nish_result.u8.u16.obj.1, i32 0, i32 2
  store i16 %59, i16* %60, align 2
  store %struct.nish_result.u8.u16* %nish_result.u8.u16.obj.1, %struct.nish_result.u8.u16** %big.addr, align 8
  %61 = load %struct.nish_result.u8.u16*, %struct.nish_result.u8.u16** %big.addr, align 8
  %62 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %61, i32 0, i32 0
  %63 = load i1, i1* %62, align 1
  %64 = xor i1 %63, true
  br i1 %64, label %if.then.1, label %if.end.1

if.then.1:
  %65 = load %struct.nish_result.u8.u16*, %struct.nish_result.u8.u16** %big.addr, align 8
  %66 = getelementptr inbounds %struct.nish_result.u8.u16, %struct.nish_result.u8.u16* %65, i32 0, i32 2
  %67 = load i16, i16* %66, align 2
  %68 = zext i16 %67 to i64
  %69 = call i8* @nish_str_from_u64(i64 %68)
  call void @nish_print(i8* %69)
  br label %if.end.1

if.end.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
