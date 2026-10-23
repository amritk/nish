%struct.Canvas = type { %struct.Screen*, i32, i32, %struct.nish_array* }
%struct.FixedStep = type { double, double, double, i32, i1 }
%struct.KeyDecoder = type { double, %struct.nish_array*, double }
%struct.KeyEvent = type { i32, i32 }
%struct.Screen = type { %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32, i32, i32, i1, i1 }
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
@.str.29 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"sync\00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"..\00" }, align 8
@.str.31 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"rgb clamps: \00" }, align 8
@.str.32 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.33 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.34 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"palette red \00" }, align 8
@.str.35 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" grey \00" }, align 8
@.str.36 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" near-black \00" }, align 8
@.str.37 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" white \00" }, align 8
@.str.38 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" default \00" }, align 8
@.str.39 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"blank 4x2\00" }, align 8
@.str.40 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"unchanged: \00" }, align 8
@.str.41 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"one cell\00" }, align 8
@.str.42 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"gap of one, bridged\00" }, align 8
@.str.43 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"gap of two in another style, moved\00" }, align 8
@.str.44 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"row start, then home\00" }, align 8
@.str.45 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"off screen: \00" }, align 8
@.str.46 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"Hi\00" }, align 8
@.str.47 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"yo\00" }, align 8
@.str.48 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\C3\A9!\00" }, align 8
@.str.49 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"styled run\00" }, align 8
@.str.50 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"text answers \00" }, align 8
@.str.51 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c", glyph at 4 is \00" }, align 8
@.str.52 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"add inverse\00" }, align 8
@.str.53 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"cleared\00" }, align 8
@.str.54 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.55 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"256 colours\00" }, align 8
@.str.56 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"sync first frame\00" }, align 8
@.str.57 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"sync unchanged: \00" }, align 8
@.str.58 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"sync one styled cell\00" }, align 8
@.str.59 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"sync turned off\00" }, align 8
@.str.60 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"canvas \00" }, align 8
@.str.61 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.62 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"pixels\00" }, align 8
@.str.63 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"fillRect\00" }, align 8
@.str.64 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"line\00" }, align 8
@.str.65 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"pixel (1,1) \00" }, align 8
@.str.66 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" (1,2) \00" }, align 8
@.str.67 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" off \00" }, align 8
@.str.68 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ok\00" }, align 8
@.str.69 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"text over pixels\00" }, align 8
@.str.70 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"frame loop sent \00" }, align 8
@.str.71 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.72 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"steps \00" }, align 8
@.str.73 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" alpha \00" }, align 8
@.str.74 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"%\00" }, align 8
@.str.75 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"a long stall runs \00" }, align 8
@.str.76 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c" and keeps the phase: alpha \00" }, align 8
@.str.77 = private unnamed_addr constant { i64, [50 x i8] } { i64 49, [50 x i8] c"a 100 Hz draw clock over a second of 1 ms ticks: \00" }, align 8
@.str.78 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" frames\00" }, align 8
@.str.79 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"clamped: step \00" }, align 8
@.str.80 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c" ms, at most \00" }, align 8
@.str.81 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"arrows\00" }, align 8
@.str.82 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"controls\00" }, align 8
@.str.83 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"printable\00" }, align 8
@.str.84 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"count bounds the read\00" }, align 8
@.str.85 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC | [A, first\00" }, align 8
@.str.86 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"split ESC | [A, then\00" }, align 8
@.str.87 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC[ | B, first\00" }, align 8
@.str.88 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"split ESC[ | B, then\00" }, align 8
@.str.89 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"split ESC O | C, first\00" }, align 8
@.str.90 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC O | C, then\00" }, align 8
@.str.91 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"parameters, ESC[1;5A\00" }, align 8
@.str.92 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"other final, ESC[3~\00" }, align 8
@.str.93 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"lone ESC, first\00" }, align 8
@.str.94 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"lone ESC, poll early\00" }, align 8
@.str.95 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"lone ESC, poll late\00" }, align 8
@.str.96 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"ESC then a letter\00" }, align 8
@.str.97 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"ESC ESC [ A\00" }, align 8
@.str.98 = private unnamed_addr constant { i64, [36 x i8] } { i64 35, [36 x i8] c"held ESC timed out by the next feed\00" }, align 8
@.str.99 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"  next feed\00" }, align 8
@.str.100 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"split UTF-8, first\00" }, align 8
@.str.101 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"split UTF-8, then\00" }, align 8
@.str.102 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"unfinished UTF-8 timed out\00" }, align 8
@.str.103 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"  poll\00" }, align 8
@.str.104 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"invalid bytes\00" }, align 8
@.str.105 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"a character cut short by another\00" }, align 8
@.str.106 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"empty feed\00" }, align 8
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
declare void @nish.FixedStep.constructor(%struct.FixedStep* noundef nonnull noalias align 8 dereferenceable(32) nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish.FixedStep.advance(%struct.FixedStep* noundef nonnull align 8 dereferenceable(32) nocapture, double noundef) #0
declare noundef double @nish.FixedStep.alpha(%struct.FixedStep* noundef nonnull readonly align 8 dereferenceable(32) nocapture) #3
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
declare void @nish.Screen.putSyncMode(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putGlyph(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putColour(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.colourKey(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare noundef nonnull align 8 i8* @nish.Screen.flush(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture) #0
declare noundef nonnull align 8 i8* @nish.beginSync() #1
declare noundef nonnull align 8 i8* @nish.clearScreen() #1
declare noundef nonnull align 8 i8* @nish.endSync() #1
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
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare double @llvm.floor.f64(double) #1
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
  %y.addr = alloca %struct.Screen*, align 8
  %Screen.obj.3 = alloca %struct.Screen, align 8
  %cs.addr = alloca %struct.Screen*, align 8
  %c.addr = alloca %struct.Canvas*, align 8
  %Canvas.obj = alloca %struct.Canvas, align 8
  %game.addr = alloca %struct.Screen*, align 8
  %Screen.obj.4 = alloca %struct.Screen, align 8
  %sent.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %out.addr = alloca i8*, align 8
  %logic.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj = alloca %struct.FixedStep, align 8
  %steps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %behind.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj.1 = alloca %struct.FixedStep, align 8
  %caught.addr = alloca i32, align 4
  %draw.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj.2 = alloca %struct.FixedStep, align 8
  %frames.addr = alloca i32, align 4
  %ms.addr = alloca i32, align 4
  %odd.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj.3 = alloca %struct.FixedStep, align 8
  %d.addr = alloca %struct.KeyDecoder*, align 8
  %KeyDecoder.obj = alloca %struct.KeyDecoder, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [12 x i32], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i32], align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i32], align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [3 x i32], align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [1 x i32], align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [2 x i32], align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [2 x i32], align 8
  %arr.hdr.8 = alloca %struct.nish_array, align 8
  %arr.data.7 = alloca [1 x i32], align 8
  %arr.hdr.9 = alloca %struct.nish_array, align 8
  %arr.data.8 = alloca [2 x i32], align 8
  %arr.hdr.10 = alloca %struct.nish_array, align 8
  %arr.data.9 = alloca [1 x i32], align 8
  %arr.hdr.11 = alloca %struct.nish_array, align 8
  %arr.data.10 = alloca [6 x i32], align 8
  %arr.hdr.12 = alloca %struct.nish_array, align 8
  %arr.data.11 = alloca [4 x i32], align 8
  %arr.hdr.13 = alloca %struct.nish_array, align 8
  %arr.data.12 = alloca [1 x i32], align 8
  %arr.hdr.14 = alloca %struct.nish_array, align 8
  %arr.data.13 = alloca [2 x i32], align 8
  %arr.hdr.15 = alloca %struct.nish_array, align 8
  %arr.data.14 = alloca [4 x i32], align 8
  %arr.hdr.16 = alloca %struct.nish_array, align 8
  %arr.data.15 = alloca [1 x i32], align 8
  %arr.hdr.17 = alloca %struct.nish_array, align 8
  %arr.data.16 = alloca [1 x i32], align 8
  %arr.hdr.18 = alloca %struct.nish_array, align 8
  %arr.data.17 = alloca [1 x i32], align 8
  %arr.hdr.19 = alloca %struct.nish_array, align 8
  %arr.data.18 = alloca [1 x i32], align 8
  %arr.hdr.20 = alloca %struct.nish_array, align 8
  %arr.data.19 = alloca [2 x i32], align 8
  %arr.hdr.21 = alloca %struct.nish_array, align 8
  %arr.data.20 = alloca [3 x i32], align 8
  %arr.hdr.22 = alloca %struct.nish_array, align 8
  %arr.data.21 = alloca [3 x i32], align 8
  %arr.hdr.23 = alloca %struct.nish_array, align 8
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
  %9 = call i8* @nish.beginSync()
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [3 x i8] }* @.str.30 to i8*))
  %11 = call i8* @nish.endSync()
  %12 = call i8* @nish_str_concat(i8* %10, i8* %11)
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.29 to i8*), i8* %12)
  %13 = call i32 @nish.rgb(i32 300, i32 -4, i32 128)
  %14 = call i32 @nish.rgb(i32 255, i32 0, i32 128)
  %15 = icmp eq i32 %13, %14
  %16 = select i1 %15, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %17 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.31 to i8*), i8* %16)
  call void @nish_print(i8* %17)
  %18 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  %19 = call i32 @nish.paletteIndex(i32 %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.34 to i8*), i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [7 x i8] }* @.str.35 to i8*))
  %23 = call i32 @nish.rgb(i32 128, i32 128, i32 128)
  %24 = call i32 @nish.paletteIndex(i32 %23)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [13 x i8] }* @.str.36 to i8*))
  %28 = call i32 @nish.rgb(i32 8, i32 8, i32 8)
  %29 = call i32 @nish.paletteIndex(i32 %28)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %27, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [8 x i8] }* @.str.37 to i8*))
  %33 = call i32 @nish.rgb(i32 255, i32 255, i32 255)
  %34 = call i32 @nish.paletteIndex(i32 %33)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %32, i8* %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [10 x i8] }* @.str.38 to i8*))
  %38 = call i32 @nish.paletteIndex(i32 -1)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %37, i8* %39)
  call void @nish_print(i8* %40)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj, i32 4, i32 2, i1 false)
  store %struct.Screen* %Screen.obj, %struct.Screen** %s.addr, align 8
  %41 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %42 = call i64 @nish_arena_mark()
  %43 = call i8* @nish.Screen.flush(%struct.Screen* %41)
  %44 = call i8* @nish_arena_keep(i64 %42, i8* %43)
  call void @frame(i8* bitcast ({ i64, [10 x i8] }* @.str.39 to i8*), i8* %44)
  %45 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %46 = call i64 @nish_arena_mark()
  %47 = call i8* @nish.Screen.flush(%struct.Screen* %45)
  %48 = call i8* @nish_arena_keep(i64 %46, i8* %47)
  %49 = bitcast i8* %48 to i64*
  %50 = load i64, i64* %49, align 8
  %51 = trunc i64 %50 to i32
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.40 to i8*), i8* %52)
  call void @nish_print(i8* %53)
  %54 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %54, i32 2, i32 1, i32 88, i32 -1, i32 -1, i32 0)
  %55 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %56 = call i64 @nish_arena_mark()
  %57 = call i8* @nish.Screen.flush(%struct.Screen* %55)
  %58 = call i8* @nish_arena_keep(i64 %56, i8* %57)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.41 to i8*), i8* %58)
  %59 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %59, i32 0, i32 0, i32 65, i32 -1, i32 -1, i32 0)
  %60 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %60, i32 2, i32 0, i32 66, i32 -1, i32 -1, i32 0)
  %61 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %62 = call i64 @nish_arena_mark()
  %63 = call i8* @nish.Screen.flush(%struct.Screen* %61)
  %64 = call i8* @nish_arena_keep(i64 %62, i8* %63)
  call void @frame(i8* bitcast ({ i64, [20 x i8] }* @.str.42 to i8*), i8* %64)
  %65 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %65, i32 0, i32 0, i32 67, i32 -1, i32 -1, i32 0)
  %66 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %67 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  call void @nish.Screen.set(%struct.Screen* %66, i32 3, i32 0, i32 68, i32 %67, i32 -1, i32 0)
  %68 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %69 = call i64 @nish_arena_mark()
  %70 = call i8* @nish.Screen.flush(%struct.Screen* %68)
  %71 = call i8* @nish_arena_keep(i64 %69, i8* %70)
  call void @frame(i8* bitcast ({ i64, [35 x i8] }* @.str.43 to i8*), i8* %71)
  %72 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %72, i32 0, i32 1, i32 69, i32 -1, i32 -1, i32 0)
  %73 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %73, i32 0, i32 0, i32 32, i32 -1, i32 -1, i32 0)
  %74 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %75 = call i64 @nish_arena_mark()
  %76 = call i8* @nish.Screen.flush(%struct.Screen* %74)
  %77 = call i8* @nish_arena_keep(i64 %75, i8* %76)
  call void @frame(i8* bitcast ({ i64, [21 x i8] }* @.str.44 to i8*), i8* %77)
  %78 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %78, i32 9, i32 9, i32 90, i32 -1, i32 -1, i32 0)
  %79 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %79, i32 -1, i32 0, i32 90, i32 -1, i32 -1, i32 0)
  %80 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %81 = call i64 @nish_arena_mark()
  %82 = call i8* @nish.Screen.flush(%struct.Screen* %80)
  %83 = call i8* @nish_arena_keep(i64 %81, i8* %82)
  %84 = bitcast i8* %83 to i64*
  %85 = load i64, i64* %84, align 8
  %86 = trunc i64 %85 to i32
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.45 to i8*), i8* %87)
  call void @nish_print(i8* %88)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.1, i32 6, i32 1, i1 false)
  store %struct.Screen* %Screen.obj.1, %struct.Screen** %t.addr, align 8
  %89 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %90 = call i64 @nish_arena_mark()
  %91 = call i8* @nish.Screen.flush(%struct.Screen* %89)
  %92 = call i8* @nish_arena_keep(i64 %90, i8* %91)
  %93 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  store i32 %93, i32* %red.addr, align 4
  %94 = call i32 @nish.rgb(i32 0, i32 0, i32 255)
  store i32 %94, i32* %blue.addr, align 4
  %95 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %96 = load i32, i32* %red.addr, align 4
  %97 = load i32, i32* %blue.addr, align 4
  %98 = call i32 @nish.Screen.text(%struct.Screen* %95, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.46 to i8*), i32 %96, i32 %97, i32 1)
  store i32 %98, i32* %drawn.addr, align 4
  %99 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %100 = load i32, i32* %drawn.addr, align 4
  %101 = load i32, i32* %red.addr, align 4
  %102 = load i32, i32* %blue.addr, align 4
  %103 = call i32 @nish.Screen.text(%struct.Screen* %99, i32 %100, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.47 to i8*), i32 %101, i32 %102, i32 2)
  %104 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %105 = call i32 @nish.Screen.text(%struct.Screen* %104, i32 4, i32 0, i8* bitcast ({ i64, [4 x i8] }* @.str.48 to i8*), i32 -1, i32 -1, i32 0)
  %106 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %107 = call i64 @nish_arena_mark()
  %108 = call i8* @nish.Screen.flush(%struct.Screen* %106)
  %109 = call i8* @nish_arena_keep(i64 %107, i8* %108)
  call void @frame(i8* bitcast ({ i64, [11 x i8] }* @.str.49 to i8*), i8* %109)
  %110 = load i32, i32* %drawn.addr, align 4
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.50 to i8*), i8* %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [17 x i8] }* @.str.51 to i8*))
  %114 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %115 = call i32 @nish.Screen.glyphAt(%struct.Screen* %114, i32 4, i32 0)
  %116 = call i8* @nish_str_from_i32(i32 %115)
  %117 = call i8* @nish_str_concat(i8* %113, i8* %116)
  call void @nish_print(i8* %117)
  %118 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %119 = load i32, i32* %red.addr, align 4
  %120 = load i32, i32* %blue.addr, align 4
  %121 = or i32 1, 2
  %122 = call i32 @nish.Screen.text(%struct.Screen* %118, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.46 to i8*), i32 %119, i32 %120, i32 %121)
  %123 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %124 = call i64 @nish_arena_mark()
  %125 = call i8* @nish.Screen.flush(%struct.Screen* %123)
  %126 = call i8* @nish_arena_keep(i64 %124, i8* %125)
  call void @frame(i8* bitcast ({ i64, [12 x i8] }* @.str.52 to i8*), i8* %126)
  %127 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  call void @nish.Screen.clear(%struct.Screen* %127, i32 -1)
  %128 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %129 = call i64 @nish_arena_mark()
  %130 = call i8* @nish.Screen.flush(%struct.Screen* %128)
  %131 = call i8* @nish_arena_keep(i64 %129, i8* %130)
  call void @frame(i8* bitcast ({ i64, [8 x i8] }* @.str.53 to i8*), i8* %131)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.2, i32 3, i32 1, i1 true)
  store %struct.Screen* %Screen.obj.2, %struct.Screen** %p.addr, align 8
  %132 = load %struct.Screen*, %struct.Screen** %p.addr, align 8
  %133 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  %134 = call i32 @nish.rgb(i32 0, i32 0, i32 0)
  %135 = call i32 @nish.Screen.text(%struct.Screen* %132, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.54 to i8*), i32 %133, i32 %134, i32 0)
  %136 = load %struct.Screen*, %struct.Screen** %p.addr, align 8
  %137 = call i64 @nish_arena_mark()
  %138 = call i8* @nish.Screen.flush(%struct.Screen* %136)
  %139 = call i8* @nish_arena_keep(i64 %137, i8* %138)
  call void @frame(i8* bitcast ({ i64, [12 x i8] }* @.str.55 to i8*), i8* %139)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.3, i32 3, i32 1, i1 false)
  store %struct.Screen* %Screen.obj.3, %struct.Screen** %y.addr, align 8
  %140 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %141 = getelementptr inbounds %struct.Screen, %struct.Screen* %140, i32 0, i32 13
  store i1 true, i1* %141, align 1, !tbaa !26
  %142 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %143 = call i64 @nish_arena_mark()
  %144 = call i8* @nish.Screen.flush(%struct.Screen* %142)
  %145 = call i8* @nish_arena_keep(i64 %143, i8* %144)
  call void @frame(i8* bitcast ({ i64, [17 x i8] }* @.str.56 to i8*), i8* %145)
  %146 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %147 = call i64 @nish_arena_mark()
  %148 = call i8* @nish.Screen.flush(%struct.Screen* %146)
  %149 = call i8* @nish_arena_keep(i64 %147, i8* %148)
  %150 = bitcast i8* %149 to i64*
  %151 = load i64, i64* %150, align 8
  %152 = trunc i64 %151 to i32
  %153 = call i8* @nish_str_from_i32(i32 %152)
  %154 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.57 to i8*), i8* %153)
  call void @nish_print(i8* %154)
  %155 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %156 = load i32, i32* %red.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %155, i32 1, i32 0, i32 90, i32 %156, i32 -1, i32 0)
  %157 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %158 = call i64 @nish_arena_mark()
  %159 = call i8* @nish.Screen.flush(%struct.Screen* %157)
  %160 = call i8* @nish_arena_keep(i64 %158, i8* %159)
  call void @frame(i8* bitcast ({ i64, [21 x i8] }* @.str.58 to i8*), i8* %160)
  %161 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %162 = getelementptr inbounds %struct.Screen, %struct.Screen* %161, i32 0, i32 13
  store i1 false, i1* %162, align 1, !tbaa !26
  %163 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %163, i32 1, i32 0, i32 89, i32 -1, i32 -1, i32 0)
  %164 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %165 = call i64 @nish_arena_mark()
  %166 = call i8* @nish.Screen.flush(%struct.Screen* %164)
  %167 = call i8* @nish_arena_keep(i64 %165, i8* %166)
  call void @frame(i8* bitcast ({ i64, [16 x i8] }* @.str.59 to i8*), i8* %167)
  %168 = call i8* @nish_alloc_struct(i64 88)
  %169 = bitcast i8* %168 to %struct.Screen*
  call void @nish.Screen.constructor(%struct.Screen* %169, i32 4, i32 2, i1 false)
  store %struct.Screen* %169, %struct.Screen** %cs.addr, align 8
  %170 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  call void @nish.Canvas.constructor(%struct.Canvas* %Canvas.obj, %struct.Screen* %170)
  store %struct.Canvas* %Canvas.obj, %struct.Canvas** %c.addr, align 8
  %171 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %172 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %171, i32 0, i32 1
  %173 = load i32, i32* %172, align 4, !tbaa !28
  %174 = call i8* @nish_str_from_i32(i32 %173)
  %175 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.60 to i8*), i8* %174)
  %176 = call i8* @nish_str_concat(i8* %175, i8* bitcast ({ i64, [2 x i8] }* @.str.61 to i8*))
  %177 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %178 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %177, i32 0, i32 2
  %179 = load i32, i32* %178, align 4, !tbaa !29
  %180 = call i8* @nish_str_from_i32(i32 %179)
  %181 = call i8* @nish_str_concat(i8* %176, i8* %180)
  call void @nish_print(i8* %181)
  %182 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %183 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %182, i32 0, i32 0, i32 %183)
  %184 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %185 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %184, i32 1, i32 1, i32 %185)
  %186 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %187 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %186, i32 2, i32 0, i32 %187)
  %188 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %189 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %188, i32 2, i32 1, i32 %189)
  %190 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %191 = call i64 @nish_arena_mark()
  %192 = call i8* @nish.Screen.flush(%struct.Screen* %190)
  %193 = call i8* @nish_arena_keep(i64 %191, i8* %192)
  call void @frame(i8* bitcast ({ i64, [7 x i8] }* @.str.62 to i8*), i8* %193)
  %194 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %195 = call i32 @nish.rgb(i32 0, i32 255, i32 0)
  call void @nish.Canvas.fillRect(%struct.Canvas* %194, i32 0, i32 2, i32 4, i32 2, i32 %195)
  %196 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %197 = call i64 @nish_arena_mark()
  %198 = call i8* @nish.Screen.flush(%struct.Screen* %196)
  %199 = call i8* @nish_arena_keep(i64 %197, i8* %198)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.63 to i8*), i8* %199)
  %200 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  call void @nish.Canvas.clear(%struct.Canvas* %200, i32 -1)
  %201 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %202 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.line(%struct.Canvas* %201, i32 0, i32 0, i32 3, i32 3, i32 %202)
  %203 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %204 = call i64 @nish_arena_mark()
  %205 = call i8* @nish.Screen.flush(%struct.Screen* %203)
  %206 = call i8* @nish_arena_keep(i64 %204, i8* %205)
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.64 to i8*), i8* %206)
  %207 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %208 = call i32 @nish.Canvas.pixel(%struct.Canvas* %207, i32 1, i32 1)
  %209 = load i32, i32* %red.addr, align 4
  %210 = icmp eq i32 %208, %209
  %211 = select i1 %210, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %212 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.65 to i8*), i8* %211)
  %213 = call i8* @nish_str_concat(i8* %212, i8* bitcast ({ i64, [8 x i8] }* @.str.66 to i8*))
  %214 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %215 = call i32 @nish.Canvas.pixel(%struct.Canvas* %214, i32 1, i32 2)
  %216 = icmp eq i32 %215, -1
  %217 = select i1 %216, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %218 = call i8* @nish_str_concat(i8* %213, i8* %217)
  %219 = call i8* @nish_str_concat(i8* %218, i8* bitcast ({ i64, [6 x i8] }* @.str.67 to i8*))
  %220 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %221 = call i32 @nish.Canvas.pixel(%struct.Canvas* %220, i32 9, i32 0)
  %222 = call i8* @nish_str_from_i32(i32 %221)
  %223 = call i8* @nish_str_concat(i8* %219, i8* %222)
  call void @nish_print(i8* %223)
  %224 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %225 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.fillRect(%struct.Canvas* %224, i32 -2, i32 -2, i32 100, i32 100, i32 %225)
  %226 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %227 = load i32, i32* %red.addr, align 4
  %228 = call i32 @nish.Canvas.text(%struct.Canvas* %226, i32 1, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.68 to i8*), i32 %227)
  %229 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %230 = call i64 @nish_arena_mark()
  %231 = call i8* @nish.Screen.flush(%struct.Screen* %229)
  %232 = call i8* @nish_arena_keep(i64 %230, i8* %231)
  call void @frame(i8* bitcast ({ i64, [17 x i8] }* @.str.69 to i8*), i8* %232)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.4, i32 8, i32 2, i1 false)
  store %struct.Screen* %Screen.obj.4, %struct.Screen** %game.addr, align 8
  store i32 0, i32* %sent.addr, align 4
  store i32 0, i32* %f.addr, align 4
  br label %for.cond

for.cond:
  %233 = load i32, i32* %f.addr, align 4
  %234 = icmp slt i32 %233, 1000
  br i1 %234, label %for.body, label %for.end

for.body:
  %235 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %236 = load i8*, i8** %235, align 8
  %237 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %238 = load i64, i64* %237, align 8
  %239 = load %struct.Screen*, %struct.Screen** %game.addr, align 8
  %240 = load i32, i32* %f.addr, align 4
  %241 = srem i32 %240, 8
  %242 = load i32, i32* %f.addr, align 4
  %243 = srem i32 %242, 2
  %244 = load i32, i32* %f.addr, align 4
  %245 = srem i32 %244, 26
  %246 = add nsw i32 65, %245
  %247 = load i32, i32* %f.addr, align 4
  %248 = srem i32 %247, 256
  %249 = call i32 @nish.rgb(i32 %248, i32 0, i32 0)
  call void @nish.Screen.set(%struct.Screen* %239, i32 %241, i32 %243, i32 %246, i32 %249, i32 -1, i32 0)
  %250 = load %struct.Screen*, %struct.Screen** %game.addr, align 8
  %251 = call i64 @nish_arena_mark()
  %252 = call i8* @nish.Screen.flush(%struct.Screen* %250)
  %253 = call i8* @nish_arena_keep(i64 %251, i8* %252)
  store i8* %253, i8** %out.addr, align 8
  %254 = load i32, i32* %sent.addr, align 4
  %255 = load i8*, i8** %out.addr, align 8
  %256 = bitcast i8* %255 to i64*
  %257 = load i64, i64* %256, align 8
  %258 = trunc i64 %257 to i32
  %259 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %254, i32 %258)
  %260 = extractvalue { i32, i1 } %259, 0
  %261 = extractvalue { i32, i1 } %259, 1
  br i1 %261, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %260, i32* %sent.addr, align 4
  %262 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %263 = load i8*, i8** %262, align 8
  %264 = icmp eq i8* %263, %236
  br i1 %264, label %pass.rewind, label %pass.free

pass.rewind:
  %265 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %238, i64* %265, align 8
  br label %pass.done

pass.free:
  %266 = ptrtoint i8* %236 to i64
  %267 = add i64 %266, %238
  call void @nish_arena_release(i64 %267)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %268 = load i32, i32* %f.addr, align 4
  %269 = add nsw i32 %268, 1
  store i32 %269, i32* %f.addr, align 4
  br label %for.cond

for.end:
  %270 = load i32, i32* %sent.addr, align 4
  %271 = call i8* @nish_str_from_i32(i32 %270)
  %272 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.70 to i8*), i8* %271)
  %273 = call i8* @nish_str_concat(i8* %272, i8* bitcast ({ i64, [7 x i8] }* @.str.71 to i8*))
  call void @nish_print(i8* %273)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj, i32 250, i32 8)
  store %struct.FixedStep* %FixedStep.obj, %struct.FixedStep** %logic.addr, align 8
  %274 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %274, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %275 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %275, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %276 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %276, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %steps.addr, align 8
  %277 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %278 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %279 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %278, double 0x408F400000000000)
  %280 = call i8* @nish_str_from_i32(i32 %279)
  %281 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 0
  %282 = load i64, i64* %281, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %283 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 1
  %284 = load i64, i64* %283, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %285 = icmp eq i64 %282, %284
  br i1 %285, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %277, i64 8)
  br label %push.store

push.store:
  %286 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 2
  %287 = load i8*, i8** %286, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %288 = bitcast i8* %287 to i8**
  %289 = getelementptr inbounds i8*, i8** %288, i64 %282
  store i8* %280, i8** %289, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %290 = add i64 %282, 1
  store i64 %290, i64* %281, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %291 = trunc i64 %290 to i32
  %292 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %293 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %294 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %293, double 0x408F580000000000)
  %295 = call i8* @nish_str_from_i32(i32 %294)
  %296 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %292, i64 0, i32 0
  %297 = load i64, i64* %296, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %298 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %292, i64 0, i32 1
  %299 = load i64, i64* %298, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %300 = icmp eq i64 %297, %299
  br i1 %300, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %292, i64 8)
  br label %push.store.1

push.store.1:
  %301 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %292, i64 0, i32 2
  %302 = load i8*, i8** %301, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %303 = bitcast i8* %302 to i8**
  %304 = getelementptr inbounds i8*, i8** %303, i64 %297
  store i8* %295, i8** %304, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %305 = add i64 %297, 1
  store i64 %305, i64* %296, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %306 = trunc i64 %305 to i32
  %307 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %308 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %309 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %308, double 0x408F880000000000)
  %310 = call i8* @nish_str_from_i32(i32 %309)
  %311 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %307, i64 0, i32 0
  %312 = load i64, i64* %311, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %313 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %307, i64 0, i32 1
  %314 = load i64, i64* %313, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %315 = icmp eq i64 %312, %314
  br i1 %315, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %307, i64 8)
  br label %push.store.2

push.store.2:
  %316 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %307, i64 0, i32 2
  %317 = load i8*, i8** %316, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %318 = bitcast i8* %317 to i8**
  %319 = getelementptr inbounds i8*, i8** %318, i64 %312
  store i8* %310, i8** %319, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %320 = add i64 %312, 1
  store i64 %320, i64* %311, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %321 = trunc i64 %320 to i32
  %322 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %323 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %324 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %323, double 0x408F880000000000)
  %325 = call i8* @nish_str_from_i32(i32 %324)
  %326 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %322, i64 0, i32 0
  %327 = load i64, i64* %326, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %328 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %322, i64 0, i32 1
  %329 = load i64, i64* %328, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %330 = icmp eq i64 %327, %329
  br i1 %330, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %322, i64 8)
  br label %push.store.3

push.store.3:
  %331 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %322, i64 0, i32 2
  %332 = load i8*, i8** %331, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %333 = bitcast i8* %332 to i8**
  %334 = getelementptr inbounds i8*, i8** %333, i64 %327
  store i8* %325, i8** %334, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %335 = add i64 %327, 1
  store i64 %335, i64* %326, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %336 = trunc i64 %335 to i32
  %337 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %338 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %339 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %338, double 0x4090680000000000)
  %340 = call i8* @nish_str_from_i32(i32 %339)
  %341 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %337, i64 0, i32 0
  %342 = load i64, i64* %341, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %343 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %337, i64 0, i32 1
  %344 = load i64, i64* %343, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %345 = icmp eq i64 %342, %344
  br i1 %345, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %337, i64 8)
  br label %push.store.4

push.store.4:
  %346 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %337, i64 0, i32 2
  %347 = load i8*, i8** %346, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %348 = bitcast i8* %347 to i8**
  %349 = getelementptr inbounds i8*, i8** %348, i64 %342
  store i8* %340, i8** %349, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %350 = add i64 %342, 1
  store i64 %350, i64* %341, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %351 = trunc i64 %350 to i32
  %352 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %353 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %354 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %353, double 0x4090400000000000)
  %355 = call i8* @nish_str_from_i32(i32 %354)
  %356 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %352, i64 0, i32 0
  %357 = load i64, i64* %356, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %358 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %352, i64 0, i32 1
  %359 = load i64, i64* %358, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %360 = icmp eq i64 %357, %359
  br i1 %360, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %352, i64 8)
  br label %push.store.5

push.store.5:
  %361 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %352, i64 0, i32 2
  %362 = load i8*, i8** %361, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %363 = bitcast i8* %362 to i8**
  %364 = getelementptr inbounds i8*, i8** %363, i64 %357
  store i8* %355, i8** %364, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %365 = add i64 %357, 1
  store i64 %365, i64* %356, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %366 = trunc i64 %365 to i32
  %367 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %368 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %369 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %368, double 0x4090540000000000)
  %370 = call i8* @nish_str_from_i32(i32 %369)
  %371 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %367, i64 0, i32 0
  %372 = load i64, i64* %371, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %373 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %367, i64 0, i32 1
  %374 = load i64, i64* %373, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %375 = icmp eq i64 %372, %374
  br i1 %375, label %push.grow.6, label %push.store.6

push.grow.6:
  call void @nish_array_grow(%struct.nish_array* %367, i64 8)
  br label %push.store.6

push.store.6:
  %376 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %367, i64 0, i32 2
  %377 = load i8*, i8** %376, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %378 = bitcast i8* %377 to i8**
  %379 = getelementptr inbounds i8*, i8** %378, i64 %372
  store i8* %370, i8** %379, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %380 = add i64 %372, 1
  store i64 %380, i64* %371, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %381 = trunc i64 %380 to i32
  %382 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %383 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %382, i64 0, i32 0
  %384 = load i64, i64* %383, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %385 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*) to i64*
  %386 = load i64, i64* %385, align 8
  %387 = sub i64 %384, 1
  %388 = mul i64 %386, %387
  %389 = icmp eq i64 %384, 0
  %390 = select i1 %389, i64 0, i64 %388
  store i64 %390, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %391 = load i64, i64* %join.at, align 8
  %392 = icmp ult i64 %391, %384
  br i1 %392, label %join.sum.body, label %join.copy

join.sum.body:
  %393 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %382, i64 0, i32 2
  %394 = load i8*, i8** %393, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %395 = bitcast i8* %394 to i8**
  %396 = getelementptr inbounds i8*, i8** %395, i64 %391
  %397 = load i8*, i8** %396, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %398 = load i64, i64* %join.total, align 8
  %399 = bitcast i8* %397 to i64*
  %400 = load i64, i64* %399, align 8
  %401 = add i64 %398, %400
  store i64 %401, i64* %join.total, align 8
  %402 = add i64 %391, 1
  store i64 %402, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %403 = load i64, i64* %join.total, align 8
  %404 = icmp ugt i64 %403, 2147483647
  %405 = add i64 %403, 9
  %406 = select i1 %404, i64 4611686018427387904, i64 %405
  %407 = call i8* @nish_alloc_struct(i64 %406)
  %408 = bitcast i8* %407 to i64*
  store i64 %403, i64* %408, align 8
  %409 = getelementptr inbounds i8, i8* %407, i64 8
  store i8* %409, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %410 = load i64, i64* %join.at, align 8
  %411 = icmp ult i64 %410, %384
  br i1 %411, label %join.part, label %join.end

join.part:
  %412 = load i8*, i8** %join.p, align 8
  %413 = icmp eq i64 %410, 0
  %414 = select i1 %413, i64 0, i64 %386
  %415 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %412, i8* %415, i64 %414, i1 false)
  %416 = getelementptr inbounds i8, i8* %412, i64 %414
  %417 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %382, i64 0, i32 2
  %418 = load i8*, i8** %417, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %419 = bitcast i8* %418 to i8**
  %420 = getelementptr inbounds i8*, i8** %419, i64 %410
  %421 = load i8*, i8** %420, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %422 = bitcast i8* %421 to i64*
  %423 = load i64, i64* %422, align 8
  %424 = getelementptr inbounds i8, i8* %421, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %416, i8* %424, i64 %423, i1 false)
  %425 = getelementptr inbounds i8, i8* %416, i64 %423
  store i8* %425, i8** %join.p, align 8
  %426 = add i64 %410, 1
  store i64 %426, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %427 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %427, align 1
  %428 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.72 to i8*), i8* %407)
  %429 = call i8* @nish_str_concat(i8* %428, i8* bitcast ({ i64, [8 x i8] }* @.str.73 to i8*))
  %430 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %431 = call double @nish.FixedStep.alpha(%struct.FixedStep* %430)
  %432 = fmul double %431, 0x4059000000000000
  %433 = call double @llvm.floor.f64(double %432)
  %434 = call i8* @nish_str_from_f64(double %433)
  %435 = call i8* @nish_str_concat(i8* %429, i8* %434)
  %436 = call i8* @nish_str_concat(i8* %435, i8* bitcast ({ i64, [2 x i8] }* @.str.74 to i8*))
  call void @nish_print(i8* %436)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.1, i32 100, i32 3)
  store %struct.FixedStep* %FixedStep.obj.1, %struct.FixedStep** %behind.addr, align 8
  %437 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %438 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %437, double 0x0000000000000000)
  %439 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %440 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %439, double 0x408F680000000000)
  store i32 %440, i32* %caught.addr, align 4
  %441 = load i32, i32* %caught.addr, align 4
  %442 = call i8* @nish_str_from_i32(i32 %441)
  %443 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.75 to i8*), i8* %442)
  %444 = call i8* @nish_str_concat(i8* %443, i8* bitcast ({ i64, [29 x i8] }* @.str.76 to i8*))
  %445 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %446 = call double @nish.FixedStep.alpha(%struct.FixedStep* %445)
  %447 = fmul double %446, 0x4059000000000000
  %448 = call double @llvm.floor.f64(double %447)
  %449 = call i8* @nish_str_from_f64(double %448)
  %450 = call i8* @nish_str_concat(i8* %444, i8* %449)
  %451 = call i8* @nish_str_concat(i8* %450, i8* bitcast ({ i64, [2 x i8] }* @.str.74 to i8*))
  call void @nish_print(i8* %451)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.2, i32 100, i32 1)
  store %struct.FixedStep* %FixedStep.obj.2, %struct.FixedStep** %draw.addr, align 8
  store i32 0, i32* %frames.addr, align 4
  %452 = load %struct.FixedStep*, %struct.FixedStep** %draw.addr, align 8
  %453 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %452, double 0x0000000000000000)
  store i32 1, i32* %ms.addr, align 4
  br label %for.cond.1

for.cond.1:
  %454 = load i32, i32* %ms.addr, align 4
  %455 = icmp sle i32 %454, 1000
  br i1 %455, label %for.body.1, label %for.end.1

for.body.1:
  %456 = load i32, i32* %frames.addr, align 4
  %457 = load %struct.FixedStep*, %struct.FixedStep** %draw.addr, align 8
  %458 = load i32, i32* %ms.addr, align 4
  %459 = sitofp i32 %458 to double
  %460 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %457, double %459)
  %461 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %456, i32 %460)
  %462 = extractvalue { i32, i1 } %461, 0
  %463 = extractvalue { i32, i1 } %461, 1
  br i1 %463, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %462, i32* %frames.addr, align 4
  br label %for.inc.1

for.inc.1:
  %464 = load i32, i32* %ms.addr, align 4
  %465 = add nsw i32 %464, 1
  store i32 %465, i32* %ms.addr, align 4
  br label %for.cond.1

for.end.1:
  %466 = load i32, i32* %frames.addr, align 4
  %467 = call i8* @nish_str_from_i32(i32 %466)
  %468 = call i8* @nish_str_concat(i8* bitcast ({ i64, [50 x i8] }* @.str.77 to i8*), i8* %467)
  %469 = call i8* @nish_str_concat(i8* %468, i8* bitcast ({ i64, [8 x i8] }* @.str.78 to i8*))
  call void @nish_print(i8* %469)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.3, i32 0, i32 0)
  store %struct.FixedStep* %FixedStep.obj.3, %struct.FixedStep** %odd.addr, align 8
  %470 = load %struct.FixedStep*, %struct.FixedStep** %odd.addr, align 8
  %471 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %470, i32 0, i32 0
  %472 = load double, double* %471, align 8, !tbaa !32
  %473 = call i8* @nish_str_from_f64(double %472)
  %474 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.79 to i8*), i8* %473)
  %475 = call i8* @nish_str_concat(i8* %474, i8* bitcast ({ i64, [14 x i8] }* @.str.80 to i8*))
  %476 = load %struct.FixedStep*, %struct.FixedStep** %odd.addr, align 8
  %477 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %476, i32 0, i32 3
  %478 = load i32, i32* %477, align 4, !tbaa !33
  %479 = call i8* @nish_str_from_i32(i32 %478)
  %480 = call i8* @nish_str_concat(i8* %475, i8* %479)
  call void @nish_print(i8* %480)
  call void @nish.KeyDecoder.constructor(%struct.KeyDecoder* %KeyDecoder.obj, double 0x403E000000000000)
  store %struct.KeyDecoder* %KeyDecoder.obj, %struct.KeyDecoder** %d.addr, align 8
  %481 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %482 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 12, i64* %482, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %483 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 12, i64* %483, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %484 = bitcast [12 x i32]* %arr.data to i8*
  %485 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %484, i8** %485, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %486 = bitcast i8* %484 to i32*
  %487 = getelementptr inbounds i32, i32* %486, i64 0
  store i32 27, i32* %487, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %488 = getelementptr inbounds i32, i32* %486, i64 1
  store i32 91, i32* %488, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %489 = getelementptr inbounds i32, i32* %486, i64 2
  store i32 65, i32* %489, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %490 = getelementptr inbounds i32, i32* %486, i64 3
  store i32 27, i32* %490, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %491 = getelementptr inbounds i32, i32* %486, i64 4
  store i32 91, i32* %491, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %492 = getelementptr inbounds i32, i32* %486, i64 5
  store i32 66, i32* %492, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %493 = getelementptr inbounds i32, i32* %486, i64 6
  store i32 27, i32* %493, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %494 = getelementptr inbounds i32, i32* %486, i64 7
  store i32 79, i32* %494, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %495 = getelementptr inbounds i32, i32* %486, i64 8
  store i32 67, i32* %495, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %496 = getelementptr inbounds i32, i32* %486, i64 9
  store i32 27, i32* %496, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %497 = getelementptr inbounds i32, i32* %486, i64 10
  store i32 79, i32* %497, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %498 = getelementptr inbounds i32, i32* %486, i64 11
  store i32 68, i32* %498, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %499 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.1)
  %500 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %481, %struct.nish_array* %499, i32 12, double 0x0000000000000000)
  %501 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.81 to i8*), %struct.nish_array* %500, %struct.KeyDecoder* %501)
  %502 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %503 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %503, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %504 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %504, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %505 = bitcast [8 x i32]* %arr.data.1 to i8*
  %506 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %505, i8** %506, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %507 = bitcast i8* %505 to i32*
  %508 = getelementptr inbounds i32, i32* %507, i64 0
  store i32 3, i32* %508, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %509 = getelementptr inbounds i32, i32* %507, i64 1
  store i32 13, i32* %509, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %510 = getelementptr inbounds i32, i32* %507, i64 2
  store i32 10, i32* %510, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %511 = getelementptr inbounds i32, i32* %507, i64 3
  store i32 32, i32* %511, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %512 = getelementptr inbounds i32, i32* %507, i64 4
  store i32 9, i32* %512, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %513 = getelementptr inbounds i32, i32* %507, i64 5
  store i32 127, i32* %513, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %514 = getelementptr inbounds i32, i32* %507, i64 6
  store i32 8, i32* %514, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %515 = getelementptr inbounds i32, i32* %507, i64 7
  store i32 1, i32* %515, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %516 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.2)
  %517 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %502, %struct.nish_array* %516, i32 8, double 0x0000000000000000)
  %518 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [9 x i8] }* @.str.82 to i8*), %struct.nish_array* %517, %struct.KeyDecoder* %518)
  %519 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %520 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %520, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %521 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %521, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %522 = bitcast [8 x i32]* %arr.data.2 to i8*
  %523 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %522, i8** %523, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %524 = bitcast i8* %522 to i32*
  %525 = getelementptr inbounds i32, i32* %524, i64 0
  store i32 113, i32* %525, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %526 = getelementptr inbounds i32, i32* %524, i64 1
  store i32 81, i32* %526, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %527 = getelementptr inbounds i32, i32* %524, i64 2
  store i32 126, i32* %527, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %528 = getelementptr inbounds i32, i32* %524, i64 3
  store i32 195, i32* %528, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %529 = getelementptr inbounds i32, i32* %524, i64 4
  store i32 169, i32* %529, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %530 = getelementptr inbounds i32, i32* %524, i64 5
  store i32 226, i32* %530, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %531 = getelementptr inbounds i32, i32* %524, i64 6
  store i32 150, i32* %531, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %532 = getelementptr inbounds i32, i32* %524, i64 7
  store i32 128, i32* %532, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %533 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.3)
  %534 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %519, %struct.nish_array* %533, i32 8, double 0x0000000000000000)
  %535 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [10 x i8] }* @.str.83 to i8*), %struct.nish_array* %534, %struct.KeyDecoder* %535)
  %536 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %537 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %537, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %538 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %538, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %539 = bitcast [3 x i32]* %arr.data.3 to i8*
  %540 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %539, i8** %540, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %541 = bitcast i8* %539 to i32*
  %542 = getelementptr inbounds i32, i32* %541, i64 0
  store i32 97, i32* %542, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %543 = getelementptr inbounds i32, i32* %541, i64 1
  store i32 98, i32* %543, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %544 = getelementptr inbounds i32, i32* %541, i64 2
  store i32 99, i32* %544, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %545 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.4)
  %546 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %536, %struct.nish_array* %545, i32 1, double 0x0000000000000000)
  %547 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.84 to i8*), %struct.nish_array* %546, %struct.KeyDecoder* %547)
  %548 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %549 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 1, i64* %549, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %550 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 1, i64* %550, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %551 = bitcast [1 x i32]* %arr.data.4 to i8*
  %552 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %551, i8** %552, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %553 = bitcast i8* %551 to i32*
  %554 = getelementptr inbounds i32, i32* %553, i64 0
  store i32 27, i32* %554, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %555 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.5)
  %556 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %548, %struct.nish_array* %555, i32 1, double 0x4059000000000000)
  %557 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.85 to i8*), %struct.nish_array* %556, %struct.KeyDecoder* %557)
  %558 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %559 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 2, i64* %559, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %560 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 2, i64* %560, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %561 = bitcast [2 x i32]* %arr.data.5 to i8*
  %562 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %561, i8** %562, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %563 = bitcast i8* %561 to i32*
  %564 = getelementptr inbounds i32, i32* %563, i64 0
  store i32 91, i32* %564, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %565 = getelementptr inbounds i32, i32* %563, i64 1
  store i32 65, i32* %565, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %566 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.6)
  %567 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %558, %struct.nish_array* %566, i32 2, double 0x405B800000000000)
  %568 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.86 to i8*), %struct.nish_array* %567, %struct.KeyDecoder* %568)
  %569 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %570 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 2, i64* %570, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %571 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 2, i64* %571, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %572 = bitcast [2 x i32]* %arr.data.6 to i8*
  %573 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %572, i8** %573, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %574 = bitcast i8* %572 to i32*
  %575 = getelementptr inbounds i32, i32* %574, i64 0
  store i32 27, i32* %575, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %576 = getelementptr inbounds i32, i32* %574, i64 1
  store i32 91, i32* %576, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %577 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.7)
  %578 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %569, %struct.nish_array* %577, i32 2, double 0x4069000000000000)
  %579 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.87 to i8*), %struct.nish_array* %578, %struct.KeyDecoder* %579)
  %580 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %581 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 1, i64* %581, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %582 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 1, i64* %582, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %583 = bitcast [1 x i32]* %arr.data.7 to i8*
  %584 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %583, i8** %584, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %585 = bitcast i8* %583 to i32*
  %586 = getelementptr inbounds i32, i32* %585, i64 0
  store i32 66, i32* %586, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %587 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.8)
  %588 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %580, %struct.nish_array* %587, i32 1, double 0x406A400000000000)
  %589 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.88 to i8*), %struct.nish_array* %588, %struct.KeyDecoder* %589)
  %590 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %591 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 0
  store i64 2, i64* %591, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %592 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 1
  store i64 2, i64* %592, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %593 = bitcast [2 x i32]* %arr.data.8 to i8*
  %594 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 2
  store i8* %593, i8** %594, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %595 = bitcast i8* %593 to i32*
  %596 = getelementptr inbounds i32, i32* %595, i64 0
  store i32 27, i32* %596, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %597 = getelementptr inbounds i32, i32* %595, i64 1
  store i32 79, i32* %597, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %598 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.9)
  %599 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %590, %struct.nish_array* %598, i32 2, double 0x4072C00000000000)
  %600 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [23 x i8] }* @.str.89 to i8*), %struct.nish_array* %599, %struct.KeyDecoder* %600)
  %601 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %602 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 0
  store i64 1, i64* %602, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %603 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 1
  store i64 1, i64* %603, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %604 = bitcast [1 x i32]* %arr.data.9 to i8*
  %605 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 2
  store i8* %604, i8** %605, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %606 = bitcast i8* %604 to i32*
  %607 = getelementptr inbounds i32, i32* %606, i64 0
  store i32 67, i32* %607, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %608 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.10)
  %609 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %601, %struct.nish_array* %608, i32 1, double 0x4073100000000000)
  %610 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.90 to i8*), %struct.nish_array* %609, %struct.KeyDecoder* %610)
  %611 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %612 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 0
  store i64 6, i64* %612, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %613 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 1
  store i64 6, i64* %613, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %614 = bitcast [6 x i32]* %arr.data.10 to i8*
  %615 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 2
  store i8* %614, i8** %615, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %616 = bitcast i8* %614 to i32*
  %617 = getelementptr inbounds i32, i32* %616, i64 0
  store i32 27, i32* %617, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %618 = getelementptr inbounds i32, i32* %616, i64 1
  store i32 91, i32* %618, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %619 = getelementptr inbounds i32, i32* %616, i64 2
  store i32 49, i32* %619, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %620 = getelementptr inbounds i32, i32* %616, i64 3
  store i32 59, i32* %620, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %621 = getelementptr inbounds i32, i32* %616, i64 4
  store i32 53, i32* %621, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %622 = getelementptr inbounds i32, i32* %616, i64 5
  store i32 65, i32* %622, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %623 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.11)
  %624 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %611, %struct.nish_array* %623, i32 6, double 0x4079000000000000)
  %625 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.91 to i8*), %struct.nish_array* %624, %struct.KeyDecoder* %625)
  %626 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %627 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 0
  store i64 4, i64* %627, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %628 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 1
  store i64 4, i64* %628, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %629 = bitcast [4 x i32]* %arr.data.11 to i8*
  %630 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 2
  store i8* %629, i8** %630, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %631 = bitcast i8* %629 to i32*
  %632 = getelementptr inbounds i32, i32* %631, i64 0
  store i32 27, i32* %632, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %633 = getelementptr inbounds i32, i32* %631, i64 1
  store i32 91, i32* %633, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %634 = getelementptr inbounds i32, i32* %631, i64 2
  store i32 51, i32* %634, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %635 = getelementptr inbounds i32, i32* %631, i64 3
  store i32 126, i32* %635, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %636 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.12)
  %637 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %626, %struct.nish_array* %636, i32 4, double 0x4079000000000000)
  %638 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.92 to i8*), %struct.nish_array* %637, %struct.KeyDecoder* %638)
  %639 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %640 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 0
  store i64 1, i64* %640, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %641 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 1
  store i64 1, i64* %641, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %642 = bitcast [1 x i32]* %arr.data.12 to i8*
  %643 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 2
  store i8* %642, i8** %643, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %644 = bitcast i8* %642 to i32*
  %645 = getelementptr inbounds i32, i32* %644, i64 0
  store i32 27, i32* %645, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %646 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.13)
  %647 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %639, %struct.nish_array* %646, i32 1, double 0x407F400000000000)
  %648 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [16 x i8] }* @.str.93 to i8*), %struct.nish_array* %647, %struct.KeyDecoder* %648)
  %649 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %650 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %649, double 0x4080400000000000)
  %651 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.94 to i8*), %struct.nish_array* %650, %struct.KeyDecoder* %651)
  %652 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %653 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %652, double 0x4080900000000000)
  %654 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.95 to i8*), %struct.nish_array* %653, %struct.KeyDecoder* %654)
  %655 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %656 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 0
  store i64 2, i64* %656, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %657 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 1
  store i64 2, i64* %657, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %658 = bitcast [2 x i32]* %arr.data.13 to i8*
  %659 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 2
  store i8* %658, i8** %659, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %660 = bitcast i8* %658 to i32*
  %661 = getelementptr inbounds i32, i32* %660, i64 0
  store i32 27, i32* %661, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %662 = getelementptr inbounds i32, i32* %660, i64 1
  store i32 120, i32* %662, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %663 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.14)
  %664 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %655, %struct.nish_array* %663, i32 2, double 0x4082C00000000000)
  %665 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.96 to i8*), %struct.nish_array* %664, %struct.KeyDecoder* %665)
  %666 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %667 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 0
  store i64 4, i64* %667, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %668 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 1
  store i64 4, i64* %668, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %669 = bitcast [4 x i32]* %arr.data.14 to i8*
  %670 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 2
  store i8* %669, i8** %670, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %671 = bitcast i8* %669 to i32*
  %672 = getelementptr inbounds i32, i32* %671, i64 0
  store i32 27, i32* %672, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %673 = getelementptr inbounds i32, i32* %671, i64 1
  store i32 27, i32* %673, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %674 = getelementptr inbounds i32, i32* %671, i64 2
  store i32 91, i32* %674, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %675 = getelementptr inbounds i32, i32* %671, i64 3
  store i32 65, i32* %675, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %676 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.15)
  %677 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %666, %struct.nish_array* %676, i32 4, double 0x4082C00000000000)
  %678 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.97 to i8*), %struct.nish_array* %677, %struct.KeyDecoder* %678)
  %679 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %680 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 0
  store i64 1, i64* %680, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %681 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 1
  store i64 1, i64* %681, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %682 = bitcast [1 x i32]* %arr.data.15 to i8*
  %683 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 2
  store i8* %682, i8** %683, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %684 = bitcast i8* %682 to i32*
  %685 = getelementptr inbounds i32, i32* %684, i64 0
  store i32 27, i32* %685, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %686 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.16)
  %687 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %679, %struct.nish_array* %686, i32 1, double 0x4085E00000000000)
  %688 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [36 x i8] }* @.str.98 to i8*), %struct.nish_array* %687, %struct.KeyDecoder* %688)
  %689 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %690 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 0
  store i64 1, i64* %690, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %691 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 1
  store i64 1, i64* %691, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %692 = bitcast [1 x i32]* %arr.data.16 to i8*
  %693 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 2
  store i8* %692, i8** %693, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %694 = bitcast i8* %692 to i32*
  %695 = getelementptr inbounds i32, i32* %694, i64 0
  store i32 120, i32* %695, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %696 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.17)
  %697 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %689, %struct.nish_array* %696, i32 1, double 0x4089000000000000)
  %698 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.99 to i8*), %struct.nish_array* %697, %struct.KeyDecoder* %698)
  %699 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %700 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 0
  store i64 1, i64* %700, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %701 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 1
  store i64 1, i64* %701, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %702 = bitcast [1 x i32]* %arr.data.17 to i8*
  %703 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 2
  store i8* %702, i8** %703, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %704 = bitcast i8* %702 to i32*
  %705 = getelementptr inbounds i32, i32* %704, i64 0
  store i32 195, i32* %705, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %706 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.18)
  %707 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %699, %struct.nish_array* %706, i32 1, double 0x408C200000000000)
  %708 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.100 to i8*), %struct.nish_array* %707, %struct.KeyDecoder* %708)
  %709 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %710 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 0
  store i64 1, i64* %710, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %711 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 1
  store i64 1, i64* %711, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %712 = bitcast [1 x i32]* %arr.data.18 to i8*
  %713 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 2
  store i8* %712, i8** %713, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %714 = bitcast i8* %712 to i32*
  %715 = getelementptr inbounds i32, i32* %714, i64 0
  store i32 169, i32* %715, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %716 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.19)
  %717 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %709, %struct.nish_array* %716, i32 1, double 0x408C280000000000)
  %718 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.101 to i8*), %struct.nish_array* %717, %struct.KeyDecoder* %718)
  %719 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %720 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 0
  store i64 2, i64* %720, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %721 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 1
  store i64 2, i64* %721, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %722 = bitcast [2 x i32]* %arr.data.19 to i8*
  %723 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 2
  store i8* %722, i8** %723, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %724 = bitcast i8* %722 to i32*
  %725 = getelementptr inbounds i32, i32* %724, i64 0
  store i32 226, i32* %725, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %726 = getelementptr inbounds i32, i32* %724, i64 1
  store i32 150, i32* %726, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %727 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.20)
  %728 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %719, %struct.nish_array* %727, i32 2, double 0x408F400000000000)
  %729 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [27 x i8] }* @.str.102 to i8*), %struct.nish_array* %728, %struct.KeyDecoder* %729)
  %730 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %731 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %730, double 0x4091300000000000)
  %732 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.103 to i8*), %struct.nish_array* %731, %struct.KeyDecoder* %732)
  %733 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %734 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 0
  store i64 3, i64* %734, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %735 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 1
  store i64 3, i64* %735, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %736 = bitcast [3 x i32]* %arr.data.20 to i8*
  %737 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 2
  store i8* %736, i8** %737, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %738 = bitcast i8* %736 to i32*
  %739 = getelementptr inbounds i32, i32* %738, i64 0
  store i32 255, i32* %739, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %740 = getelementptr inbounds i32, i32* %738, i64 1
  store i32 128, i32* %740, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %741 = getelementptr inbounds i32, i32* %738, i64 2
  store i32 97, i32* %741, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %742 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.21)
  %743 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %733, %struct.nish_array* %742, i32 3, double 0x4092C00000000000)
  %744 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [14 x i8] }* @.str.104 to i8*), %struct.nish_array* %743, %struct.KeyDecoder* %744)
  %745 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %746 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 0
  store i64 3, i64* %746, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %747 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 1
  store i64 3, i64* %747, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %748 = bitcast [3 x i32]* %arr.data.21 to i8*
  %749 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 2
  store i8* %748, i8** %749, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %750 = bitcast i8* %748 to i32*
  %751 = getelementptr inbounds i32, i32* %750, i64 0
  store i32 226, i32* %751, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %752 = getelementptr inbounds i32, i32* %750, i64 1
  store i32 150, i32* %752, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %753 = getelementptr inbounds i32, i32* %750, i64 2
  store i32 97, i32* %753, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %754 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.22)
  %755 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %745, %struct.nish_array* %754, i32 3, double 0x4093880000000000)
  %756 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [33 x i8] }* @.str.105 to i8*), %struct.nish_array* %755, %struct.KeyDecoder* %756)
  %757 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %758 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 0
  store i64 0, i64* %758, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %759 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 1
  store i64 0, i64* %759, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %760 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 2
  store i8* null, i8** %760, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %761 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.23)
  %762 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %757, %struct.nish_array* %761, i32 0, double 0x4094500000000000)
  %763 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [11 x i8] }* @.str.106 to i8*), %struct.nish_array* %762, %struct.KeyDecoder* %763)
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
!24 = !{!"i1", !6, i64 0}
!25 = !{!"Screen", !23, i64 0, !23, i64 8, !23, i64 16, !23, i64 24, !23, i64 32, !23, i64 40, !23, i64 48, !23, i64 56, !23, i64 64, !19, i64 72, !19, i64 76, !19, i64 80, !24, i64 84, !24, i64 85}
!26 = !{!25, !24, i64 85}
!27 = !{!"Canvas", !23, i64 0, !19, i64 8, !19, i64 12, !23, i64 16}
!28 = !{!27, !19, i64 8}
!29 = !{!27, !19, i64 12}
!30 = !{!"double", !6, i64 0}
!31 = !{!"FixedStep", !30, i64 0, !30, i64 8, !30, i64 16, !19, i64 24, !24, i64 28}
!32 = !{!31, !30, i64 0}
!33 = !{!31, !19, i64 24}
