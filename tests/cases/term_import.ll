%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noundef i32 @nish_read_stdin(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #0
declare zeroext i1 @nish_wait_stdin(i32 noundef) #0
declare zeroext i1 @nish_is_terminal(i32 noundef) #1
declare noundef i32 @nish_set_raw_mode(i1 noundef zeroext) #0
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @nish_main() #0 {
entry:
  %raw.addr = alloca i32, align 4
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [16 x i8], align 8
  %total.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_is_terminal(i32 0)
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i32 @nish_set_raw_mode(i1 zeroext true)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ %1, %cond.true ], [ -25, %cond.false ]
  store i32 %2, i32* %raw.addr, align 4
  %3 = load i32, i32* %raw.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 16, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 16, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast [16 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 16, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond

while.cond:
  %12 = call zeroext i1 @nish_wait_stdin(i32 1000)
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %14 = trunc i64 %11 to i32
  %15 = sext i32 %14 to i64
  %16 = add i64 0, %15
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %18 = load i64, i64* %17, align 8
  %19 = icmp ule i64 0, %16
  %20 = icmp ule i64 %16, %18
  %21 = and i1 %19, %20
  br i1 %21, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %16, i64 %18)
  unreachable

net.ok:
  %22 = call i32 @nish_read_stdin(%struct.nish_array* %13, i64 0, i64 %15)
  store i32 %22, i32* %n.addr, align 4
  %23 = load i32, i32* %n.addr, align 4
  %24 = icmp sle i32 %23, 0
  br i1 %24, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %25 = load i32, i32* %total.addr, align 4
  %26 = load i32, i32* %n.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %26)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %28, i32* %total.addr, align 4
  br label %while.cond

while.end:
  %30 = load i32, i32* %total.addr, align 4
  %31 = call i8* @nish_str_from_i32(i32 %30)
  call void @nish_print(i8* %31)
  %32 = call i32 @nish_set_raw_mode(i1 zeroext false)
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
