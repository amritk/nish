%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"test \22$(ps -o nice= -p $$)\22 -eq 1\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"linux\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"test \22$(ps -o cls= -p $$)\22 = IDL\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noundef i32 @nish_spawn(%struct.nish_array* noundef nonnull align 8) #0
declare i64 @nish_euid() #2
declare noundef nonnull align 8 i8* @nish_platform() #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare noundef i32 @nish_set_nice(i32 noundef) #2
declare noundef i32 @nish_set_idle_priority() #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @nish_main() #0 {
entry:
  %raised.addr = alloca i32, align 4
  %idle.addr = alloca i32, align 4
  %0 = call i32 @nish_set_nice(i32 1)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 3, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %6 to i8**
  %9 = getelementptr inbounds i8*, i8** %8, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8*, i8** %8, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8*, i8** %8, i64 2
  store i8* bitcast ({ i64, [34 x i8] }* @.str.2 to i8*), i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = call i32 @nish_spawn(%struct.nish_array* %3)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = call i32 @nish_set_nice(i32 -20)
  store i32 %14, i32* %raised.addr, align 4
  %15 = call i64 @nish_euid()
  %16 = icmp eq i64 %15, 0
  br i1 %16, label %cond.true, label %cond.false

cond.true:
  %17 = load i32, i32* %raised.addr, align 4
  %18 = icmp eq i32 %17, 0
  br label %cond.end

cond.false:
  %19 = load i32, i32* %raised.addr, align 4
  %20 = icmp slt i32 %19, 0
  br label %cond.end

cond.end:
  %21 = phi i1 [ %18, %cond.true ], [ %20, %cond.false ]
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @nish_print(i8* %22)
  %23 = call i32 @nish_set_idle_priority()
  store i32 %23, i32* %idle.addr, align 4
  %24 = call i8* @nish_platform()
  %25 = call zeroext i1 @nish_str_eq(i8* %24, i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*))
  br i1 %25, label %if.then, label %if.else

if.then:
  %26 = load i32, i32* %idle.addr, align 4
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.nish_array*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  store i64 3, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  store i64 3, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = call i8* @nish_alloc_struct(i64 24)
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %32 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = getelementptr inbounds i8*, i8** %34, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = getelementptr inbounds i8*, i8** %34, i64 2
  store i8* bitcast ({ i64, [33 x i8] }* @.str.6 to i8*), i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %38 = call i32 @nish_spawn(%struct.nish_array* %29)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  br label %if.end

if.else:
  %40 = load i32, i32* %idle.addr, align 4
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %40, i32 95)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok

ovf.ok:
  %44 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %44)
  %45 = call i8* @nish_str_from_i32(i32 0)
  call void @nish_print(i8* %45)
  br label %if.end

if.end:
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

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
