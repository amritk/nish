@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" * \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c" -> \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"pairs 1000000 wrong \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" fold \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2

define internal noundef i64 @reference(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %mask.addr = alloca i64, align 8
  %aHi.addr = alloca i64, align 8
  %aLo.addr = alloca i64, align 8
  %bHi.addr = alloca i64, align 8
  %bLo.addr = alloca i64, align 8
  %ll.addr = alloca i64, align 8
  %hl.addr = alloca i64, align 8
  %lh.addr = alloca i64, align 8
  %cross.addr = alloca i64, align 8
  store i64 4294967295, i64* %mask.addr, align 8
  %0 = sext i32 32 to i64
  %1 = and i64 %0, 63
  %2 = lshr i64 %a, %1
  store i64 %2, i64* %aHi.addr, align 8
  %3 = load i64, i64* %mask.addr, align 8
  %4 = and i64 %a, %3
  store i64 %4, i64* %aLo.addr, align 8
  %5 = sext i32 32 to i64
  %6 = and i64 %5, 63
  %7 = lshr i64 %b, %6
  store i64 %7, i64* %bHi.addr, align 8
  %8 = load i64, i64* %mask.addr, align 8
  %9 = and i64 %b, %8
  store i64 %9, i64* %bLo.addr, align 8
  %10 = load i64, i64* %aLo.addr, align 8
  %11 = load i64, i64* %bLo.addr, align 8
  %12 = mul i64 %10, %11
  store i64 %12, i64* %ll.addr, align 8
  %13 = load i64, i64* %aHi.addr, align 8
  %14 = load i64, i64* %bLo.addr, align 8
  %15 = mul i64 %13, %14
  store i64 %15, i64* %hl.addr, align 8
  %16 = load i64, i64* %aLo.addr, align 8
  %17 = load i64, i64* %bHi.addr, align 8
  %18 = mul i64 %16, %17
  store i64 %18, i64* %lh.addr, align 8
  %19 = load i64, i64* %ll.addr, align 8
  %20 = sext i32 32 to i64
  %21 = and i64 %20, 63
  %22 = lshr i64 %19, %21
  %23 = load i64, i64* %hl.addr, align 8
  %24 = load i64, i64* %mask.addr, align 8
  %25 = and i64 %23, %24
  %26 = add i64 %22, %25
  %27 = load i64, i64* %lh.addr, align 8
  %28 = add i64 %26, %27
  store i64 %28, i64* %cross.addr, align 8
  %29 = load i64, i64* %hl.addr, align 8
  %30 = sext i32 32 to i64
  %31 = and i64 %30, 63
  %32 = lshr i64 %29, %31
  %33 = load i64, i64* %cross.addr, align 8
  %34 = sext i32 32 to i64
  %35 = and i64 %34, 63
  %36 = lshr i64 %33, %35
  %37 = add i64 %32, %36
  %38 = load i64, i64* %aHi.addr, align 8
  %39 = load i64, i64* %bHi.addr, align 8
  %40 = mul i64 %38, %39
  %41 = add i64 %37, %40
  ret i64 %41
}

define internal void @show(i64 noundef %a, i64 noundef %b) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_u64(i64 %a)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %2 = call i8* @nish_str_from_u64(i64 %b)
  %3 = call i8* @nish_str_concat(i8* %1, i8* %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*))
  %5 = zext i64 %a to i128
  %6 = zext i64 %b to i128
  %7 = mul i128 %5, %6
  %8 = lshr i128 %7, 64
  %9 = trunc i128 %8 to i64
  %10 = call i8* @nish_str_from_u64(i64 %9)
  %11 = call i8* @nish_str_concat(i8* %4, i8* %10)
  call void @nish_print(i8* %11)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %zero.addr = alloca i64, align 8
  %one.addr = alloca i64, align 8
  %k32.addr = alloca i64, align 8
  %top.addr = alloca i64, align 8
  %all.addr = alloca i64, align 8
  %x.addr = alloca i64, align 8
  %fold.addr = alloca i64, align 8
  %wrong.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %h.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 0 to i64
  store i64 %0, i64* %zero.addr, align 8
  %1 = sext i32 1 to i64
  store i64 %1, i64* %one.addr, align 8
  %2 = load i64, i64* %one.addr, align 8
  %3 = sext i32 32 to i64
  %4 = and i64 %3, 63
  %5 = shl i64 %2, %4
  store i64 %5, i64* %k32.addr, align 8
  %6 = load i64, i64* %one.addr, align 8
  %7 = sext i32 63 to i64
  %8 = and i64 %7, 63
  %9 = shl i64 %6, %8
  store i64 %9, i64* %top.addr, align 8
  %10 = load i64, i64* %zero.addr, align 8
  %11 = xor i64 %10, -1
  store i64 %11, i64* %all.addr, align 8
  %12 = load i64, i64* %zero.addr, align 8
  %13 = load i64, i64* %zero.addr, align 8
  call void @show(i64 %12, i64 %13)
  %14 = load i64, i64* %zero.addr, align 8
  %15 = load i64, i64* %all.addr, align 8
  call void @show(i64 %14, i64 %15)
  %16 = load i64, i64* %one.addr, align 8
  %17 = load i64, i64* %one.addr, align 8
  call void @show(i64 %16, i64 %17)
  %18 = load i64, i64* %one.addr, align 8
  %19 = load i64, i64* %all.addr, align 8
  call void @show(i64 %18, i64 %19)
  %20 = load i64, i64* %k32.addr, align 8
  %21 = load i64, i64* %k32.addr, align 8
  call void @show(i64 %20, i64 %21)
  %22 = load i64, i64* %k32.addr, align 8
  %23 = load i64, i64* %one.addr, align 8
  %24 = sub i64 %22, %23
  %25 = load i64, i64* %k32.addr, align 8
  %26 = load i64, i64* %one.addr, align 8
  %27 = sub i64 %25, %26
  call void @show(i64 %24, i64 %27)
  %28 = load i64, i64* %k32.addr, align 8
  %29 = load i64, i64* %one.addr, align 8
  %30 = add i64 %28, %29
  %31 = load i64, i64* %all.addr, align 8
  call void @show(i64 %30, i64 %31)
  %32 = load i64, i64* %top.addr, align 8
  %33 = sext i32 2 to i64
  call void @show(i64 %32, i64 %33)
  %34 = load i64, i64* %all.addr, align 8
  %35 = sext i32 2 to i64
  call void @show(i64 %34, i64 %35)
  %36 = load i64, i64* %all.addr, align 8
  %37 = load i64, i64* %all.addr, align 8
  call void @show(i64 %36, i64 %37)
  %38 = sext i32 20529 to i64
  %39 = sext i32 42 to i64
  %40 = and i64 %39, 63
  %41 = shl i64 %38, %40
  %42 = sext i32 1234567 to i64
  %43 = or i64 %41, %42
  store i64 %43, i64* %x.addr, align 8
  %44 = load i64, i64* %zero.addr, align 8
  store i64 %44, i64* %fold.addr, align 8
  store i32 0, i32* %wrong.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %45 = load i32, i32* %i.addr, align 4
  %46 = icmp slt i32 %45, 1000000
  br i1 %46, label %for.body, label %for.end

for.body:
  %47 = load i64, i64* %x.addr, align 8
  %48 = load i64, i64* %x.addr, align 8
  %49 = sext i32 13 to i64
  %50 = and i64 %49, 63
  %51 = shl i64 %48, %50
  %52 = xor i64 %47, %51
  store i64 %52, i64* %x.addr, align 8
  %53 = load i64, i64* %x.addr, align 8
  %54 = load i64, i64* %x.addr, align 8
  %55 = sext i32 7 to i64
  %56 = and i64 %55, 63
  %57 = lshr i64 %54, %56
  %58 = xor i64 %53, %57
  store i64 %58, i64* %x.addr, align 8
  %59 = load i64, i64* %x.addr, align 8
  %60 = load i64, i64* %x.addr, align 8
  %61 = sext i32 17 to i64
  %62 = and i64 %61, 63
  %63 = shl i64 %60, %62
  %64 = xor i64 %59, %63
  store i64 %64, i64* %x.addr, align 8
  %65 = load i64, i64* %x.addr, align 8
  store i64 %65, i64* %a.addr, align 8
  %66 = load i64, i64* %x.addr, align 8
  %67 = load i64, i64* %x.addr, align 8
  %68 = sext i32 13 to i64
  %69 = and i64 %68, 63
  %70 = shl i64 %67, %69
  %71 = xor i64 %66, %70
  store i64 %71, i64* %x.addr, align 8
  %72 = load i64, i64* %x.addr, align 8
  %73 = load i64, i64* %x.addr, align 8
  %74 = sext i32 7 to i64
  %75 = and i64 %74, 63
  %76 = lshr i64 %73, %75
  %77 = xor i64 %72, %76
  store i64 %77, i64* %x.addr, align 8
  %78 = load i64, i64* %x.addr, align 8
  %79 = load i64, i64* %x.addr, align 8
  %80 = sext i32 17 to i64
  %81 = and i64 %80, 63
  %82 = shl i64 %79, %81
  %83 = xor i64 %78, %82
  store i64 %83, i64* %x.addr, align 8
  %84 = load i64, i64* %a.addr, align 8
  %85 = load i64, i64* %x.addr, align 8
  %86 = zext i64 %84 to i128
  %87 = zext i64 %85 to i128
  %88 = mul i128 %86, %87
  %89 = lshr i128 %88, 64
  %90 = trunc i128 %89 to i64
  store i64 %90, i64* %h.addr, align 8
  %91 = load i64, i64* %h.addr, align 8
  %92 = load i64, i64* %a.addr, align 8
  %93 = load i64, i64* %x.addr, align 8
  %94 = call i64 @reference(i64 %92, i64 %93)
  %95 = icmp ne i64 %91, %94
  br i1 %95, label %if.then, label %if.end

if.then:
  %96 = load i32, i32* %wrong.addr, align 4
  %97 = add nsw i32 %96, 1
  store i32 %97, i32* %wrong.addr, align 4
  br label %if.end

if.end:
  %98 = load i64, i64* %fold.addr, align 8
  %99 = load i64, i64* %one.addr, align 8
  %100 = and i64 %99, 63
  %101 = shl i64 %98, %100
  %102 = load i64, i64* %fold.addr, align 8
  %103 = sext i32 63 to i64
  %104 = and i64 %103, 63
  %105 = lshr i64 %102, %104
  %106 = or i64 %101, %105
  %107 = load i64, i64* %h.addr, align 8
  %108 = xor i64 %106, %107
  store i64 %108, i64* %fold.addr, align 8
  br label %for.inc

for.inc:
  %109 = load i32, i32* %i.addr, align 4
  %110 = add nsw i32 %109, 1
  store i32 %110, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %111 = load i32, i32* %wrong.addr, align 4
  %112 = call i8* @nish_str_from_i32(i32 %111)
  %113 = call i8* @nish_str_concat(i8* bitcast ({ i64, [21 x i8] }* @.str.2 to i8*), i8* %112)
  %114 = call i8* @nish_str_concat(i8* %113, i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*))
  %115 = load i64, i64* %fold.addr, align 8
  %116 = call i8* @nish_str_from_u64(i64 %115)
  %117 = call i8* @nish_str_concat(i8* %114, i8* %116)
  call void @nish_print(i8* %117)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
