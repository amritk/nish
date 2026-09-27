%struct.Tally = type { i32 }
%struct.nish_result.i32.bool = type { i1, i32, i1 }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @next(i32 noundef %entry.param) #0 {
entry:
  %0 = add nsw i32 %entry.param, 1
  ret i32 %0
}

define internal noundef i32 @counted() #0 {
entry:
  %entry.addr = alloca i32, align 4
  store i32 4, i32* %entry.addr, align 4
  %0 = load i32, i32* %entry.addr, align 4
  %1 = add nsw i32 %0, 1
  store i32 %1, i32* %entry.addr, align 4
  %2 = load i32, i32* %entry.addr, align 4
  ret i32 %2
}

define internal noundef nonnull align 8 i8* @letter(i32 noundef %chr.param) #1 {
entry:
  %chr = alloca i8, align 1
  %0 = sext i32 %chr.param to i64
  %1 = trunc i64 %0 to i8
  store i8 %1, i8* %chr, align 1
  %2 = call i8* @nish_str_new(i8* %chr, i64 1)
  ret i8* %2
}

define internal { i1, i32, i32 } @parse(i32 noundef %n) #1 {
entry:
  %nish_result.i32.bool.obj = alloca %struct.nish_result.i32.bool, align 8
  %nish_result.i32.bool.obj.1 = alloca %struct.nish_result.i32.bool, align 8
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0
  store i1 false, i1* %1, align 1
  %2 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 2
  store i1 false, i1* %2, align 1
  br label %cond.end

cond.false:
  %3 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj.1, i32 0, i32 0
  store i1 true, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj.1, i32 0, i32 1
  store i32 %n, i32* %4, align 4
  br label %cond.end

cond.end:
  %5 = phi %struct.nish_result.i32.bool* [ %nish_result.i32.bool.obj, %cond.true ], [ %nish_result.i32.bool.obj.1, %cond.false ]
  %6 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %5, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = insertvalue { i1, i32, i32 } undef, i1 %7, 0
  %9 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %5, i32 0, i32 2
  %10 = load i1, i1* %9, align 1
  %11 = zext i1 %10 to i32
  %12 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %5, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  %14 = insertvalue { i1, i32, i32 } %8, i32 %13, 1
  %15 = insertvalue { i1, i32, i32 } %14, i32 %11, 2
  ret { i1, i32, i32 } %15
}

define internal noundef i32 @orZero({ i1, i32, i32 } %entry.param) #2 {
entry:
  %nish_result.i32.bool.obj = alloca %struct.nish_result.i32.bool, align 8
  %0 = extractvalue { i1, i32, i32 } %entry.param, 0
  %1 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = extractvalue { i1, i32, i32 } %entry.param, 1
  %3 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 1
  store i32 %2, i32* %3, align 4
  %4 = extractvalue { i1, i32, i32 } %entry.param, 2
  %5 = trunc i32 %4 to i1
  %6 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 2
  store i1 %5, i1* %6, align 1
  %7 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br i1 %8, label %res.ok, label %res.alt

res.ok:
  %9 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %11 = phi i32 [ %10, %res.ok ], [ 0, %res.alt ]
  ret i32 %11
}

define internal void @Tally.constructor(%struct.Tally* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %entry.param) #1 {
entry:
  %0 = getelementptr inbounds %struct.Tally, %struct.Tally* %this, i32 0, i32 0
  store i32 %entry.param, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Tally.plus(%struct.Tally* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %entry.param) #2 {
entry:
  %0 = getelementptr inbounds %struct.Tally, %struct.Tally* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = add nsw i32 %1, %entry.param
  ret i32 %2
}

define noundef i32 @nish_main() #1 {
entry:
  %nish_result.i32.bool.obj = alloca %struct.nish_result.i32.bool, align 8
  %Tally.obj = alloca %struct.Tally, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @next(i32 1)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @counted()
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @letter(i32 65)
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  call void @nish_print(i8* %6)
  %7 = call { i1, i32, i32 } @parse(i32 7)
  %8 = extractvalue { i1, i32, i32 } %7, 0
  %9 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0
  store i1 %8, i1* %9, align 1
  %10 = extractvalue { i1, i32, i32 } %7, 1
  %11 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 1
  store i32 %10, i32* %11, align 4
  %12 = extractvalue { i1, i32, i32 } %7, 2
  %13 = trunc i32 %12 to i1
  %14 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 2
  store i1 %13, i1* %14, align 1
  %15 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 0
  %16 = load i1, i1* %15, align 1
  %17 = insertvalue { i1, i32, i32 } undef, i1 %16, 0
  %18 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 2
  %19 = load i1, i1* %18, align 1
  %20 = zext i1 %19 to i32
  %21 = getelementptr inbounds %struct.nish_result.i32.bool, %struct.nish_result.i32.bool* %nish_result.i32.bool.obj, i32 0, i32 1
  %22 = load i32, i32* %21, align 4
  %23 = insertvalue { i1, i32, i32 } %17, i32 %22, 1
  %24 = insertvalue { i1, i32, i32 } %23, i32 %20, 2
  %25 = call i32 @orZero({ i1, i32, i32 } %24)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %26)
  call void @Tally.constructor(%struct.Tally* %Tally.obj, i32 2)
  %27 = call i32 @Tally.plus(%struct.Tally* %Tally.obj, i32 3)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Tally", !2, i64 0}
!4 = !{!3, !2, i64 0}
