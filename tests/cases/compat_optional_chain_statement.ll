%struct.Cell = type { double, %struct.Cell* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"cell \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0

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

define internal void @Cell.bump(%struct.Cell* noundef nonnull align 8 dereferenceable(16) nocapture %this, double noundef %by) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  %1 = load double, double* %0, align 8
  %2 = fadd double %1, %by
  store double %2, double* %0, align 8
  ret void
}

define internal noundef nonnull align 8 i8* @Cell.label(%struct.Cell* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  %1 = load double, double* %0, align 8, !tbaa !5
  %2 = call i8* @nish_str_from_f64(double %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %2)
  ret i8* %3
}

define internal void @touch(%struct.Cell* noundef align 8 nocapture %c, double noundef %by) #0 {
entry:
  %0 = icmp eq %struct.Cell* %c, null
  br i1 %0, label %chain.end, label %chain.next

chain.next:
  call void @Cell.bump(%struct.Cell* %c, double %by)
  br label %chain.end

chain.end:
  %1 = icmp eq %struct.Cell* %c, null
  br i1 %1, label %chain.end.1, label %chain.next.1

chain.next.1:
  %2 = getelementptr inbounds %struct.Cell, %struct.Cell* %c, i32 0, i32 1
  %3 = load %struct.Cell*, %struct.Cell** %2, align 8, !tbaa !6
  %4 = icmp eq %struct.Cell* %3, null
  br i1 %4, label %chain.end.1, label %chain.next.2

chain.next.2:
  %5 = fmul double %by, 0x4024000000000000
  call void @Cell.bump(%struct.Cell* %3, double %5)
  br label %chain.end.1

chain.end.1:
  ret void
}

define void @nish_main() #1 {
entry:
  %a.addr = alloca %struct.Cell*, align 8
  %Cell.obj = alloca %struct.Cell, align 8
  %b.addr = alloca %struct.Cell*, align 8
  %c.addr = alloca %struct.Cell*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 1
  store %struct.Cell* null, %struct.Cell** %1, align 8, !tbaa !6
  store %struct.Cell* %Cell.obj, %struct.Cell** %a.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.Cell*
  %4 = getelementptr inbounds %struct.Cell, %struct.Cell* %3, i32 0, i32 0
  store double 0x0000000000000000, double* %4, align 8, !tbaa !5
  %5 = getelementptr inbounds %struct.Cell, %struct.Cell* %3, i32 0, i32 1
  store %struct.Cell* null, %struct.Cell** %5, align 8, !tbaa !6
  store %struct.Cell* %3, %struct.Cell** %b.addr, align 8
  %6 = load %struct.Cell*, %struct.Cell** %a.addr, align 8
  %7 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  %8 = getelementptr inbounds %struct.Cell, %struct.Cell* %6, i32 0, i32 1
  store %struct.Cell* %7, %struct.Cell** %8, align 8, !tbaa !6
  %9 = load %struct.Cell*, %struct.Cell** %a.addr, align 8
  call void @touch(%struct.Cell* %9, double 0x4000000000000000)
  call void @touch(%struct.Cell* null, double 0x4008000000000000)
  %10 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  call void @touch(%struct.Cell* %10, double 0x4014000000000000)
  %11 = load %struct.Cell*, %struct.Cell** %a.addr, align 8
  %12 = getelementptr inbounds %struct.Cell, %struct.Cell* %11, i32 0, i32 0
  %13 = load double, double* %12, align 8, !tbaa !5
  %14 = call i8* @nish_str_from_f64(double %13)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %16 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  %17 = getelementptr inbounds %struct.Cell, %struct.Cell* %16, i32 0, i32 0
  %18 = load double, double* %17, align 8, !tbaa !5
  %19 = call i8* @nish_str_from_f64(double %18)
  %20 = call i8* @nish_str_concat(i8* %15, i8* %19)
  call void @nish_print(i8* %20)
  %21 = load %struct.Cell*, %struct.Cell** %a.addr, align 8
  %22 = getelementptr inbounds %struct.Cell, %struct.Cell* %21, i32 0, i32 1
  %23 = load %struct.Cell*, %struct.Cell** %22, align 8, !tbaa !6
  store %struct.Cell* %23, %struct.Cell** %c.addr, align 8
  %24 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %25 = icmp eq %struct.Cell* %24, null
  br i1 %25, label %nullish.default, label %chain.next

chain.next:
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @Cell.label(%struct.Cell* %24)
  %28 = call i8* @nish_arena_keep(i64 %26, i8* %27)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %29 = phi i8* [ %28, %chain.next ], [ bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), %nullish.default ]
  call void @nish_print(i8* %29)
  %30 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  %31 = getelementptr inbounds %struct.Cell, %struct.Cell* %30, i32 0, i32 1
  %32 = load %struct.Cell*, %struct.Cell** %31, align 8, !tbaa !6
  %33 = icmp eq %struct.Cell* %32, null
  br i1 %33, label %nullish.default.1, label %chain.next.1

chain.next.1:
  %34 = call i64 @nish_arena_mark()
  %35 = call i8* @Cell.label(%struct.Cell* %32)
  %36 = call i8* @nish_arena_keep(i64 %34, i8* %35)
  br label %nullish.end.1

nullish.default.1:
  br label %nullish.end.1

nullish.end.1:
  %37 = phi i8* [ %36, %chain.next.1 ], [ bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), %nullish.default.1 ]
  call void @nish_print(i8* %37)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!nish.compat = !{!12}
!llvm.module.flags = !{!7, !8, !9, !10, !11}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Cell", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{i32 8, !"cf-protection-branch", i32 1}
!8 = !{i32 8, !"cf-protection-return", i32 1}
!9 = !{i32 8, !"branch-target-enforcement", i32 1}
!10 = !{i32 8, !"sign-return-address", i32 1}
!11 = !{i32 4, !"probe-stack", !"inline-asm"}
!12 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}
