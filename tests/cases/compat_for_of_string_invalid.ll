@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"yz\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\C3\A9\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare i64 @llvm.smin.i64(i64, i64) #2

define internal noundef double @count(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %n.addr = alloca double, align 8
  %_c.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %forof.next = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store double 0x0000000000000000, double* %n.addr, align 8
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %s, i64 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %3 = load i64, i64* %forof.idx, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %forof.body, label %forof.end

forof.body:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = icmp uge i8 %6, -64
  %8 = zext i1 %7 to i64
  %9 = add i64 1, %8
  %10 = icmp uge i8 %6, -32
  %11 = zext i1 %10 to i64
  %12 = add i64 %9, %11
  %13 = icmp uge i8 %6, -16
  %14 = zext i1 %13 to i64
  %15 = add i64 %12, %14
  %16 = sub i64 %1, %3
  %17 = call i64 @llvm.smin.i64(i64 %15, i64 %16)
  br label %forof.run

forof.run:
  %forof.run.n = phi i64 [ 1, %forof.body ], [ %forof.run.grown, %forof.run.test ]
  %18 = icmp ult i64 %forof.run.n, %17
  br i1 %18, label %forof.run.test, label %forof.take

forof.run.test:
  %19 = getelementptr inbounds i8, i8* %5, i64 %forof.run.n
  %20 = load i8, i8* %19
  %21 = and i8 %20, -64
  %22 = icmp eq i8 %21, -128
  %forof.run.grown = add i64 %forof.run.n, 1
  br i1 %22, label %forof.run, label %forof.take

forof.take:
  %23 = add i64 %3, %forof.run.n
  store i64 %23, i64* %forof.next, align 8
  %24 = call i8* @nish_str_new(i8* %5, i64 %forof.run.n)
  store i8* %24, i8** %_c.addr, align 8
  %25 = load double, double* %n.addr, align 8
  %26 = fadd double %25, 0x3FF0000000000000
  store double %26, double* %n.addr, align 8
  br label %forof.inc

forof.inc:
  %27 = load i64, i64* %forof.next, align 8
  store i64 %27, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %28 = load double, double* %n.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret double %28
}

define void @nish_main() #1 {
entry:
  %chr = alloca i8, align 1
  %chr.1 = alloca i8, align 1
  %chr.2 = alloca i8, align 1
  %chr.3 = alloca i8, align 1
  %chr.4 = alloca i8, align 1
  %arena.mark = call i64 @nish_arena_mark()
  %0 = fptosi double 0x4069000000000000 to i64
  %1 = trunc i64 %0 to i8
  store i8 %1, i8* %chr, align 1
  %2 = call i8* @nish_str_new(i8* %chr, i64 1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %4 = call double @count(i8* %3)
  %5 = call i8* @nish_str_from_f64(double %4)
  call void @nish_print(i8* %5)
  %6 = fptosi double 0x406E000000000000 to i64
  %7 = trunc i64 %6 to i8
  store i8 %7, i8* %chr.1, align 1
  %8 = call i8* @nish_str_new(i8* %chr.1, i64 1)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %11 = call double @count(i8* %10)
  %12 = call i8* @nish_str_from_f64(double %11)
  call void @nish_print(i8* %12)
  %13 = fptosi double 0x4060000000000000 to i64
  %14 = trunc i64 %13 to i8
  store i8 %14, i8* %chr.2, align 1
  %15 = call i8* @nish_str_new(i8* %chr.2, i64 1)
  %16 = fptosi double 0x4067E00000000000 to i64
  %17 = trunc i64 %16 to i8
  store i8 %17, i8* %chr.3, align 1
  %18 = call i8* @nish_str_new(i8* %chr.3, i64 1)
  %19 = call i8* @nish_str_concat(i8* %15, i8* %18)
  %20 = call double @count(i8* %19)
  %21 = call i8* @nish_str_from_f64(double %20)
  call void @nish_print(i8* %21)
  %22 = fptosi double 0x406C400000000000 to i64
  %23 = trunc i64 %22 to i8
  store i8 %23, i8* %chr.4, align 1
  %24 = call i8* @nish_str_new(i8* %chr.4, i64 1)
  %25 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.3 to i8*), i8* %24)
  %26 = call double @count(i8* %25)
  %27 = call i8* @nish_str_from_f64(double %26)
  call void @nish_print(i8* %27)
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
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!nish.compat = !{!5}
!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
!5 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}
