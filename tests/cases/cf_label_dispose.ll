%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @arenas() #0 {
entry:
  %out.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %tag.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %out.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp slt i32 %6, 3
  br i1 %7, label %for.body.1, label %for.end.1

for.body.1:
  %8 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %9 = load i8*, i8** %8, align 8
  %10 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %11 = load i64, i64* %10, align 8
  %12 = call i64 @nish_arena_mark()
  store i64 %12, i64* %a.addr, align 8
  %13 = load i64, i64* %a.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = load i32, i32* %j.addr, align 4
  %17 = call i8* @nish_str_from_i32(i32 %16)
  %18 = call i8* @nish_str_concat(i8* %15, i8* %17)
  store i8* %18, i8** %tag.addr, align 8
  %19 = load i32, i32* %j.addr, align 4
  %20 = icmp eq i32 %19, 1
  br i1 %20, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %13)
  %21 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %22 = load i8*, i8** %21, align 8
  %23 = icmp eq i8* %22, %3
  br i1 %23, label %pass.rewind, label %pass.free

pass.rewind:
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %24, align 8
  br label %pass.done

pass.free:
  %25 = ptrtoint i8* %3 to i64
  %26 = add i64 %25, %5
  call void @nish_arena_release(i64 %26)
  br label %pass.done

pass.done:
  br label %for.inc

if.end:
  %27 = load i32, i32* %i.addr, align 4
  %28 = icmp eq i32 %27, 2
  br i1 %28, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_arena_release(i64 %13)
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %30 = load i8*, i8** %29, align 8
  %31 = icmp eq i8* %30, %3
  br i1 %31, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %32 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %32, align 8
  br label %pass.done.1

pass.free.1:
  %33 = ptrtoint i8* %3 to i64
  %34 = add i64 %33, %5
  call void @nish_arena_release(i64 %34)
  br label %pass.done.1

pass.done.1:
  br label %for.end

if.end.1:
  %35 = load i32, i32* %out.addr, align 4
  %36 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %35, i32 100)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok

ovf.ok:
  %39 = load i8*, i8** %tag.addr, align 8
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = trunc i64 %41 to i32
  %43 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %42, i32 10)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %46 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %37, i32 %44)
  %47 = extractvalue { i32, i1 } %46, 0
  %48 = extractvalue { i32, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %49 = load i32, i32* %i.addr, align 4
  %50 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 %49)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %51, i32* %out.addr, align 4
  call void @nish_arena_release(i64 %13)
  %53 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %54 = load i8*, i8** %53, align 8
  %55 = icmp eq i8* %54, %9
  br i1 %55, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %56 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %11, i64* %56, align 8
  br label %pass.done.2

pass.free.2:
  %57 = ptrtoint i8* %9 to i64
  %58 = add i64 %57, %11
  call void @nish_arena_release(i64 %58)
  br label %pass.done.2

pass.done.2:
  br label %for.inc.1

for.inc.1:
  %59 = load i32, i32* %j.addr, align 4
  %60 = add nsw i32 %59, 1
  store i32 %60, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %61 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %62 = load i8*, i8** %61, align 8
  %63 = icmp eq i8* %62, %3
  br i1 %63, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %64 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %64, align 8
  br label %pass.done.3

pass.free.3:
  %65 = ptrtoint i8* %3 to i64
  %66 = add i64 %65, %5
  call void @nish_arena_release(i64 %66)
  br label %pass.done.3

pass.done.3:
  br label %for.inc

for.inc:
  %67 = load i32, i32* %i.addr, align 4
  %68 = add nsw i32 %67, 1
  store i32 %68, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %69 = load i32, i32* %out.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %69

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.end.1 ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @arenas()
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
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

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
