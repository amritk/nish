%struct.nish_array = type { i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @a0(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @a1(i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @a1(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @a2(i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @a2(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @a0(i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @b0(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @b1(i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @b1(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @b2(i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @b2(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @b3(i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @b3(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @b0(i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @c0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @c1(%struct.nish_array* %xs, i32 %1, i32 %k)
  %3 = sext i32 %k to i64
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %3, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %3
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %15 = phi i32 [ 0, %cond.true ], [ %13, %ovf.ok ]
  ret i32 %15

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @c1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @c2(%struct.nish_array* %xs, i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @c2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @c0(%struct.nish_array* %xs, i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @e0(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @e1(i32 %1, i32 %k)
  br label %cond.end

cond.end:
  %3 = phi i32 [ 0, %cond.true ], [ %2, %cond.false ]
  ret i32 %3
}

define internal noundef i32 @e1(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @e0(i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @f(i32 noundef %d, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %d, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub i32 %d, 1
  %2 = call i32 @f(i32 %1, i32 %k)
  %3 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %2, i32 %k)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %6 = phi i32 [ 0, %cond.true ], [ %4, %ovf.ok ]
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %k.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %k.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %6 = bitcast [2 x i32]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 4, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %8, i64 1
  store i32 5, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %11 = load i32, i32* %k.addr, align 4
  %12 = call i32 @a0(i32 5, i32 %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load i32, i32* %k.addr, align 4
  %15 = call i32 @b0(i32 6, i32 %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %18 = load i32, i32* %k.addr, align 4
  %19 = call i32 @c0(%struct.nish_array* %17, i32 4, i32 %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  %21 = load i32, i32* %k.addr, align 4
  %22 = call i32 @e0(i32 4, i32 %21)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load i32, i32* %k.addr, align 4
  %25 = call i32 @f(i32 3, i32 %24)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %26)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
