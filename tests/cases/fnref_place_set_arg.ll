%struct.P = type { i32 }
%struct.Keep = type { %struct.P* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
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

define internal noundef i32 @run(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %uses, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k) #2 {
entry:
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %P.obj = alloca %struct.P, align 8
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %uses, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %uses, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 9
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = srem i32 %6, 3
  %8 = sext i32 %7 to i64
  %9 = icmp ult i64 %8, %1
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %8, i64 %1)
  unreachable

bounds.ok:
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %8
  %12 = load i32, i32* %11, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %sum.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  call void @P.constructor(%struct.P* %P.obj, i32 %14)
  %15 = load i32, i32* %h.addr, align 4
  %16 = call i32 @apply$fn.10.run$arrow0(%struct.P* %P.obj, %struct.Keep* %k, i32 %15)
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %18, i32* %sum.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %22 = load i32, i32* %sum.addr, align 4
  ret i32 %22

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #2 {
entry:
  %k.addr = alloca %struct.Keep*, align 8
  %Keep.obj = alloca %struct.Keep, align 8
  %hot.addr = alloca %struct.nish_array*, align 8
  %sum.addr = alloca i32, align 4
  %once.addr = alloca i32, align 4
  %e.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Keep.constructor(%struct.Keep* %Keep.obj)
  store %struct.Keep* %Keep.obj, %struct.Keep** %k.addr, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  store %struct.nish_array* %1, %struct.nish_array** %hot.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %hot.addr, align 8
  %11 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %12 = call i32 @run(%struct.nish_array* %10, %struct.Keep* %11)
  store i32 %12, i32* %sum.addr, align 4
  store i32 4, i32* %once.addr, align 4
  %13 = call i8* @nish_alloc_struct(i64 4)
  %14 = bitcast i8* %13 to %struct.P*
  call void @P.constructor(%struct.P* %14, i32 5)
  %15 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %16 = call i32 @keepIt(%struct.P* %14, %struct.Keep* %15)
  %17 = load i32, i32* %once.addr, align 4
  %18 = call i8* @nish_alloc_struct(i64 4)
  %19 = bitcast i8* %18 to %struct.P*
  call void @P.constructor(%struct.P* %19, i32 6)
  %20 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %21 = call i32 @$ref.0.fr2.$P.$Keep.i32.0(i32 %17, %struct.P* %19, %struct.Keep* %20)
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %23, i32* %e.addr, align 4
  %25 = load i32, i32* %sum.addr, align 4
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %28 = load i32, i32* %e.addr, align 4
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %27, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %32 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %33 = getelementptr inbounds %struct.Keep, %struct.Keep* %32, i32 0, i32 0
  %34 = load %struct.P*, %struct.P** %33, align 8, !tbaa !7
  %35 = getelementptr inbounds %struct.P, %struct.P* %34, i32 0, i32 0
  %36 = load i32, i32* %35, align 4, !tbaa !4
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %31, i8* %37)
  call void @nish_print(i8* %38)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @run$arrow0(%struct.P* noundef nonnull readonly align 8 dereferenceable(4) nocapture %$a0, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %$a1, i32 noundef %h) #2 {
entry:
  %0 = call i32 @$ref.0.fr2.$P.$Keep.i32.1(i32 %h, %struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %0
}

define internal noundef i32 @apply$fn.10.run$arrow0(%struct.P* noundef nonnull readonly align 8 dereferenceable(4) nocapture %p, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %k, i32 noundef %cap.0) #2 {
entry:
  %0 = call i32 @run$arrow0(%struct.P* %p, %struct.Keep* %k, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @$ref.0.fr2.$P.$Keep.i32.0(i32 noundef %$t, %struct.P* noundef nonnull align 8 dereferenceable(4) %$a0, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %$a1) #0 {
entry:
  %0 = call i32 @keepIt(%struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %0
}

define internal noundef i32 @$ref.0.fr2.$P.$Keep.i32.1(i32 noundef %$t, %struct.P* noundef nonnull readonly align 8 dereferenceable(4) nocapture %$a0, %struct.Keep* noundef nonnull readonly align 8 dereferenceable(8) nocapture %$a1) #2 {
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
!16 = !{!15, !13, i64 0}
!17 = !{!15, !14, i64 16}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!15, !13, i64 8}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}
