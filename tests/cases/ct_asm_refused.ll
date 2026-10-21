%struct.nish_array = type { i64, i64, i8* }

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic_div(i1 noundef zeroext) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define noundef i32 @naiveEqual(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 32
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = bitcast i8* %1 to i8*
  %9 = getelementptr inbounds i8, i8* %8, i64 %7
  %10 = load i8, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %3 to i8*
  %14 = getelementptr inbounds i8, i8* %13, i64 %12
  %15 = load i8, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %16 = icmp ne i8 %10, %15
  br i1 %16, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 4294967295
}

define noundef i32 @indexedLookup(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %secret) #0 {
entry:
  %0 = and i32 %secret, 15
  %1 = sext i32 %0 to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %3 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 %1
  %6 = load i32, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %6
}

define void @indexedStore(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %table, i32 noundef %secret) #1 {
entry:
  %0 = and i32 %secret, 15
  %1 = sext i32 %0 to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %3 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 %1
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret void
}

define noundef i32 @unreadCall(i32 noundef %secret) #1 {
entry:
  %text.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = zext i32 %secret to i64
  %1 = call i8* @nish_str_from_u64(i64 %0)
  store i8* %1, i8** %text.addr, align 8
  %2 = load i8*, i8** %text.addr, align 8
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = xor i32 %secret, %5
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %6
}

define noundef nonnull align 8 i8* @secretText(i32 noundef %secret) #1 {
entry:
  %0 = zext i32 %secret to i64
  %1 = call i8* @nish_str_from_u64(i64 %0)
  ret i8* %1
}

define noundef i32 @leakyRow(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %secret) #0 {
entry:
  %acc.addr = alloca i32, align 4
  store i32 %secret, i32* %acc.addr, align 4
  %0 = load i32, i32* %acc.addr, align 4
  %1 = mul i32 %0, 2654435761
  %2 = load i32, i32* %acc.addr, align 4
  %3 = lshr i32 %2, 13
  %4 = xor i32 %1, %3
  %5 = load i32, i32* %acc.addr, align 4
  %6 = and i32 %5, 15
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %7
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = xor i32 %4, %12
  store i32 %13, i32* %acc.addr, align 4
  %14 = load i32, i32* %acc.addr, align 4
  %15 = mul i32 %14, 2654435761
  %16 = load i32, i32* %acc.addr, align 4
  %17 = lshr i32 %16, 13
  %18 = xor i32 %15, %17
  %19 = load i32, i32* %acc.addr, align 4
  %20 = add i32 %19, 1
  %21 = and i32 %20, 15
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %22
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = xor i32 %18, %27
  store i32 %28, i32* %acc.addr, align 4
  %29 = load i32, i32* %acc.addr, align 4
  %30 = mul i32 %29, 2654435761
  %31 = load i32, i32* %acc.addr, align 4
  %32 = lshr i32 %31, 13
  %33 = xor i32 %30, %32
  %34 = load i32, i32* %acc.addr, align 4
  %35 = add i32 %34, 2
  %36 = and i32 %35, 15
  %37 = sext i32 %36 to i64
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %37
  %42 = load i32, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = xor i32 %33, %42
  store i32 %43, i32* %acc.addr, align 4
  %44 = load i32, i32* %acc.addr, align 4
  %45 = mul i32 %44, 2654435761
  %46 = load i32, i32* %acc.addr, align 4
  %47 = lshr i32 %46, 13
  %48 = xor i32 %45, %47
  %49 = load i32, i32* %acc.addr, align 4
  %50 = add i32 %49, 3
  %51 = and i32 %50, 15
  %52 = sext i32 %51 to i64
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %52
  %57 = load i32, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = xor i32 %48, %57
  store i32 %58, i32* %acc.addr, align 4
  %59 = load i32, i32* %acc.addr, align 4
  %60 = mul i32 %59, 2654435761
  %61 = load i32, i32* %acc.addr, align 4
  %62 = lshr i32 %61, 13
  %63 = xor i32 %60, %62
  %64 = load i32, i32* %acc.addr, align 4
  %65 = add i32 %64, 4
  %66 = and i32 %65, 15
  %67 = sext i32 %66 to i64
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = bitcast i8* %69 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 %67
  %72 = load i32, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %73 = xor i32 %63, %72
  store i32 %73, i32* %acc.addr, align 4
  %74 = load i32, i32* %acc.addr, align 4
  %75 = mul i32 %74, 2654435761
  %76 = load i32, i32* %acc.addr, align 4
  %77 = lshr i32 %76, 13
  %78 = xor i32 %75, %77
  %79 = load i32, i32* %acc.addr, align 4
  %80 = add i32 %79, 5
  %81 = and i32 %80, 15
  %82 = sext i32 %81 to i64
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = bitcast i8* %84 to i32*
  %86 = getelementptr inbounds i32, i32* %85, i64 %82
  %87 = load i32, i32* %86, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %88 = xor i32 %78, %87
  store i32 %88, i32* %acc.addr, align 4
  %89 = load i32, i32* %acc.addr, align 4
  %90 = mul i32 %89, 2654435761
  %91 = load i32, i32* %acc.addr, align 4
  %92 = lshr i32 %91, 13
  %93 = xor i32 %90, %92
  %94 = load i32, i32* %acc.addr, align 4
  %95 = add i32 %94, 6
  %96 = and i32 %95, 15
  %97 = sext i32 %96 to i64
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = bitcast i8* %99 to i32*
  %101 = getelementptr inbounds i32, i32* %100, i64 %97
  %102 = load i32, i32* %101, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %103 = xor i32 %93, %102
  store i32 %103, i32* %acc.addr, align 4
  %104 = load i32, i32* %acc.addr, align 4
  %105 = mul i32 %104, 2654435761
  %106 = load i32, i32* %acc.addr, align 4
  %107 = lshr i32 %106, 13
  %108 = xor i32 %105, %107
  %109 = load i32, i32* %acc.addr, align 4
  %110 = add i32 %109, 7
  %111 = and i32 %110, 15
  %112 = sext i32 %111 to i64
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = bitcast i8* %114 to i32*
  %116 = getelementptr inbounds i32, i32* %115, i64 %112
  %117 = load i32, i32* %116, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %118 = xor i32 %108, %117
  store i32 %118, i32* %acc.addr, align 4
  %119 = load i32, i32* %acc.addr, align 4
  %120 = mul i32 %119, 2654435761
  %121 = load i32, i32* %acc.addr, align 4
  %122 = lshr i32 %121, 13
  %123 = xor i32 %120, %122
  %124 = load i32, i32* %acc.addr, align 4
  %125 = add i32 %124, 8
  %126 = and i32 %125, 15
  %127 = sext i32 %126 to i64
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %129 = load i8*, i8** %128, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %130 = bitcast i8* %129 to i32*
  %131 = getelementptr inbounds i32, i32* %130, i64 %127
  %132 = load i32, i32* %131, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %133 = xor i32 %123, %132
  store i32 %133, i32* %acc.addr, align 4
  %134 = load i32, i32* %acc.addr, align 4
  %135 = mul i32 %134, 2654435761
  %136 = load i32, i32* %acc.addr, align 4
  %137 = lshr i32 %136, 13
  %138 = xor i32 %135, %137
  %139 = load i32, i32* %acc.addr, align 4
  %140 = add i32 %139, 9
  %141 = and i32 %140, 15
  %142 = sext i32 %141 to i64
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %144 = load i8*, i8** %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = bitcast i8* %144 to i32*
  %146 = getelementptr inbounds i32, i32* %145, i64 %142
  %147 = load i32, i32* %146, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %148 = xor i32 %138, %147
  store i32 %148, i32* %acc.addr, align 4
  %149 = load i32, i32* %acc.addr, align 4
  %150 = mul i32 %149, 2654435761
  %151 = load i32, i32* %acc.addr, align 4
  %152 = lshr i32 %151, 13
  %153 = xor i32 %150, %152
  %154 = load i32, i32* %acc.addr, align 4
  %155 = add i32 %154, 10
  %156 = and i32 %155, 15
  %157 = sext i32 %156 to i64
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %159 = load i8*, i8** %158, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %160 = bitcast i8* %159 to i32*
  %161 = getelementptr inbounds i32, i32* %160, i64 %157
  %162 = load i32, i32* %161, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %163 = xor i32 %153, %162
  store i32 %163, i32* %acc.addr, align 4
  %164 = load i32, i32* %acc.addr, align 4
  %165 = mul i32 %164, 2654435761
  %166 = load i32, i32* %acc.addr, align 4
  %167 = lshr i32 %166, 13
  %168 = xor i32 %165, %167
  %169 = load i32, i32* %acc.addr, align 4
  %170 = add i32 %169, 11
  %171 = and i32 %170, 15
  %172 = sext i32 %171 to i64
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %174 = load i8*, i8** %173, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %175 = bitcast i8* %174 to i32*
  %176 = getelementptr inbounds i32, i32* %175, i64 %172
  %177 = load i32, i32* %176, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %178 = xor i32 %168, %177
  store i32 %178, i32* %acc.addr, align 4
  %179 = load i32, i32* %acc.addr, align 4
  ret i32 %179
}

define noundef i32 @callsLeak(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %secret) #0 {
entry:
  %0 = call i32 @leakyRow(%struct.nish_array* %table, i32 %secret)
  %1 = add i32 %secret, 1
  %2 = call i32 @leakyRow(%struct.nish_array* %table, i32 %1)
  %3 = xor i32 %0, %2
  %4 = add i32 %secret, 2
  %5 = call i32 @leakyRow(%struct.nish_array* %table, i32 %4)
  %6 = xor i32 %3, %5
  %7 = add i32 %secret, 3
  %8 = call i32 @leakyRow(%struct.nish_array* %table, i32 %7)
  %9 = xor i32 %6, %8
  ret i32 %9
}

define noundef i32 @tailLeak(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %secret) #0 {
entry:
  %0 = xor i32 %secret, 1
  %1 = call i32 @leakyRow(%struct.nish_array* %table, i32 %0)
  ret i32 %1
}

define noundef i32 @secretDivide(i32 noundef %a, i32 noundef %secret) #2 {
entry:
  %0 = or i32 %secret, 1
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %2 = udiv i32 %a, %0
  ret i32 %2
}

define void @leakyBaseRead(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %c, i32 noundef %digit) #2 {
entry:
  %at.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = mul i32 %c, 240
  %1 = and i32 %digit, 15
  %2 = sub i32 %1, 1
  %3 = and i32 %2, 15
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %3, i32 16)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = add i32 %0, %5
  store i32 %7, i32* %at.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %12 = load i32, i32* %i.addr, align 4
  %13 = icmp slt i32 %12, 16
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = load i32, i32* %at.addr, align 4
  %17 = load i32, i32* %i.addr, align 4
  %18 = add i32 %16, %17
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %11 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = bitcast i8* %9 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %15
  store i32 %22, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @leakyDivstep(i32 noundef %zeta, i32 noundef %f0, i32 noundef %g0, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %t) #1 {
entry:
  %z.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %g.addr = alloca i32, align 4
  %u.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %q.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %tf.addr = alloca i32, align 4
  %tu.addr = alloca i32, align 4
  %tv.addr = alloca i32, align 4
  store i32 %zeta, i32* %z.addr, align 4
  store i32 %f0, i32* %f.addr, align 4
  store i32 %g0, i32* %g.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 0
  %4 = load i32, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %4, i32* %u.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %9, i32* %v.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 2
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %14, i32* %q.addr, align 4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 3
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %19, i32* %r.addr, align 4
  %20 = load i32, i32* %g.addr, align 4
  %21 = and i32 %20, 1
  %22 = icmp ne i32 %21, 0
  br i1 %22, label %if.then, label %if.else

if.then:
  %23 = load i32, i32* %z.addr, align 4
  %24 = icmp slt i32 %23, 0
  br i1 %24, label %if.then.1, label %if.else.1

if.then.1:
  %25 = load i32, i32* %f.addr, align 4
  store i32 %25, i32* %tf.addr, align 4
  %26 = load i32, i32* %u.addr, align 4
  store i32 %26, i32* %tu.addr, align 4
  %27 = load i32, i32* %v.addr, align 4
  store i32 %27, i32* %tv.addr, align 4
  %28 = load i32, i32* %g.addr, align 4
  store i32 %28, i32* %f.addr, align 4
  %29 = load i32, i32* %q.addr, align 4
  store i32 %29, i32* %u.addr, align 4
  %30 = load i32, i32* %r.addr, align 4
  store i32 %30, i32* %v.addr, align 4
  %31 = load i32, i32* %g.addr, align 4
  %32 = load i32, i32* %tf.addr, align 4
  %33 = sub i32 %31, %32
  store i32 %33, i32* %g.addr, align 4
  %34 = load i32, i32* %q.addr, align 4
  %35 = load i32, i32* %tu.addr, align 4
  %36 = sub i32 %34, %35
  store i32 %36, i32* %q.addr, align 4
  %37 = load i32, i32* %r.addr, align 4
  %38 = load i32, i32* %tv.addr, align 4
  %39 = sub i32 %37, %38
  store i32 %39, i32* %r.addr, align 4
  %40 = load i32, i32* %z.addr, align 4
  %41 = sub i32 0, %40
  %42 = sub i32 %41, 2
  store i32 %42, i32* %z.addr, align 4
  br label %if.end.1

if.else.1:
  %43 = load i32, i32* %g.addr, align 4
  %44 = load i32, i32* %f.addr, align 4
  %45 = add i32 %43, %44
  store i32 %45, i32* %g.addr, align 4
  %46 = load i32, i32* %q.addr, align 4
  %47 = load i32, i32* %u.addr, align 4
  %48 = add i32 %46, %47
  store i32 %48, i32* %q.addr, align 4
  %49 = load i32, i32* %r.addr, align 4
  %50 = load i32, i32* %v.addr, align 4
  %51 = add i32 %49, %50
  store i32 %51, i32* %r.addr, align 4
  %52 = load i32, i32* %z.addr, align 4
  %53 = sub i32 %52, 1
  store i32 %53, i32* %z.addr, align 4
  br label %if.end.1

if.end.1:
  br label %if.end

if.else:
  %54 = load i32, i32* %z.addr, align 4
  %55 = sub i32 %54, 1
  store i32 %55, i32* %z.addr, align 4
  br label %if.end

if.end:
  %56 = load i32, i32* %u.addr, align 4
  %57 = shl i32 %56, 1
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 0
  store i32 %57, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %62 = load i32, i32* %v.addr, align 4
  %63 = shl i32 %62, 1
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = bitcast i8* %65 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 1
  store i32 %63, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %68 = load i32, i32* %q.addr, align 4
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = bitcast i8* %70 to i32*
  %72 = getelementptr inbounds i32, i32* %71, i64 2
  store i32 %68, i32* %72, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %73 = load i32, i32* %r.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 3
  store i32 %73, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %78 = load i32, i32* %z.addr, align 4
  %79 = load i32, i32* %f.addr, align 4
  %80 = xor i32 %78, %79
  %81 = load i32, i32* %g.addr, align 4
  %82 = lshr i32 %81, 1
  %83 = xor i32 %80, %82
  ret i32 %83
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !8, i64 16}
!11 = !{!"element i8", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
