%struct.P = type { i32 }
%struct.Keep = type { %struct.P* }
%struct.Slot = type { i32 }
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

define internal void @Slot.constructor(%struct.Slot* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %use) #0 {
entry:
  %0 = getelementptr inbounds %struct.Slot, %struct.Slot* %this, i32 0, i32 0
  store i32 %use, i32* %0, align 4, !tbaa !9
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

define internal noundef i32 @keepIt(%struct.P* noundef nonnull align 8 dereferenceable(4) %p, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k) #0 {
entry:
  %0 = getelementptr inbounds %struct.Keep, %struct.Keep* %k, i32 0, i32 0
  store %struct.P* %p, %struct.P** %0, align 8, !tbaa !7
  %1 = getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  ret i32 %2
}

define internal noundef i32 @keepPlus(%struct.P* noundef nonnull align 8 dereferenceable(4) %p, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %k) #2 {
entry:
  %0 = getelementptr inbounds %struct.Keep, %struct.Keep* %k, i32 0, i32 0
  store %struct.P* %p, %struct.P** %0, align 8, !tbaa !7
  %1 = getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #2 {
entry:
  %k.addr = alloca %struct.Keep*, align 8
  %Keep.obj = alloca %struct.Keep, align 8
  %local.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %slot.addr = alloca %struct.Slot*, align 8
  %Slot.obj = alloca %struct.Slot, align 8
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %P.obj = alloca %struct.P, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Keep.constructor(%struct.Keep* %Keep.obj)
  store %struct.Keep* %Keep.obj, %struct.Keep** %k.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %local.addr, align 8
  call void @Slot.constructor(%struct.Slot* %Slot.obj, i32 3)
  store %struct.Slot* %Slot.obj, %struct.Slot** %slot.addr, align 8
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %7 = load %struct.nish_array*, %struct.nish_array** %local.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  br label %while.cond

while.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, 4
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %sum.addr, align 4
  %13 = load i32, i32* %i.addr, align 4
  %14 = srem i32 %13, 2
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %9 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %19 = load i32, i32* %i.addr, align 4
  call void @P.constructor(%struct.P* %P.obj, i32 %19)
  %20 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %21 = call i32 @$ref.0.fr2.$P.$Keep.i32.0(i32 %18, %struct.P* %P.obj, %struct.Keep* %20)
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %23, i32* %sum.addr, align 4
  %25 = load i32, i32* %i.addr, align 4
  %26 = icmp eq i32 %25, 2
  br i1 %26, label %if.then, label %if.end

if.then:
  %27 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %28 = getelementptr inbounds %struct.Slot, %struct.Slot* %27, i32 0, i32 0
  store i32 4, i32* %28, align 4, !tbaa !9
  br label %if.end

if.end:
  %29 = load i32, i32* %sum.addr, align 4
  %30 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %31 = getelementptr inbounds %struct.Slot, %struct.Slot* %30, i32 0, i32 0
  %32 = load i32, i32* %31, align 4, !tbaa !9
  %33 = call i8* @nish_alloc_struct(i64 4)
  %34 = bitcast i8* %33 to %struct.P*
  %35 = load i32, i32* %i.addr, align 4
  call void @P.constructor(%struct.P* %34, i32 %35)
  %36 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %37 = call i32 @$ref.0.fr2.$P.$Keep.i32.1(i32 %32, %struct.P* %34, %struct.Keep* %36)
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %39, i32* %sum.addr, align 4
  %41 = load i32, i32* %i.addr, align 4
  %42 = add nsw i32 %41, 1
  store i32 %42, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %43 = load i32, i32* %sum.addr, align 4
  %44 = call i8* @nish_str_from_i32(i32 %43)
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %46 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %47 = getelementptr inbounds %struct.Keep, %struct.Keep* %46, i32 0, i32 0
  %48 = load %struct.P*, %struct.P** %47, align 8, !tbaa !7
  %49 = getelementptr inbounds %struct.P, %struct.P* %48, i32 0, i32 0
  %50 = load i32, i32* %49, align 4, !tbaa !4
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* %45, i8* %51)
  call void @nish_print(i8* %52)
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
  ]

sw.case:
  %0 = call i32 @readX(%struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %0

sw.default:
  %1 = call i32 @readTwice(%struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %1
}

define internal noundef i32 @$ref.0.fr2.$P.$Keep.i32.1(i32 noundef %$t, %struct.P* noundef nonnull align 8 dereferenceable(4) %$a0, %struct.Keep* noundef nonnull align 8 dereferenceable(8) nocapture %$a1) #2 {
entry:
  switch i32 %$t, label %sw.default [
    i32 3, label %sw.case
  ]

sw.case:
  %0 = call i32 @keepIt(%struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %0

sw.default:
  %1 = call i32 @keepPlus(%struct.P* %$a0, %struct.Keep* %$a1)
  ret i32 %1
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

!llvm.module.flags = !{!23, !24, !25, !26, !27}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"P", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Keep", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"Slot", !2, i64 0}
!9 = !{!8, !2, i64 0}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"element i32", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{i32 8, !"cf-protection-branch", i32 1}
!24 = !{i32 8, !"cf-protection-return", i32 1}
!25 = !{i32 8, !"branch-target-enforcement", i32 1}
!26 = !{i32 8, !"sign-return-address", i32 1}
!27 = !{i32 4, !"probe-stack", !"inline-asm"}
