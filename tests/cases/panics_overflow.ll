%struct.Counter = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #2
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #2

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @sum(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @scaled(i64 noundef %a, i64 noundef %b) #1 {
entry:
  %0 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %a, i64 %b)
  %1 = extractvalue { i64, i1 } %0, 0
  %2 = extractvalue { i64, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %1)
  %4 = extractvalue { i64, i1 } %3, 0
  %5 = extractvalue { i64, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i64 %4

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 3, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @bump(%struct.Counter* noundef nonnull align 8 dereferenceable(4) nocapture %c, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %k) #1 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %k)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %3, i32* %0, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  %9 = load i32, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !15
  %10 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %9, i32 %k)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %11, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !15
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @hash(i32 noundef %a, i32 noundef %b) #2 {
entry:
  %0 = mul i32 %a, 31
  %1 = add i32 %0, %b
  ret i32 %1
}

define internal noundef i32 @wrapped(i32 noundef %a, i32 noundef %b) #2 {
entry:
  %0 = add i32 %a, %b
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %k.addr = alloca i32, align 4
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %k.addr, align 4
  call void @Counter.constructor(%struct.Counter* %Counter.obj)
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %6 = bitcast [1 x i32]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 10, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %10 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %12 = load i32, i32* %k.addr, align 4
  call void @bump(%struct.Counter* %10, %struct.nish_array* %11, i32 %12)
  %13 = load i32, i32* %k.addr, align 4
  %14 = load i32, i32* %k.addr, align 4
  %15 = call i32 @sum(i32 %13, i32 %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = load i32, i32* %k.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = sext i32 3 to i64
  %20 = call i64 @scaled(i64 %18, i64 %19)
  %21 = call i8* @nish_str_from_i64(i64 %20)
  call void @nish_print(i8* %21)
  %22 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %23 = getelementptr inbounds %struct.Counter, %struct.Counter* %22, i32 0, i32 0
  %24 = load i32, i32* %23, align 4, !tbaa !4
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  %30 = load i32, i32* %29, align 4, !alias.scope !9, !noalias !8, !tbaa !15
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %30)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok

ovf.ok:
  %34 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %34)
  %35 = load i32, i32* %k.addr, align 4
  %36 = call i32 @hash(i32 %35, i32 7)
  %37 = zext i32 %36 to i64
  %38 = call i8* @nish_str_from_u64(i64 %37)
  call void @nish_print(i8* %38)
  %39 = load i32, i32* %k.addr, align 4
  %40 = call i32 @wrapped(i32 %39, i32 2147483647)
  %41 = call i8* @nish_str_from_i32(i32 %40)
  call void @nish_print(i8* %41)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Counter", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !11, i64 16}
!14 = !{!"element i32", !1, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!12, !10, i64 0}
!17 = !{!12, !10, i64 8}
