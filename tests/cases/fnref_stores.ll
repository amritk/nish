%struct.Holder = type { i32 }
%struct.Box = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @plus1(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @plus3(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 3
  ret i32 %0
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %f) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %f, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Box.set(%struct.Box* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %f) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %f, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @pick(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 2, %cond.true ], [ 1, %cond.false ]
  ret i32 %1
}

define internal noundef i32 @callOne(i32 noundef %f) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %f, i32 1)
  ret i32 %0
}

define void @nish_main() #2 {
entry:
  %b.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %first.addr = alloca i32, align 4
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %g.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Box.constructor(%struct.Box* %Box.obj, i32 2)
  store %struct.Box* %Box.obj, %struct.Box** %b.addr, align 8
  %0 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %1 = getelementptr inbounds %struct.Box, %struct.Box* %0, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  %3 = call i32 @$ref.0.fr1.i32.i32.0(i32 %2, i32 1)
  store i32 %3, i32* %first.addr, align 4
  %4 = load %struct.Box*, %struct.Box** %b.addr, align 8
  call void @Box.set(%struct.Box* %4, i32 1)
  %5 = call i32 @pick(i32 1)
  %6 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj, i32 0, i32 0
  store i32 %5, i32* %6, align 4
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  store i32 1, i32* %g.addr, align 4
  %7 = load i32, i32* %first.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %11 = getelementptr inbounds %struct.Box, %struct.Box* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !4
  %13 = call i32 @$ref.0.fr1.i32.i32.0(i32 %12, i32 1)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %9, i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %17 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %18 = getelementptr inbounds %struct.Holder, %struct.Holder* %17, i32 0, i32 0
  %19 = load i32, i32* %18, align 4
  %20 = call i32 @$ref.0.fr1.i32.i32.0(i32 %19, i32 1)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %16, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %24 = load i32, i32* %g.addr, align 4
  %25 = call i32 @$ref.0.fr1.fr1.i32.i32.i32.1(i32 %24, i32 2)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %23, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %29 = load i32, i32* %g.addr, align 4
  %30 = call i32 @pick(i32 0)
  %31 = call i32 @$ref.0.fr1.fr1.i32.i32.i32.1(i32 %29, i32 %30)
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* %28, i8* %32)
  call void @nish_print(i8* %33)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @plus1(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @plus3(i32 %$a0)
  ret i32 %1
}

define internal noundef i32 @$ref.0.fr1.fr1.i32.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = call i32 @callOne(i32 %$a0)
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

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}
