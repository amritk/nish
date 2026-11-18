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
  %11 = load i32, i32* %n.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = sub i32 %11, 1
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %12)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %13)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  %20 = or i1 %16, %19
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %25 = load i32, i32* %i.addr, align 4
  %26 = load i32, i32* %n.addr, align 4
  %27 = icmp slt i32 %25, %26
  br i1 %27, label %for.body, label %for.end

for.body:
  %28 = load i32, i32* %i.addr, align 4
  br i1 %20, label %add.checked, label %add.nsw

add.nsw:
  %29 = add nsw i32 %at, %28
  br label %add.join

add.checked:
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %28)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %add.join

add.join:
  %33 = phi i32 [ %29, %add.nsw ], [ %31, %ovf.ok ]
  %34 = sext i32 %33 to i64
  %35 = load i32, i32* %i.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = getelementptr inbounds i8, i8* %s, i64 8
  %38 = getelementptr inbounds i8, i8* %37, i64 %36
  %39 = load i8, i8* %38, align 1
  %40 = zext i8 %39 to i32
  %41 = trunc i32 %40 to i8
  %42 = icmp ult i64 %34, %22
  br i1 %42, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %34, i64 %22)
  unreachable

bounds.ok:
  %43 = bitcast i8* %24 to i8*
  %44 = getelementptr inbounds i8, i8* %43, i64 %34
  store i8 %41, i8* %44, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %45 = load i32, i32* %i.addr, align 4
  %46 = add nsw i32 %45, 1
  store i32 %46, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %47 = load i32, i32* %n.addr, align 4
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %47)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %49

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
