%struct.Indirect = type { i32 }
%struct.Ping = type { %struct.Pong* }
%struct.Pong = type { %struct.Ping* }
%struct.Tail = type { i32 }
%struct.Opt = type { %struct.Opt* }
%struct.Box$str = type { i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

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

define internal noundef i32 @inc(i32 noundef %n) #0 {
entry:
  %0 = add nsw i32 %n, 1
  ret i32 %0
}

define internal void @Indirect.constructor(%struct.Indirect* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %step) #1 {
entry:
  %0 = getelementptr inbounds %struct.Indirect, %struct.Indirect* %this, i32 0, i32 0
  store i32 %step, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Indirect.run(%struct.Indirect* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #2 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = getelementptr inbounds %struct.Indirect, %struct.Indirect* %this, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  %3 = sub nsw i32 %n, 1
  %4 = call i32 @$ref.0.fr1.i32.i32.0(i32 %2, i32 %3)
  %5 = add nsw i32 %n, %4
  ret i32 %5
}

define internal void @Ping.constructor(%struct.Ping* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Pong* noundef align 8 %other) #1 {
entry:
  %0 = getelementptr inbounds %struct.Ping, %struct.Ping* %this, i32 0, i32 0
  store %struct.Pong* %other, %struct.Pong** %0, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @Ping.walk(%struct.Ping* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #3 {
entry:
  %other.addr = alloca %struct.Pong*, align 8
  %0 = getelementptr inbounds %struct.Ping, %struct.Ping* %this, i32 0, i32 0
  %1 = load %struct.Pong*, %struct.Pong** %0, align 8, !tbaa !7
  store %struct.Pong* %1, %struct.Pong** %other.addr, align 8
  %2 = icmp sle i32 %n, 0
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = load %struct.Pong*, %struct.Pong** %other.addr, align 8
  %4 = icmp eq %struct.Pong* %3, null
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %6 = load %struct.Pong*, %struct.Pong** %other.addr, align 8
  %7 = sub nsw i32 %n, 1
  %8 = call i32 @Pong.walk(%struct.Pong* %6, i32 %7)
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Pong.constructor(%struct.Pong* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Ping* noundef align 8 %other) #1 {
entry:
  %0 = getelementptr inbounds %struct.Pong, %struct.Pong* %this, i32 0, i32 0
  store %struct.Ping* %other, %struct.Ping** %0, align 8, !tbaa !9
  ret void
}

define internal noundef i32 @Pong.walk(%struct.Pong* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #3 {
entry:
  %other.addr = alloca %struct.Ping*, align 8
  %0 = getelementptr inbounds %struct.Pong, %struct.Pong* %this, i32 0, i32 0
  %1 = load %struct.Ping*, %struct.Ping** %0, align 8, !tbaa !9
  store %struct.Ping* %1, %struct.Ping** %other.addr, align 8
  %2 = icmp sle i32 %n, 0
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = load %struct.Ping*, %struct.Ping** %other.addr, align 8
  %4 = icmp eq %struct.Ping* %3, null
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %6 = load %struct.Ping*, %struct.Ping** %other.addr, align 8
  %7 = sub nsw i32 %n, 1
  %8 = call i32 @Ping.walk(%struct.Ping* %6, i32 %7)
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Tail.constructor(%struct.Tail* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %f) #1 {
entry:
  %0 = getelementptr inbounds %struct.Tail, %struct.Tail* %this, i32 0, i32 0
  store i32 %f, i32* %0, align 4, !tbaa !11
  ret void
}

define internal noundef i32 @Tail.m(%struct.Tail* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #3 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @Tail.m(%struct.Tail* %this, i32 %1)
  %3 = getelementptr inbounds %struct.Tail, %struct.Tail* %this, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !11
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Opt.constructor(%struct.Opt* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Opt* noundef align 8 %next) #1 {
entry:
  %0 = getelementptr inbounds %struct.Opt, %struct.Opt* %this, i32 0, i32 0
  store %struct.Opt* %next, %struct.Opt** %0, align 8, !tbaa !13
  ret void
}

define internal noundef i32 @Opt.m(%struct.Opt* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #3 {
entry:
  %r.addr = alloca %struct.Opt*, align 8
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = getelementptr inbounds %struct.Opt, %struct.Opt* %this, i32 0, i32 0
  %2 = load %struct.Opt*, %struct.Opt** %1, align 8, !tbaa !13
  store %struct.Opt* %2, %struct.Opt** %r.addr, align 8
  %3 = load %struct.Opt*, %struct.Opt** %r.addr, align 8
  %4 = icmp eq %struct.Opt* %3, null
  br i1 %4, label %nullish.default, label %chain.next

chain.next:
  %5 = sub nsw i32 %n, 1
  %6 = call i32 @Opt.m(%struct.Opt* %3, i32 %5)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %7 = phi i32 [ %6, %chain.next ], [ 0, %nullish.default ]
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #3 {
entry:
  %pong.addr = alloca %struct.Pong*, align 8
  %ping.addr = alloca %struct.Ping*, align 8
  %box.addr = alloca %struct.Box$str*, align 8
  %Box$str.obj = alloca %struct.Box$str, align 8
  %opt.addr = alloca %struct.Opt*, align 8
  %Indirect.obj = alloca %struct.Indirect, align 8
  %Tail.obj = alloca %struct.Tail, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pong*
  call void @Pong.constructor(%struct.Pong* %1, %struct.Ping* null)
  store %struct.Pong* %1, %struct.Pong** %pong.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Ping*
  %4 = load %struct.Pong*, %struct.Pong** %pong.addr, align 8
  call void @Ping.constructor(%struct.Ping* %3, %struct.Pong* %4)
  store %struct.Ping* %3, %struct.Ping** %ping.addr, align 8
  %5 = load %struct.Pong*, %struct.Pong** %pong.addr, align 8
  %6 = load %struct.Ping*, %struct.Ping** %ping.addr, align 8
  %7 = getelementptr inbounds %struct.Pong, %struct.Pong* %5, i32 0, i32 0
  store %struct.Ping* %6, %struct.Ping** %7, align 8, !tbaa !9
  call void @Box$str.constructor(%struct.Box$str* %Box$str.obj, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  store %struct.Box$str* %Box$str.obj, %struct.Box$str** %box.addr, align 8
  %8 = call i8* @nish_alloc_struct(i64 8)
  %9 = bitcast i8* %8 to %struct.Opt*
  call void @Opt.constructor(%struct.Opt* %9, %struct.Opt* null)
  store %struct.Opt* %9, %struct.Opt** %opt.addr, align 8
  %10 = load %struct.Opt*, %struct.Opt** %opt.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 8)
  %12 = bitcast i8* %11 to %struct.Opt*
  %13 = load %struct.Opt*, %struct.Opt** %opt.addr, align 8
  call void @Opt.constructor(%struct.Opt* %12, %struct.Opt* %13)
  %14 = getelementptr inbounds %struct.Opt, %struct.Opt* %10, i32 0, i32 0
  store %struct.Opt* %12, %struct.Opt** %14, align 8, !tbaa !13
  call void @Indirect.constructor(%struct.Indirect* %Indirect.obj, i32 1)
  %15 = call i32 @Indirect.run(%struct.Indirect* %Indirect.obj, i32 10)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %18 = load %struct.Ping*, %struct.Ping** %ping.addr, align 8
  %19 = call i32 @Ping.walk(%struct.Ping* %18, i32 10)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %23 = load %struct.Box$str*, %struct.Box$str** %box.addr, align 8
  %24 = call i32 @Box$str.count(%struct.Box$str* %23, i32 10)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  call void @Tail.constructor(%struct.Tail* %Tail.obj, i32 2)
  %28 = call i32 @Tail.m(%struct.Tail* %Tail.obj, i32 10)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %27, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %32 = load %struct.Opt*, %struct.Opt** %opt.addr, align 8
  %33 = call i32 @Opt.m(%struct.Opt* %32, i32 10)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %31, i8* %34)
  call void @nish_print(i8* %35)
  ret i32 0
}

define internal void @Box$str.constructor(%struct.Box$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %item) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  store i8* %item, i8** %0, align 8, !tbaa !15
  ret void
}

define internal noundef i32 @Box$str.count(%struct.Box$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #3 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @Box$str.count(%struct.Box$str* %this, i32 %1)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @inc(i32 %$a0)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!16, !17, !18, !19, !20}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Indirect", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Ping", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"Pong", !5, i64 0}
!9 = !{!8, !5, i64 0}
!10 = !{!"Tail", !2, i64 0}
!11 = !{!10, !2, i64 0}
!12 = !{!"Opt", !5, i64 0}
!13 = !{!12, !5, i64 0}
!14 = !{!"Box$str", !5, i64 0}
!15 = !{!14, !5, i64 0}
!16 = !{i32 8, !"cf-protection-branch", i32 1}
!17 = !{i32 8, !"cf-protection-return", i32 1}
!18 = !{i32 8, !"branch-target-enforcement", i32 1}
!19 = !{i32 8, !"sign-return-address", i32 1}
!20 = !{i32 4, !"probe-stack", !"inline-asm"}
