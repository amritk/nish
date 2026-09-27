%struct.Box$rng.m128.p127 = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [48 x i8] } { i64 47, [48 x i8] c"value out of range: expected integer<-128, 127>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_exit(i32 noundef) #3

define noundef i32 @nish_main() #0 {
entry:
  %r.addr = alloca i32, align 4
  %same.addr = alloca i32, align 4
  %plain.addr = alloca i32, align 4
  %low.addr = alloca %struct.Box$rng.m128.p127*, align 8
  %Box$rng.m128.p127.obj = alloca %struct.Box$rng.m128.p127, align 8
  %n.addr = alloca i32, align 4
  %high.addr = alloca %struct.Box$rng.m128.p127*, align 8
  %Box$rng.m128.p127.obj.1 = alloca %struct.Box$rng.m128.p127, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 7, i32* %r.addr, align 4
  %0 = load i32, i32* %r.addr, align 4
  %1 = call i32 @identity$rng.p0.p9(i32 %0)
  store i32 %1, i32* %same.addr, align 4
  %2 = call i32 @identity$i32(i32 8)
  store i32 %2, i32* %plain.addr, align 4
  %3 = sub nsw i32 0, 100
  call void @Box$rng.m128.p127.constructor(%struct.Box$rng.m128.p127* %Box$rng.m128.p127.obj, i32 %3)
  store %struct.Box$rng.m128.p127* %Box$rng.m128.p127.obj, %struct.Box$rng.m128.p127** %low.addr, align 8
  store i32 20, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = mul nsw i32 %4, 5
  %6 = sub i32 %5, -128
  %7 = icmp ult i32 %6, 256
  br i1 %7, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [48 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  call void @Box$rng.m128.p127.constructor(%struct.Box$rng.m128.p127* %Box$rng.m128.p127.obj.1, i32 %5)
  store %struct.Box$rng.m128.p127* %Box$rng.m128.p127.obj.1, %struct.Box$rng.m128.p127** %high.addr, align 8
  %8 = load i32, i32* %same.addr, align 4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %11 = load i32, i32* %plain.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %15 = load %struct.Box$rng.m128.p127*, %struct.Box$rng.m128.p127** %low.addr, align 8
  %16 = getelementptr inbounds %struct.Box$rng.m128.p127, %struct.Box$rng.m128.p127* %15, i32 0, i32 0
  %17 = load i32, i32* %16, align 4, !tbaa !4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %14, i8* %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %21 = load %struct.Box$rng.m128.p127*, %struct.Box$rng.m128.p127** %high.addr, align 8
  %22 = getelementptr inbounds %struct.Box$rng.m128.p127, %struct.Box$rng.m128.p127* %21, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !4
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %20, i8* %24)
  call void @nish_print(i8* %25)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal void @Box$rng.m128.p127.constructor(%struct.Box$rng.m128.p127* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$rng.m128.p127, %struct.Box$rng.m128.p127* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @identity$rng.p0.p9(i32 noundef %x) #2 {
entry:
  ret i32 %x
}

define internal noundef i32 @identity$i32(i32 noundef %x) #2 {
entry:
  ret i32 %x
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { noreturn nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box$rng.m128.p127", !2, i64 0}
!4 = !{!3, !2, i64 0}
