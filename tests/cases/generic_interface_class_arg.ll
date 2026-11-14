%struct.Named = type { i8* }
%struct.A = type { i8* }
%struct.B = type { i8*, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

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

define void @nish_main() #0 {
entry:
  %a.addr = alloca %struct.Named*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.A*
  %2 = getelementptr inbounds %struct.A, %struct.A* %1, i32 0, i32 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %2, align 8
  %3 = bitcast %struct.A* %1 to %struct.Named*
  store %struct.Named* %3, %struct.Named** %a.addr, align 8
  %4 = load %struct.Named*, %struct.Named** %a.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.B*
  %7 = getelementptr inbounds %struct.B, %struct.B* %6, i32 0, i32 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %7, align 8
  %8 = getelementptr inbounds %struct.B, %struct.B* %6, i32 0, i32 1
  store i32 7, i32* %8, align 4
  %9 = bitcast %struct.B* %6 to %struct.Named*
  %10 = call %struct.Named* @pick$$Named(i32 1, %struct.Named* %4, %struct.Named* %9)
  %11 = getelementptr inbounds %struct.Named, %struct.Named* %10, i32 0, i32 0
  %12 = load i8*, i8** %11, align 8
  call void @nish_print(i8* %12)
  %13 = load %struct.Named*, %struct.Named** %a.addr, align 8
  %14 = call i8* @nish_alloc_struct(i64 16)
  %15 = bitcast i8* %14 to %struct.B*
  %16 = getelementptr inbounds %struct.B, %struct.B* %15, i32 0, i32 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %16, align 8
  %17 = getelementptr inbounds %struct.B, %struct.B* %15, i32 0, i32 1
  store i32 7, i32* %17, align 4
  %18 = bitcast %struct.B* %15 to %struct.Named*
  %19 = call %struct.Named* @pick$$Named(i32 0, %struct.Named* %13, %struct.Named* %18)
  %20 = getelementptr inbounds %struct.Named, %struct.Named* %19, i32 0, i32 0
  %21 = load i8*, i8** %20, align 8
  call void @nish_print(i8* %21)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Named* @pick$$Named(i32 noundef %n, %struct.Named* noundef nonnull align 8 dereferenceable(8) %first, %struct.Named* noundef nonnull align 8 dereferenceable(8) %second) #1 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi %struct.Named* [ %first, %cond.true ], [ %second, %cond.false ]
  ret %struct.Named* %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
