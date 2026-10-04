%struct.Tally = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"value out of range: expected integer<0, 99>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [54 x i8] } { i64 53, [54 x i8] c"value out of range: expected integer<-2147483648, 99>\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [46 x i8] } { i64 45, [46 x i8] c"value out of range: expected integer<0, 1000>\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"value out of range: expected integer<1, 31>\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_exit(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i32], align 8
  %t.addr = alloca %struct.Tally*, align 8
  %Tally.obj = alloca %struct.Tally, align 8
  %total.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %top.addr = alloca i32, align 4
  %day.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [6 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 4, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 8, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 15, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 16, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 23, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i32, i32* %4, i64 5
  store i32 42, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %11 = getelementptr inbounds %struct.Tally, %struct.Tally* %Tally.obj, i32 0, i32 0
  store i32 0, i32* %11, align 4, !tbaa !17
  store %struct.Tally* %Tally.obj, %struct.Tally** %t.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %17 = load i32, i32* %k.addr, align 4
  %18 = trunc i64 %14 to i32
  %19 = icmp slt i32 %17, %18
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %k.addr, align 4
  %21 = icmp ult i32 %20, 100
  br i1 %21, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  store i32 %20, i32* %w.addr, align 4
  %22 = load i32, i32* %k.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %16 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %23
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = icmp ult i32 %26, 100
  br i1 %27, label %rng.ok.1, label %rng.fail.1

rng.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.1:
  store i32 %26, i32* %v.addr, align 4
  %28 = load i32, i32* %k.addr, align 4
  %29 = sub i32 %28, -2147483648
  %30 = icmp ult i32 %29, -2147483548
  br i1 %30, label %rng.ok.2, label %rng.fail.2

rng.fail.2:
  call void @nish_write(i8* bitcast ({ i64, [54 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.2:
  store i32 %28, i32* %top.addr, align 4
  %31 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %32 = getelementptr inbounds %struct.Tally, %struct.Tally* %31, i32 0, i32 0
  %33 = load i32, i32* %32, align 4
  %34 = add nsw i32 %33, 1
  %35 = icmp ult i32 %34, 1001
  br i1 %35, label %rng.ok.3, label %rng.fail.3

rng.fail.3:
  call void @nish_write(i8* bitcast ({ i64, [46 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.3:
  store i32 %34, i32* %32, align 4
  %36 = load i32, i32* %k.addr, align 4
  %37 = add nsw i32 %36, 1
  %38 = sub i32 %37, 1
  %39 = icmp ult i32 %38, 31
  br i1 %39, label %rng.ok.4, label %rng.fail.4

rng.fail.4:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.4:
  store i32 %37, i32* %day.addr, align 4
  %40 = load i32, i32* %total.addr, align 4
  %41 = load i32, i32* %w.addr, align 4
  %42 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %40, i32 %41)
  %43 = extractvalue { i32, i1 } %42, 0
  %44 = extractvalue { i32, i1 } %42, 1
  br i1 %44, label %ovf.fail, label %ovf.ok

ovf.ok:
  %45 = load i32, i32* %v.addr, align 4
  %46 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 %45)
  %47 = extractvalue { i32, i1 } %46, 0
  %48 = extractvalue { i32, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %49 = load i32, i32* %top.addr, align 4
  %50 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 %49)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %53 = load i32, i32* %day.addr, align 4
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %51, i32 %53)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %55, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %57 = load i32, i32* %k.addr, align 4
  %58 = add nsw i32 %57, 1
  store i32 %58, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %59 = load i32, i32* %total.addr, align 4
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %62 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %63 = getelementptr inbounds %struct.Tally, %struct.Tally* %62, i32 0, i32 0
  %64 = load i32, i32* %63, align 4, !tbaa !17
  %65 = call i8* @nish_str_from_i32(i32 %64)
  %66 = call i8* @nish_str_concat(i8* %61, i8* %65)
  call void @nish_print(i8* %66)
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { noreturn nounwind }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"Tally", !15, i64 0}
!17 = !{!16, !15, i64 0}
