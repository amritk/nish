%struct.Meter = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0

define internal void @Meter.constructor(%struct.Meter* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Meter, %struct.Meter* %this, i32 0, i32 0
  store i32 4294967295, i32* %0, align 4, !tbaa !4
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %level.addr = alloca i8, align 1
  %wide.addr = alloca i16, align 2
  %big.addr = alloca i32, align 4
  %product.addr = alloca i32, align 4
  %meter.addr = alloca %struct.Meter*, align 8
  %Meter.obj = alloca %struct.Meter, align 8
  %down.addr = alloca i8, align 1
  %arena.mark = call i64 @nish_arena_mark()
  store i8 250, i8* %level.addr, align 1
  %0 = load i8, i8* %level.addr, align 1
  %1 = add i8 %0, 10
  store i8 %1, i8* %level.addr, align 1
  %2 = load i8, i8* %level.addr, align 1
  %3 = add i8 %2, 1
  store i8 %3, i8* %level.addr, align 1
  store i16 3, i16* %wide.addr, align 2
  %4 = load i16, i16* %wide.addr, align 2
  %5 = sub i16 %4, 5
  store i16 %5, i16* %wide.addr, align 2
  store i32 70000, i32* %big.addr, align 4
  %6 = load i32, i32* %big.addr, align 4
  %7 = load i32, i32* %big.addr, align 4
  %8 = mul i32 %6, %7
  store i32 %8, i32* %product.addr, align 4
  call void @Meter.constructor(%struct.Meter* %Meter.obj)
  store %struct.Meter* %Meter.obj, %struct.Meter** %meter.addr, align 8
  %9 = load %struct.Meter*, %struct.Meter** %meter.addr, align 8
  %10 = getelementptr inbounds %struct.Meter, %struct.Meter* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4
  %12 = add i32 %11, 2
  store i32 %12, i32* %10, align 4
  store i8 0, i8* %down.addr, align 1
  %13 = load i8, i8* %down.addr, align 1
  %14 = sub i8 %13, 1
  store i8 %14, i8* %down.addr, align 1
  %15 = load i8, i8* %level.addr, align 1
  %16 = zext i8 %15 to i32
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  %18 = load i16, i16* %wide.addr, align 2
  %19 = zext i16 %18 to i32
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  %21 = load i32, i32* %product.addr, align 4
  %22 = zext i32 %21 to i64
  %23 = call i8* @nish_str_from_u64(i64 %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %25 = load %struct.Meter*, %struct.Meter** %meter.addr, align 8
  %26 = getelementptr inbounds %struct.Meter, %struct.Meter* %25, i32 0, i32 0
  %27 = load i32, i32* %26, align 4, !tbaa !4
  %28 = zext i32 %27 to i64
  %29 = call i8* @nish_str_from_u64(i64 %28)
  %30 = call i8* @nish_str_concat(i8* %24, i8* %29)
  call void @nish_print(i8* %30)
  %31 = load i8, i8* %down.addr, align 1
  %32 = zext i8 %31 to i32
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
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

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Meter", !2, i64 0}
!4 = !{!3, !2, i64 0}
