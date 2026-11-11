%struct.nish_array = type { i64, i64, i8* }

@nish_storage_0_BYTES.data = global [8 x i8] zeroinitializer, align 16
@nish_storage_0_BYTES = internal global %struct.nish_array { i64 8, i64 8, i8* bitcast ([8 x i8]* @nish_storage_0_BYTES.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"xyz\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @put(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf, i32 noundef %at, i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = load i32, i32* %n.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  %8 = sub nsw i32 %7, %at
  %9 = icmp sgt i32 %4, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %entry ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  store i32 0, i32* %i.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = load i32, i32* %n.addr, align 4
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %i.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok

ovf.ok:
  %22 = sext i32 %20 to i64
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = getelementptr inbounds i8, i8* %s, i64 8
  %26 = getelementptr inbounds i8, i8* %25, i64 %24
  %27 = load i8, i8* %26, align 1
  %28 = zext i8 %27 to i32
  %29 = trunc i32 %28 to i8
  %30 = icmp ult i64 %22, %12
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %22, i64 %12)
  unreachable

bounds.ok:
  %31 = bitcast i8* %14 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 %22
  store i8 %29, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %35 = load i32, i32* %n.addr, align 4
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %37

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @putTwice(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf, i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %0 = call i32 @put(%struct.nish_array* %buf, i32 0, i8* %s)
  %1 = call i32 @put(%struct.nish_array* %buf, i32 %0, i8* %s)
  ret i32 %1
}

define internal noundef nonnull align 8 i8* @read$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ule i64 0, %0
  %4 = icmp ule i64 %0, %2
  %5 = and i1 %3, %4
  br i1 %5, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %0, i64 %2)
  unreachable

bytes.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = getelementptr inbounds i8, i8* %7, i64 0
  %9 = sub i64 %0, 0
  %10 = call i8* @nish_str_new(i8* %8, i64 %9)
  ret i8* %10
}

define void @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @putTwice(%struct.nish_array* @nish_storage_0_BYTES, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  store i32 %0, i32* %n.addr, align 4
  %1 = load i32, i32* %n.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %4 = load i32, i32* %n.addr, align 4
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @read$(%struct.nish_array* @nish_storage_0_BYTES, i32 %4)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %3, i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_BYTES, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %9, i8* %13)
  call void @nish_print(i8* %14)
  %15 = call i32 @put(%struct.nish_array* @nish_storage_0_BYTES, i32 6, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!14, !15, !16, !17, !18}
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
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{i32 8, !"cf-protection-branch", i32 1}
!15 = !{i32 8, !"cf-protection-return", i32 1}
!16 = !{i32 8, !"branch-target-enforcement", i32 1}
!17 = !{i32 8, !"sign-return-address", i32 1}
!18 = !{i32 4, !"probe-stack", !"inline-asm"}
