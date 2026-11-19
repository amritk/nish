%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"a\C3\A9\E2\82\AC\F0\9F\98\80z\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"[\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"]\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"plain\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"a-b-c!d\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"x\C3\A9\F0\9F\98\80\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"12\F0\9F\98\80\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"\F0\9F\98\80\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare i64 @llvm.smin.i64(i64, i64) #3

define internal noundef double @count(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %n.addr = alloca double, align 8
  %_c.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %forof.next = alloca i64, align 8
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
  %18 = add i64 %3, %17
  store i64 %18, i64* %forof.next, align 8
  %19 = call i8* @nish_str_new(i8* %5, i64 %17)
  store i8* %19, i8** %_c.addr, align 8
  %20 = load double, double* %n.addr, align 8
  %21 = fadd double %20, 0x3FF0000000000000
  store double %21, double* %n.addr, align 8
  br label %forof.inc

forof.inc:
  %22 = load i64, i64* %forof.next, align 8
  store i64 %22, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %23 = load double, double* %n.addr, align 8
  ret double %23
}

define void @nish_main() #1 {
entry:
  %text.addr = alloca i8*, align 8
  %c.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %forof.next = alloca i64, align 8
  %kept.addr = alloca i8*, align 8
  %c.addr.1 = alloca i8*, align 8
  %forof.idx.1 = alloca i64, align 8
  %forof.next.1 = alloca i64, align 8
  %c.addr.2 = alloca i8*, align 8
  %forof.idx.2 = alloca i64, align 8
  %forof.next.2 = alloca i64, align 8
  %d.addr = alloca i8*, align 8
  %forof.idx.3 = alloca i64, align 8
  %forof.next.3 = alloca i64, align 8
  store i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i8** %text.addr, align 8
  %0 = load i8*, i8** %text.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = getelementptr inbounds i8, i8* %0, i64 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %4 = load i64, i64* %forof.idx, align 8
  %5 = icmp ult i64 %4, %2
  br i1 %5, label %forof.body, label %forof.end

forof.body:
  %6 = getelementptr inbounds i8, i8* %3, i64 %4
  %7 = load i8, i8* %6
  %8 = icmp uge i8 %7, -64
  %9 = zext i1 %8 to i64
  %10 = add i64 1, %9
  %11 = icmp uge i8 %7, -32
  %12 = zext i1 %11 to i64
  %13 = add i64 %10, %12
  %14 = icmp uge i8 %7, -16
  %15 = zext i1 %14 to i64
  %16 = add i64 %13, %15
  %17 = sub i64 %2, %4
  %18 = call i64 @llvm.smin.i64(i64 %16, i64 %17)
  %19 = add i64 %4, %18
  store i64 %19, i64* %forof.next, align 8
  %20 = call i8* @nish_str_new(i8* %6, i64 %18)
  store i8* %20, i8** %c.addr, align 8
  %21 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %22 = load i8*, i8** %21, align 8
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %24 = load i64, i64* %23, align 8
  %25 = load i8*, i8** %c.addr, align 8
  %26 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  call void @nish_print(i8* %27)
  %28 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %29 = load i8*, i8** %28, align 8
  %30 = icmp eq i8* %29, %22
  br i1 %30, label %pass.rewind, label %pass.free

pass.rewind:
  %31 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %24, i64* %31, align 8
  br label %pass.done

pass.free:
  %32 = ptrtoint i8* %22 to i64
  %33 = add i64 %32, %24
  call void @nish_arena_release(i64 %33)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %34 = load i64, i64* %forof.next, align 8
  store i64 %34, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %35 = load i8*, i8** %text.addr, align 8
  %36 = call double @count(i8* %35)
  %37 = call i8* @nish_str_from_f64(double %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %39 = call double @count(i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*))
  %40 = call i8* @nish_str_from_f64(double %39)
  %41 = call i8* @nish_str_concat(i8* %38, i8* %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %43 = call double @count(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*))
  %44 = call i8* @nish_str_from_f64(double %43)
  %45 = call i8* @nish_str_concat(i8* %42, i8* %44)
  call void @nish_print(i8* %45)
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %kept.addr, align 8
  %46 = bitcast i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*) to i64*
  %47 = load i64, i64* %46, align 8
  %48 = getelementptr inbounds i8, i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*), i64 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %49 = load i64, i64* %forof.idx.1, align 8
  %50 = icmp ult i64 %49, %47
  br i1 %50, label %forof.body.1, label %forof.end.1

forof.body.1:
  %51 = getelementptr inbounds i8, i8* %48, i64 %49
  %52 = load i8, i8* %51
  %53 = icmp uge i8 %52, -64
  %54 = zext i1 %53 to i64
  %55 = add i64 1, %54
  %56 = icmp uge i8 %52, -32
  %57 = zext i1 %56 to i64
  %58 = add i64 %55, %57
  %59 = icmp uge i8 %52, -16
  %60 = zext i1 %59 to i64
  %61 = add i64 %58, %60
  %62 = sub i64 %47, %49
  %63 = call i64 @llvm.smin.i64(i64 %61, i64 %62)
  %64 = add i64 %49, %63
  store i64 %64, i64* %forof.next.1, align 8
  %65 = call i8* @nish_str_new(i8* %51, i64 %63)
  store i8* %65, i8** %c.addr.1, align 8
  %66 = load i8*, i8** %c.addr.1, align 8
  %67 = call zeroext i1 @nish_str_eq(i8* %66, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  br i1 %67, label %if.then, label %if.end

if.then:
  br label %forof.inc.1

if.end:
  %68 = load i8*, i8** %c.addr.1, align 8
  %69 = call zeroext i1 @nish_str_eq(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  br i1 %69, label %if.then.1, label %if.end.1

if.then.1:
  br label %forof.end.1

if.end.1:
  %70 = load i8*, i8** %c.addr.1, align 8
  %71 = load i8*, i8** %c.addr.1, align 8
  %72 = call i8* @nish_str_concat(i8* %70, i8* %71)
  store i8* %72, i8** %c.addr.1, align 8
  %73 = load i8*, i8** %kept.addr, align 8
  %74 = load i8*, i8** %c.addr.1, align 8
  %75 = call i8* @nish_str_concat(i8* %73, i8* %74)
  store i8* %75, i8** %kept.addr, align 8
  br label %forof.inc.1

forof.inc.1:
  %76 = load i64, i64* %forof.next.1, align 8
  store i64 %76, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %77 = load i8*, i8** %kept.addr, align 8
  call void @nish_print(i8* %77)
  %78 = bitcast i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*) to i64*
  %79 = load i64, i64* %78, align 8
  %80 = getelementptr inbounds i8, i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*), i64 8
  store i64 0, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.cond.2:
  %81 = load i64, i64* %forof.idx.2, align 8
  %82 = icmp ult i64 %81, %79
  br i1 %82, label %forof.body.2, label %forof.end.2

forof.body.2:
  %83 = getelementptr inbounds i8, i8* %80, i64 %81
  %84 = load i8, i8* %83
  %85 = icmp uge i8 %84, -64
  %86 = zext i1 %85 to i64
  %87 = add i64 1, %86
  %88 = icmp uge i8 %84, -32
  %89 = zext i1 %88 to i64
  %90 = add i64 %87, %89
  %91 = icmp uge i8 %84, -16
  %92 = zext i1 %91 to i64
  %93 = add i64 %90, %92
  %94 = sub i64 %79, %81
  %95 = call i64 @llvm.smin.i64(i64 %93, i64 %94)
  %96 = add i64 %81, %95
  store i64 %96, i64* %forof.next.2, align 8
  %97 = call i8* @nish_str_new(i8* %83, i64 %95)
  store i8* %97, i8** %c.addr.2, align 8
  %98 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %99 = load i8*, i8** %98, align 8
  %100 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %101 = load i64, i64* %100, align 8
  %102 = bitcast i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*) to i64*
  %103 = load i64, i64* %102, align 8
  %104 = getelementptr inbounds i8, i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*), i64 8
  store i64 0, i64* %forof.idx.3, align 8
  br label %forof.cond.3

forof.cond.3:
  %105 = load i64, i64* %forof.idx.3, align 8
  %106 = icmp ult i64 %105, %103
  br i1 %106, label %forof.body.3, label %forof.end.3

forof.body.3:
  %107 = getelementptr inbounds i8, i8* %104, i64 %105
  %108 = load i8, i8* %107
  %109 = icmp uge i8 %108, -64
  %110 = zext i1 %109 to i64
  %111 = add i64 1, %110
  %112 = icmp uge i8 %108, -32
  %113 = zext i1 %112 to i64
  %114 = add i64 %111, %113
  %115 = icmp uge i8 %108, -16
  %116 = zext i1 %115 to i64
  %117 = add i64 %114, %116
  %118 = sub i64 %103, %105
  %119 = call i64 @llvm.smin.i64(i64 %117, i64 %118)
  %120 = add i64 %105, %119
  store i64 %120, i64* %forof.next.3, align 8
  %121 = call i8* @nish_str_new(i8* %107, i64 %119)
  store i8* %121, i8** %d.addr, align 8
  %122 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %123 = load i8*, i8** %122, align 8
  %124 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %125 = load i64, i64* %124, align 8
  %126 = load i8*, i8** %d.addr, align 8
  %127 = call zeroext i1 @nish_str_eq(i8* %126, i8* bitcast ({ i64, [5 x i8] }* @.str.11 to i8*))
  br i1 %127, label %if.then.2, label %if.end.2

if.then.2:
  %128 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %129 = load i8*, i8** %128, align 8
  %130 = icmp eq i8* %129, %99
  br i1 %130, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %131 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %101, i64* %131, align 8
  br label %pass.done.1

pass.free.1:
  %132 = ptrtoint i8* %99 to i64
  %133 = add i64 %132, %101
  call void @nish_arena_release(i64 %133)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc.2

if.end.2:
  %134 = load i8*, i8** %c.addr.2, align 8
  %135 = call zeroext i1 @nish_str_eq(i8* %134, i8* bitcast ({ i64, [5 x i8] }* @.str.11 to i8*))
  br i1 %135, label %if.then.3, label %if.end.3

if.then.3:
  %136 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %137 = load i8*, i8** %136, align 8
  %138 = icmp eq i8* %137, %99
  br i1 %138, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %139 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %101, i64* %139, align 8
  br label %pass.done.2

pass.free.2:
  %140 = ptrtoint i8* %99 to i64
  %141 = add i64 %140, %101
  call void @nish_arena_release(i64 %141)
  br label %pass.done.2

pass.done.2:
  br label %forof.end.2

if.end.3:
  %142 = load i8*, i8** %c.addr.2, align 8
  %143 = load i8*, i8** %d.addr, align 8
  %144 = call i8* @nish_str_concat(i8* %142, i8* %143)
  call void @nish_print(i8* %144)
  %145 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %146 = load i8*, i8** %145, align 8
  %147 = icmp eq i8* %146, %123
  br i1 %147, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %148 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %125, i64* %148, align 8
  br label %pass.done.3

pass.free.3:
  %149 = ptrtoint i8* %123 to i64
  %150 = add i64 %149, %125
  call void @nish_arena_release(i64 %150)
  br label %pass.done.3

pass.done.3:
  br label %forof.inc.3

forof.inc.3:
  %151 = load i64, i64* %forof.next.3, align 8
  store i64 %151, i64* %forof.idx.3, align 8
  br label %forof.cond.3

forof.end.3:
  %152 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %153 = load i8*, i8** %152, align 8
  %154 = icmp eq i8* %153, %99
  br i1 %154, label %pass.rewind.4, label %pass.free.4

pass.rewind.4:
  %155 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %101, i64* %155, align 8
  br label %pass.done.4

pass.free.4:
  %156 = ptrtoint i8* %99 to i64
  %157 = add i64 %156, %101
  call void @nish_arena_release(i64 %157)
  br label %pass.done.4

pass.done.4:
  br label %forof.inc.2

forof.inc.2:
  %158 = load i64, i64* %forof.next.2, align 8
  store i64 %158, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.end.2:
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
attributes #2 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!nish.compat = !{!5}
!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
!5 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string"}
