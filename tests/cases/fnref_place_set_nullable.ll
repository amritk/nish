%struct.P = type { i32 }
%struct.Keep = type { %struct.P* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

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

define internal void @P.constructor(%struct.P* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %x) #0 {
entry:
  %0 = getelementptr inbounds %struct.P, %struct.P* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.P, %struct.P* %this, i32 0, i32 0
  store i32 %x, i32* %1, align 4, !tbaa !4
  ret void
}

define internal void @Keep.constructor(%struct.Keep* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.P*
  call void @P.constructor(%struct.P* %1, i32 0)
  %2 = getelementptr inbounds %struct.Keep, %struct.Keep* %this, i32 0, i32 0
  store %struct.P* %1, %struct.P** %2, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @readX(%struct.P* noundef nonnull readonly align 8 dereferenceable(4) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #1 {
entry:
  %0 = getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  ret i32 %1
}

define internal noundef i32 @readTwice(%struct.P* noundef nonnull readonly align 8 dereferenceable(4) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #2 {
entry:
  %0 = getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 2)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @readThrice(%struct.P* noundef nonnull readonly align 8 dereferenceable(4) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #2 {
entry:
  %0 = getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 3)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @keepIt(%struct.P* noundef nonnull align 8 dereferenceable(4) %p, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k) #0 {
entry:
  %0 = getelementptr inbounds %struct.Keep, %struct.Keep* %k, i32 0, i32 0
  store %struct.P* %p, %struct.P** %0, align 8, !tbaa !7
  %1 = getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  ret i32 %2
}

define internal noundef i32 @run(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %uses, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #2 {
entry:
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 8
  %P.obj = alloca %struct.P, align 8
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %uses, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  br label %while.cond

while.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp slt i32 %2, 9
  br i1 %3, label %while.body, label %while.end

while.body:
  %4 = load i32, i32* %i.addr, align 4
  %5 = srem i32 %4, 3
  %6 = sext i32 %5 to i64
  %7 = bitcast i8* %1 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %6
  %9 = load i32, i32* %8, align 8, !alias.scope !12, !noalias !11, !tbaa !18
  store i32 %9, i32* %h.addr, align 8
  %10 = load i32, i32* %h.addr, align 8
  %11 = icmp ne i32 %10, 0
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load i32, i32* %sum.addr, align 4
  %13 = load i32, i32* %h.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  call void @P.constructor(%struct.P* %P.obj, i32 %14)
  %15 = call i32 @$ref.0.fr2.$P.$Keep.i32.0(i32 %13, %struct.P* %P.obj, %struct.Keep* %k)
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %sum.addr, align 4
  br label %if.end

if.end:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %21 = load i32, i32* %sum.addr, align 4
  ret i32 %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #2 {
entry:
  %k.addr = alloca %struct.Keep*, align 8
  %Keep.obj = alloca %struct.Keep, align 8
  %hot.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %sum.addr = alloca i32, align 4
  %once.addr = alloca i32, align 4
  %e.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Keep.constructor(%struct.Keep* %Keep.obj)
  store %struct.Keep* %Keep.obj, %struct.Keep** %k.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !19
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %2 = mul i64 4, 8
  %3 = bitcast [4 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !12, !noalias !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %hot.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %hot.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 1, i32* %9, align 8, !alias.scope !12, !noalias !11, !tbaa !18
  %10 = load %struct.nish_array*, %struct.nish_array** %hot.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 1
  store i32 2, i32* %14, align 8, !alias.scope !12, !noalias !11, !tbaa !18
  %15 = load %struct.nish_array*, %struct.nish_array** %hot.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 2
  store i32 3, i32* %19, align 8, !alias.scope !12, !noalias !11, !tbaa !18
  %20 = load %struct.nish_array*, %struct.nish_array** %hot.addr, align 8
  %21 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %22 = call i32 @run(%struct.nish_array* %20, %struct.Keep* %21)
  store i32 %22, i32* %sum.addr, align 4
  store i32 4, i32* %once.addr, align 4
  %23 = call i8* @nish_alloc_struct(i64 4)
  %24 = bitcast i8* %23 to %struct.P*
  call void @P.constructor(%struct.P* %24, i32 5)
  %25 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %26 = call i32 @keepIt(%struct.P* %24, %struct.Keep* %25)
  %27 = load i32, i32* %once.addr, align 4
  %28 = call i8* @nish_alloc_struct(i64 4)
  %29 = bitcast i8* %28 to %struct.P*
  call void @P.constructor(%struct.P* %29, i32 6)
  %30 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %31 = call i32 @$ref.0.fr2.$P.$Keep.i32.1(i32 %27, %struct.P* %29, %struct.Keep* %30)
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %31)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %33, i32* %e.addr, align 4
  %35 = load i32, i32* %sum.addr, align 4
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %38 = load i32, i32* %e.addr, align 4
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %37, i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %42 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %43 = getelementptr inbounds %struct.Keep, %struct.Keep* %42, i32 0, i32 0
  %44 = load %struct.P*, %struct.P** %43, align 8, !tbaa !7
  %45 = getelementptr inbounds %struct.P, %struct.P* %44, i32 0, i32 0
  %46 = load i32, i32* %45, align 4, !tbaa !4
  %47 = call i8* @nish_str_from_i32(i32 %46)
  %48 = call i8* @nish_str_concat(i8* %41, i8* %47)
  call void @nish_print(i8* %48)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @$ref.0.fr2.$P.$Keep.i32.0(i32 noundef %$t, %struct.P* noundef nonnull readonly align 8 dereferenceable(4) nocapture %$a0, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %$a1) #2 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
    i32 2, label %sw.case.1
  ]

sw.case:
  %0 = call i32 @readX(%struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %0

sw.case.1:
  %1 = call i32 @readTwice(%struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %1

sw.default:
  %2 = call i32 @readThrice(%struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %2
}

define internal noundef i32 @$ref.0.fr2.$P.$Keep.i32.1(i32 noundef %$t, %struct.P* noundef nonnull align 8 dereferenceable(4) %$a0, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %$a1) #0 {
entry:
  %0 = call i32 @keepIt(%struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"P", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Keep", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !14, i64 16}
!17 = !{!"element i32", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!15, !13, i64 0}
!20 = !{!15, !13, i64 8}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
