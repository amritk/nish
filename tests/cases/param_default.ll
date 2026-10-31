@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"?\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal noundef i32 @scale(i32 noundef %x, i32 noundef %by) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %by)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @area(i32 noundef %w, i32 noundef %h) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %w, i32 %h)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef nonnull align 8 i8* @label(i8* noundef nonnull noalias readonly align 8 nocapture %name, i32 noundef %mode, i8* noundef nonnull noalias readonly align 8 nocapture %end) #0 {
entry:
  %0 = icmp eq i32 %mode, 1
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_str_concat(i8* %name, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %2 = call i8* @nish_str_concat(i8* %1, i8* %end)
  br label %cond.end

cond.false:
  %3 = call i8* @nish_str_concat(i8* %name, i8* %end)
  br label %cond.end

cond.end:
  %4 = phi i8* [ %2, %cond.true ], [ %3, %cond.false ]
  ret i8* %4
}

define internal noundef zeroext i1 @within(i32 noundef %x, i32 noundef %lo, i32 noundef %hi, i1 noundef zeroext %open) #1 {
entry:
  br i1 %open, label %cond.true, label %cond.false

cond.true:
  %0 = icmp sgt i32 %x, %lo
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp slt i32 %x, %hi
  br label %land.end

land.end:
  %2 = phi i1 [ false, %cond.true ], [ %1, %land.rhs ]
  br label %cond.end

cond.false:
  %3 = icmp sge i32 %x, %lo
  br i1 %3, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %4 = icmp sle i32 %x, %hi
  br label %land.end.1

land.end.1:
  %5 = phi i1 [ false, %cond.false ], [ %4, %land.rhs.1 ]
  br label %cond.end

cond.end:
  %6 = phi i1 [ %2, %land.end ], [ %5, %land.end.1 ]
  ret i1 %6
}

define internal noundef double @mix(double noundef %a, double noundef %t, i64 noundef %big) #1 {
entry:
  %0 = fmul double %a, %t
  %1 = icmp sgt i64 %big, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi double [ 0x3FF0000000000000, %cond.true ], [ 0x0000000000000000, %cond.false ]
  %3 = fadd double %0, %2
  ret double %3
}

define void @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @scale(i32 3, i32 2)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @scale(i32 3, i32 5)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call i32 @area(i32 4, i32 4)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @area(i32 4, i32 2)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = call i64 @nish_arena_mark()
  %9 = call i8* @label(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 0, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %10 = call i8* @nish_arena_keep(i64 %8, i8* %9)
  call void @nish_print(i8* %10)
  %11 = call i64 @nish_arena_mark()
  %12 = call i8* @label(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i32 1, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %13 = call i8* @nish_arena_keep(i64 %11, i8* %12)
  call void @nish_print(i8* %13)
  %14 = call i64 @nish_arena_mark()
  %15 = call i8* @label(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i32 1, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %16 = call i8* @nish_arena_keep(i64 %14, i8* %15)
  call void @nish_print(i8* %16)
  %17 = call i1 @within(i32 1, i32 -1, i32 1, i1 false)
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*)
  call void @nish_print(i8* %18)
  %19 = call i1 @within(i32 1, i32 0, i32 1, i1 true)
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*)
  call void @nish_print(i8* %20)
  %21 = call i1 @within(i32 -2, i32 -3, i32 1, i1 false)
  %22 = select i1 %21, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*)
  call void @nish_print(i8* %22)
  %23 = call double @mix(double 0x4010000000000000, double 0x3FE0000000000000, i64 5000000000)
  %24 = call i8* @nish_str_from_f64(double %23)
  call void @nish_print(i8* %24)
  %25 = call double @mix(double 0x4010000000000000, double 0x3FD0000000000000, i64 5000000000)
  %26 = call i8* @nish_str_from_f64(double %25)
  call void @nish_print(i8* %26)
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
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
