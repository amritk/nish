%struct.Canvas = type { %struct.Screen*, i32, i32, %struct.nish_array* }
%struct.KeyDecoder = type { double, %struct.nish_array*, double }
%struct.KeyEvent = type { i32, i32 }
%struct.Screen = type { %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32, i32, i32, i1 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\1B\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"^[\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"char\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"up\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"down\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"right\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"left\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"enter\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"space\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"escape\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"ctrl-c\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"tab\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"backspace\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"control\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"unknown\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"(\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c")\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c": [\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"]\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c" holding\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"leave\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"hide\00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"show\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"clear\00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"reset\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"move 3,1\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"rgb clamps: \00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.31 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.32 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"palette red \00" }, align 8
@.str.33 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" grey \00" }, align 8
@.str.34 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" near-black \00" }, align 8
@.str.35 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" white \00" }, align 8
@.str.36 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" default \00" }, align 8
@.str.37 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"blank 4x2\00" }, align 8
@.str.38 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"unchanged: \00" }, align 8
@.str.39 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"one cell\00" }, align 8
@.str.40 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"gap of one, bridged\00" }, align 8
@.str.41 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"gap of two in another style, moved\00" }, align 8
@.str.42 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"row start, then home\00" }, align 8
@.str.43 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"off screen: \00" }, align 8
@.str.44 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"Hi\00" }, align 8
@.str.45 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"yo\00" }, align 8
@.str.46 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\C3\A9!\00" }, align 8
@.str.47 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"styled run\00" }, align 8
@.str.48 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"text answers \00" }, align 8
@.str.49 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c", glyph at 4 is \00" }, align 8
@.str.50 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"add inverse\00" }, align 8
@.str.51 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"cleared\00" }, align 8
@.str.52 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.53 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"256 colours\00" }, align 8
@.str.54 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"canvas \00" }, align 8
@.str.55 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.56 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"pixels\00" }, align 8
@.str.57 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"fillRect\00" }, align 8
@.str.58 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"line\00" }, align 8
@.str.59 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"pixel (1,1) \00" }, align 8
@.str.60 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" (1,2) \00" }, align 8
@.str.61 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" off \00" }, align 8
@.str.62 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ok\00" }, align 8
@.str.63 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"text over pixels\00" }, align 8
@.str.64 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"frame loop sent \00" }, align 8
@.str.65 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.66 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"arrows\00" }, align 8
@.str.67 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"controls\00" }, align 8
@.str.68 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"printable\00" }, align 8
@.str.69 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"count bounds the read\00" }, align 8
@.str.70 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC | [A, first\00" }, align 8
@.str.71 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"split ESC | [A, then\00" }, align 8
@.str.72 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC[ | B, first\00" }, align 8
@.str.73 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"split ESC[ | B, then\00" }, align 8
@.str.74 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"split ESC O | C, first\00" }, align 8
@.str.75 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC O | C, then\00" }, align 8
@.str.76 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"parameters, ESC[1;5A\00" }, align 8
@.str.77 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"other final, ESC[3~\00" }, align 8
@.str.78 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"lone ESC, first\00" }, align 8
@.str.79 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"lone ESC, poll early\00" }, align 8
@.str.80 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"lone ESC, poll late\00" }, align 8
@.str.81 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"ESC then a letter\00" }, align 8
@.str.82 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"ESC ESC [ A\00" }, align 8
@.str.83 = private unnamed_addr constant { i64, [36 x i8] } { i64 35, [36 x i8] c"held ESC timed out by the next feed\00" }, align 8
@.str.84 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"  next feed\00" }, align 8
@.str.85 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"split UTF-8, first\00" }, align 8
@.str.86 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"split UTF-8, then\00" }, align 8
@.str.87 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"unfinished UTF-8 timed out\00" }, align 8
@.str.88 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"  poll\00" }, align 8
@.str.89 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"invalid bytes\00" }, align 8
@.str.90 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"a character cut short by another\00" }, align 8
@.str.91 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"empty feed\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish.Canvas.constructor(%struct.Canvas* noundef nonnull noalias align 8 dereferenceable(24) nocapture, %struct.Screen* noundef nonnull align 8 dereferenceable(88)) #0
declare void @nish.Canvas.clear(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef) #0
declare noundef i32 @nish.Canvas.pixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.Canvas.setPixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare void @nish.Canvas.fillRect(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare void @nish.Canvas.line(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Canvas.text(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i8* noundef nonnull noalias readonly align 8, i32 noundef) #0
declare void @nish.Canvas.paintCell(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.KeyDecoder.constructor(%struct.KeyDecoder* noundef nonnull noalias align 8 dereferenceable(24) nocapture, double noundef) #2
declare noundef zeroext i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #3
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, double noundef) #0
declare void @nish.KeyEvent.constructor(%struct.KeyEvent* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i32 noundef, i32 noundef) #2
declare void @nish.Screen.constructor(%struct.Screen* noundef nonnull noalias align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i1 noundef zeroext) #0
declare void @nish.Screen.resize(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.Screen.clear(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef) #2
declare void @nish.Screen.invalidate(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture) #2
declare void @nish.Screen.set(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.text(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i8* noundef nonnull noalias readonly align 8, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.glyphAt(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.Screen.put(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putDecimal(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putGlyph(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putColour(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.colourKey(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare noundef nonnull align 8 i8* @nish.Screen.flush(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture) #0
declare noundef nonnull align 8 i8* @nish.clearScreen() #1
declare noundef nonnull align 8 i8* @nish.enterAltScreen() #1
declare noundef nonnull align 8 i8* @nish.hideCursor() #1
declare noundef nonnull align 8 i8* @nish.leaveAltScreen() #1
declare noundef nonnull align 8 i8* @nish.moveCursor(i32 noundef, i32 noundef) #0
declare noundef i32 @nish.paletteIndex(i32 noundef) #0
declare noundef nonnull align 8 i8* @nish.resetStyle() #1
declare noundef i32 @nish.rgb(i32 noundef, i32 noundef, i32 noundef) #1
declare noundef nonnull align 8 i8* @nish.showCursor() #1
declare noundef nonnull align 8 i8* @nish.replaceAll(i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8 nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal noundef nonnull align 8 i8* @shown(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.replaceAll(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define internal void @frame(i8* noundef nonnull noalias readonly align 8 nocapture %label, i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @shown(i8* %s)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  %4 = call i8* @nish_str_concat(i8* %0, i8* %3)
  call void @nish_print(i8* %4)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @bytesOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %codes) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %c.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %5 = load i64, i64* %forof.idx, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %codes, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 %5, %7
  br i1 %8, label %forof.body, label %forof.end

forof.body:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %codes, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %5
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %13, i32* %c.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %15 = load i32, i32* %c.addr, align 4
  %16 = trunc i32 %15 to i8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 1)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i8*
  %25 = getelementptr inbounds i8, i8* %24, i64 %18
  store i8 %16, i8* %25, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  br label %forof.inc

forof.inc:
  %28 = load i64, i64* %forof.idx, align 8
  %29 = add i64 %28, 1
  store i64 %29, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %30
}

define internal noundef nonnull align 8 i8* @kindName(i32 noundef %kind) #1 {
entry:
  %0 = icmp eq i32 %kind, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*)

if.end:
  %1 = icmp eq i32 %kind, 2
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*)

if.end.1:
  %2 = icmp eq i32 %kind, 3
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*)

if.end.2:
  %3 = icmp eq i32 %kind, 4
  br i1 %3, label %if.then.3, label %if.end.3

if.then.3:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)

if.end.3:
  %4 = icmp eq i32 %kind, 5
  br i1 %4, label %if.then.4, label %if.end.4

if.then.4:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*)

if.end.4:
  %5 = icmp eq i32 %kind, 6
  br i1 %5, label %if.then.5, label %if.end.5

if.then.5:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*)

if.end.5:
  %6 = icmp eq i32 %kind, 7
  br i1 %6, label %if.then.6, label %if.end.6

if.then.6:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)

if.end.6:
  %7 = icmp eq i32 %kind, 8
  br i1 %7, label %if.then.7, label %if.end.7

if.then.7:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*)

if.end.7:
  %8 = icmp eq i32 %kind, 9
  br i1 %8, label %if.then.8, label %if.end.8

if.then.8:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.11 to i8*)

if.end.8:
  %9 = icmp eq i32 %kind, 10
  br i1 %9, label %if.then.9, label %if.end.9

if.then.9:
  ret i8* bitcast ({ i64, [4 x i8] }* @.str.12 to i8*)

if.end.9:
  %10 = icmp eq i32 %kind, 11
  br i1 %10, label %if.then.10, label %if.end.10

if.then.10:
  ret i8* bitcast ({ i64, [10 x i8] }* @.str.13 to i8*)

if.end.10:
  %11 = icmp eq i32 %kind, 12
  br i1 %11, label %if.then.11, label %if.end.11

if.then.11:
  ret i8* bitcast ({ i64, [8 x i8] }* @.str.14 to i8*)

if.end.11:
  ret i8* bitcast ({ i64, [8 x i8] }* @.str.15 to i8*)
}

define internal void @events(i8* noundef nonnull noalias readonly align 8 nocapture %label, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %keys, %struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture %d) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %k.addr = alloca %struct.KeyEvent*, align 8
  %forof.idx = alloca i64, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %3 = load i64, i64* %forof.idx, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %forof.body, label %forof.end

forof.body:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to %struct.KeyEvent**
  %10 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %9, i64 %3
  %11 = load %struct.KeyEvent*, %struct.KeyEvent** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.KeyEvent* %11, %struct.KeyEvent** %k.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %13 = load %struct.KeyEvent*, %struct.KeyEvent** %k.addr, align 8
  %14 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !21
  %16 = call i8* @kindName(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.16 to i8*))
  %18 = load %struct.KeyEvent*, %struct.KeyEvent** %k.addr, align 8
  %19 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %18, i32 0, i32 1
  %20 = load i32, i32* %19, align 4, !tbaa !22
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %17, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.17 to i8*))
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 8)
  br label %push.store

push.store:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 %25
  store i8* %23, i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  br label %forof.inc

forof.inc:
  %35 = load i64, i64* %forof.idx, align 8
  %36 = add i64 %35, 1
  store i64 %36, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %37 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [4 x i8] }* @.str.18 to i8*))
  %38 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*) to i64*
  %42 = load i64, i64* %41, align 8
  %43 = sub i64 %40, 1
  %44 = mul i64 %42, %43
  %45 = icmp eq i64 %40, 0
  %46 = select i1 %45, i64 0, i64 %44
  store i64 %46, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %47 = load i64, i64* %join.at, align 8
  %48 = icmp ult i64 %47, %40
  br i1 %48, label %join.sum.body, label %join.copy

join.sum.body:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %50 to i8**
  %52 = getelementptr inbounds i8*, i8** %51, i64 %47
  %53 = load i8*, i8** %52, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %54 = load i64, i64* %join.total, align 8
  %55 = bitcast i8* %53 to i64*
  %56 = load i64, i64* %55, align 8
  %57 = add i64 %54, %56
  store i64 %57, i64* %join.total, align 8
  %58 = add i64 %47, 1
  store i64 %58, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %59 = load i64, i64* %join.total, align 8
  %60 = icmp ugt i64 %59, 2147483647
  %61 = add i64 %59, 9
  %62 = select i1 %60, i64 4611686018427387904, i64 %61
  %63 = call i8* @nish_alloc_struct(i64 %62)
  %64 = bitcast i8* %63 to i64*
  store i64 %59, i64* %64, align 8
  %65 = getelementptr inbounds i8, i8* %63, i64 8
  store i8* %65, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %66 = load i64, i64* %join.at, align 8
  %67 = icmp ult i64 %66, %40
  br i1 %67, label %join.part, label %join.end

join.part:
  %68 = load i8*, i8** %join.p, align 8
  %69 = icmp eq i64 %66, 0
  %70 = select i1 %69, i64 0, i64 %42
  %71 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %68, i8* %71, i64 %70, i1 false)
  %72 = getelementptr inbounds i8, i8* %68, i64 %70
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to i8**
  %76 = getelementptr inbounds i8*, i8** %75, i64 %66
  %77 = load i8*, i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %78 = bitcast i8* %77 to i64*
  %79 = load i64, i64* %78, align 8
  %80 = getelementptr inbounds i8, i8* %77, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %72, i8* %80, i64 %79, i1 false)
  %81 = getelementptr inbounds i8, i8* %72, i64 %79
  store i8* %81, i8** %join.p, align 8
  %82 = add i64 %66, 1
  store i64 %82, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %83 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %83, align 1
  %84 = call i8* @nish_str_concat(i8* %37, i8* %63)
  %85 = call i8* @nish_str_concat(i8* %84, i8* bitcast ({ i64, [2 x i8] }* @.str.20 to i8*))
  %86 = call i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* %d)
  br i1 %86, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %87 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.21 to i8*), %cond.true ], [ bitcast ({ i64, [1 x i8] }* @.str.22 to i8*), %cond.false ]
  %88 = call i8* @nish_str_concat(i8* %85, i8* %87)
  call void @nish_print(i8* %88)
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %s.addr = alloca %struct.Screen*, align 8
  %Screen.obj = alloca %struct.Screen, align 8
  %t.addr = alloca %struct.Screen*, align 8
  %Screen.obj.1 = alloca %struct.Screen, align 8
  %red.addr = alloca i32, align 4
  %blue.addr = alloca i32, align 4
  %drawn.addr = alloca i32, align 4
  %p.addr = alloca %struct.Screen*, align 8
  %Screen.obj.2 = alloca %struct.Screen, align 8
  %cs.addr = alloca %struct.Screen*, align 8
  %c.addr = alloca %struct.Canvas*, align 8
  %Canvas.obj = alloca %struct.Canvas, align 8
  %game.addr = alloca %struct.Screen*, align 8
  %Screen.obj.3 = alloca %struct.Screen, align 8
  %sent.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %out.addr = alloca i8*, align 8
  %d.addr = alloca %struct.KeyDecoder*, align 8
  %KeyDecoder.obj = alloca %struct.KeyDecoder, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [12 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i32], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i32], align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [3 x i32], align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [1 x i32], align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [2 x i32], align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [2 x i32], align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.7 = alloca [1 x i32], align 8
  %arr.hdr.8 = alloca %struct.nish_array, align 8
  %arr.data.8 = alloca [2 x i32], align 8
  %arr.hdr.9 = alloca %struct.nish_array, align 8
  %arr.data.9 = alloca [1 x i32], align 8
  %arr.hdr.10 = alloca %struct.nish_array, align 8
  %arr.data.10 = alloca [6 x i32], align 8
  %arr.hdr.11 = alloca %struct.nish_array, align 8
  %arr.data.11 = alloca [4 x i32], align 8
  %arr.hdr.12 = alloca %struct.nish_array, align 8
  %arr.data.12 = alloca [1 x i32], align 8
  %arr.hdr.13 = alloca %struct.nish_array, align 8
  %arr.data.13 = alloca [2 x i32], align 8
  %arr.hdr.14 = alloca %struct.nish_array, align 8
  %arr.data.14 = alloca [4 x i32], align 8
  %arr.hdr.15 = alloca %struct.nish_array, align 8
  %arr.data.15 = alloca [1 x i32], align 8
  %arr.hdr.16 = alloca %struct.nish_array, align 8
  %arr.data.16 = alloca [1 x i32], align 8
  %arr.hdr.17 = alloca %struct.nish_array, align 8
  %arr.data.17 = alloca [1 x i32], align 8
  %arr.hdr.18 = alloca %struct.nish_array, align 8
  %arr.data.18 = alloca [1 x i32], align 8
  %arr.hdr.19 = alloca %struct.nish_array, align 8
  %arr.data.19 = alloca [2 x i32], align 8
  %arr.hdr.20 = alloca %struct.nish_array, align 8
  %arr.data.20 = alloca [3 x i32], align 8
  %arr.hdr.21 = alloca %struct.nish_array, align 8
  %arr.data.21 = alloca [3 x i32], align 8
  %arr.hdr.22 = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish.enterAltScreen()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), i8* %0)
  %1 = call i8* @nish.leaveAltScreen()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.23 to i8*), i8* %1)
  %2 = call i8* @nish.hideCursor()
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.24 to i8*), i8* %2)
  %3 = call i8* @nish.showCursor()
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.25 to i8*), i8* %3)
  %4 = call i8* @nish.clearScreen()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.26 to i8*), i8* %4)
  %5 = call i8* @nish.resetStyle()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.27 to i8*), i8* %5)
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @nish.moveCursor(i32 3, i32 1)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.28 to i8*), i8* %8)
  %9 = call i32 @nish.rgb(i32 300, i32 -4, i32 128)
  %10 = call i32 @nish.rgb(i32 255, i32 0, i32 128)
  %11 = icmp eq i32 %9, %10
  %12 = select i1 %11, i8* bitcast ({ i64, [5 x i8] }* @.str.30 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.31 to i8*)
  %13 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.29 to i8*), i8* %12)
  call void @nish_print(i8* %13)
  %14 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  %15 = call i32 @nish.paletteIndex(i32 %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.32 to i8*), i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [7 x i8] }* @.str.33 to i8*))
  %19 = call i32 @nish.rgb(i32 128, i32 128, i32 128)
  %20 = call i32 @nish.paletteIndex(i32 %19)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %18, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [13 x i8] }* @.str.34 to i8*))
  %24 = call i32 @nish.rgb(i32 8, i32 8, i32 8)
  %25 = call i32 @nish.paletteIndex(i32 %24)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %23, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [8 x i8] }* @.str.35 to i8*))
  %29 = call i32 @nish.rgb(i32 255, i32 255, i32 255)
  %30 = call i32 @nish.paletteIndex(i32 %29)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %28, i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [10 x i8] }* @.str.36 to i8*))
  %34 = call i32 @nish.paletteIndex(i32 -1)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %33, i8* %35)
  call void @nish_print(i8* %36)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj, i32 4, i32 2, i1 false)
  store %struct.Screen* %Screen.obj, %struct.Screen** %s.addr, align 8
  %37 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %38 = call i64 @nish_arena_mark()
  %39 = call i8* @nish.Screen.flush(%struct.Screen* %37)
  %40 = call i8* @nish_arena_keep(i64 %38, i8* %39)
  call void @frame(i8* bitcast ({ i64, [10 x i8] }* @.str.37 to i8*), i8* %40)
  %41 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %42 = call i64 @nish_arena_mark()
  %43 = call i8* @nish.Screen.flush(%struct.Screen* %41)
  %44 = call i8* @nish_arena_keep(i64 %42, i8* %43)
  %45 = bitcast i8* %44 to i64*
  %46 = load i64, i64* %45, align 8
  %47 = trunc i64 %46 to i32
  %48 = call i8* @nish_str_from_i32(i32 %47)
  %49 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.38 to i8*), i8* %48)
  call void @nish_print(i8* %49)
  %50 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %50, i32 2, i32 1, i32 88, i32 -1, i32 -1, i32 0)
  %51 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %52 = call i64 @nish_arena_mark()
  %53 = call i8* @nish.Screen.flush(%struct.Screen* %51)
  %54 = call i8* @nish_arena_keep(i64 %52, i8* %53)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.39 to i8*), i8* %54)
  %55 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %55, i32 0, i32 0, i32 65, i32 -1, i32 -1, i32 0)
  %56 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %56, i32 2, i32 0, i32 66, i32 -1, i32 -1, i32 0)
  %57 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %58 = call i64 @nish_arena_mark()
  %59 = call i8* @nish.Screen.flush(%struct.Screen* %57)
  %60 = call i8* @nish_arena_keep(i64 %58, i8* %59)
  call void @frame(i8* bitcast ({ i64, [20 x i8] }* @.str.40 to i8*), i8* %60)
  %61 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %61, i32 0, i32 0, i32 67, i32 -1, i32 -1, i32 0)
  %62 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %63 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  call void @nish.Screen.set(%struct.Screen* %62, i32 3, i32 0, i32 68, i32 %63, i32 -1, i32 0)
  %64 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %65 = call i64 @nish_arena_mark()
  %66 = call i8* @nish.Screen.flush(%struct.Screen* %64)
  %67 = call i8* @nish_arena_keep(i64 %65, i8* %66)
  call void @frame(i8* bitcast ({ i64, [35 x i8] }* @.str.41 to i8*), i8* %67)
  %68 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %68, i32 0, i32 1, i32 69, i32 -1, i32 -1, i32 0)
  %69 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %69, i32 0, i32 0, i32 32, i32 -1, i32 -1, i32 0)
  %70 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %71 = call i64 @nish_arena_mark()
  %72 = call i8* @nish.Screen.flush(%struct.Screen* %70)
  %73 = call i8* @nish_arena_keep(i64 %71, i8* %72)
  call void @frame(i8* bitcast ({ i64, [21 x i8] }* @.str.42 to i8*), i8* %73)
  %74 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %74, i32 9, i32 9, i32 90, i32 -1, i32 -1, i32 0)
  %75 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %75, i32 -1, i32 0, i32 90, i32 -1, i32 -1, i32 0)
  %76 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %77 = call i64 @nish_arena_mark()
  %78 = call i8* @nish.Screen.flush(%struct.Screen* %76)
  %79 = call i8* @nish_arena_keep(i64 %77, i8* %78)
  %80 = bitcast i8* %79 to i64*
  %81 = load i64, i64* %80, align 8
  %82 = trunc i64 %81 to i32
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.43 to i8*), i8* %83)
  call void @nish_print(i8* %84)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.1, i32 6, i32 1, i1 false)
  store %struct.Screen* %Screen.obj.1, %struct.Screen** %t.addr, align 8
  %85 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %86 = call i64 @nish_arena_mark()
  %87 = call i8* @nish.Screen.flush(%struct.Screen* %85)
  %88 = call i8* @nish_arena_keep(i64 %86, i8* %87)
  %89 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  store i32 %89, i32* %red.addr, align 4
  %90 = call i32 @nish.rgb(i32 0, i32 0, i32 255)
  store i32 %90, i32* %blue.addr, align 4
  %91 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %92 = load i32, i32* %red.addr, align 4
  %93 = load i32, i32* %blue.addr, align 4
  %94 = call i32 @nish.Screen.text(%struct.Screen* %91, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.44 to i8*), i32 %92, i32 %93, i32 1)
  store i32 %94, i32* %drawn.addr, align 4
  %95 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %96 = load i32, i32* %drawn.addr, align 4
  %97 = load i32, i32* %red.addr, align 4
  %98 = load i32, i32* %blue.addr, align 4
  %99 = call i32 @nish.Screen.text(%struct.Screen* %95, i32 %96, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.45 to i8*), i32 %97, i32 %98, i32 2)
  %100 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %101 = call i32 @nish.Screen.text(%struct.Screen* %100, i32 4, i32 0, i8* bitcast ({ i64, [4 x i8] }* @.str.46 to i8*), i32 -1, i32 -1, i32 0)
  %102 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %103 = call i64 @nish_arena_mark()
  %104 = call i8* @nish.Screen.flush(%struct.Screen* %102)
  %105 = call i8* @nish_arena_keep(i64 %103, i8* %104)
  call void @frame(i8* bitcast ({ i64, [11 x i8] }* @.str.47 to i8*), i8* %105)
  %106 = load i32, i32* %drawn.addr, align 4
  %107 = call i8* @nish_str_from_i32(i32 %106)
  %108 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.48 to i8*), i8* %107)
  %109 = call i8* @nish_str_concat(i8* %108, i8* bitcast ({ i64, [17 x i8] }* @.str.49 to i8*))
  %110 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %111 = call i32 @nish.Screen.glyphAt(%struct.Screen* %110, i32 4, i32 0)
  %112 = call i8* @nish_str_from_i32(i32 %111)
  %113 = call i8* @nish_str_concat(i8* %109, i8* %112)
  call void @nish_print(i8* %113)
  %114 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %115 = load i32, i32* %red.addr, align 4
  %116 = load i32, i32* %blue.addr, align 4
  %117 = or i32 1, 2
  %118 = call i32 @nish.Screen.text(%struct.Screen* %114, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.44 to i8*), i32 %115, i32 %116, i32 %117)
  %119 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %120 = call i64 @nish_arena_mark()
  %121 = call i8* @nish.Screen.flush(%struct.Screen* %119)
  %122 = call i8* @nish_arena_keep(i64 %120, i8* %121)
  call void @frame(i8* bitcast ({ i64, [12 x i8] }* @.str.50 to i8*), i8* %122)
  %123 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  call void @nish.Screen.clear(%struct.Screen* %123, i32 -1)
  %124 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %125 = call i64 @nish_arena_mark()
  %126 = call i8* @nish.Screen.flush(%struct.Screen* %124)
  %127 = call i8* @nish_arena_keep(i64 %125, i8* %126)
  call void @frame(i8* bitcast ({ i64, [8 x i8] }* @.str.51 to i8*), i8* %127)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.2, i32 3, i32 1, i1 true)
  store %struct.Screen* %Screen.obj.2, %struct.Screen** %p.addr, align 8
  %128 = load %struct.Screen*, %struct.Screen** %p.addr, align 8
  %129 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  %130 = call i32 @nish.rgb(i32 0, i32 0, i32 0)
  %131 = call i32 @nish.Screen.text(%struct.Screen* %128, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.52 to i8*), i32 %129, i32 %130, i32 0)
  %132 = load %struct.Screen*, %struct.Screen** %p.addr, align 8
  %133 = call i64 @nish_arena_mark()
  %134 = call i8* @nish.Screen.flush(%struct.Screen* %132)
  %135 = call i8* @nish_arena_keep(i64 %133, i8* %134)
  call void @frame(i8* bitcast ({ i64, [12 x i8] }* @.str.53 to i8*), i8* %135)
  %136 = call i8* @nish_alloc_struct(i64 88)
  %137 = bitcast i8* %136 to %struct.Screen*
  call void @nish.Screen.constructor(%struct.Screen* %137, i32 4, i32 2, i1 false)
  store %struct.Screen* %137, %struct.Screen** %cs.addr, align 8
  %138 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  call void @nish.Canvas.constructor(%struct.Canvas* %Canvas.obj, %struct.Screen* %138)
  store %struct.Canvas* %Canvas.obj, %struct.Canvas** %c.addr, align 8
  %139 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %140 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %139, i32 0, i32 1
  %141 = load i32, i32* %140, align 4, !tbaa !25
  %142 = call i8* @nish_str_from_i32(i32 %141)
  %143 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.54 to i8*), i8* %142)
  %144 = call i8* @nish_str_concat(i8* %143, i8* bitcast ({ i64, [2 x i8] }* @.str.55 to i8*))
  %145 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %146 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %145, i32 0, i32 2
  %147 = load i32, i32* %146, align 4, !tbaa !26
  %148 = call i8* @nish_str_from_i32(i32 %147)
  %149 = call i8* @nish_str_concat(i8* %144, i8* %148)
  call void @nish_print(i8* %149)
  %150 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %151 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %150, i32 0, i32 0, i32 %151)
  %152 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %153 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %152, i32 1, i32 1, i32 %153)
  %154 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %155 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %154, i32 2, i32 0, i32 %155)
  %156 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %157 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %156, i32 2, i32 1, i32 %157)
  %158 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %159 = call i64 @nish_arena_mark()
  %160 = call i8* @nish.Screen.flush(%struct.Screen* %158)
  %161 = call i8* @nish_arena_keep(i64 %159, i8* %160)
  call void @frame(i8* bitcast ({ i64, [7 x i8] }* @.str.56 to i8*), i8* %161)
  %162 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %163 = call i32 @nish.rgb(i32 0, i32 255, i32 0)
  call void @nish.Canvas.fillRect(%struct.Canvas* %162, i32 0, i32 2, i32 4, i32 2, i32 %163)
  %164 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %165 = call i64 @nish_arena_mark()
  %166 = call i8* @nish.Screen.flush(%struct.Screen* %164)
  %167 = call i8* @nish_arena_keep(i64 %165, i8* %166)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.57 to i8*), i8* %167)
  %168 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  call void @nish.Canvas.clear(%struct.Canvas* %168, i32 -1)
  %169 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %170 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.line(%struct.Canvas* %169, i32 0, i32 0, i32 3, i32 3, i32 %170)
  %171 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %172 = call i64 @nish_arena_mark()
  %173 = call i8* @nish.Screen.flush(%struct.Screen* %171)
  %174 = call i8* @nish_arena_keep(i64 %172, i8* %173)
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.58 to i8*), i8* %174)
  %175 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %176 = call i32 @nish.Canvas.pixel(%struct.Canvas* %175, i32 1, i32 1)
  %177 = load i32, i32* %red.addr, align 4
  %178 = icmp eq i32 %176, %177
  %179 = select i1 %178, i8* bitcast ({ i64, [5 x i8] }* @.str.30 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.31 to i8*)
  %180 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.59 to i8*), i8* %179)
  %181 = call i8* @nish_str_concat(i8* %180, i8* bitcast ({ i64, [8 x i8] }* @.str.60 to i8*))
  %182 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %183 = call i32 @nish.Canvas.pixel(%struct.Canvas* %182, i32 1, i32 2)
  %184 = icmp eq i32 %183, -1
  %185 = select i1 %184, i8* bitcast ({ i64, [5 x i8] }* @.str.30 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.31 to i8*)
  %186 = call i8* @nish_str_concat(i8* %181, i8* %185)
  %187 = call i8* @nish_str_concat(i8* %186, i8* bitcast ({ i64, [6 x i8] }* @.str.61 to i8*))
  %188 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %189 = call i32 @nish.Canvas.pixel(%struct.Canvas* %188, i32 9, i32 0)
  %190 = call i8* @nish_str_from_i32(i32 %189)
  %191 = call i8* @nish_str_concat(i8* %187, i8* %190)
  call void @nish_print(i8* %191)
  %192 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %193 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.fillRect(%struct.Canvas* %192, i32 -2, i32 -2, i32 100, i32 100, i32 %193)
  %194 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %195 = load i32, i32* %red.addr, align 4
  %196 = call i32 @nish.Canvas.text(%struct.Canvas* %194, i32 1, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.62 to i8*), i32 %195)
  %197 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %198 = call i64 @nish_arena_mark()
  %199 = call i8* @nish.Screen.flush(%struct.Screen* %197)
  %200 = call i8* @nish_arena_keep(i64 %198, i8* %199)
  call void @frame(i8* bitcast ({ i64, [17 x i8] }* @.str.63 to i8*), i8* %200)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.3, i32 8, i32 2, i1 false)
  store %struct.Screen* %Screen.obj.3, %struct.Screen** %game.addr, align 8
  store i32 0, i32* %sent.addr, align 4
  store i32 0, i32* %f.addr, align 4
  br label %for.cond

for.cond:
  %201 = load i32, i32* %f.addr, align 4
  %202 = icmp slt i32 %201, 1000
  br i1 %202, label %for.body, label %for.end

for.body:
  %203 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %204 = load i8*, i8** %203, align 8
  %205 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %206 = load i64, i64* %205, align 8
  %207 = load %struct.Screen*, %struct.Screen** %game.addr, align 8
  %208 = load i32, i32* %f.addr, align 4
  %209 = srem i32 %208, 8
  %210 = load i32, i32* %f.addr, align 4
  %211 = srem i32 %210, 2
  %212 = load i32, i32* %f.addr, align 4
  %213 = srem i32 %212, 26
  %214 = add nsw i32 65, %213
  %215 = load i32, i32* %f.addr, align 4
  %216 = srem i32 %215, 256
  %217 = call i32 @nish.rgb(i32 %216, i32 0, i32 0)
  call void @nish.Screen.set(%struct.Screen* %207, i32 %209, i32 %211, i32 %214, i32 %217, i32 -1, i32 0)
  %218 = load %struct.Screen*, %struct.Screen** %game.addr, align 8
  %219 = call i64 @nish_arena_mark()
  %220 = call i8* @nish.Screen.flush(%struct.Screen* %218)
  %221 = call i8* @nish_arena_keep(i64 %219, i8* %220)
  store i8* %221, i8** %out.addr, align 8
  %222 = load i32, i32* %sent.addr, align 4
  %223 = load i8*, i8** %out.addr, align 8
  %224 = bitcast i8* %223 to i64*
  %225 = load i64, i64* %224, align 8
  %226 = trunc i64 %225 to i32
  %227 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %222, i32 %226)
  %228 = extractvalue { i32, i1 } %227, 0
  %229 = extractvalue { i32, i1 } %227, 1
  br i1 %229, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %228, i32* %sent.addr, align 4
  %230 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %231 = load i8*, i8** %230, align 8
  %232 = icmp eq i8* %231, %204
  br i1 %232, label %pass.rewind, label %pass.free

pass.rewind:
  %233 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %206, i64* %233, align 8
  br label %pass.done

pass.free:
  %234 = ptrtoint i8* %204 to i64
  %235 = add i64 %234, %206
  call void @nish_arena_release(i64 %235)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %236 = load i32, i32* %f.addr, align 4
  %237 = add nsw i32 %236, 1
  store i32 %237, i32* %f.addr, align 4
  br label %for.cond

for.end:
  %238 = load i32, i32* %sent.addr, align 4
  %239 = call i8* @nish_str_from_i32(i32 %238)
  %240 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.64 to i8*), i8* %239)
  %241 = call i8* @nish_str_concat(i8* %240, i8* bitcast ({ i64, [7 x i8] }* @.str.65 to i8*))
  call void @nish_print(i8* %241)
  call void @nish.KeyDecoder.constructor(%struct.KeyDecoder* %KeyDecoder.obj, double 0x403E000000000000)
  store %struct.KeyDecoder* %KeyDecoder.obj, %struct.KeyDecoder** %d.addr, align 8
  %242 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %243 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 12, i64* %243, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %244 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 12, i64* %244, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %245 = bitcast [12 x i32]* %arr.data to i8*
  %246 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %245, i8** %246, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %247 = bitcast i8* %245 to i32*
  %248 = getelementptr inbounds i32, i32* %247, i64 0
  store i32 27, i32* %248, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %249 = getelementptr inbounds i32, i32* %247, i64 1
  store i32 91, i32* %249, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %250 = getelementptr inbounds i32, i32* %247, i64 2
  store i32 65, i32* %250, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %251 = getelementptr inbounds i32, i32* %247, i64 3
  store i32 27, i32* %251, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %252 = getelementptr inbounds i32, i32* %247, i64 4
  store i32 91, i32* %252, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %253 = getelementptr inbounds i32, i32* %247, i64 5
  store i32 66, i32* %253, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %254 = getelementptr inbounds i32, i32* %247, i64 6
  store i32 27, i32* %254, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %255 = getelementptr inbounds i32, i32* %247, i64 7
  store i32 79, i32* %255, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %256 = getelementptr inbounds i32, i32* %247, i64 8
  store i32 67, i32* %256, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %257 = getelementptr inbounds i32, i32* %247, i64 9
  store i32 27, i32* %257, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %258 = getelementptr inbounds i32, i32* %247, i64 10
  store i32 79, i32* %258, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %259 = getelementptr inbounds i32, i32* %247, i64 11
  store i32 68, i32* %259, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %260 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr)
  %261 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %242, %struct.nish_array* %260, i32 12, double 0x0000000000000000)
  %262 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.66 to i8*), %struct.nish_array* %261, %struct.KeyDecoder* %262)
  %263 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %264 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %264, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %265 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %265, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %266 = bitcast [8 x i32]* %arr.data.1 to i8*
  %267 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %266, i8** %267, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %268 = bitcast i8* %266 to i32*
  %269 = getelementptr inbounds i32, i32* %268, i64 0
  store i32 3, i32* %269, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %270 = getelementptr inbounds i32, i32* %268, i64 1
  store i32 13, i32* %270, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %271 = getelementptr inbounds i32, i32* %268, i64 2
  store i32 10, i32* %271, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %272 = getelementptr inbounds i32, i32* %268, i64 3
  store i32 32, i32* %272, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %273 = getelementptr inbounds i32, i32* %268, i64 4
  store i32 9, i32* %273, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %274 = getelementptr inbounds i32, i32* %268, i64 5
  store i32 127, i32* %274, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %275 = getelementptr inbounds i32, i32* %268, i64 6
  store i32 8, i32* %275, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %276 = getelementptr inbounds i32, i32* %268, i64 7
  store i32 1, i32* %276, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %277 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.1)
  %278 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %263, %struct.nish_array* %277, i32 8, double 0x0000000000000000)
  %279 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [9 x i8] }* @.str.67 to i8*), %struct.nish_array* %278, %struct.KeyDecoder* %279)
  %280 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %281 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %281, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %282 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %282, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %283 = bitcast [8 x i32]* %arr.data.2 to i8*
  %284 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %283, i8** %284, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %285 = bitcast i8* %283 to i32*
  %286 = getelementptr inbounds i32, i32* %285, i64 0
  store i32 113, i32* %286, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %287 = getelementptr inbounds i32, i32* %285, i64 1
  store i32 81, i32* %287, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %288 = getelementptr inbounds i32, i32* %285, i64 2
  store i32 126, i32* %288, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %289 = getelementptr inbounds i32, i32* %285, i64 3
  store i32 195, i32* %289, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %290 = getelementptr inbounds i32, i32* %285, i64 4
  store i32 169, i32* %290, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %291 = getelementptr inbounds i32, i32* %285, i64 5
  store i32 226, i32* %291, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %292 = getelementptr inbounds i32, i32* %285, i64 6
  store i32 150, i32* %292, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %293 = getelementptr inbounds i32, i32* %285, i64 7
  store i32 128, i32* %293, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %294 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.2)
  %295 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %280, %struct.nish_array* %294, i32 8, double 0x0000000000000000)
  %296 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [10 x i8] }* @.str.68 to i8*), %struct.nish_array* %295, %struct.KeyDecoder* %296)
  %297 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %298 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 3, i64* %298, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %299 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 3, i64* %299, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %300 = bitcast [3 x i32]* %arr.data.3 to i8*
  %301 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %300, i8** %301, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %302 = bitcast i8* %300 to i32*
  %303 = getelementptr inbounds i32, i32* %302, i64 0
  store i32 97, i32* %303, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %304 = getelementptr inbounds i32, i32* %302, i64 1
  store i32 98, i32* %304, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %305 = getelementptr inbounds i32, i32* %302, i64 2
  store i32 99, i32* %305, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %306 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.3)
  %307 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %297, %struct.nish_array* %306, i32 1, double 0x0000000000000000)
  %308 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.69 to i8*), %struct.nish_array* %307, %struct.KeyDecoder* %308)
  %309 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %310 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 1, i64* %310, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %311 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 1, i64* %311, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %312 = bitcast [1 x i32]* %arr.data.4 to i8*
  %313 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %312, i8** %313, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %314 = bitcast i8* %312 to i32*
  %315 = getelementptr inbounds i32, i32* %314, i64 0
  store i32 27, i32* %315, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %316 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.4)
  %317 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %309, %struct.nish_array* %316, i32 1, double 0x4059000000000000)
  %318 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.70 to i8*), %struct.nish_array* %317, %struct.KeyDecoder* %318)
  %319 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %320 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 2, i64* %320, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %321 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 2, i64* %321, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %322 = bitcast [2 x i32]* %arr.data.5 to i8*
  %323 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %322, i8** %323, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %324 = bitcast i8* %322 to i32*
  %325 = getelementptr inbounds i32, i32* %324, i64 0
  store i32 91, i32* %325, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %326 = getelementptr inbounds i32, i32* %324, i64 1
  store i32 65, i32* %326, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %327 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.5)
  %328 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %319, %struct.nish_array* %327, i32 2, double 0x405B800000000000)
  %329 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.71 to i8*), %struct.nish_array* %328, %struct.KeyDecoder* %329)
  %330 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %331 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 2, i64* %331, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %332 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 2, i64* %332, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %333 = bitcast [2 x i32]* %arr.data.6 to i8*
  %334 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %333, i8** %334, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %335 = bitcast i8* %333 to i32*
  %336 = getelementptr inbounds i32, i32* %335, i64 0
  store i32 27, i32* %336, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %337 = getelementptr inbounds i32, i32* %335, i64 1
  store i32 91, i32* %337, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %338 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.6)
  %339 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %330, %struct.nish_array* %338, i32 2, double 0x4069000000000000)
  %340 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.72 to i8*), %struct.nish_array* %339, %struct.KeyDecoder* %340)
  %341 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %342 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 1, i64* %342, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %343 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 1, i64* %343, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %344 = bitcast [1 x i32]* %arr.data.7 to i8*
  %345 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %344, i8** %345, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %346 = bitcast i8* %344 to i32*
  %347 = getelementptr inbounds i32, i32* %346, i64 0
  store i32 66, i32* %347, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %348 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.7)
  %349 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %341, %struct.nish_array* %348, i32 1, double 0x406A400000000000)
  %350 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.73 to i8*), %struct.nish_array* %349, %struct.KeyDecoder* %350)
  %351 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %352 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 2, i64* %352, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %353 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 2, i64* %353, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %354 = bitcast [2 x i32]* %arr.data.8 to i8*
  %355 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %354, i8** %355, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %356 = bitcast i8* %354 to i32*
  %357 = getelementptr inbounds i32, i32* %356, i64 0
  store i32 27, i32* %357, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %358 = getelementptr inbounds i32, i32* %356, i64 1
  store i32 79, i32* %358, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %359 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.8)
  %360 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %351, %struct.nish_array* %359, i32 2, double 0x4072C00000000000)
  %361 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [23 x i8] }* @.str.74 to i8*), %struct.nish_array* %360, %struct.KeyDecoder* %361)
  %362 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %363 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 0
  store i64 1, i64* %363, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %364 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 1
  store i64 1, i64* %364, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %365 = bitcast [1 x i32]* %arr.data.9 to i8*
  %366 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 2
  store i8* %365, i8** %366, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %367 = bitcast i8* %365 to i32*
  %368 = getelementptr inbounds i32, i32* %367, i64 0
  store i32 67, i32* %368, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %369 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.9)
  %370 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %362, %struct.nish_array* %369, i32 1, double 0x4073100000000000)
  %371 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.75 to i8*), %struct.nish_array* %370, %struct.KeyDecoder* %371)
  %372 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %373 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 0
  store i64 6, i64* %373, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %374 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 1
  store i64 6, i64* %374, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %375 = bitcast [6 x i32]* %arr.data.10 to i8*
  %376 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 2
  store i8* %375, i8** %376, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %377 = bitcast i8* %375 to i32*
  %378 = getelementptr inbounds i32, i32* %377, i64 0
  store i32 27, i32* %378, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %379 = getelementptr inbounds i32, i32* %377, i64 1
  store i32 91, i32* %379, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %380 = getelementptr inbounds i32, i32* %377, i64 2
  store i32 49, i32* %380, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %381 = getelementptr inbounds i32, i32* %377, i64 3
  store i32 59, i32* %381, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %382 = getelementptr inbounds i32, i32* %377, i64 4
  store i32 53, i32* %382, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %383 = getelementptr inbounds i32, i32* %377, i64 5
  store i32 65, i32* %383, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %384 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.10)
  %385 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %372, %struct.nish_array* %384, i32 6, double 0x4079000000000000)
  %386 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.76 to i8*), %struct.nish_array* %385, %struct.KeyDecoder* %386)
  %387 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %388 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 0
  store i64 4, i64* %388, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %389 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 1
  store i64 4, i64* %389, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %390 = bitcast [4 x i32]* %arr.data.11 to i8*
  %391 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 2
  store i8* %390, i8** %391, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %392 = bitcast i8* %390 to i32*
  %393 = getelementptr inbounds i32, i32* %392, i64 0
  store i32 27, i32* %393, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %394 = getelementptr inbounds i32, i32* %392, i64 1
  store i32 91, i32* %394, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %395 = getelementptr inbounds i32, i32* %392, i64 2
  store i32 51, i32* %395, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %396 = getelementptr inbounds i32, i32* %392, i64 3
  store i32 126, i32* %396, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %397 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.11)
  %398 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %387, %struct.nish_array* %397, i32 4, double 0x4079000000000000)
  %399 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.77 to i8*), %struct.nish_array* %398, %struct.KeyDecoder* %399)
  %400 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %401 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 0
  store i64 1, i64* %401, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %402 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 1
  store i64 1, i64* %402, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %403 = bitcast [1 x i32]* %arr.data.12 to i8*
  %404 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 2
  store i8* %403, i8** %404, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %405 = bitcast i8* %403 to i32*
  %406 = getelementptr inbounds i32, i32* %405, i64 0
  store i32 27, i32* %406, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %407 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.12)
  %408 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %400, %struct.nish_array* %407, i32 1, double 0x407F400000000000)
  %409 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [16 x i8] }* @.str.78 to i8*), %struct.nish_array* %408, %struct.KeyDecoder* %409)
  %410 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %411 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %410, double 0x4080400000000000)
  %412 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.79 to i8*), %struct.nish_array* %411, %struct.KeyDecoder* %412)
  %413 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %414 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %413, double 0x4080900000000000)
  %415 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.80 to i8*), %struct.nish_array* %414, %struct.KeyDecoder* %415)
  %416 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %417 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 0
  store i64 2, i64* %417, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %418 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 1
  store i64 2, i64* %418, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %419 = bitcast [2 x i32]* %arr.data.13 to i8*
  %420 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 2
  store i8* %419, i8** %420, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %421 = bitcast i8* %419 to i32*
  %422 = getelementptr inbounds i32, i32* %421, i64 0
  store i32 27, i32* %422, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %423 = getelementptr inbounds i32, i32* %421, i64 1
  store i32 120, i32* %423, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %424 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.13)
  %425 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %416, %struct.nish_array* %424, i32 2, double 0x4082C00000000000)
  %426 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.81 to i8*), %struct.nish_array* %425, %struct.KeyDecoder* %426)
  %427 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %428 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 0
  store i64 4, i64* %428, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %429 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 1
  store i64 4, i64* %429, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %430 = bitcast [4 x i32]* %arr.data.14 to i8*
  %431 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 2
  store i8* %430, i8** %431, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %432 = bitcast i8* %430 to i32*
  %433 = getelementptr inbounds i32, i32* %432, i64 0
  store i32 27, i32* %433, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %434 = getelementptr inbounds i32, i32* %432, i64 1
  store i32 27, i32* %434, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %435 = getelementptr inbounds i32, i32* %432, i64 2
  store i32 91, i32* %435, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %436 = getelementptr inbounds i32, i32* %432, i64 3
  store i32 65, i32* %436, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %437 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.14)
  %438 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %427, %struct.nish_array* %437, i32 4, double 0x4082C00000000000)
  %439 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.82 to i8*), %struct.nish_array* %438, %struct.KeyDecoder* %439)
  %440 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %441 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 0
  store i64 1, i64* %441, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %442 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 1
  store i64 1, i64* %442, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %443 = bitcast [1 x i32]* %arr.data.15 to i8*
  %444 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 2
  store i8* %443, i8** %444, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %445 = bitcast i8* %443 to i32*
  %446 = getelementptr inbounds i32, i32* %445, i64 0
  store i32 27, i32* %446, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %447 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.15)
  %448 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %440, %struct.nish_array* %447, i32 1, double 0x4085E00000000000)
  %449 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [36 x i8] }* @.str.83 to i8*), %struct.nish_array* %448, %struct.KeyDecoder* %449)
  %450 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %451 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 0
  store i64 1, i64* %451, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %452 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 1
  store i64 1, i64* %452, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %453 = bitcast [1 x i32]* %arr.data.16 to i8*
  %454 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 2
  store i8* %453, i8** %454, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %455 = bitcast i8* %453 to i32*
  %456 = getelementptr inbounds i32, i32* %455, i64 0
  store i32 120, i32* %456, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %457 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.16)
  %458 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %450, %struct.nish_array* %457, i32 1, double 0x4089000000000000)
  %459 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.84 to i8*), %struct.nish_array* %458, %struct.KeyDecoder* %459)
  %460 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %461 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 0
  store i64 1, i64* %461, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %462 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 1
  store i64 1, i64* %462, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %463 = bitcast [1 x i32]* %arr.data.17 to i8*
  %464 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 2
  store i8* %463, i8** %464, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %465 = bitcast i8* %463 to i32*
  %466 = getelementptr inbounds i32, i32* %465, i64 0
  store i32 195, i32* %466, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %467 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.17)
  %468 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %460, %struct.nish_array* %467, i32 1, double 0x408C200000000000)
  %469 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.85 to i8*), %struct.nish_array* %468, %struct.KeyDecoder* %469)
  %470 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %471 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 0
  store i64 1, i64* %471, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %472 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 1
  store i64 1, i64* %472, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %473 = bitcast [1 x i32]* %arr.data.18 to i8*
  %474 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 2
  store i8* %473, i8** %474, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %475 = bitcast i8* %473 to i32*
  %476 = getelementptr inbounds i32, i32* %475, i64 0
  store i32 169, i32* %476, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %477 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.18)
  %478 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %470, %struct.nish_array* %477, i32 1, double 0x408C280000000000)
  %479 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.86 to i8*), %struct.nish_array* %478, %struct.KeyDecoder* %479)
  %480 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %481 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 0
  store i64 2, i64* %481, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %482 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 1
  store i64 2, i64* %482, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %483 = bitcast [2 x i32]* %arr.data.19 to i8*
  %484 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 2
  store i8* %483, i8** %484, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %485 = bitcast i8* %483 to i32*
  %486 = getelementptr inbounds i32, i32* %485, i64 0
  store i32 226, i32* %486, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %487 = getelementptr inbounds i32, i32* %485, i64 1
  store i32 150, i32* %487, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %488 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.19)
  %489 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %480, %struct.nish_array* %488, i32 2, double 0x408F400000000000)
  %490 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [27 x i8] }* @.str.87 to i8*), %struct.nish_array* %489, %struct.KeyDecoder* %490)
  %491 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %492 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %491, double 0x4091300000000000)
  %493 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.88 to i8*), %struct.nish_array* %492, %struct.KeyDecoder* %493)
  %494 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %495 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 0
  store i64 3, i64* %495, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %496 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 1
  store i64 3, i64* %496, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %497 = bitcast [3 x i32]* %arr.data.20 to i8*
  %498 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 2
  store i8* %497, i8** %498, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %499 = bitcast i8* %497 to i32*
  %500 = getelementptr inbounds i32, i32* %499, i64 0
  store i32 255, i32* %500, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %501 = getelementptr inbounds i32, i32* %499, i64 1
  store i32 128, i32* %501, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %502 = getelementptr inbounds i32, i32* %499, i64 2
  store i32 97, i32* %502, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %503 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.20)
  %504 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %494, %struct.nish_array* %503, i32 3, double 0x4092C00000000000)
  %505 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [14 x i8] }* @.str.89 to i8*), %struct.nish_array* %504, %struct.KeyDecoder* %505)
  %506 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %507 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 0
  store i64 3, i64* %507, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %508 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 1
  store i64 3, i64* %508, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %509 = bitcast [3 x i32]* %arr.data.21 to i8*
  %510 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 2
  store i8* %509, i8** %510, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %511 = bitcast i8* %509 to i32*
  %512 = getelementptr inbounds i32, i32* %511, i64 0
  store i32 226, i32* %512, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %513 = getelementptr inbounds i32, i32* %511, i64 1
  store i32 150, i32* %513, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %514 = getelementptr inbounds i32, i32* %511, i64 2
  store i32 97, i32* %514, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %515 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.21)
  %516 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %506, %struct.nish_array* %515, i32 3, double 0x4093880000000000)
  %517 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [33 x i8] }* @.str.90 to i8*), %struct.nish_array* %516, %struct.KeyDecoder* %517)
  %518 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %519 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 0
  store i64 0, i64* %519, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %520 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 1
  store i64 0, i64* %520, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %521 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 2
  store i8* null, i8** %521, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %522 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.22)
  %523 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %518, %struct.nish_array* %522, i32 0, double 0x4094500000000000)
  %524 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [11 x i8] }* @.str.91 to i8*), %struct.nish_array* %523, %struct.KeyDecoder* %524)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element ptr", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!"i32", !6, i64 0}
!20 = !{!"KeyEvent", !19, i64 0, !19, i64 4}
!21 = !{!20, !19, i64 0}
!22 = !{!20, !19, i64 4}
!23 = !{!"ptr", !6, i64 0}
!24 = !{!"Canvas", !23, i64 0, !19, i64 8, !19, i64 12, !23, i64 16}
!25 = !{!24, !19, i64 8}
!26 = !{!24, !19, i64 12}
