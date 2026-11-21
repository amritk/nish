%struct.Scale = type { double }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1

define internal noundef double @area(double noundef %width, double noundef %height) #0 {
entry:
  %0 = fcmp olt double %height, 0x0000000000000000
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = fmul double %width, %width
  br label %cond.end

cond.false:
  %2 = fmul double %width, %height
  br label %cond.end

cond.end:
  %3 = phi double [ %1, %cond.true ], [ %2, %cond.false ]
  ret double %3
}

define internal void @Scale.constructor(%struct.Scale* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, double noundef %factor) #1 {
entry:
  %0 = getelementptr inbounds %struct.Scale, %struct.Scale* %this, i32 0, i32 0
  store double %factor, double* %0, align 8, !tbaa !4
  ret void
}

define internal noundef double @Scale.apply(%struct.Scale* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, double noundef %x, double noundef %offset) #2 {
entry:
  %0 = getelementptr inbounds %struct.Scale, %struct.Scale* %this, i32 0, i32 0
  %1 = load double, double* %0, align 8, !tbaa !4
  %2 = fmul double %x, %1
  %3 = fadd double %2, %offset
  ret double %3
}

define void @nish_main() #3 {
entry:
  %twice.addr = alloca %struct.Scale*, align 8
  %Scale.obj = alloca %struct.Scale, align 8
  %thrice.addr = alloca %struct.Scale*, align 8
  %Scale.obj.1 = alloca %struct.Scale, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @area(double 0x4008000000000000, double 0xBFF0000000000000)
  %1 = call i8* @nish_str_from_f64(double %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = call double @area(double 0x4000000000000000, double 0x4014000000000000)
  %4 = call i8* @nish_str_from_f64(double %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  call void @nish_print(i8* %5)
  call void @Scale.constructor(%struct.Scale* %Scale.obj, double 0x4000000000000000)
  store %struct.Scale* %Scale.obj, %struct.Scale** %twice.addr, align 8
  call void @Scale.constructor(%struct.Scale* %Scale.obj.1, double 0x4008000000000000)
  store %struct.Scale* %Scale.obj.1, %struct.Scale** %thrice.addr, align 8
  %6 = load %struct.Scale*, %struct.Scale** %twice.addr, align 8
  %7 = call double @Scale.apply(%struct.Scale* %6, double 0x4010000000000000, double 0x0000000000000000)
  %8 = call i8* @nish_str_from_f64(double %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = load %struct.Scale*, %struct.Scale** %thrice.addr, align 8
  %11 = call double @Scale.apply(%struct.Scale* %10, double 0x4010000000000000, double 0x0000000000000000)
  %12 = call i8* @nish_str_from_f64(double %11)
  %13 = call i8* @nish_str_concat(i8* %9, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load %struct.Scale*, %struct.Scale** %thrice.addr, align 8
  %16 = call double @Scale.apply(%struct.Scale* %15, double 0x4010000000000000, double 0x3FF0000000000000)
  %17 = call i8* @nish_str_from_f64(double %16)
  %18 = call i8* @nish_str_concat(i8* %14, i8* %17)
  call void @nish_print(i8* %18)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }

!nish.compat = !{!10}
!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"Scale", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}
!10 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}
