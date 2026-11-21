%struct.ShaCtx = type { i8, [5 x i32], i64, i16, [3 x i8], double }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @fillCtx(%struct.ShaCtx*)
declare i32 @checkCtx(%struct.ShaCtx*)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 dereferenceable(48) %struct.ShaCtx* @filled() #0 {
entry:
  %c.addr = alloca %struct.ShaCtx*, align 8
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.ShaCtx*
  %2 = bitcast %struct.ShaCtx* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 48, i1 false)
  store %struct.ShaCtx* %1, %struct.ShaCtx** %c.addr, align 8
  %3 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  call void @fillCtx(%struct.ShaCtx* %3)
  %4 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  ret %struct.ShaCtx* %4
}

define noundef i32 @readH(i32 noundef %i) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.ShaCtx* @filled()
  %1 = sext i32 %i to i64
  %2 = icmp ult i64 %1, 5
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 5)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %0, i32 0, i32 1, i64 %1
  %4 = load i32, i32* %3, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %4
}

define noundef i8 @readData(i32 noundef %i) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.ShaCtx* @filled()
  %1 = sext i32 %i to i64
  %2 = icmp ult i64 %1, 3
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 3)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %0, i32 0, i32 4, i64 %1
  %4 = load i8, i8* %3, align 1
  call void @nish_arena_release(i64 %arena.mark)
  ret i8 %4
}

define noundef i32 @sumH() #0 {
entry:
  %c.addr = alloca %struct.ShaCtx*, align 8
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.ShaCtx* @filled()
  store %struct.ShaCtx* %0, %struct.ShaCtx** %c.addr, align 8
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, 5
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = load i32, i32* %sum.addr, align 4
  %4 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %5 = load i32, i32* %i.addr, align 4
  %6 = sext i32 %5 to i64
  %7 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %4, i32 0, i32 1, i64 %6
  %8 = load i32, i32* %7, align 4
  %9 = add i32 %3, %8
  store i32 %9, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %10 = load i32, i32* %i.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %12 = load i32, i32* %sum.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %12
}

define internal void @store(%struct.ShaCtx* noundef nonnull align 8 dereferenceable(48) nocapture %c, i32 noundef %i, i8 noundef %v) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = icmp ult i64 %0, 3
  br i1 %1, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 3)
  unreachable

bounds.ok:
  %2 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %c, i32 0, i32 4, i64 %0
  store i8 %v, i8* %2, align 1
  ret void
}

define noundef i32 @poke(i32 noundef %i) #0 {
entry:
  %c.addr = alloca %struct.ShaCtx*, align 8
  %ShaCtx.obj = alloca %struct.ShaCtx, align 8
  %0 = bitcast %struct.ShaCtx* %ShaCtx.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %0, i8 0, i64 48, i1 false)
  store %struct.ShaCtx* %ShaCtx.obj, %struct.ShaCtx** %c.addr, align 8
  %1 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  call void @store(%struct.ShaCtx* %1, i32 %i, i8 187)
  %2 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %3 = call i32 @checkCtx(%struct.ShaCtx* %2)
  ret i32 %3
}

define noundef double @readScalars() #0 {
entry:
  %c.addr = alloca %struct.ShaCtx*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.ShaCtx* @filled()
  store %struct.ShaCtx* %0, %struct.ShaCtx** %c.addr, align 8
  %1 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %2 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %1, i32 0, i32 0
  %3 = load i8, i8* %2, align 1
  %4 = uitofp i8 %3 to double
  %5 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %6 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %5, i32 0, i32 2
  %7 = load i64, i64* %6, align 8
  %8 = uitofp i64 %7 to double
  %9 = fadd double %4, %8
  %10 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %11 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %10, i32 0, i32 3
  %12 = load i16, i16* %11, align 2
  %13 = uitofp i16 %12 to double
  %14 = fadd double %9, %13
  %15 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %16 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %15, i32 0, i32 5
  %17 = load double, double* %16, align 8
  %18 = fadd double %14, %17
  call void @nish_arena_release(i64 %arena.mark)
  ret double %18
}

define noundef i32 @zeroed() #0 {
entry:
  %ShaCtx.obj = alloca %struct.ShaCtx, align 8
  %0 = bitcast %struct.ShaCtx* %ShaCtx.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %0, i8 0, i64 48, i1 false)
  %1 = call i32 @checkCtx(%struct.ShaCtx* %ShaCtx.obj)
  ret i32 %1
}

define noundef i32 @written() #0 {
entry:
  %c.addr = alloca %struct.ShaCtx*, align 8
  %ShaCtx.obj = alloca %struct.ShaCtx, align 8
  %0 = bitcast %struct.ShaCtx* %ShaCtx.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %0, i8 0, i64 48, i1 false)
  store %struct.ShaCtx* %ShaCtx.obj, %struct.ShaCtx** %c.addr, align 8
  %1 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %2 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %1, i32 0, i32 0
  store i8 1, i8* %2, align 1
  %3 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %4 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %3, i32 0, i32 1, i64 0
  store i32 1732584193, i32* %4, align 4
  %5 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %6 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %5, i32 0, i32 1, i64 1
  store i32 4023233416, i32* %6, align 4
  %7 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %8 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %7, i32 0, i32 1, i64 2
  store i32 2562383102, i32* %8, align 4
  %9 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %10 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %9, i32 0, i32 1, i64 3
  store i32 271733878, i32* %10, align 4
  %11 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %12 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %11, i32 0, i32 1, i64 4
  store i32 3285377520, i32* %12, align 4
  %13 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %14 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %13, i32 0, i32 1, i64 1
  %15 = load i32, i32* %14, align 4
  %16 = add i32 %15, 1
  store i32 %16, i32* %14, align 4
  %17 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %18 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %17, i32 0, i32 2
  store i64 64, i64* %18, align 8
  %19 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %20 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %19, i32 0, i32 3
  store i16 7, i16* %20, align 2
  %21 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %22 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %21, i32 0, i32 4, i64 0
  store i8 170, i8* %22, align 1
  %23 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %24 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %23, i32 0, i32 4, i64 1
  store i8 187, i8* %24, align 1
  %25 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %26 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %25, i32 0, i32 4, i64 2
  store i8 76, i8* %26, align 1
  %27 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %28 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %27, i32 0, i32 4, i64 2
  %29 = load i8, i8* %28, align 1
  %30 = or i8 %29, 128
  store i8 %30, i8* %28, align 1
  %31 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %32 = getelementptr inbounds %struct.ShaCtx, %struct.ShaCtx* %31, i32 0, i32 5
  store double 0x3FE0000000000000, double* %32, align 8
  %33 = load %struct.ShaCtx*, %struct.ShaCtx** %c.addr, align 8
  %34 = call i32 @checkCtx(%struct.ShaCtx* %33)
  ret i32 %34
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
