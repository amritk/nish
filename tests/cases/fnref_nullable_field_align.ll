%struct.C = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @plus1(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #0 {
entry:
  %c.addr = alloca %struct.C*, align 8
  %C.obj = alloca %struct.C, align 8
  %h.addr = alloca i32, align 4
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %g.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.C, %struct.C* %C.obj, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.C, %struct.C* %C.obj, i32 0, i32 1
  store i32 0, i32* %1, align 4, !tbaa !5
  store %struct.C* %C.obj, %struct.C** %c.addr, align 8
  %2 = load %struct.C*, %struct.C** %c.addr, align 8
  %3 = getelementptr inbounds %struct.C, %struct.C* %2, i32 0, i32 1
  store i32 1, i32* %3, align 4, !tbaa !5
  %4 = load %struct.C*, %struct.C** %c.addr, align 8
  %5 = getelementptr inbounds %struct.C, %struct.C* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !5
  store i32 %6, i32* %h.addr, align 4
  %7 = load i32, i32* %h.addr, align 4
  %8 = icmp ne i32 %7, 0
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = load i32, i32* %h.addr, align 4
  %10 = load %struct.C*, %struct.C** %c.addr, align 8
  %11 = getelementptr inbounds %struct.C, %struct.C* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !4
  %13 = call i32 @$ref.0.fr1.i32.i32.0(i32 %9, i32 %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  br label %if.end

if.end:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %17 = mul i64 2, 4
  %18 = bitcast [2 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !10, !noalias !9
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 1
  store i32 1, i32* %24, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  %25 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 1
  %30 = load i32, i32* %29, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  store i32 %30, i32* %g.addr, align 4
  %31 = load i32, i32* %g.addr, align 4
  %32 = icmp ne i32 %31, 0
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  %33 = load i32, i32* %g.addr, align 4
  %34 = call i32 @$ref.0.fr1.i32.i32.0(i32 %33, i32 41)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %35)
  br label %if.end.1

if.end.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @plus1(i32 %$a0)
  ret i32 %0
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

!llvm.module.flags = !{!19, !20, !21, !22, !23}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"C", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !11, i64 8}
!16 = !{!13, !12, i64 16}
!17 = !{!"element i32", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
