%struct.Pair$i32 = type { i32, i32 }
%struct.Pair$str = type { i8*, i32 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"s\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

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

define void @nish_main() #1 {
entry:
  %other.addr = alloca i32, align 4
  %n.addr = alloca %struct.Pair$i32*, align 8
  %Pair$i32.obj = alloca %struct.Pair$i32, align 8
  %s.addr = alloca %struct.Pair$str*, align 8
  %Pair$str.obj = alloca %struct.Pair$str, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 2, i32* %other.addr, align 4
  call void @Pair$i32.constructor(%struct.Pair$i32* %Pair$i32.obj, i32 1, i32 1)
  store %struct.Pair$i32* %Pair$i32.obj, %struct.Pair$i32** %n.addr, align 8
  call void @Pair$str.constructor(%struct.Pair$str* %Pair$str.obj, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 3)
  store %struct.Pair$str* %Pair$str.obj, %struct.Pair$str** %s.addr, align 8
  %0 = load %struct.Pair$i32*, %struct.Pair$i32** %n.addr, align 8
  %1 = getelementptr inbounds %struct.Pair$i32, %struct.Pair$i32* %0, i32 0, i32 1
  %2 = load i32, i32* %1, align 4, !tbaa !4
  %3 = call i32 @$ref.0.fr1.i32.i32.0(i32 %2, i32 10)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %6 = load %struct.Pair$str*, %struct.Pair$str** %s.addr, align 8
  %7 = getelementptr inbounds %struct.Pair$str, %struct.Pair$str* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4, !tbaa !7
  %9 = call i32 @$ref.0.fr1.i32.i32.0(i32 %8, i32 10)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %5, i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %13 = load %struct.Pair$i32*, %struct.Pair$i32** %n.addr, align 8
  %14 = getelementptr inbounds %struct.Pair$i32, %struct.Pair$i32* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !8
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %12, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %19 = load %struct.Pair$str*, %struct.Pair$str** %s.addr, align 8
  %20 = getelementptr inbounds %struct.Pair$str, %struct.Pair$str* %19, i32 0, i32 0
  %21 = load i8*, i8** %20, align 8, !tbaa !9
  %22 = call i8* @nish_str_concat(i8* %18, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %24 = load i32, i32* %other.addr, align 4
  %25 = call i32 @$ref.0.fr1.i32.i32.1(i32 %24, i32 10)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %23, i8* %26)
  call void @nish_print(i8* %27)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @Pair$i32.constructor(%struct.Pair$i32* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %v, i32 noundef %f) #2 {
entry:
  %0 = getelementptr inbounds %struct.Pair$i32, %struct.Pair$i32* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !8
  %1 = getelementptr inbounds %struct.Pair$i32, %struct.Pair$i32* %this, i32 0, i32 1
  store i32 %f, i32* %1, align 4, !tbaa !4
  ret void
}

define internal void @Pair$str.constructor(%struct.Pair$str* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %v, i32 noundef %f) #2 {
entry:
  %0 = getelementptr inbounds %struct.Pair$str, %struct.Pair$str* %this, i32 0, i32 0
  store i8* %v, i8** %0, align 8, !tbaa !9
  %1 = getelementptr inbounds %struct.Pair$str, %struct.Pair$str* %this, i32 0, i32 1
  store i32 %f, i32* %1, align 4, !tbaa !7
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

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!10, !11, !12, !13, !14}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Pair$i32", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 4}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Pair$str", !5, i64 0, !2, i64 8}
!7 = !{!6, !2, i64 8}
!8 = !{!3, !2, i64 0}
!9 = !{!6, !5, i64 0}
!10 = !{i32 8, !"cf-protection-branch", i32 1}
!11 = !{i32 8, !"cf-protection-return", i32 1}
!12 = !{i32 8, !"branch-target-enforcement", i32 1}
!13 = !{i32 8, !"sign-return-address", i32 1}
!14 = !{i32 4, !"probe-stack", !"inline-asm"}
