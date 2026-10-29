%struct.HelpMenu = type { %struct.Style*, i8*, i32, i32, %struct.nish_array*, i32 }
%struct.Style = type { i1, i1, i8*, i8*, i8*, i8*, i8*, i8*, i8*, i8*, i8*, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\1B\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"^[\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"greet\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"1.2.0\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"say hello\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"<name> [flags]\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"greet someone\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"--version\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"Flags\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"--shout\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"in capitals\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"--times\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"<n>\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"say it n times\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"--a-flag-past-the-column\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"<x>\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"two spaces\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"Notes\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"one line of prose\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"/etc/greet.conf\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"k\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"g\00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"m\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"  fg \00" }, align 8
@.str.31 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.32 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"  bright \00" }, align 8
@.str.33 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"  bg \00" }, align 8
@.str.34 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"  bgBright \00" }, align 8
@.str.35 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"f\00" }, align 8
@.str.36 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"i\00" }, align 8
@.str.37 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"u\00" }, align 8
@.str.38 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"v\00" }, align 8
@.str.39 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"s\00" }, align 8
@.str.40 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"  attrs \00" }, align 8
@.str.41 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"  sgr \00" }, align 8
@.str.42 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.43 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"1\00" }, align 8
@.str.44 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c";\00" }, align 8
@.str.45 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"31\00" }, align 8
@.str.46 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"o\00" }, align 8
@.str.47 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"38;5;208\00" }, align 8
@.str.48 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"t\00" }, align 8
@.str.49 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"38;2;255;128;0\00" }, align 8
@.str.50 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"  nested \00" }, align 8
@.str.51 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.52 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"44\00" }, align 8
@.str.53 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"  empty [\00" }, align 8
@.str.54 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"][\00" }, align 8
@.str.55 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"]\00" }, align 8
@.str.56 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"1;34\00" }, align 8
@.str.57 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"1;4\00" }, align 8
@.str.58 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"32\00" }, align 8
@.str.59 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"7\00" }, align 8
@.str.60 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"1;33\00" }, align 8
@.str.61 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"35\00" }, align 8
@.str.62 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"3\00" }, align 8
@.str.63 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"2\00" }, align 8
@.str.64 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"theme:\00" }, align 8
@.str.65 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"mono:\00" }, align 8
@.str.66 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"plain:\00" }, align 8
@.str.67 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"off paints nothing: \00" }, align 8
@.str.68 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.69 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.70 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"mono dim is plain: \00" }, align 8
@.str.71 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.72 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"-----------------------\00" }, align 8
@.str.73 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"<name>\00" }, align 8
@.str.74 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"theme painters\00" }, align 8
@.str.75 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"mono painters\00" }, align 8
@.str.76 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"off painters\00" }, align 8
@.str.77 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"recoloured theme:\00" }, align 8
@.str.78 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"recoloured mono:\00" }, align 8
@.str.79 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"recoloured off is plain: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish.HelpMenu.constructor(%struct.HelpMenu* noundef nonnull noalias align 8 dereferenceable(40) nocapture, %struct.Style* noundef nonnull align 8 dereferenceable(88), i8* noundef nonnull noalias readonly align 8, i32 noundef, i32 noundef) #1
declare void @nish.HelpMenu.header(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.title(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.line(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare void @nish.HelpMenu.usage(%struct.HelpMenu* noundef nonnull align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.section(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.row(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.note(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.value(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.HelpMenu.text(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture) #1
declare void @nish.Style.constructor(%struct.Style* noundef nonnull noalias align 8 dereferenceable(88) nocapture, i1 noundef zeroext, i1 noundef zeroext) #1
declare noundef nonnull align 8 i8* @nish.Style.paint(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.heading(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.name(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.flag(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.meta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.dim(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.sgr(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.black(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.red(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.green(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.yellow(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.blue(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.magenta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.cyan(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.white(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightBlack(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightRed(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightGreen(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightYellow(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightBlue(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightMagenta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightCyan(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightWhite(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBlack(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgRed(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgGreen(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgYellow(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBlue(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgMagenta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgCyan(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgWhite(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightBlack(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightRed(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightGreen(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightYellow(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightBlue(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightMagenta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightCyan(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightWhite(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bold(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.faint(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.italic(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.underline(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.inverse(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.strikethrough(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.replaceAll(i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8 nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 i8* @visible(i8* noundef nonnull noalias readonly align 8 %text) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.replaceAll(i8* %text, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define internal noundef nonnull align 8 i8* @menu(%struct.Style* noundef nonnull align 8 dereferenceable(88) %style) #0 {
entry:
  %m.addr = alloca %struct.HelpMenu*, align 8
  %HelpMenu.obj = alloca %struct.HelpMenu, align 8
  call void @nish.HelpMenu.constructor(%struct.HelpMenu* %HelpMenu.obj, %struct.Style* %style, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i32 24, i32 30)
  store %struct.HelpMenu* %HelpMenu.obj, %struct.HelpMenu** %m.addr, align 8
  %0 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.header(%struct.HelpMenu* %0, i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  %1 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.usage(%struct.HelpMenu* %1, i8* bitcast ({ i64, [15 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [14 x i8] }* @.str.6 to i8*))
  %2 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.usage(%struct.HelpMenu* %2, i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %3 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.section(%struct.HelpMenu* %3, i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*))
  %4 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.row(%struct.HelpMenu* %4, i8* bitcast ({ i64, [8 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [12 x i8] }* @.str.11 to i8*))
  %5 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.row(%struct.HelpMenu* %5, i8* bitcast ({ i64, [8 x i8] }* @.str.12 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.13 to i8*), i8* bitcast ({ i64, [15 x i8] }* @.str.14 to i8*))
  %6 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.row(%struct.HelpMenu* %6, i8* bitcast ({ i64, [25 x i8] }* @.str.15 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.16 to i8*), i8* bitcast ({ i64, [11 x i8] }* @.str.17 to i8*))
  %7 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.section(%struct.HelpMenu* %7, i8* bitcast ({ i64, [6 x i8] }* @.str.18 to i8*))
  %8 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.note(%struct.HelpMenu* %8, i8* bitcast ({ i64, [18 x i8] }* @.str.19 to i8*))
  %9 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.value(%struct.HelpMenu* %9, i8* bitcast ({ i64, [16 x i8] }* @.str.20 to i8*))
  %10 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  %11 = call i64 @nish_arena_mark()
  %12 = call i8* @nish.HelpMenu.text(%struct.HelpMenu* %10)
  %13 = call i8* @nish_arena_keep(i64 %11, i8* %12)
  ret i8* %13
}

define internal void @painters(i8* noundef nonnull noalias readonly align 8 nocapture %label, %struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture %s) #0 {
entry:
  %fg.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %bright.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i8*], align 8
  %join.total.1 = alloca i64, align 8
  %join.at.1 = alloca i64, align 8
  %join.p.1 = alloca i8*, align 8
  %bg.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i8*], align 8
  %join.total.2 = alloca i64, align 8
  %join.at.2 = alloca i64, align 8
  %join.p.2 = alloca i8*, align 8
  %bgBright.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [8 x i8*], align 8
  %join.total.3 = alloca i64, align 8
  %join.at.3 = alloca i64, align 8
  %join.p.3 = alloca i8*, align 8
  %attrs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [6 x i8*], align 8
  %join.total.4 = alloca i64, align 8
  %join.at.4 = alloca i64, align 8
  %join.p.4 = alloca i8*, align 8
  %0 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [2 x i8] }* @.str.21 to i8*))
  call void @nish_print(i8* %0)
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @nish.Style.black(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @nish.Style.red(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.23 to i8*))
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @nish.Style.green(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.24 to i8*))
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  %10 = call i64 @nish_arena_mark()
  %11 = call i8* @nish.Style.yellow(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %12 = call i8* @nish_arena_keep(i64 %10, i8* %11)
  %13 = call i64 @nish_arena_mark()
  %14 = call i8* @nish.Style.blue(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %15 = call i8* @nish_arena_keep(i64 %13, i8* %14)
  %16 = call i64 @nish_arena_mark()
  %17 = call i8* @nish.Style.magenta(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.27 to i8*))
  %18 = call i8* @nish_arena_keep(i64 %16, i8* %17)
  %19 = call i64 @nish_arena_mark()
  %20 = call i8* @nish.Style.cyan(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*))
  %21 = call i8* @nish_arena_keep(i64 %19, i8* %20)
  %22 = call i64 @nish_arena_mark()
  %23 = call i8* @nish.Style.white(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.29 to i8*))
  %24 = call i8* @nish_arena_keep(i64 %22, i8* %23)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast [8 x i8*]* %arr.data to i8*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %27, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %27 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 0
  store i8* %3, i8** %30, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %31 = getelementptr inbounds i8*, i8** %29, i64 1
  store i8* %6, i8** %31, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = getelementptr inbounds i8*, i8** %29, i64 2
  store i8* %9, i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = getelementptr inbounds i8*, i8** %29, i64 3
  store i8* %12, i8** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = getelementptr inbounds i8*, i8** %29, i64 4
  store i8* %15, i8** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = getelementptr inbounds i8*, i8** %29, i64 5
  store i8* %18, i8** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = getelementptr inbounds i8*, i8** %29, i64 6
  store i8* %21, i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = getelementptr inbounds i8*, i8** %29, i64 7
  store i8* %24, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %fg.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %fg.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
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
  %53 = load i8*, i8** %52, align 8, !alias.scope !4, !noalias !3, !tbaa !14
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
  %71 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %68, i8* %71, i64 %70, i1 false)
  %72 = getelementptr inbounds i8, i8* %68, i64 %70
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to i8**
  %76 = getelementptr inbounds i8*, i8** %75, i64 %66
  %77 = load i8*, i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !14
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
  %84 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.30 to i8*), i8* %63)
  %85 = call i64 @nish_arena_mark()
  %86 = call i8* @visible(i8* %84)
  %87 = call i8* @nish_arena_keep(i64 %85, i8* %86)
  call void @nish_print(i8* %87)
  %88 = call i64 @nish_arena_mark()
  %89 = call i8* @nish.Style.brightBlack(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  %90 = call i8* @nish_arena_keep(i64 %88, i8* %89)
  %91 = call i64 @nish_arena_mark()
  %92 = call i8* @nish.Style.brightRed(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.23 to i8*))
  %93 = call i8* @nish_arena_keep(i64 %91, i8* %92)
  %94 = call i64 @nish_arena_mark()
  %95 = call i8* @nish.Style.brightGreen(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.24 to i8*))
  %96 = call i8* @nish_arena_keep(i64 %94, i8* %95)
  %97 = call i64 @nish_arena_mark()
  %98 = call i8* @nish.Style.brightYellow(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %99 = call i8* @nish_arena_keep(i64 %97, i8* %98)
  %100 = call i64 @nish_arena_mark()
  %101 = call i8* @nish.Style.brightBlue(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %102 = call i8* @nish_arena_keep(i64 %100, i8* %101)
  %103 = call i64 @nish_arena_mark()
  %104 = call i8* @nish.Style.brightMagenta(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.27 to i8*))
  %105 = call i8* @nish_arena_keep(i64 %103, i8* %104)
  %106 = call i64 @nish_arena_mark()
  %107 = call i8* @nish.Style.brightCyan(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*))
  %108 = call i8* @nish_arena_keep(i64 %106, i8* %107)
  %109 = call i64 @nish_arena_mark()
  %110 = call i8* @nish.Style.brightWhite(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.29 to i8*))
  %111 = call i8* @nish_arena_keep(i64 %109, i8* %110)
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %114 = bitcast [8 x i8*]* %arr.data.1 to i8*
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %114, i8** %115, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %116 = bitcast i8* %114 to i8**
  %117 = getelementptr inbounds i8*, i8** %116, i64 0
  store i8* %90, i8** %117, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %118 = getelementptr inbounds i8*, i8** %116, i64 1
  store i8* %93, i8** %118, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %119 = getelementptr inbounds i8*, i8** %116, i64 2
  store i8* %96, i8** %119, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %120 = getelementptr inbounds i8*, i8** %116, i64 3
  store i8* %99, i8** %120, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %121 = getelementptr inbounds i8*, i8** %116, i64 4
  store i8* %102, i8** %121, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %122 = getelementptr inbounds i8*, i8** %116, i64 5
  store i8* %105, i8** %122, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %123 = getelementptr inbounds i8*, i8** %116, i64 6
  store i8* %108, i8** %123, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %124 = getelementptr inbounds i8*, i8** %116, i64 7
  store i8* %111, i8** %124, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %bright.addr, align 8
  %125 = load %struct.nish_array*, %struct.nish_array** %bright.addr, align 8
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 0
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %128 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
  %129 = load i64, i64* %128, align 8
  %130 = sub i64 %127, 1
  %131 = mul i64 %129, %130
  %132 = icmp eq i64 %127, 0
  %133 = select i1 %132, i64 0, i64 %131
  store i64 %133, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %134 = load i64, i64* %join.at.1, align 8
  %135 = icmp ult i64 %134, %127
  br i1 %135, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %138 = bitcast i8* %137 to i8**
  %139 = getelementptr inbounds i8*, i8** %138, i64 %134
  %140 = load i8*, i8** %139, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %141 = load i64, i64* %join.total.1, align 8
  %142 = bitcast i8* %140 to i64*
  %143 = load i64, i64* %142, align 8
  %144 = add i64 %141, %143
  store i64 %144, i64* %join.total.1, align 8
  %145 = add i64 %134, 1
  store i64 %145, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %146 = load i64, i64* %join.total.1, align 8
  %147 = icmp ugt i64 %146, 2147483647
  %148 = add i64 %146, 9
  %149 = select i1 %147, i64 4611686018427387904, i64 %148
  %150 = call i8* @nish_alloc_struct(i64 %149)
  %151 = bitcast i8* %150 to i64*
  store i64 %146, i64* %151, align 8
  %152 = getelementptr inbounds i8, i8* %150, i64 8
  store i8* %152, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %153 = load i64, i64* %join.at.1, align 8
  %154 = icmp ult i64 %153, %127
  br i1 %154, label %join.part.1, label %join.end.1

join.part.1:
  %155 = load i8*, i8** %join.p.1, align 8
  %156 = icmp eq i64 %153, 0
  %157 = select i1 %156, i64 0, i64 %129
  %158 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %155, i8* %158, i64 %157, i1 false)
  %159 = getelementptr inbounds i8, i8* %155, i64 %157
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 2
  %161 = load i8*, i8** %160, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %162 = bitcast i8* %161 to i8**
  %163 = getelementptr inbounds i8*, i8** %162, i64 %153
  %164 = load i8*, i8** %163, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %165 = bitcast i8* %164 to i64*
  %166 = load i64, i64* %165, align 8
  %167 = getelementptr inbounds i8, i8* %164, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %159, i8* %167, i64 %166, i1 false)
  %168 = getelementptr inbounds i8, i8* %159, i64 %166
  store i8* %168, i8** %join.p.1, align 8
  %169 = add i64 %153, 1
  store i64 %169, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %170 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %170, align 1
  %171 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.32 to i8*), i8* %150)
  %172 = call i64 @nish_arena_mark()
  %173 = call i8* @visible(i8* %171)
  %174 = call i8* @nish_arena_keep(i64 %172, i8* %173)
  call void @nish_print(i8* %174)
  %175 = call i64 @nish_arena_mark()
  %176 = call i8* @nish.Style.bgBlack(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  %177 = call i8* @nish_arena_keep(i64 %175, i8* %176)
  %178 = call i64 @nish_arena_mark()
  %179 = call i8* @nish.Style.bgRed(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.23 to i8*))
  %180 = call i8* @nish_arena_keep(i64 %178, i8* %179)
  %181 = call i64 @nish_arena_mark()
  %182 = call i8* @nish.Style.bgGreen(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.24 to i8*))
  %183 = call i8* @nish_arena_keep(i64 %181, i8* %182)
  %184 = call i64 @nish_arena_mark()
  %185 = call i8* @nish.Style.bgYellow(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %186 = call i8* @nish_arena_keep(i64 %184, i8* %185)
  %187 = call i64 @nish_arena_mark()
  %188 = call i8* @nish.Style.bgBlue(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %189 = call i8* @nish_arena_keep(i64 %187, i8* %188)
  %190 = call i64 @nish_arena_mark()
  %191 = call i8* @nish.Style.bgMagenta(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.27 to i8*))
  %192 = call i8* @nish_arena_keep(i64 %190, i8* %191)
  %193 = call i64 @nish_arena_mark()
  %194 = call i8* @nish.Style.bgCyan(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*))
  %195 = call i8* @nish_arena_keep(i64 %193, i8* %194)
  %196 = call i64 @nish_arena_mark()
  %197 = call i8* @nish.Style.bgWhite(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.29 to i8*))
  %198 = call i8* @nish_arena_keep(i64 %196, i8* %197)
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %199, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %200, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %201 = bitcast [8 x i8*]* %arr.data.2 to i8*
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %201, i8** %202, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %203 = bitcast i8* %201 to i8**
  %204 = getelementptr inbounds i8*, i8** %203, i64 0
  store i8* %177, i8** %204, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %205 = getelementptr inbounds i8*, i8** %203, i64 1
  store i8* %180, i8** %205, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %206 = getelementptr inbounds i8*, i8** %203, i64 2
  store i8* %183, i8** %206, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %207 = getelementptr inbounds i8*, i8** %203, i64 3
  store i8* %186, i8** %207, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %208 = getelementptr inbounds i8*, i8** %203, i64 4
  store i8* %189, i8** %208, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %209 = getelementptr inbounds i8*, i8** %203, i64 5
  store i8* %192, i8** %209, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %210 = getelementptr inbounds i8*, i8** %203, i64 6
  store i8* %195, i8** %210, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %211 = getelementptr inbounds i8*, i8** %203, i64 7
  store i8* %198, i8** %211, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %bg.addr, align 8
  %212 = load %struct.nish_array*, %struct.nish_array** %bg.addr, align 8
  %213 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %212, i64 0, i32 0
  %214 = load i64, i64* %213, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %215 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
  %216 = load i64, i64* %215, align 8
  %217 = sub i64 %214, 1
  %218 = mul i64 %216, %217
  %219 = icmp eq i64 %214, 0
  %220 = select i1 %219, i64 0, i64 %218
  store i64 %220, i64* %join.total.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.sum.2

join.sum.2:
  %221 = load i64, i64* %join.at.2, align 8
  %222 = icmp ult i64 %221, %214
  br i1 %222, label %join.sum.body.2, label %join.copy.2

join.sum.body.2:
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %212, i64 0, i32 2
  %224 = load i8*, i8** %223, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %225 = bitcast i8* %224 to i8**
  %226 = getelementptr inbounds i8*, i8** %225, i64 %221
  %227 = load i8*, i8** %226, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %228 = load i64, i64* %join.total.2, align 8
  %229 = bitcast i8* %227 to i64*
  %230 = load i64, i64* %229, align 8
  %231 = add i64 %228, %230
  store i64 %231, i64* %join.total.2, align 8
  %232 = add i64 %221, 1
  store i64 %232, i64* %join.at.2, align 8
  br label %join.sum.2

join.copy.2:
  %233 = load i64, i64* %join.total.2, align 8
  %234 = icmp ugt i64 %233, 2147483647
  %235 = add i64 %233, 9
  %236 = select i1 %234, i64 4611686018427387904, i64 %235
  %237 = call i8* @nish_alloc_struct(i64 %236)
  %238 = bitcast i8* %237 to i64*
  store i64 %233, i64* %238, align 8
  %239 = getelementptr inbounds i8, i8* %237, i64 8
  store i8* %239, i8** %join.p.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.copy.body.2:
  %240 = load i64, i64* %join.at.2, align 8
  %241 = icmp ult i64 %240, %214
  br i1 %241, label %join.part.2, label %join.end.2

join.part.2:
  %242 = load i8*, i8** %join.p.2, align 8
  %243 = icmp eq i64 %240, 0
  %244 = select i1 %243, i64 0, i64 %216
  %245 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %242, i8* %245, i64 %244, i1 false)
  %246 = getelementptr inbounds i8, i8* %242, i64 %244
  %247 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %212, i64 0, i32 2
  %248 = load i8*, i8** %247, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %249 = bitcast i8* %248 to i8**
  %250 = getelementptr inbounds i8*, i8** %249, i64 %240
  %251 = load i8*, i8** %250, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %252 = bitcast i8* %251 to i64*
  %253 = load i64, i64* %252, align 8
  %254 = getelementptr inbounds i8, i8* %251, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %246, i8* %254, i64 %253, i1 false)
  %255 = getelementptr inbounds i8, i8* %246, i64 %253
  store i8* %255, i8** %join.p.2, align 8
  %256 = add i64 %240, 1
  store i64 %256, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.end.2:
  %257 = load i8*, i8** %join.p.2, align 8
  store i8 0, i8* %257, align 1
  %258 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*), i8* %237)
  %259 = call i64 @nish_arena_mark()
  %260 = call i8* @visible(i8* %258)
  %261 = call i8* @nish_arena_keep(i64 %259, i8* %260)
  call void @nish_print(i8* %261)
  %262 = call i64 @nish_arena_mark()
  %263 = call i8* @nish.Style.bgBrightBlack(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  %264 = call i8* @nish_arena_keep(i64 %262, i8* %263)
  %265 = call i64 @nish_arena_mark()
  %266 = call i8* @nish.Style.bgBrightRed(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.23 to i8*))
  %267 = call i8* @nish_arena_keep(i64 %265, i8* %266)
  %268 = call i64 @nish_arena_mark()
  %269 = call i8* @nish.Style.bgBrightGreen(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.24 to i8*))
  %270 = call i8* @nish_arena_keep(i64 %268, i8* %269)
  %271 = call i64 @nish_arena_mark()
  %272 = call i8* @nish.Style.bgBrightYellow(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %273 = call i8* @nish_arena_keep(i64 %271, i8* %272)
  %274 = call i64 @nish_arena_mark()
  %275 = call i8* @nish.Style.bgBrightBlue(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %276 = call i8* @nish_arena_keep(i64 %274, i8* %275)
  %277 = call i64 @nish_arena_mark()
  %278 = call i8* @nish.Style.bgBrightMagenta(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.27 to i8*))
  %279 = call i8* @nish_arena_keep(i64 %277, i8* %278)
  %280 = call i64 @nish_arena_mark()
  %281 = call i8* @nish.Style.bgBrightCyan(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*))
  %282 = call i8* @nish_arena_keep(i64 %280, i8* %281)
  %283 = call i64 @nish_arena_mark()
  %284 = call i8* @nish.Style.bgBrightWhite(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.29 to i8*))
  %285 = call i8* @nish_arena_keep(i64 %283, i8* %284)
  %286 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %286, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %287 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %287, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %288 = bitcast [8 x i8*]* %arr.data.3 to i8*
  %289 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %288, i8** %289, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %290 = bitcast i8* %288 to i8**
  %291 = getelementptr inbounds i8*, i8** %290, i64 0
  store i8* %264, i8** %291, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %292 = getelementptr inbounds i8*, i8** %290, i64 1
  store i8* %267, i8** %292, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %293 = getelementptr inbounds i8*, i8** %290, i64 2
  store i8* %270, i8** %293, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %294 = getelementptr inbounds i8*, i8** %290, i64 3
  store i8* %273, i8** %294, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %295 = getelementptr inbounds i8*, i8** %290, i64 4
  store i8* %276, i8** %295, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %296 = getelementptr inbounds i8*, i8** %290, i64 5
  store i8* %279, i8** %296, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %297 = getelementptr inbounds i8*, i8** %290, i64 6
  store i8* %282, i8** %297, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %298 = getelementptr inbounds i8*, i8** %290, i64 7
  store i8* %285, i8** %298, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %bgBright.addr, align 8
  %299 = load %struct.nish_array*, %struct.nish_array** %bgBright.addr, align 8
  %300 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %299, i64 0, i32 0
  %301 = load i64, i64* %300, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %302 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
  %303 = load i64, i64* %302, align 8
  %304 = sub i64 %301, 1
  %305 = mul i64 %303, %304
  %306 = icmp eq i64 %301, 0
  %307 = select i1 %306, i64 0, i64 %305
  store i64 %307, i64* %join.total.3, align 8
  store i64 0, i64* %join.at.3, align 8
  br label %join.sum.3

join.sum.3:
  %308 = load i64, i64* %join.at.3, align 8
  %309 = icmp ult i64 %308, %301
  br i1 %309, label %join.sum.body.3, label %join.copy.3

join.sum.body.3:
  %310 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %299, i64 0, i32 2
  %311 = load i8*, i8** %310, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %312 = bitcast i8* %311 to i8**
  %313 = getelementptr inbounds i8*, i8** %312, i64 %308
  %314 = load i8*, i8** %313, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %315 = load i64, i64* %join.total.3, align 8
  %316 = bitcast i8* %314 to i64*
  %317 = load i64, i64* %316, align 8
  %318 = add i64 %315, %317
  store i64 %318, i64* %join.total.3, align 8
  %319 = add i64 %308, 1
  store i64 %319, i64* %join.at.3, align 8
  br label %join.sum.3

join.copy.3:
  %320 = load i64, i64* %join.total.3, align 8
  %321 = icmp ugt i64 %320, 2147483647
  %322 = add i64 %320, 9
  %323 = select i1 %321, i64 4611686018427387904, i64 %322
  %324 = call i8* @nish_alloc_struct(i64 %323)
  %325 = bitcast i8* %324 to i64*
  store i64 %320, i64* %325, align 8
  %326 = getelementptr inbounds i8, i8* %324, i64 8
  store i8* %326, i8** %join.p.3, align 8
  store i64 0, i64* %join.at.3, align 8
  br label %join.copy.body.3

join.copy.body.3:
  %327 = load i64, i64* %join.at.3, align 8
  %328 = icmp ult i64 %327, %301
  br i1 %328, label %join.part.3, label %join.end.3

join.part.3:
  %329 = load i8*, i8** %join.p.3, align 8
  %330 = icmp eq i64 %327, 0
  %331 = select i1 %330, i64 0, i64 %303
  %332 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %329, i8* %332, i64 %331, i1 false)
  %333 = getelementptr inbounds i8, i8* %329, i64 %331
  %334 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %299, i64 0, i32 2
  %335 = load i8*, i8** %334, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %336 = bitcast i8* %335 to i8**
  %337 = getelementptr inbounds i8*, i8** %336, i64 %327
  %338 = load i8*, i8** %337, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %339 = bitcast i8* %338 to i64*
  %340 = load i64, i64* %339, align 8
  %341 = getelementptr inbounds i8, i8* %338, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %333, i8* %341, i64 %340, i1 false)
  %342 = getelementptr inbounds i8, i8* %333, i64 %340
  store i8* %342, i8** %join.p.3, align 8
  %343 = add i64 %327, 1
  store i64 %343, i64* %join.at.3, align 8
  br label %join.copy.body.3

join.end.3:
  %344 = load i8*, i8** %join.p.3, align 8
  store i8 0, i8* %344, align 1
  %345 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.34 to i8*), i8* %324)
  %346 = call i64 @nish_arena_mark()
  %347 = call i8* @visible(i8* %345)
  %348 = call i8* @nish_arena_keep(i64 %346, i8* %347)
  call void @nish_print(i8* %348)
  %349 = call i64 @nish_arena_mark()
  %350 = call i8* @nish.Style.bold(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %351 = call i8* @nish_arena_keep(i64 %349, i8* %350)
  %352 = call i64 @nish_arena_mark()
  %353 = call i8* @nish.Style.faint(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.35 to i8*))
  %354 = call i8* @nish_arena_keep(i64 %352, i8* %353)
  %355 = call i64 @nish_arena_mark()
  %356 = call i8* @nish.Style.italic(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.36 to i8*))
  %357 = call i8* @nish_arena_keep(i64 %355, i8* %356)
  %358 = call i64 @nish_arena_mark()
  %359 = call i8* @nish.Style.underline(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.37 to i8*))
  %360 = call i8* @nish_arena_keep(i64 %358, i8* %359)
  %361 = call i64 @nish_arena_mark()
  %362 = call i8* @nish.Style.inverse(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.38 to i8*))
  %363 = call i8* @nish_arena_keep(i64 %361, i8* %362)
  %364 = call i64 @nish_arena_mark()
  %365 = call i8* @nish.Style.strikethrough(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.39 to i8*))
  %366 = call i8* @nish_arena_keep(i64 %364, i8* %365)
  %367 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 6, i64* %367, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %368 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 6, i64* %368, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %369 = bitcast [6 x i8*]* %arr.data.4 to i8*
  %370 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %369, i8** %370, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %371 = bitcast i8* %369 to i8**
  %372 = getelementptr inbounds i8*, i8** %371, i64 0
  store i8* %351, i8** %372, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %373 = getelementptr inbounds i8*, i8** %371, i64 1
  store i8* %354, i8** %373, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %374 = getelementptr inbounds i8*, i8** %371, i64 2
  store i8* %357, i8** %374, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %375 = getelementptr inbounds i8*, i8** %371, i64 3
  store i8* %360, i8** %375, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %376 = getelementptr inbounds i8*, i8** %371, i64 4
  store i8* %363, i8** %376, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %377 = getelementptr inbounds i8*, i8** %371, i64 5
  store i8* %366, i8** %377, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %attrs.addr, align 8
  %378 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %379 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %378, i64 0, i32 0
  %380 = load i64, i64* %379, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %381 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
  %382 = load i64, i64* %381, align 8
  %383 = sub i64 %380, 1
  %384 = mul i64 %382, %383
  %385 = icmp eq i64 %380, 0
  %386 = select i1 %385, i64 0, i64 %384
  store i64 %386, i64* %join.total.4, align 8
  store i64 0, i64* %join.at.4, align 8
  br label %join.sum.4

join.sum.4:
  %387 = load i64, i64* %join.at.4, align 8
  %388 = icmp ult i64 %387, %380
  br i1 %388, label %join.sum.body.4, label %join.copy.4

join.sum.body.4:
  %389 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %378, i64 0, i32 2
  %390 = load i8*, i8** %389, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %391 = bitcast i8* %390 to i8**
  %392 = getelementptr inbounds i8*, i8** %391, i64 %387
  %393 = load i8*, i8** %392, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %394 = load i64, i64* %join.total.4, align 8
  %395 = bitcast i8* %393 to i64*
  %396 = load i64, i64* %395, align 8
  %397 = add i64 %394, %396
  store i64 %397, i64* %join.total.4, align 8
  %398 = add i64 %387, 1
  store i64 %398, i64* %join.at.4, align 8
  br label %join.sum.4

join.copy.4:
  %399 = load i64, i64* %join.total.4, align 8
  %400 = icmp ugt i64 %399, 2147483647
  %401 = add i64 %399, 9
  %402 = select i1 %400, i64 4611686018427387904, i64 %401
  %403 = call i8* @nish_alloc_struct(i64 %402)
  %404 = bitcast i8* %403 to i64*
  store i64 %399, i64* %404, align 8
  %405 = getelementptr inbounds i8, i8* %403, i64 8
  store i8* %405, i8** %join.p.4, align 8
  store i64 0, i64* %join.at.4, align 8
  br label %join.copy.body.4

join.copy.body.4:
  %406 = load i64, i64* %join.at.4, align 8
  %407 = icmp ult i64 %406, %380
  br i1 %407, label %join.part.4, label %join.end.4

join.part.4:
  %408 = load i8*, i8** %join.p.4, align 8
  %409 = icmp eq i64 %406, 0
  %410 = select i1 %409, i64 0, i64 %382
  %411 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %408, i8* %411, i64 %410, i1 false)
  %412 = getelementptr inbounds i8, i8* %408, i64 %410
  %413 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %378, i64 0, i32 2
  %414 = load i8*, i8** %413, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %415 = bitcast i8* %414 to i8**
  %416 = getelementptr inbounds i8*, i8** %415, i64 %406
  %417 = load i8*, i8** %416, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %418 = bitcast i8* %417 to i64*
  %419 = load i64, i64* %418, align 8
  %420 = getelementptr inbounds i8, i8* %417, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %412, i8* %420, i64 %419, i1 false)
  %421 = getelementptr inbounds i8, i8* %412, i64 %419
  store i8* %421, i8** %join.p.4, align 8
  %422 = add i64 %406, 1
  store i64 %422, i64* %join.at.4, align 8
  br label %join.copy.body.4

join.end.4:
  %423 = load i8*, i8** %join.p.4, align 8
  store i8 0, i8* %423, align 1
  %424 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.40 to i8*), i8* %403)
  %425 = call i64 @nish_arena_mark()
  %426 = call i8* @visible(i8* %424)
  %427 = call i8* @nish_arena_keep(i64 %425, i8* %426)
  call void @nish_print(i8* %427)
  %428 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.43 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.44 to i8*))
  %429 = call i8* @nish_str_concat(i8* %428, i8* bitcast ({ i64, [3 x i8] }* @.str.45 to i8*))
  %430 = call i64 @nish_arena_mark()
  %431 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.42 to i8*), i8* %429)
  %432 = call i8* @nish_arena_keep(i64 %430, i8* %431)
  %433 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.41 to i8*), i8* %432)
  %434 = call i8* @nish_str_concat(i8* %433, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %435 = call i64 @nish_arena_mark()
  %436 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.46 to i8*), i8* bitcast ({ i64, [9 x i8] }* @.str.47 to i8*))
  %437 = call i8* @nish_arena_keep(i64 %435, i8* %436)
  %438 = call i8* @nish_str_concat(i8* %434, i8* %437)
  %439 = call i8* @nish_str_concat(i8* %438, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %440 = call i64 @nish_arena_mark()
  %441 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.48 to i8*), i8* bitcast ({ i64, [15 x i8] }* @.str.49 to i8*))
  %442 = call i8* @nish_arena_keep(i64 %440, i8* %441)
  %443 = call i8* @nish_str_concat(i8* %439, i8* %442)
  %444 = call i64 @nish_arena_mark()
  %445 = call i8* @visible(i8* %443)
  %446 = call i8* @nish_arena_keep(i64 %444, i8* %445)
  call void @nish_print(i8* %446)
  %447 = call i64 @nish_arena_mark()
  %448 = call i8* @nish.Style.red(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.51 to i8*))
  %449 = call i8* @nish_arena_keep(i64 %447, i8* %448)
  %450 = call i64 @nish_arena_mark()
  %451 = call i8* @nish.Style.bold(%struct.Style* %s, i8* %449)
  %452 = call i8* @nish_arena_keep(i64 %450, i8* %451)
  %453 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.50 to i8*), i8* %452)
  %454 = call i8* @nish_str_concat(i8* %453, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %455 = call i64 @nish_arena_mark()
  %456 = call i8* @nish.Style.white(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %457 = call i8* @nish_arena_keep(i64 %455, i8* %456)
  %458 = call i64 @nish_arena_mark()
  %459 = call i8* @nish.Style.bgBlue(%struct.Style* %s, i8* %457)
  %460 = call i8* @nish_arena_keep(i64 %458, i8* %459)
  %461 = call i8* @nish_str_concat(i8* %454, i8* %460)
  %462 = call i8* @nish_str_concat(i8* %461, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %463 = call i64 @nish_arena_mark()
  %464 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.52 to i8*))
  %465 = call i8* @nish_arena_keep(i64 %463, i8* %464)
  %466 = call i8* @nish_str_concat(i8* %462, i8* %465)
  %467 = call i64 @nish_arena_mark()
  %468 = call i8* @visible(i8* %466)
  %469 = call i8* @nish_arena_keep(i64 %467, i8* %468)
  call void @nish_print(i8* %469)
  %470 = call i64 @nish_arena_mark()
  %471 = call i8* @nish.Style.red(%struct.Style* %s, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %472 = call i8* @nish_arena_keep(i64 %470, i8* %471)
  %473 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.53 to i8*), i8* %472)
  %474 = call i8* @nish_str_concat(i8* %473, i8* bitcast ({ i64, [3 x i8] }* @.str.54 to i8*))
  %475 = call i64 @nish_arena_mark()
  %476 = call i8* @nish.Style.bold(%struct.Style* %s, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %477 = call i8* @nish_arena_keep(i64 %475, i8* %476)
  %478 = call i8* @nish_str_concat(i8* %474, i8* %477)
  %479 = call i8* @nish_str_concat(i8* %478, i8* bitcast ({ i64, [3 x i8] }* @.str.54 to i8*))
  %480 = call i64 @nish_arena_mark()
  %481 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.43 to i8*))
  %482 = call i8* @nish_arena_keep(i64 %480, i8* %481)
  %483 = call i8* @nish_str_concat(i8* %479, i8* %482)
  %484 = call i8* @nish_str_concat(i8* %483, i8* bitcast ({ i64, [2 x i8] }* @.str.55 to i8*))
  %485 = call i64 @nish_arena_mark()
  %486 = call i8* @visible(i8* %484)
  %487 = call i8* @nish_arena_keep(i64 %485, i8* %486)
  call void @nish_print(i8* %487)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(88) %struct.Style* @recoloured(i1 noundef zeroext %on, i1 noundef zeroext %colour) #1 {
entry:
  %s.addr = alloca %struct.Style*, align 8
  %0 = call i8* @nish_alloc_struct(i64 88)
  %1 = bitcast i8* %0 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %1, i1 %on, i1 %colour)
  store %struct.Style* %1, %struct.Style** %s.addr, align 8
  %2 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %3 = getelementptr inbounds %struct.Style, %struct.Style* %2, i32 0, i32 2
  store i8* bitcast ({ i64, [5 x i8] }* @.str.56 to i8*), i8** %3, align 8, !tbaa !18
  %4 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %5 = getelementptr inbounds %struct.Style, %struct.Style* %4, i32 0, i32 3
  store i8* bitcast ({ i64, [4 x i8] }* @.str.57 to i8*), i8** %5, align 8, !tbaa !19
  %6 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %7 = getelementptr inbounds %struct.Style, %struct.Style* %6, i32 0, i32 4
  store i8* bitcast ({ i64, [3 x i8] }* @.str.58 to i8*), i8** %7, align 8, !tbaa !20
  %8 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %9 = getelementptr inbounds %struct.Style, %struct.Style* %8, i32 0, i32 5
  store i8* bitcast ({ i64, [2 x i8] }* @.str.59 to i8*), i8** %9, align 8, !tbaa !21
  %10 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %11 = getelementptr inbounds %struct.Style, %struct.Style* %10, i32 0, i32 6
  store i8* bitcast ({ i64, [5 x i8] }* @.str.60 to i8*), i8** %11, align 8, !tbaa !22
  %12 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %13 = getelementptr inbounds %struct.Style, %struct.Style* %12, i32 0, i32 7
  store i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8** %13, align 8, !tbaa !23
  %14 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %15 = getelementptr inbounds %struct.Style, %struct.Style* %14, i32 0, i32 8
  store i8* bitcast ({ i64, [3 x i8] }* @.str.61 to i8*), i8** %15, align 8, !tbaa !24
  %16 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %17 = getelementptr inbounds %struct.Style, %struct.Style* %16, i32 0, i32 9
  store i8* bitcast ({ i64, [2 x i8] }* @.str.62 to i8*), i8** %17, align 8, !tbaa !25
  %18 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %19 = getelementptr inbounds %struct.Style, %struct.Style* %18, i32 0, i32 10
  store i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8** %19, align 8, !tbaa !26
  %20 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %21 = getelementptr inbounds %struct.Style, %struct.Style* %20, i32 0, i32 11
  store i8* bitcast ({ i64, [2 x i8] }* @.str.63 to i8*), i8** %21, align 8, !tbaa !27
  %22 = load %struct.Style*, %struct.Style** %s.addr, align 8
  ret %struct.Style* %22
}

define noundef i32 @nish_main() #0 {
entry:
  %off.addr = alloca %struct.Style*, align 8
  %Style.obj = alloca %struct.Style, align 8
  %mono.addr = alloca %struct.Style*, align 8
  %Style.obj.1 = alloca %struct.Style, align 8
  %theme.addr = alloca %struct.Style*, align 8
  %ruled.addr = alloca %struct.HelpMenu*, align 8
  %HelpMenu.obj = alloca %struct.HelpMenu, align 8
  %Style.obj.2 = alloca %struct.Style, align 8
  %Style.obj.3 = alloca %struct.Style, align 8
  %Style.obj.4 = alloca %struct.Style, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.64 to i8*))
  %0 = call i8* @nish_alloc_struct(i64 88)
  %1 = bitcast i8* %0 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %1, i1 true, i1 true)
  %2 = call i8* @menu(%struct.Style* %1)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @visible(i8* %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.65 to i8*))
  %6 = call i8* @nish_alloc_struct(i64 88)
  %7 = bitcast i8* %6 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %7, i1 true, i1 false)
  %8 = call i8* @menu(%struct.Style* %7)
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @visible(i8* %8)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  call void @nish_print(i8* %11)
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.66 to i8*))
  %12 = call i8* @nish_alloc_struct(i64 88)
  %13 = bitcast i8* %12 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %13, i1 false, i1 true)
  %14 = call i8* @menu(%struct.Style* %13)
  call void @nish_print(i8* %14)
  call void @nish.Style.constructor(%struct.Style* %Style.obj, i1 false, i1 false)
  store %struct.Style* %Style.obj, %struct.Style** %off.addr, align 8
  %15 = load %struct.Style*, %struct.Style** %off.addr, align 8
  %16 = call i64 @nish_arena_mark()
  %17 = call i8* @nish.Style.heading(%struct.Style* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.42 to i8*))
  %18 = call i8* @nish_arena_keep(i64 %16, i8* %17)
  %19 = call zeroext i1 @nish_str_eq(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.42 to i8*))
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load %struct.Style*, %struct.Style** %off.addr, align 8
  %21 = call i64 @nish_arena_mark()
  %22 = call i8* @nish.Style.dim(%struct.Style* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %23 = call i8* @nish_arena_keep(i64 %21, i8* %22)
  %24 = call zeroext i1 @nish_str_eq(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  br label %land.end

land.end:
  %25 = phi i1 [ false, %entry ], [ %24, %land.rhs ]
  %26 = select i1 %25, i8* bitcast ({ i64, [5 x i8] }* @.str.68 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.69 to i8*)
  %27 = call i8* @nish_str_concat(i8* bitcast ({ i64, [21 x i8] }* @.str.67 to i8*), i8* %26)
  call void @nish_print(i8* %27)
  call void @nish.Style.constructor(%struct.Style* %Style.obj.1, i1 true, i1 false)
  store %struct.Style* %Style.obj.1, %struct.Style** %mono.addr, align 8
  %28 = load %struct.Style*, %struct.Style** %mono.addr, align 8
  %29 = call i64 @nish_arena_mark()
  %30 = call i8* @nish.Style.dim(%struct.Style* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.71 to i8*))
  %31 = call i8* @nish_arena_keep(i64 %29, i8* %30)
  %32 = call zeroext i1 @nish_str_eq(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.71 to i8*))
  %33 = select i1 %32, i8* bitcast ({ i64, [5 x i8] }* @.str.68 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.69 to i8*)
  %34 = call i8* @nish_str_concat(i8* bitcast ({ i64, [20 x i8] }* @.str.70 to i8*), i8* %33)
  call void @nish_print(i8* %34)
  %35 = call i8* @nish_alloc_struct(i64 88)
  %36 = bitcast i8* %35 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %36, i1 true, i1 true)
  store %struct.Style* %36, %struct.Style** %theme.addr, align 8
  %37 = load %struct.Style*, %struct.Style** %theme.addr, align 8
  call void @nish.HelpMenu.constructor(%struct.HelpMenu* %HelpMenu.obj, %struct.Style* %37, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i32 24, i32 30)
  store %struct.HelpMenu* %HelpMenu.obj, %struct.HelpMenu** %ruled.addr, align 8
  %38 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  call void @nish.HelpMenu.title(%struct.HelpMenu* %38, i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  %39 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  %40 = load %struct.Style*, %struct.Style** %theme.addr, align 8
  %41 = call i64 @nish_arena_mark()
  %42 = call i8* @nish.Style.dim(%struct.Style* %40, i8* bitcast ({ i64, [24 x i8] }* @.str.72 to i8*))
  %43 = call i8* @nish_arena_keep(i64 %41, i8* %42)
  call void @nish.HelpMenu.line(%struct.HelpMenu* %39, i8* %43)
  %44 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  call void @nish.HelpMenu.line(%struct.HelpMenu* %44, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %45 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  call void @nish.HelpMenu.usage(%struct.HelpMenu* %45, i8* bitcast ({ i64, [7 x i8] }* @.str.73 to i8*), i8* bitcast ({ i64, [14 x i8] }* @.str.6 to i8*))
  %46 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  %47 = call i64 @nish_arena_mark()
  %48 = call i8* @nish.HelpMenu.text(%struct.HelpMenu* %46)
  %49 = call i8* @nish_arena_keep(i64 %47, i8* %48)
  %50 = call i64 @nish_arena_mark()
  %51 = call i8* @visible(i8* %49)
  %52 = call i8* @nish_arena_keep(i64 %50, i8* %51)
  call void @nish_print(i8* %52)
  call void @nish.Style.constructor(%struct.Style* %Style.obj.2, i1 true, i1 true)
  call void @painters(i8* bitcast ({ i64, [15 x i8] }* @.str.74 to i8*), %struct.Style* %Style.obj.2)
  call void @nish.Style.constructor(%struct.Style* %Style.obj.3, i1 true, i1 false)
  call void @painters(i8* bitcast ({ i64, [14 x i8] }* @.str.75 to i8*), %struct.Style* %Style.obj.3)
  call void @nish.Style.constructor(%struct.Style* %Style.obj.4, i1 false, i1 true)
  call void @painters(i8* bitcast ({ i64, [13 x i8] }* @.str.76 to i8*), %struct.Style* %Style.obj.4)
  call void @nish_print(i8* bitcast ({ i64, [18 x i8] }* @.str.77 to i8*))
  %53 = call %struct.Style* @recoloured(i1 true, i1 true)
  %54 = call i8* @menu(%struct.Style* %53)
  %55 = call i64 @nish_arena_mark()
  %56 = call i8* @visible(i8* %54)
  %57 = call i8* @nish_arena_keep(i64 %55, i8* %56)
  call void @nish_print(i8* %57)
  call void @nish_print(i8* bitcast ({ i64, [17 x i8] }* @.str.78 to i8*))
  %58 = call %struct.Style* @recoloured(i1 true, i1 false)
  %59 = call i8* @menu(%struct.Style* %58)
  %60 = call i64 @nish_arena_mark()
  %61 = call i8* @visible(i8* %59)
  %62 = call i8* @nish_arena_keep(i64 %60, i8* %61)
  call void @nish_print(i8* %62)
  %63 = call %struct.Style* @recoloured(i1 false, i1 true)
  %64 = call i8* @menu(%struct.Style* %63)
  %65 = call i8* @nish_alloc_struct(i64 88)
  %66 = bitcast i8* %65 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %66, i1 false, i1 false)
  %67 = call i8* @menu(%struct.Style* %66)
  %68 = call zeroext i1 @nish_str_eq(i8* %64, i8* %67)
  %69 = select i1 %68, i8* bitcast ({ i64, [5 x i8] }* @.str.68 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.69 to i8*)
  %70 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.79 to i8*), i8* %69)
  call void @nish_print(i8* %70)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!28, !29, !30, !31, !32}
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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i1", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"Style", !15, i64 0, !15, i64 1, !16, i64 8, !16, i64 16, !16, i64 24, !16, i64 32, !16, i64 40, !16, i64 48, !16, i64 56, !16, i64 64, !16, i64 72, !16, i64 80}
!18 = !{!17, !16, i64 8}
!19 = !{!17, !16, i64 16}
!20 = !{!17, !16, i64 24}
!21 = !{!17, !16, i64 32}
!22 = !{!17, !16, i64 40}
!23 = !{!17, !16, i64 48}
!24 = !{!17, !16, i64 56}
!25 = !{!17, !16, i64 64}
!26 = !{!17, !16, i64 72}
!27 = !{!17, !16, i64 80}
!28 = !{i32 8, !"cf-protection-branch", i32 1}
!29 = !{i32 8, !"cf-protection-return", i32 1}
!30 = !{i32 8, !"branch-target-enforcement", i32 1}
!31 = !{i32 8, !"sign-return-address", i32 1}
!32 = !{i32 4, !"probe-stack", !"inline-asm"}
