%struct.Base = type { i32, i32, i8* }
%struct.Point = type { i32, i32, i8*, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"eval \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"first\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"second\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
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

define internal noundef nonnull align 8 dereferenceable(16) %struct.Base* @mark(i8* noundef nonnull noalias readonly align 8 nocapture %label, %struct.Base* noundef nonnull align 8 dereferenceable(16) %b) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %label)
  call void @nish_print(i8* %0)
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.Base* %b
}

define internal noundef i32 @tick(i8* noundef nonnull noalias readonly align 8 nocapture %label, i32 noundef %v) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %label)
  call void @nish_print(i8* %0)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %v
}

define void @nish_main() #0 {
entry:
  %a.addr = alloca %struct.Base*, align 8
  %b.addr = alloca %struct.Base*, align 8
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %q.addr = alloca %struct.Point*, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Base*
  %2 = getelementptr inbounds %struct.Base, %struct.Base* %1, i32 0, i32 0
  store i32 1, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Base, %struct.Base* %1, i32 0, i32 1
  store i32 2, i32* %3, align 4
  %4 = getelementptr inbounds %struct.Base, %struct.Base* %1, i32 0, i32 2
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %4, align 8
  store %struct.Base* %1, %struct.Base** %a.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.Base*
  %7 = getelementptr inbounds %struct.Base, %struct.Base* %6, i32 0, i32 0
  store i32 3, i32* %7, align 4
  %8 = getelementptr inbounds %struct.Base, %struct.Base* %6, i32 0, i32 1
  store i32 4, i32* %8, align 4
  %9 = getelementptr inbounds %struct.Base, %struct.Base* %6, i32 0, i32 2
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %9, align 8
  store %struct.Base* %6, %struct.Base** %b.addr, align 8
  %10 = call i32 @tick(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i32 9)
  %11 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 3
  store i32 %10, i32* %11, align 4
  %12 = load %struct.Base*, %struct.Base** %a.addr, align 8
  %13 = call %struct.Base* @mark(i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*), %struct.Base* %12)
  %14 = load %struct.Base*, %struct.Base** %b.addr, align 8
  %15 = call %struct.Base* @mark(i8* bitcast ({ i64, [7 x i8] }* @.str.5 to i8*), %struct.Base* %14)
  %16 = getelementptr inbounds %struct.Base, %struct.Base* %15, i32 0, i32 1
  %17 = load i32, i32* %16, align 4
  %18 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 %17, i32* %18, align 4
  %19 = getelementptr inbounds %struct.Base, %struct.Base* %15, i32 0, i32 2
  %20 = load i8*, i8** %19, align 8
  %21 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 2
  store i8* %20, i8** %21, align 8
  %22 = call i32 @tick(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i32 10)
  %23 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 %22, i32* %23, align 4
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %24 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %25 = getelementptr inbounds %struct.Point, %struct.Point* %24, i32 0, i32 0
  %26 = load i32, i32* %25, align 4
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %29 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %30 = getelementptr inbounds %struct.Point, %struct.Point* %29, i32 0, i32 1
  %31 = load i32, i32* %30, align 4
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* %28, i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %35 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %36 = getelementptr inbounds %struct.Point, %struct.Point* %35, i32 0, i32 2
  %37 = load i8*, i8** %36, align 8
  %38 = call i8* @nish_str_concat(i8* %34, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %40 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %41 = getelementptr inbounds %struct.Point, %struct.Point* %40, i32 0, i32 3
  %42 = load i32, i32* %41, align 4
  %43 = call i8* @nish_str_from_i32(i32 %42)
  %44 = call i8* @nish_str_concat(i8* %39, i8* %43)
  call void @nish_print(i8* %44)
  %45 = load %struct.Base*, %struct.Base** %a.addr, align 8
  %46 = getelementptr inbounds %struct.Base, %struct.Base* %45, i32 0, i32 0
  %47 = load i32, i32* %46, align 4
  %48 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 0
  store i32 %47, i32* %48, align 4
  %49 = load %struct.Base*, %struct.Base** %a.addr, align 8
  %50 = getelementptr inbounds %struct.Base, %struct.Base* %49, i32 0, i32 1
  %51 = load i32, i32* %50, align 4
  %52 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 1
  store i32 %51, i32* %52, align 4
  %53 = load %struct.Base*, %struct.Base** %a.addr, align 8
  %54 = getelementptr inbounds %struct.Base, %struct.Base* %53, i32 0, i32 2
  %55 = load i8*, i8** %54, align 8
  %56 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 2
  store i8* %55, i8** %56, align 8
  %57 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 3
  store i32 0, i32* %57, align 4
  store %struct.Point* %Point.obj.1, %struct.Point** %q.addr, align 8
  %58 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %59 = getelementptr inbounds %struct.Point, %struct.Point* %58, i32 0, i32 0
  %60 = load i32, i32* %59, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %63 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %64 = getelementptr inbounds %struct.Point, %struct.Point* %63, i32 0, i32 1
  %65 = load i32, i32* %64, align 4
  %66 = call i8* @nish_str_from_i32(i32 %65)
  %67 = call i8* @nish_str_concat(i8* %62, i8* %66)
  %68 = call i8* @nish_str_concat(i8* %67, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %69 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %70 = getelementptr inbounds %struct.Point, %struct.Point* %69, i32 0, i32 2
  %71 = load i8*, i8** %70, align 8
  %72 = call i8* @nish_str_concat(i8* %68, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %74 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %75 = getelementptr inbounds %struct.Point, %struct.Point* %74, i32 0, i32 3
  %76 = load i32, i32* %75, align 4
  %77 = call i8* @nish_str_from_i32(i32 %76)
  %78 = call i8* @nish_str_concat(i8* %73, i8* %77)
  call void @nish_print(i8* %78)
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
