%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.sumScaled$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.18.wordLengths$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @sumScaled(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %s.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %y.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %s.addr, align 4
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.sumScaled$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %ys.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %4 = load i64, i64* %forof.idx, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %forof.body, label %forof.end

forof.body:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %12, i32* %y.addr, align 4
  %13 = load i32, i32* %s.addr, align 4
  %14 = load i32, i32* %y.addr, align 4
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = srem i32 %16, 1000003
  store i32 %18, i32* %s.addr, align 4
  br label %forof.inc

forof.inc:
  %19 = load i64, i64* %forof.idx, align 8
  %20 = add i64 %19, 1
  store i64 %20, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  call void @nish_arena_release(i64 %1)
  %21 = load i32, i32* %s.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @wordLengths(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %k) #0 {
entry:
  %s.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %s.addr, align 4
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.18.wordLengths$arrow0(%struct.nish_array* %xs, i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %ws.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %4 = load i64, i64* %forof.idx, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %forof.body, label %forof.end

forof.body:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  %12 = load i8*, i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  store i8* %12, i8** %w.addr, align 8
  %13 = load i32, i32* %s.addr, align 4
  %14 = load i8*, i8** %w.addr, align 8
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  %21 = load i8*, i8** %w.addr, align 8
  %22 = load i8*, i8** %w.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = sub nsw i32 %25, 1
  %27 = sext i32 %26 to i64
  %28 = bitcast i8* %21 to i64*
  %29 = load i64, i64* %28, align 8
  %30 = icmp ult i64 %27, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %27, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds i8, i8* %21, i64 8
  %32 = getelementptr inbounds i8, i8* %31, i64 %27
  %33 = load i8, i8* %32, align 1
  %34 = zext i8 %33 to i32
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %34)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %38 = srem i32 %36, 1000003
  store i32 %38, i32* %s.addr, align 4
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = add i64 %39, 1
  store i64 %40, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  call void @nish_arena_release(i64 %1)
  %41 = load i32, i32* %s.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %41

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 1000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 4)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  store i32 %6, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = add i64 %8, 1
  store i64 %16, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %c.addr, align 4
  store i32 0, i32* %r.addr, align 4
  br label %for.cond.1

for.cond.1:
  %20 = load i32, i32* %r.addr, align 4
  %21 = icmp slt i32 %20, 5
  br i1 %21, label %for.body.1, label %for.end.1

for.body.1:
  %22 = load i32, i32* %c.addr, align 4
  %23 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %24 = load i32, i32* %r.addr, align 4
  %25 = call i32 @sumScaled(%struct.nish_array* %23, i32 %24)
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  %29 = srem i32 %27, 1000003
  store i32 %29, i32* %c.addr, align 4
  %30 = load i32, i32* %c.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %32 = load i32, i32* %r.addr, align 4
  %33 = call i32 @wordLengths(%struct.nish_array* %31, i32 %32)
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %37 = srem i32 %35, 1000003
  store i32 %37, i32* %c.addr, align 4
  br label %for.inc.1

for.inc.1:
  %38 = load i32, i32* %r.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %r.addr, align 4
  br label %for.cond.1

for.end.1:
  %40 = load i32, i32* %c.addr, align 4
  %41 = call i8* @nish_str_from_i32(i32 %40)
  call void @nish_print(i8* %41)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @sumScaled$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef nonnull align 8 i8* @wordLengths$arrow0(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %k)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i8* @nish_str_from_i32(i32 %1)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %3)
  ret i8* %4

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
!14 = !{!"element ptr", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!9, !7, i64 8}
