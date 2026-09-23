@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"before\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8

declare void @nish_free_arena() #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noundef i32 @at(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds i8, i8* %s, i64 8
  %5 = getelementptr inbounds i8, i8* %4, i64 %0
  %6 = load i8, i8* %5, align 1
  %7 = zext i8 %6 to i32
  ret i32 %7
}

define internal noundef i32 @first(i8* noundef nonnull noalias readonly align 8 nocapture %s) #1 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp sgt i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds i8, i8* %s, i64 8
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  %6 = load i8, i8* %5, align 1
  %7 = zext i8 %6 to i32
  ret i32 %7

if.end:
  ret i32 0
}

define noundef i32 @nish_main() #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  %0 = call i32 @first(i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  store i32 %0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, 3
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = load i32, i32* %t.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 5
  %6 = call i32 @at(i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i32 %5)
  %7 = add nsw i32 %3, %6
  store i32 %7, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i32, i32* %t.addr, align 4
  ret i32 %10
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
