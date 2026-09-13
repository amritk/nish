/**
 * The S2 oracle: `self/parser.ts` against the `typescript` parser
 * (docs/wp14-selfhost.md, milestone S2).
 *
 *   node tests/parser_oracle.js              the whole corpus
 *   node tests/parser_oracle.js <file>...    just those files
 *   node tests/parser_oracle.js --verbose    also list what each skipped file needs
 *
 * The same idea as `tests/lexer_oracle.js`: stage0's parser is the
 * `typescript` package's, so walk its tree, print it in the shape and format
 * `self/dump_ast.ts` prints, and diff. What that tests is not "did it parse"
 * but "did it build the same tree, with the same spans, out of the same
 * pieces" — over every construct the corpus contains, which is every construct
 * the language has.
 *
 * **Skips are the measurement, not a weakness.** Nish-0's grammar is
 * deliberately smaller than TypeScript's: it has no `try`, no arrow function,
 * no generic parameter list, no `as`. A file using one of those is a parse
 * error here and a tree there, so it is skipped and *counted*, and the tally
 * of what the skipped files need is exactly the S2 gate's question about how
 * much grammar is still missing (§4, "The gate at S2"). Today stage0's
 * validator rejects those constructs by name after the `typescript` package
 * has parsed them; for stage1 to give the same message, this parser will have
 * to read them and turn them down itself.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { linkWith, seedForOracle, withoutSeed } from "./self/seed.js";

const root = path.resolve(import.meta.dirname, "..");

/** Byte offset of every UTF-16 index, so the two trees can be compared. */
function byteOffsets(source) {
  const offsets = new Int32Array(source.length + 1);
  let bytes = 0;
  for (let i = 0; i < source.length; i++) {
    offsets[i] = bytes;
    const code = source.codePointAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else {
      bytes += 4;
      offsets[i + 1] = bytes;
      i++;
    }
  }
  offsets[source.length] = bytes;
  return offsets;
}

/**
 * Print the `typescript` tree of `source` in `dump_ast`'s format.
 *
 * The printer is a pair of mutually recursive emitters — one for the node
 * kinds `self/nodes.ts` models, one for the list wrappers — and every
 * unhandled kind raises, which is how a construct Nish-0 has no node for
 * becomes a skip rather than a silent difference.
 */
function printTypeScriptTree(source, sf) {
  const offsets = byteOffsets(source);
  const lines = [];
  const at = (i) => offsets[i];

  const emit = (depth, kind, start, end, extra) => {
    lines.push(`${"  ".repeat(depth)}${kind} ${start} ${end}${extra === undefined ? "" : ` ${extra}`}`);
  };
  const span = (node) => [at(node.getStart(sf)), at(node.end)];
  const unsupported = (node) => {
    const e = new Error(ts.SyntaxKind[node.kind]);
    e.unsupported = ts.SyntaxKind[node.kind];
    throw e;
  };

  /** A list node: its elements' span, or nothing at all when empty. */
  const list = (depth, items, print) => {
    if (items.length === 0) {
      emit(depth, "LIST", 0, 0);
      return;
    }
    emit(depth, "LIST", at(items[0].getStart(sf)), at(items[items.length - 1].end));
    for (const item of items) print(item, depth + 1);
  };
  const empty = (depth) => emit(depth, "EMPTY", 0, 0);
  const optional = (depth, node, print) => (node === undefined ? empty(depth) : print(node, depth));

  const exported = (node) =>
    node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? "+export" : "";

  /** `const` rather than `let`, which Nish spells as a flag on the statement. */
  const isConst = (declarationList) => (declarationList.flags & ts.NodeFlags.Const) !== 0;

  /** The two modifiers stage1's grammar reads on an `enum`; `declare` is not one (WP23). */
  const isEnumModifier = (m) =>
    m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.ConstKeyword;

  const identifier = (node, depth) => {
    const [s, e] = span(node);
    emit(depth, "IDENT", s, e, node.text);
  };

  const type = (node, depth) => {
    const [s, e] = span(node);
    switch (node.kind) {
      case ts.SyntaxKind.NumberKeyword:
      case ts.SyntaxKind.BooleanKeyword:
      case ts.SyntaxKind.StringKeyword:
      case ts.SyntaxKind.VoidKeyword:
      case ts.SyntaxKind.AnyKeyword:
      case ts.SyntaxKind.UnknownKeyword:
      case ts.SyntaxKind.NeverKeyword:
      case ts.SyntaxKind.ObjectKeyword:
      case ts.SyntaxKind.SymbolKeyword:
      case ts.SyntaxKind.BigIntKeyword:
      case ts.SyntaxKind.UndefinedKeyword: {
        emit(depth, "TYPE_REF", s, e, source.slice(node.getStart(sf), node.end));
        emit(depth + 1, "LIST", 0, 0);
        return;
      }
      case ts.SyntaxKind.TypeReference: {
        if (!ts.isIdentifier(node.typeName)) unsupported(node);
        emit(depth, "TYPE_REF", s, e, node.typeName.text);
        list(depth + 1, node.typeArguments ?? [], type);
        return;
      }
      case ts.SyntaxKind.ParenthesizedType:
        emit(depth, "TYPE_PAREN", s, e);
        type(node.type, depth + 1);
        return;
      case ts.SyntaxKind.ArrayType:
        emit(depth, "TYPE_ARRAY", s, e);
        type(node.elementType, depth + 1);
        return;
      // `readonly T[]`. TypeScript models it as a TypeOperator and allows the
      // modifier on nothing else (TS1354), so any other operator here — `keyof`,
      // `unique` — is a type stage1 does not have a node for either.
      case ts.SyntaxKind.TypeOperator:
        if (node.operator !== ts.SyntaxKind.ReadonlyKeyword) unsupported(node);
        emit(depth, "TYPE_READONLY", s, e);
        type(node.type, depth + 1);
        return;
      case ts.SyntaxKind.UnionType:
        emit(depth, "TYPE_UNION", s, e);
        for (const member of node.types) type(member, depth + 1);
        return;
      case ts.SyntaxKind.LiteralType:
        if (node.literal.kind !== ts.SyntaxKind.NullKeyword) unsupported(node);
        emit(depth, "TYPE_NULL", s, e);
        return;
      default:
        unsupported(node);
    }
  };

  const expression = (node, depth) => {
    const [s, e] = span(node);
    switch (node.kind) {
      case ts.SyntaxKind.Identifier:
        emit(depth, "IDENT", s, e, node.text);
        return;
      case ts.SyntaxKind.NumericLiteral:
        emit(depth, "NUMBER", s, e, source.slice(node.getStart(sf), node.end));
        return;
      case ts.SyntaxKind.BigIntLiteral:
        emit(depth, "BIGINT", s, e, source.slice(node.getStart(sf), node.end));
        return;
      case ts.SyntaxKind.StringLiteral:
        emit(depth, "STRING", s, e, `#${Buffer.byteLength(node.text, "utf8")}`);
        return;
      case ts.SyntaxKind.TrueKeyword:
        emit(depth, "TRUE", s, e);
        return;
      case ts.SyntaxKind.FalseKeyword:
        emit(depth, "FALSE", s, e);
        return;
      case ts.SyntaxKind.NullKeyword:
        emit(depth, "NULL", s, e);
        return;
      case ts.SyntaxKind.ThisKeyword:
        emit(depth, "THIS", s, e);
        return;
      case ts.SyntaxKind.SuperKeyword:
        emit(depth, "SUPER", s, e);
        return;
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        emit(depth, "TEMPLATE", s, e);
        emit(depth + 1, "TEMPLATE_TEXT", s, e, `#${Buffer.byteLength(node.text, "utf8")}`);
        return;
      case ts.SyntaxKind.TemplateExpression: {
        emit(depth, "TEMPLATE", s, e);
        const head = node.head;
        emit(
          depth + 1,
          "TEMPLATE_TEXT",
          at(head.getStart(sf)),
          at(head.end),
          `#${Buffer.byteLength(head.text, "utf8")}`
        );
        for (const part of node.templateSpans) {
          expression(part.expression, depth + 1);
          const literal = part.literal;
          emit(
            depth + 1,
            "TEMPLATE_TEXT",
            at(literal.getStart(sf)),
            at(literal.end),
            `#${Buffer.byteLength(literal.text, "utf8")}`
          );
        }
        return;
      }
      case ts.SyntaxKind.ArrayLiteralExpression:
        emit(depth, "ARRAY", s, e);
        for (const element of node.elements) expression(element, depth + 1);
        return;
      case ts.SyntaxKind.ObjectLiteralExpression:
        emit(depth, "OBJECT", s, e);
        for (const property of node.properties) {
          const [ps, pe] = span(property);
          if (ts.isPropertyAssignment(property)) {
            if (!ts.isIdentifier(property.name)) unsupported(property);
            emit(depth + 1, "PROPERTY", ps, pe, property.name.text);
            expression(property.initializer, depth + 2);
          } else if (ts.isShorthandPropertyAssignment(property)) {
            emit(depth + 1, "PROPERTY", ps, pe, property.name.text);
            emit(depth + 2, "IDENT", ps, pe, property.name.text);
          } else {
            unsupported(property);
          }
        }
        return;
      case ts.SyntaxKind.BinaryExpression:
        emit(depth, "BINARY", s, e, ts.tokenToString(node.operatorToken.kind));
        expression(node.left, depth + 1);
        expression(node.right, depth + 1);
        return;
      case ts.SyntaxKind.PrefixUnaryExpression:
        emit(depth, "UNARY+prefix", s, e, ts.tokenToString(node.operator));
        expression(node.operand, depth + 1);
        return;
      case ts.SyntaxKind.PostfixUnaryExpression:
        emit(depth, "UNARY+postfix", s, e, ts.tokenToString(node.operator));
        expression(node.operand, depth + 1);
        return;
      case ts.SyntaxKind.ConditionalExpression:
        emit(depth, "CONDITIONAL", s, e);
        expression(node.condition, depth + 1);
        expression(node.whenTrue, depth + 1);
        expression(node.whenFalse, depth + 1);
        return;
      case ts.SyntaxKind.CallExpression:
        if (node.typeArguments !== undefined || node.questionDotToken !== undefined) unsupported(node);
        emit(depth, "CALL", s, e);
        expression(node.expression, depth + 1);
        list(depth + 1, node.arguments, expression);
        return;
      case ts.SyntaxKind.NewExpression:
        if (!ts.isIdentifier(node.expression)) unsupported(node);
        emit(depth, "NEW", s, e);
        identifier(node.expression, depth + 1);
        list(depth + 1, node.typeArguments ?? [], type);
        list(depth + 1, node.arguments ?? [], expression);
        return;
      case ts.SyntaxKind.PropertyAccessExpression:
        if (node.questionDotToken !== undefined || !ts.isIdentifier(node.name)) unsupported(node);
        emit(depth, "MEMBER", s, e, node.name.text);
        expression(node.expression, depth + 1);
        return;
      case ts.SyntaxKind.ElementAccessExpression:
        if (node.questionDotToken !== undefined) unsupported(node);
        emit(depth, "INDEX", s, e);
        expression(node.expression, depth + 1);
        expression(node.argumentExpression, depth + 1);
        return;
      case ts.SyntaxKind.ParenthesizedExpression:
        emit(depth, "PAREN", s, e);
        expression(node.expression, depth + 1);
        return;
      default:
        unsupported(node);
    }
  };

  const variableDeclaration = (node, depth) => {
    if (!ts.isIdentifier(node.name)) unsupported(node);
    const [s, e] = span(node);
    emit(depth, "VAR_DECL", s, e);
    identifier(node.name, depth + 1);
    optional(depth + 1, node.type, type);
    optional(depth + 1, node.initializer, expression);
  };

  const parameter = (node, depth) => {
    if (!ts.isIdentifier(node.name) || node.dotDotDotToken !== undefined) unsupported(node);
    if (node.questionToken !== undefined || node.initializer !== undefined) unsupported(node);
    const [s, e] = span(node);
    emit(depth, "PARAM", s, e);
    identifier(node.name, depth + 1);
    if (node.type === undefined) unsupported(node);
    type(node.type, depth + 1);
  };

  const block = (node, depth) => {
    const [s, e] = span(node);
    emit(depth, "BLOCK", s, e);
    for (const statement of node.statements) statementOf(node)(statement, depth + 1);
  };
  // `statementOf` exists only so `block` can be defined before `statement`.
  const statementOf = () => statement;

  const statement = (node, depth) => {
    const [s, e] = span(node);
    switch (node.kind) {
      case ts.SyntaxKind.Block:
        block(node, depth);
        return;
      case ts.SyntaxKind.VariableStatement: {
        if (!isConst(node.declarationList)) {
          emit(depth, "VAR", s, e);
        } else {
          emit(depth, "VAR+const", s, e);
        }
        list(depth + 1, node.declarationList.declarations, variableDeclaration);
        return;
      }
      case ts.SyntaxKind.ExpressionStatement:
        emit(depth, "EXPR_STMT", s, e);
        expression(node.expression, depth + 1);
        return;
      case ts.SyntaxKind.IfStatement:
        emit(depth, "IF", s, e);
        expression(node.expression, depth + 1);
        statement(node.thenStatement, depth + 1);
        optional(depth + 1, node.elseStatement, statement);
        return;
      case ts.SyntaxKind.WhileStatement:
        emit(depth, "WHILE", s, e);
        expression(node.expression, depth + 1);
        statement(node.statement, depth + 1);
        return;
      case ts.SyntaxKind.DoStatement:
        emit(depth, "DO", s, e);
        statement(node.statement, depth + 1);
        expression(node.expression, depth + 1);
        return;
      case ts.SyntaxKind.ForStatement: {
        emit(depth, "FOR", s, e);
        if (node.initializer === undefined) empty(depth + 1);
        else if (ts.isVariableDeclarationList(node.initializer)) {
          const [ds, de] = [at(node.initializer.getStart(sf)), at(node.initializer.end)];
          emit(depth + 1, isConst(node.initializer) ? "VAR+const" : "VAR", ds, de);
          list(depth + 2, node.initializer.declarations, variableDeclaration);
        } else expression(node.initializer, depth + 1);
        optional(depth + 1, node.condition, expression);
        optional(depth + 1, node.incrementor, expression);
        statement(node.statement, depth + 1);
        return;
      }
      case ts.SyntaxKind.ForOfStatement: {
        if (node.awaitModifier !== undefined) unsupported(node);
        emit(depth, "FOR_OF", s, e);
        const initializer = node.initializer;
        if (!ts.isVariableDeclarationList(initializer)) unsupported(node);
        emit(
          depth + 1,
          isConst(initializer) ? "VAR+const" : "VAR",
          at(initializer.getStart(sf)),
          at(initializer.end)
        );
        list(depth + 2, initializer.declarations, variableDeclaration);
        expression(node.expression, depth + 1);
        statement(node.statement, depth + 1);
        return;
      }
      case ts.SyntaxKind.BreakStatement:
        if (node.label !== undefined) unsupported(node);
        emit(depth, "BREAK", s, e);
        return;
      case ts.SyntaxKind.ContinueStatement:
        if (node.label !== undefined) unsupported(node);
        emit(depth, "CONTINUE", s, e);
        return;
      case ts.SyntaxKind.ReturnStatement:
        emit(depth, "RETURN", s, e);
        optional(depth + 1, node.expression, expression);
        return;
      case ts.SyntaxKind.ThrowStatement:
        emit(depth, "THROW", s, e);
        expression(node.expression, depth + 1);
        return;
      case ts.SyntaxKind.SwitchStatement: {
        emit(depth, "SWITCH", s, e);
        expression(node.expression, depth + 1);
        list(depth + 1, node.caseBlock.clauses, (clause, clauseDepth) => {
          const [cs, ce] = span(clause);
          if (ts.isCaseClause(clause)) {
            emit(clauseDepth, "CASE", cs, ce);
            expression(clause.expression, clauseDepth + 1);
          } else {
            emit(clauseDepth, "DEFAULT", cs, ce);
          }
          list(clauseDepth + 1, clause.statements, statement);
        });
        return;
      }
      case ts.SyntaxKind.EmptyStatement:
        emit(depth, "EMPTY", s, e);
        return;
      default:
        unsupported(node);
    }
  };

  const declaration = (node, depth) => {
    const [s, e] = span(node);
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration: {
        const clause = node.importClause;
        if (clause === undefined || clause.namedBindings === undefined) unsupported(node);
        if (!ts.isNamedImports(clause.namedBindings)) unsupported(node);
        emit(depth, "IMPORT", s, e, node.moduleSpecifier.text);
        list(depth + 1, clause.namedBindings.elements, (element, elementDepth) => {
          const [es, ee] = span(element);
          emit(elementDepth, "IMPORT_SPEC", es, ee, element.name.text);
          identifier(element.propertyName ?? element.name, elementDepth + 1);
        });
        return;
      }
      case ts.SyntaxKind.FunctionDeclaration: {
        if (node.typeParameters !== undefined || node.asteriskToken !== undefined) unsupported(node);
        if (node.name === undefined || node.body === undefined || node.type === undefined) unsupported(node);
        emit(depth, `FUNCTION${exported(node)}`, s, e);
        identifier(node.name, depth + 1);
        list(depth + 1, node.parameters, parameter);
        type(node.type, depth + 1);
        block(node.body, depth + 1);
        return;
      }
      case ts.SyntaxKind.ClassDeclaration: {
        if (node.typeParameters !== undefined || node.name === undefined) unsupported(node);
        emit(depth, `CLASS${exported(node)}`, s, e);
        identifier(node.name, depth + 1);
        const heritage = node.heritageClauses ?? [];
        const extendsClause = heritage.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword);
        const implementsClause = heritage.find((h) => h.token === ts.SyntaxKind.ImplementsKeyword);
        if (extendsClause === undefined) empty(depth + 1);
        else {
          const base = extendsClause.types[0].expression;
          if (!ts.isIdentifier(base)) unsupported(node);
          identifier(base, depth + 1);
        }
        const implemented = (implementsClause?.types ?? []).map((t) => {
          if (!ts.isIdentifier(t.expression)) unsupported(node);
          return t.expression;
        });
        list(depth + 1, implemented, identifier);
        list(depth + 1, node.members, member);
        return;
      }
      case ts.SyntaxKind.InterfaceDeclaration: {
        if (node.typeParameters !== undefined || node.heritageClauses !== undefined) unsupported(node);
        emit(depth, `INTERFACE${exported(node)}`, s, e);
        identifier(node.name, depth + 1);
        list(depth + 1, node.members, (m, d) => {
          if (!ts.isPropertySignature(m) || !ts.isIdentifier(m.name) || m.type === undefined) unsupported(m);
          if (m.questionToken !== undefined) unsupported(m);
          const [ms, me] = span(m);
          emit(d, "FIELD", ms, me);
          identifier(m.name, d + 1);
          type(m.type, d + 1);
          empty(d + 1);
        });
        return;
      }
      // `type X = T;` (WP23). An alias is a declaration in stage1's tree and a
      // type in its right-hand child, which is exactly TypeScript's shape.
      case ts.SyntaxKind.TypeAliasDeclaration: {
        if (node.typeParameters !== undefined) unsupported(node);
        emit(depth, `TYPE_ALIAS${exported(node)}`, s, e);
        identifier(node.name, depth + 1);
        type(node.type, depth + 1);
        return;
      }
      // `enum X { A = 1, B }` (WP23). stage1 reads the members as a LIST of
      // ENUM_MEMBER, each one a name and an initialiser that is EMPTY when the
      // member is auto-numbered — which is TypeScript's shape flattened.
      // `const enum` is read too, and refused by the checker rather than the
      // grammar, so the `const` is a flag here exactly as it is on a module
      // constant; `declare enum` is the parser's to refuse and is skipped.
      case ts.SyntaxKind.EnumDeclaration: {
        const modifiers = node.modifiers ?? [];
        if (modifiers.some((m) => !isEnumModifier(m))) unsupported(node);
        const constEnum = modifiers.some((m) => m.kind === ts.SyntaxKind.ConstKeyword) ? "+const" : "";
        emit(depth, `ENUM${exported(node)}${constEnum}`, s, e);
        identifier(node.name, depth + 1);
        list(depth + 1, node.members, (m, d) => {
          if (!ts.isIdentifier(m.name)) unsupported(m);
          const [ms, me] = span(m);
          emit(d, "ENUM_MEMBER", ms, me);
          identifier(m.name, d + 1);
          if (m.initializer !== undefined) expression(m.initializer, d + 1);
          else empty(d + 1);
        });
        return;
      }
      case ts.SyntaxKind.VariableStatement: {
        if (!isConst(node.declarationList)) unsupported(node);
        // A module-level `const` bound to an arrow declares a *function*
        // (docs/wp22-arrow-functions.md), and stage1's parser builds the same
        // `N_FUNCTION` it builds for the `function` spelling -- so this side
        // normalises the same way. It is the one place the oracle reshapes a
        // `typescript` tree rather than transcribing it, and it does so
        // because the language says the two spellings declare one thing.
        const single = node.declarationList.declarations;
        const arrow =
          single.length === 1 && single[0].initializer !== undefined && ts.isArrowFunction(single[0].initializer)
            ? single[0].initializer
            : undefined;
        if (arrow !== undefined) {
          if (arrow.typeParameters !== undefined || arrow.type === undefined) unsupported(node);
          if (single[0].type !== undefined || !ts.isIdentifier(single[0].name)) unsupported(node);
          emit(depth, `FUNCTION${exported(node)}`, s, e);
          identifier(single[0].name, depth + 1);
          list(depth + 1, arrow.parameters, parameter);
          type(arrow.type, depth + 1);
          // The body child is the block, or the expression a concise body
          // returns -- exactly what stage1 puts there.
          if (ts.isBlock(arrow.body)) block(arrow.body, depth + 1);
          else expression(arrow.body, depth + 1);
          return;
        }
        emit(depth, `MODULE_CONST${exported(node)}+const`, s, e);
        list(depth + 1, node.declarationList.declarations, variableDeclaration);
        return;
      }
      default:
        unsupported(node);
    }
  };

  /**
   * `readonly` is recorded; `public`, `private` and `protected` are accepted
   * and ignored, as Nish does (docs/LANGUAGE.md, Classes). Anything else
   * — `static`, `abstract`, `async`, `declare` — is a construct the language
   * does not have, so the file is skipped and counted.
   */
  const memberFlags = (node) => {
    let readonly = false;
    for (const modifier of node.modifiers ?? []) {
      if (modifier.kind === ts.SyntaxKind.ReadonlyKeyword) readonly = true;
      else if (
        modifier.kind !== ts.SyntaxKind.PublicKeyword &&
        modifier.kind !== ts.SyntaxKind.PrivateKeyword &&
        modifier.kind !== ts.SyntaxKind.ProtectedKeyword
      ) {
        unsupported(modifier);
      }
    }
    return readonly ? "+readonly" : "";
  };

  const member = (node, depth) => {
    const [s, e] = span(node);
    if (ts.isPropertyDeclaration(node)) {
      if (!ts.isIdentifier(node.name) || node.type === undefined) unsupported(node);
      if (node.questionToken !== undefined) unsupported(node);
      emit(depth, `FIELD${memberFlags(node)}`, s, e);
      identifier(node.name, depth + 1);
      type(node.type, depth + 1);
      optional(depth + 1, node.initializer, expression);
      return;
    }
    if (ts.isMethodDeclaration(node)) {
      if (!ts.isIdentifier(node.name) || node.body === undefined || node.type === undefined)
        unsupported(node);
      if (node.typeParameters !== undefined) unsupported(node);
      memberFlags(node);
      emit(depth, "METHOD", s, e);
      identifier(node.name, depth + 1);
      list(depth + 1, node.parameters, parameter);
      type(node.type, depth + 1);
      block(node.body, depth + 1);
      return;
    }
    if (ts.isConstructorDeclaration(node)) {
      if (node.body === undefined) unsupported(node);
      memberFlags(node);
      emit(depth, "CONSTRUCTOR", s, e);
      list(depth + 1, node.parameters, parameter);
      block(node.body, depth + 1);
      return;
    }
    unsupported(node);
  };

  emit(0, "SOURCE_FILE", 0, Buffer.byteLength(source, "utf8"));
  for (const node of sf.statements) declaration(node, 1);
  return lines;
}

function compare(binary, file) {
  const source = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  if (sf.parseDiagnostics !== undefined && sf.parseDiagnostics.length > 0) {
    return { skipped: `typescript reports a syntax error` };
  }
  let want;
  try {
    want = printTypeScriptTree(source, sf);
  } catch (err) {
    if (err.unsupported === undefined) throw err;
    return { skipped: `needs ${err.unsupported}` };
  }
  const run = spawnSync(binary, [file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) {
    const first = run.stderr.trim().split("\n")[0] ?? "";
    return { skipped: `parser: ${first.replace(/^.*?:\d+:\d+: [a-z ]+: /, "")}` };
  }
  const ours = run.stdout.split("\n").filter((l) => l.length > 0);
  for (let i = 0; i < Math.max(ours.length, want.length); i++) {
    if (ours[i] !== want[i]) {
      return {
        failed: `line ${i + 1}: ours \`${ours[i] ?? "<end>"}\`, typescript \`${want[i] ?? "<end>"}\``,
      };
    }
  }
  return { nodes: want.length };
}

function corpus() {
  const files = [];
  const dirs = [
    path.join(root, "tests", "cases"),
    path.join(root, "examples"),
    path.join(root, "self"),
    path.join(root, "tests", "differential", "corpus"),
    path.join(root, "docs", "cookbook"),
    path.join(root, "bench"),
    path.join(root, "tests", "parser"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      // `recovery.ts` is the one fixture the oracle cannot judge: the
      // `typescript` parser recovers from a syntax error and this one reports
      // and moves on, so it has a golden of its own in `tests/run.js`.
      if (name.endsWith(".ts") && name !== "recovery.ts") files.push(path.join(dir, name));
    }
  }
  return files;
}

/**
 * `self/dump_ast.ts`, linked by the seed rather than by stage0 (WP19 G2.3):
 * what this oracle compares against is the `typescript` parser, which outlives
 * `src/`, so the compiler that builds its subject has to as well.
 */
function build(seed) {
  return linkWith(seed, path.join("self", "dump_ast.ts"), path.join(root, "build", "self", "dump_ast"));
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const files = withoutSeed(argv).filter((a) => !a.startsWith("--"));
  const seed = seedForOracle(argv);
  if (seed.error !== undefined) {
    process.stderr.write(`${seed.error}\n`);
    return 1;
  }
  const binary = build(seed);
  if (binary === null) return 1;
  const inputs = files.length > 0 ? files.map((f) => path.resolve(f)) : corpus();
  let agreed = 0;
  let nodes = 0;
  const skipped = [];
  const failed = [];
  const reasons = new Map();
  for (const file of inputs) {
    const result = compare(binary, file);
    const name = path.relative(root, file);
    if (result.skipped !== undefined) {
      skipped.push(`${name}: ${result.skipped}`);
      reasons.set(result.skipped, (reasons.get(result.skipped) ?? 0) + 1);
    } else if (result.failed !== undefined) failed.push(`${name}: ${result.failed}`);
    else {
      agreed++;
      nodes += result.nodes;
    }
  }
  for (const f of failed) process.stdout.write(`  FAIL ${f}\n`);
  if (verbose) {
    for (const s of skipped) process.stdout.write(`  skip ${s}\n`);
    const ranked = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
    for (const [reason, count] of ranked) process.stdout.write(`  ${String(count).padStart(4)}  ${reason}\n`);
  }
  process.stdout.write(
    `${agreed}/${inputs.length - skipped.length} files agree (${nodes} nodes), ` +
      `${skipped.length} skipped, seed ${seed.label}\n`
  );
  return failed.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { printTypeScriptTree, compare, corpus, build };
