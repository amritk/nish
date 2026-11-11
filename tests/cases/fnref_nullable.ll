%struct.Slot = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @square(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, %x
  ret i32 %0
}

define internal noundef i32 @plus1(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef align 8 i32 @pick(i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = icmp eq i32 %k, 1
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ 1, %cond.true ], [ 2, %cond.false ]
  ret i32 %2
}

define internal noundef i32 @run(i32 noundef align 8 %h, i32 noundef %x) #0 {
entry:
  %0 = icmp eq i32 %h, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %1 = call i32 @$ref.0.fr1.i32.i32.0(i32 %h, i32 %x)
  ret i32 %1
}

define void @nish_main() #1 {
entry:
  %s.addr = alloca %struct.Slot*, align 8
  %Slot.obj = alloca %struct.Slot, align 8
  %o.addr = alloca i32, align 8
  %hs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Slot, %struct.Slot* %Slot.obj, i32 0, i32 0
  store i32 0, i32* %0, align 8, !tbaa !4
  store %struct.Slot* %Slot.obj, %struct.Slot** %s.addr, align 8
  %1 = load %struct.Slot*, %struct.Slot** %s.addr, align 8
  %2 = getelementptr inbounds %struct.Slot, %struct.Slot* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 8, !tbaa !4
  %4 = icmp eq i32 %3, 0
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %5)
  %6 = load %struct.Slot*, %struct.Slot** %s.addr, align 8
  %7 = getelementptr inbounds %struct.Slot, %struct.Slot* %6, i32 0, i32 0
  store i32 2, i32* %7, align 8, !tbaa !4
  %8 = load %struct.Slot*, %struct.Slot** %s.addr, align 8
  %9 = getelementptr inbounds %struct.Slot, %struct.Slot* %8, i32 0, i32 0
  %10 = load i32, i32* %9, align 8, !tbaa !4
  store i32 %10, i32* %o.addr, align 8
  %11 = load i32, i32* %o.addr, align 8
  %12 = icmp ne i32 %11, 0
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i32, i32* %o.addr, align 8
  %14 = call i32 @$ref.0.fr1.i32.i32.1(i32 %13, i32 4)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  br label %if.end

if.end:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %18 = mul i64 3, 8
  %19 = bitcast [3 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %19, i8 0, i64 %18, i1 false), !alias.scope !9, !noalias !8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %hs.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %hs.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 1
  store i32 1, i32* %25, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %26 = load %struct.nish_array*, %struct.nish_array** %hs.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  br label %for.cond

for.cond:
  %29 = load i32, i32* %i.addr, align 4
  %30 = icmp slt i32 %29, 3
  br i1 %30, label %for.body, label %for.end

for.body:
  %31 = load i32, i32* %total.addr, align 4
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = bitcast i8* %28 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %33
  %36 = load i32, i32* %35, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %37 = call i32 @run(i32 %36, i32 3)
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok

ovf.ok:
  %41 = load i32, i32* %i.addr, align 4
  %42 = call i32 @pick(i32 %41)
  %43 = call i32 @run(i32 %42, i32 2)
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %39, i32 %43)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %45, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %47 = load i32, i32* %i.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %49 = load i32, i32* %total.addr, align 4
  %50 = call i8* @nish_str_from_i32(i32 %49)
  call void @nish_print(i8* %50)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @square(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @plus1(i32 %$a0)
  ret i32 %1
}

define internal noundef i32 @$ref.0.fr1.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @plus1(i32 %$a0)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!18, !19, !20, !21, !22}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Slot", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}
