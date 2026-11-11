%struct.Inner = type { i32 }
%struct.Outer = type { i32, %struct.Inner* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define void @nish_main() #0 {
entry:
  %a.addr = alloca %struct.Outer*, align 8
  %Outer.obj = alloca %struct.Outer, align 8
  %shared.addr = alloca %struct.Outer*, align 8
  %Outer.obj.1 = alloca %struct.Outer, align 8
  %fresh.addr = alloca %struct.Outer*, align 8
  %Outer.obj.2 = alloca %struct.Outer, align 8
  %0 = getelementptr inbounds %struct.Outer, %struct.Outer* %Outer.obj, i32 0, i32 0
  store i32 1, i32* %0, align 4
  %1 = call i8* @nish_alloc_struct(i64 4)
  %2 = bitcast i8* %1 to %struct.Inner*
  %3 = getelementptr inbounds %struct.Inner, %struct.Inner* %2, i32 0, i32 0
  store i32 2, i32* %3, align 4
  %4 = getelementptr inbounds %struct.Outer, %struct.Outer* %Outer.obj, i32 0, i32 1
  store %struct.Inner* %2, %struct.Inner** %4, align 8
  store %struct.Outer* %Outer.obj, %struct.Outer** %a.addr, align 8
  %5 = load %struct.Outer*, %struct.Outer** %a.addr, align 8
  %6 = getelementptr inbounds %struct.Outer, %struct.Outer* %5, i32 0, i32 1
  %7 = load %struct.Inner*, %struct.Inner** %6, align 8
  %8 = getelementptr inbounds %struct.Outer, %struct.Outer* %Outer.obj.1, i32 0, i32 1
  store %struct.Inner* %7, %struct.Inner** %8, align 8
  %9 = getelementptr inbounds %struct.Outer, %struct.Outer* %Outer.obj.1, i32 0, i32 0
  store i32 2, i32* %9, align 4
  store %struct.Outer* %Outer.obj.1, %struct.Outer** %shared.addr, align 8
  %10 = load %struct.Outer*, %struct.Outer** %a.addr, align 8
  %11 = getelementptr inbounds %struct.Outer, %struct.Outer* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4
  %13 = getelementptr inbounds %struct.Outer, %struct.Outer* %Outer.obj.2, i32 0, i32 0
  store i32 %12, i32* %13, align 4
  %14 = call i8* @nish_alloc_struct(i64 4)
  %15 = bitcast i8* %14 to %struct.Inner*
  %16 = getelementptr inbounds %struct.Inner, %struct.Inner* %15, i32 0, i32 0
  store i32 9, i32* %16, align 4
  %17 = getelementptr inbounds %struct.Outer, %struct.Outer* %Outer.obj.2, i32 0, i32 1
  store %struct.Inner* %15, %struct.Inner** %17, align 8
  store %struct.Outer* %Outer.obj.2, %struct.Outer** %fresh.addr, align 8
  %18 = load %struct.Outer*, %struct.Outer** %shared.addr, align 8
  %19 = getelementptr inbounds %struct.Outer, %struct.Outer* %18, i32 0, i32 1
  %20 = load %struct.Inner*, %struct.Inner** %19, align 8
  %21 = getelementptr inbounds %struct.Inner, %struct.Inner* %20, i32 0, i32 0
  store i32 5, i32* %21, align 4
  %22 = load %struct.Outer*, %struct.Outer** %a.addr, align 8
  %23 = getelementptr inbounds %struct.Outer, %struct.Outer* %22, i32 0, i32 1
  %24 = load %struct.Inner*, %struct.Inner** %23, align 8
  %25 = getelementptr inbounds %struct.Inner, %struct.Inner* %24, i32 0, i32 0
  %26 = load i32, i32* %25, align 4
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %29 = load %struct.Outer*, %struct.Outer** %shared.addr, align 8
  %30 = getelementptr inbounds %struct.Outer, %struct.Outer* %29, i32 0, i32 0
  %31 = load i32, i32* %30, align 4
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* %28, i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %35 = load %struct.Outer*, %struct.Outer** %shared.addr, align 8
  %36 = getelementptr inbounds %struct.Outer, %struct.Outer* %35, i32 0, i32 1
  %37 = load %struct.Inner*, %struct.Inner** %36, align 8
  %38 = getelementptr inbounds %struct.Inner, %struct.Inner* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %34, i8* %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %43 = load %struct.Outer*, %struct.Outer** %fresh.addr, align 8
  %44 = getelementptr inbounds %struct.Outer, %struct.Outer* %43, i32 0, i32 0
  %45 = load i32, i32* %44, align 4
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %42, i8* %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %49 = load %struct.Outer*, %struct.Outer** %fresh.addr, align 8
  %50 = getelementptr inbounds %struct.Outer, %struct.Outer* %49, i32 0, i32 1
  %51 = load %struct.Inner*, %struct.Inner** %50, align 8
  %52 = getelementptr inbounds %struct.Inner, %struct.Inner* %51, i32 0, i32 0
  %53 = load i32, i32* %52, align 4
  %54 = call i8* @nish_str_from_i32(i32 %53)
  %55 = call i8* @nish_str_concat(i8* %48, i8* %54)
  call void @nish_print(i8* %55)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
