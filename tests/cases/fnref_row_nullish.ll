%struct.Holder = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

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

define internal noundef i32 @u1(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @u2(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @u3(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 3
  ret i32 %0
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %f) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store i32 %f, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef align 8 %struct.Holder* @find(i32 noundef %n) #1 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 4)
  %2 = bitcast i8* %1 to %struct.Holder*
  call void @Holder.constructor(%struct.Holder* %2, i32 3)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi %struct.Holder* [ %2, %cond.true ], [ null, %cond.false ]
  ret %struct.Holder* %3
}

define void @nish_main() #2 {
entry:
  %other.addr = alloca i32, align 4
  %g.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 2, i32* %other.addr, align 4
  %0 = call %struct.Holder* @find(i32 1)
  %1 = icmp eq %struct.Holder* %0, null
  br i1 %1, label %nullish.default, label %chain.next

chain.next:
  %2 = getelementptr inbounds %struct.Holder, %struct.Holder* %0, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %4 = phi i32 [ %3, %chain.next ], [ 1, %nullish.default ]
  store i32 %4, i32* %g.addr, align 4
  %5 = call %struct.Holder* @find(i32 0)
  %6 = icmp eq %struct.Holder* %5, null
  br i1 %6, label %nullish.default.1, label %chain.next.1

chain.next.1:
  %7 = getelementptr inbounds %struct.Holder, %struct.Holder* %5, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !4
  br label %nullish.end.1

nullish.default.1:
  br label %nullish.end.1

nullish.end.1:
  %9 = phi i32 [ %8, %chain.next.1 ], [ 1, %nullish.default.1 ]
  store i32 %9, i32* %d.addr, align 4
  %10 = load i32, i32* %g.addr, align 4
  %11 = call i32 @$ref.0.fr1.i32.i32.0(i32 %10, i32 10)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = load i32, i32* %d.addr, align 4
  %15 = call i32 @$ref.0.fr1.i32.i32.0(i32 %14, i32 10)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %13, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %19 = load i32, i32* %other.addr, align 4
  %20 = call i32 @$ref.0.fr1.i32.i32.1(i32 %19, i32 10)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %18, i8* %21)
  call void @nish_print(i8* %22)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @u1(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @u3(i32 %$a0)
  ret i32 %1
}

define internal noundef i32 @$ref.0.fr1.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @u2(i32 %$a0)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Holder", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}
