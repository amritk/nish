%struct.Base = type { i32, i32 }
%struct.Holder = type { %struct.Base* }
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
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %s.addr = alloca %struct.Base*, align 8
  %p.addr = alloca %struct.Base*, align 8
  %Base.obj = alloca %struct.Base, align 8
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj, i32 0, i32 0
  store %struct.Base* null, %struct.Base** %0, align 8, !tbaa !4
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %1 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Base*
  %4 = getelementptr inbounds %struct.Base, %struct.Base* %3, i32 0, i32 0
  store i32 4, i32* %4, align 4
  %5 = getelementptr inbounds %struct.Base, %struct.Base* %3, i32 0, i32 1
  store i32 5, i32* %5, align 4
  %6 = getelementptr inbounds %struct.Holder, %struct.Holder* %1, i32 0, i32 0
  store %struct.Base* %3, %struct.Base** %6, align 8, !tbaa !4
  %7 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %7, i32 0, i32 0
  %9 = load %struct.Base*, %struct.Base** %8, align 8, !tbaa !4
  store %struct.Base* %9, %struct.Base** %s.addr, align 8
  %10 = load %struct.Base*, %struct.Base** %s.addr, align 8
  %11 = icmp ne %struct.Base* %10, null
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load %struct.Base*, %struct.Base** %s.addr, align 8
  %13 = getelementptr inbounds %struct.Base, %struct.Base* %12, i32 0, i32 0
  %14 = load i32, i32* %13, align 4
  %15 = getelementptr inbounds %struct.Base, %struct.Base* %Base.obj, i32 0, i32 0
  store i32 %14, i32* %15, align 4
  %16 = getelementptr inbounds %struct.Base, %struct.Base* %Base.obj, i32 0, i32 1
  store i32 6, i32* %16, align 4
  store %struct.Base* %Base.obj, %struct.Base** %p.addr, align 8
  %17 = load %struct.Base*, %struct.Base** %p.addr, align 8
  %18 = getelementptr inbounds %struct.Base, %struct.Base* %17, i32 0, i32 0
  %19 = load i32, i32* %18, align 4
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %22 = load %struct.Base*, %struct.Base** %p.addr, align 8
  %23 = getelementptr inbounds %struct.Base, %struct.Base* %22, i32 0, i32 1
  %24 = load i32, i32* %23, align 4
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %21, i8* %25)
  call void @nish_print(i8* %26)
  br label %if.end

if.end:
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

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Holder", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}
