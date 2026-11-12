%struct.Inner = type { i16, i8* }
%struct.Mixed = type { i8, i64, i32, double, i16, i8*, %struct.Inner, i8 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @fillMixed(%struct.Mixed*)
declare i32 @checkMixed(%struct.Mixed*)
declare i32 @isSentinel(i8*)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal noundef nonnull align 8 dereferenceable(72) %struct.Mixed* @filled() #0 {
entry:
  %m.addr = alloca %struct.Mixed*, align 8
  %0 = call i8* @nish_alloc_struct(i64 72)
  %1 = bitcast i8* %0 to %struct.Mixed*
  %2 = bitcast %struct.Mixed* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 72, i1 false)
  store %struct.Mixed* %1, %struct.Mixed** %m.addr, align 8
  %3 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  call void @fillMixed(%struct.Mixed* %3)
  %4 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  ret %struct.Mixed* %4
}

define noundef i8 @readA() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Mixed* @filled()
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %0, i32 0, i32 0
  %2 = load i8, i8* %1, align 1
  call void @nish_arena_release(i64 %arena.mark)
  ret i8 %2
}

define noundef i64 @readB() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Mixed* @filled()
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %0, i32 0, i32 1
  %2 = load i64, i64* %1, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret i64 %2
}

define noundef i32 @readC() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Mixed* @filled()
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %0, i32 0, i32 2
  %2 = load i32, i32* %1, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %2
}

define noundef double @readD() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Mixed* @filled()
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %0, i32 0, i32 3
  %2 = load double, double* %1, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret double %2
}

define noundef i16 @readE() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Mixed* @filled()
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %0, i32 0, i32 4
  %2 = load i16, i16* %1, align 2
  call void @nish_arena_release(i64 %arena.mark)
  ret i16 %2
}

define noundef i16 @readTag() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Mixed* @filled()
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %0, i32 0, i32 6
  %2 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0
  %3 = load i16, i16* %2, align 2
  call void @nish_arena_release(i64 %arena.mark)
  ret i16 %3
}

define noundef i8 @readZ() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Mixed* @filled()
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %0, i32 0, i32 7
  %2 = load i8, i8* %1, align 1
  call void @nish_arena_release(i64 %arena.mark)
  ret i8 %2
}

define noundef i32 @readPointers() #0 {
entry:
  %m.addr = alloca %struct.Mixed*, align 8
  %link.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Mixed* @filled()
  store %struct.Mixed* %0, %struct.Mixed** %m.addr, align 8
  %1 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %2 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %1, i32 0, i32 6
  %3 = getelementptr inbounds %struct.Inner, %struct.Inner* %2, i32 0, i32 1
  %4 = load i8*, i8** %3, align 8
  store i8* %4, i8** %link.addr, align 8
  %5 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %6 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %5, i32 0, i32 5
  %7 = load i8*, i8** %6, align 8
  %8 = call i32 @isSentinel(i8* %7)
  %9 = load i8*, i8** %link.addr, align 8
  %10 = icmp eq i8* %9, null
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %11 = load i8*, i8** %link.addr, align 8
  %12 = call i32 @isSentinel(i8* %11)
  %13 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %12, i32 2)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %16 = phi i32 [ 0, %cond.true ], [ %14, %ovf.ok ]
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %18

ovf.fail:
  %ovf.op = phi i32 [ 2, %cond.false ], [ 0, %cond.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @zeroFields() #0 {
entry:
  %Mixed.obj = alloca %struct.Mixed, align 8
  %0 = bitcast %struct.Mixed* %Mixed.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %0, i8 0, i64 72, i1 false)
  %1 = call i32 @checkMixed(%struct.Mixed* %Mixed.obj)
  ret i32 %1
}

define noundef i32 @writtenFields() #0 {
entry:
  %m.addr = alloca %struct.Mixed*, align 8
  %Mixed.obj = alloca %struct.Mixed, align 8
  %0 = bitcast %struct.Mixed* %Mixed.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %0, i8 0, i64 72, i1 false)
  store %struct.Mixed* %Mixed.obj, %struct.Mixed** %m.addr, align 8
  %1 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %2 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %1, i32 0, i32 0
  store i8 200, i8* %2, align 1
  %3 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %4 = sext i32 16909060 to i64
  %5 = shl i64 %4, 32
  %6 = or i64 %5, 84281096
  %7 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %3, i32 0, i32 1
  store i64 %6, i64* %7, align 8
  %8 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %9 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %8, i32 0, i32 2
  store i32 -5, i32* %9, align 4
  %10 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %11 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %10, i32 0, i32 3
  store double 0x4004000000000000, double* %11, align 8
  %12 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %13 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %12, i32 0, i32 4
  store i16 65535, i16* %13, align 2
  %14 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %15 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %14, i32 0, i32 6
  %16 = getelementptr inbounds %struct.Inner, %struct.Inner* %15, i32 0, i32 0
  store i16 48879, i16* %16, align 2
  %17 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %18 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %17, i32 0, i32 7
  store i8 9, i8* %18, align 1
  %19 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %20 = call i32 @checkMixed(%struct.Mixed* %19)
  ret i32 %20
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
