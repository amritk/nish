%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"index out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare i8 @llvm.fptoui.sat.i8.f64(double) #5
declare i32 @llvm.fptoui.sat.i32.f64(double) #5

define internal noundef i32 @at32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptoui.sat.i32.f64(double %2)
  %4 = icmp ult i32 %i, %3
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = zext i32 %i to i64
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %5
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %10

if.end:
  ret i32 -1
}

define internal noundef i32 @at8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8 noundef %i) #1 {
entry:
  %0 = zext i8 %i to i32
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = sitofp i64 %2 to double
  %4 = call i32 @llvm.fptoui.sat.i32.f64(double %3)
  %5 = icmp ult i32 %0, %4
  %6 = xor i1 %5, true
  br i1 %6, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [19 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %7 = zext i8 %i to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %7
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %12
}

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %n) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  %0 = call i32 @llvm.fptoui.sat.i32.f64(double 0x0000000000000000)
  store i32 %0, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp ult i32 %5, %n
  br i1 %6, label %while.body, label %while.end

while.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sitofp i64 %2 to double
  %9 = call i32 @llvm.fptoui.sat.i32.f64(double %8)
  %10 = icmp ult i32 %7, %9
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i32, i32* %s.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = zext i32 %12 to i64
  %14 = bitcast i8* %4 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %18, i32* %s.addr, align 4
  br label %if.end

if.end:
  %20 = load i32, i32* %i.addr, align 4
  %21 = call i32 @llvm.fptoui.sat.i32.f64(double 0x3FF0000000000000)
  %22 = add i32 %20, %21
  store i32 %22, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %23 = load i32, i32* %s.addr, align 4
  ret i32 %23

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 10, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 20, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 30, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = call i32 @llvm.fptoui.sat.i32.f64(double 0x4000000000000000)
  %10 = call i32 @at32(%struct.nish_array* %8, i32 %9)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %13 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %14 = call i32 @llvm.fptoui.sat.i32.f64(double 0x4008000000000000)
  %15 = call i32 @at32(%struct.nish_array* %13, i32 %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %12, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %20 = call i32 @llvm.fptoui.sat.i32.f64(double 0x41EDCD6500000000)
  %21 = call i32 @at32(%struct.nish_array* %19, i32 %20)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %18, i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %26 = call i8 @llvm.fptoui.sat.i8.f64(double 0x3FF0000000000000)
  %27 = call i32 @at8(%struct.nish_array* %25, i8 %26)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %24, i8* %28)
  call void @nish_print(i8* %29)
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = call i32 @llvm.fptoui.sat.i32.f64(double 0x401C000000000000)
  %32 = call i32 @sum(%struct.nish_array* %30, i32 %31)
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

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }

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
