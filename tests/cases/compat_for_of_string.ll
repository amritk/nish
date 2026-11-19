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
declare noundef i64 @nish_arena_mark() #0
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
  br label %forof.run

forof.run:
  %forof.run.n = phi i64 [ 1, %forof.body ], [ %forof.run.grown, %forof.run.test ]
  %19 = icmp ult i64 %forof.run.n, %18
  br i1 %19, label %forof.run.test, label %forof.take

forof.run.test:
  %20 = getelementptr inbounds i8, i8* %6, i64 %forof.run.n
  %21 = load i8, i8* %20
  %22 = and i8 %21, -64
  %23 = icmp eq i8 %22, -128
  %forof.run.grown = add i64 %forof.run.n, 1
  br i1 %23, label %forof.run, label %forof.take

forof.take:
  %24 = add i64 %4, %forof.run.n
  store i64 %24, i64* %forof.next, align 8
  %25 = call i8* @nish_str_new(i8* %6, i64 %forof.run.n)
  store i8* %25, i8** %c.addr, align 8
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %27 = load i8*, i8** %26, align 8
  %28 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %29 = load i64, i64* %28, align 8
  %30 = load i8*, i8** %c.addr, align 8
  %31 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  call void @nish_print(i8* %32)
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %34 = load i8*, i8** %33, align 8
  %35 = icmp eq i8* %34, %27
  br i1 %35, label %pass.rewind, label %pass.free

pass.rewind:
  %36 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %29, i64* %36, align 8
  br label %pass.done

pass.free:
  %37 = ptrtoint i8* %27 to i64
  %38 = add i64 %37, %29
  call void @nish_arena_release(i64 %38)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.next, align 8
  store i64 %39, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %40 = load i8*, i8** %text.addr, align 8
  %41 = call double @count(i8* %40)
  %42 = call i8* @nish_str_from_f64(double %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %44 = call double @count(i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*))
  %45 = call i8* @nish_str_from_f64(double %44)
  %46 = call i8* @nish_str_concat(i8* %43, i8* %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %48 = call double @count(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*))
  %49 = call i8* @nish_str_from_f64(double %48)
  %50 = call i8* @nish_str_concat(i8* %47, i8* %49)
  call void @nish_print(i8* %50)
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %kept.addr, align 8
  %51 = bitcast i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*) to i64*
  %52 = load i64, i64* %51, align 8
  %53 = getelementptr inbounds i8, i8* bitcast ({ i64, [8 x i8] }* @.str.6 to i8*), i64 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %54 = load i64, i64* %forof.idx.1, align 8
  %55 = icmp ult i64 %54, %52
  br i1 %55, label %forof.body.1, label %forof.end.1

forof.body.1:
  %56 = getelementptr inbounds i8, i8* %53, i64 %54
  %57 = load i8, i8* %56
  %58 = icmp uge i8 %57, -64
  %59 = zext i1 %58 to i64
  %60 = add i64 1, %59
  %61 = icmp uge i8 %57, -32
  %62 = zext i1 %61 to i64
  %63 = add i64 %60, %62
  %64 = icmp uge i8 %57, -16
  %65 = zext i1 %64 to i64
  %66 = add i64 %63, %65
  %67 = sub i64 %52, %54
  %68 = call i64 @llvm.smin.i64(i64 %66, i64 %67)
  br label %forof.run.1

forof.run.1:
  %forof.run.1.n = phi i64 [ 1, %forof.body.1 ], [ %forof.run.1.grown, %forof.run.test.1 ]
  %69 = icmp ult i64 %forof.run.1.n, %68
  br i1 %69, label %forof.run.test.1, label %forof.take.1

forof.run.test.1:
  %70 = getelementptr inbounds i8, i8* %56, i64 %forof.run.1.n
  %71 = load i8, i8* %70
  %72 = and i8 %71, -64
  %73 = icmp eq i8 %72, -128
  %forof.run.1.grown = add i64 %forof.run.1.n, 1
  br i1 %73, label %forof.run.1, label %forof.take.1

forof.take.1:
  %74 = add i64 %54, %forof.run.1.n
  store i64 %74, i64* %forof.next.1, align 8
  %75 = call i8* @nish_str_new(i8* %56, i64 %forof.run.1.n)
  store i8* %75, i8** %c.addr.1, align 8
  %76 = load i8*, i8** %c.addr.1, align 8
  %77 = call zeroext i1 @nish_str_eq(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  br i1 %77, label %if.then, label %if.end

if.then:
  br label %forof.inc.1

if.end:
  %78 = load i8*, i8** %c.addr.1, align 8
  %79 = call zeroext i1 @nish_str_eq(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  br i1 %79, label %if.then.1, label %if.end.1

if.then.1:
  br label %forof.end.1

if.end.1:
  %80 = load i8*, i8** %c.addr.1, align 8
  %81 = load i8*, i8** %c.addr.1, align 8
  %82 = call i8* @nish_str_concat(i8* %80, i8* %81)
  store i8* %82, i8** %c.addr.1, align 8
  %83 = load i8*, i8** %kept.addr, align 8
  %84 = load i8*, i8** %c.addr.1, align 8
  %85 = call i8* @nish_str_concat(i8* %83, i8* %84)
  store i8* %85, i8** %kept.addr, align 8
  br label %forof.inc.1

forof.inc.1:
  %86 = load i64, i64* %forof.next.1, align 8
  store i64 %86, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %87 = load i8*, i8** %kept.addr, align 8
  call void @nish_print(i8* %87)
  %88 = bitcast i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*) to i64*
  %89 = load i64, i64* %88, align 8
  %90 = getelementptr inbounds i8, i8* bitcast ({ i64, [8 x i8] }* @.str.9 to i8*), i64 8
  store i64 0, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.cond.2:
  %91 = load i64, i64* %forof.idx.2, align 8
  %92 = icmp ult i64 %91, %89
  br i1 %92, label %forof.body.2, label %forof.end.2

forof.body.2:
  %93 = getelementptr inbounds i8, i8* %90, i64 %91
  %94 = load i8, i8* %93
  %95 = icmp uge i8 %94, -64
  %96 = zext i1 %95 to i64
  %97 = add i64 1, %96
  %98 = icmp uge i8 %94, -32
  %99 = zext i1 %98 to i64
  %100 = add i64 %97, %99
  %101 = icmp uge i8 %94, -16
  %102 = zext i1 %101 to i64
  %103 = add i64 %100, %102
  %104 = sub i64 %89, %91
  %105 = call i64 @llvm.smin.i64(i64 %103, i64 %104)
  br label %forof.run.2

forof.run.2:
  %forof.run.2.n = phi i64 [ 1, %forof.body.2 ], [ %forof.run.2.grown, %forof.run.test.2 ]
  %106 = icmp ult i64 %forof.run.2.n, %105
  br i1 %106, label %forof.run.test.2, label %forof.take.2

forof.run.test.2:
  %107 = getelementptr inbounds i8, i8* %93, i64 %forof.run.2.n
  %108 = load i8, i8* %107
  %109 = and i8 %108, -64
  %110 = icmp eq i8 %109, -128
  %forof.run.2.grown = add i64 %forof.run.2.n, 1
  br i1 %110, label %forof.run.2, label %forof.take.2

forof.take.2:
  %111 = add i64 %91, %forof.run.2.n
  store i64 %111, i64* %forof.next.2, align 8
  %112 = call i8* @nish_str_new(i8* %93, i64 %forof.run.2.n)
  store i8* %112, i8** %c.addr.2, align 8
  %113 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %114 = load i8*, i8** %113, align 8
  %115 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %116 = load i64, i64* %115, align 8
  %117 = bitcast i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*) to i64*
  %118 = load i64, i64* %117, align 8
  %119 = getelementptr inbounds i8, i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*), i64 8
  store i64 0, i64* %forof.idx.3, align 8
  br label %forof.cond.3

forof.cond.3:
  %120 = load i64, i64* %forof.idx.3, align 8
  %121 = icmp ult i64 %120, %118
  br i1 %121, label %forof.body.3, label %forof.end.3

forof.body.3:
  %122 = getelementptr inbounds i8, i8* %119, i64 %120
  %123 = load i8, i8* %122
  %124 = icmp uge i8 %123, -64
  %125 = zext i1 %124 to i64
  %126 = add i64 1, %125
  %127 = icmp uge i8 %123, -32
  %128 = zext i1 %127 to i64
  %129 = add i64 %126, %128
  %130 = icmp uge i8 %123, -16
  %131 = zext i1 %130 to i64
  %132 = add i64 %129, %131
  %133 = sub i64 %118, %120
  %134 = call i64 @llvm.smin.i64(i64 %132, i64 %133)
  br label %forof.run.3

forof.run.3:
  %forof.run.3.n = phi i64 [ 1, %forof.body.3 ], [ %forof.run.3.grown, %forof.run.test.3 ]
  %135 = icmp ult i64 %forof.run.3.n, %134
  br i1 %135, label %forof.run.test.3, label %forof.take.3

forof.run.test.3:
  %136 = getelementptr inbounds i8, i8* %122, i64 %forof.run.3.n
  %137 = load i8, i8* %136
  %138 = and i8 %137, -64
  %139 = icmp eq i8 %138, -128
  %forof.run.3.grown = add i64 %forof.run.3.n, 1
  br i1 %139, label %forof.run.3, label %forof.take.3

forof.take.3:
  %140 = add i64 %120, %forof.run.3.n
  store i64 %140, i64* %forof.next.3, align 8
  %141 = call i8* @nish_str_new(i8* %122, i64 %forof.run.3.n)
  store i8* %141, i8** %d.addr, align 8
  %142 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %143 = load i8*, i8** %142, align 8
  %144 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %145 = load i64, i64* %144, align 8
  %146 = load i8*, i8** %d.addr, align 8
  %147 = call zeroext i1 @nish_str_eq(i8* %146, i8* bitcast ({ i64, [5 x i8] }* @.str.11 to i8*))
  br i1 %147, label %if.then.2, label %if.end.2

if.then.2:
  %148 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %149 = load i8*, i8** %148, align 8
  %150 = icmp eq i8* %149, %114
  br i1 %150, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %151 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %116, i64* %151, align 8
  br label %pass.done.1

pass.free.1:
  %152 = ptrtoint i8* %114 to i64
  %153 = add i64 %152, %116
  call void @nish_arena_release(i64 %153)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc.2

if.end.2:
  %154 = load i8*, i8** %c.addr.2, align 8
  %155 = call zeroext i1 @nish_str_eq(i8* %154, i8* bitcast ({ i64, [5 x i8] }* @.str.11 to i8*))
  br i1 %155, label %if.then.3, label %if.end.3

if.then.3:
  %156 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %157 = load i8*, i8** %156, align 8
  %158 = icmp eq i8* %157, %114
  br i1 %158, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %159 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %116, i64* %159, align 8
  br label %pass.done.2

pass.free.2:
  %160 = ptrtoint i8* %114 to i64
  %161 = add i64 %160, %116
  call void @nish_arena_release(i64 %161)
  br label %pass.done.2

pass.done.2:
  br label %forof.end.2

if.end.3:
  %162 = load i8*, i8** %c.addr.2, align 8
  %163 = load i8*, i8** %d.addr, align 8
  %164 = call i8* @nish_str_concat(i8* %162, i8* %163)
  call void @nish_print(i8* %164)
  %165 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %166 = load i8*, i8** %165, align 8
  %167 = icmp eq i8* %166, %143
  br i1 %167, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %168 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %145, i64* %168, align 8
  br label %pass.done.3

pass.free.3:
  %169 = ptrtoint i8* %143 to i64
  %170 = add i64 %169, %145
  call void @nish_arena_release(i64 %170)
  br label %pass.done.3

pass.done.3:
  br label %forof.inc.3

forof.inc.3:
  %171 = load i64, i64* %forof.next.3, align 8
  store i64 %171, i64* %forof.idx.3, align 8
  br label %forof.cond.3

forof.end.3:
  %172 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %173 = load i8*, i8** %172, align 8
  %174 = icmp eq i8* %173, %114
  br i1 %174, label %pass.rewind.4, label %pass.free.4

pass.rewind.4:
  %175 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %116, i64* %175, align 8
  br label %pass.done.4

pass.free.4:
  %176 = ptrtoint i8* %114 to i64
  %177 = add i64 %176, %116
  call void @nish_arena_release(i64 %177)
  br label %pass.done.4

pass.done.4:
  br label %forof.inc.2

forof.inc.2:
  %178 = load i64, i64* %forof.next.2, align 8
  store i64 %178, i64* %forof.idx.2, align 8
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
!5 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}
