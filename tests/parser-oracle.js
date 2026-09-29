/**
 * The S2 oracle: `src/parser.ts` against the `typescript` parser
 * (docs/wp14-selfhost.md, milestone S2).
 *
 *   node tests/parser-oracle.js              the whole corpus
 *   node tests/parser-oracle.js <file>...    just those files
 *   node tests/parser-oracle.js --verbose    also list what each skipped file needs
 *
 * The same idea as `tests/lexer-oracle.js`: stage0's parser is the
 * `typescript` package's, so walk its tree, print it in the shape and format
 * `src/dump-ast.ts` prints, and diff. What that tests is not "did it parse"
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
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import ts from "typescript"
import { fileURLToPath } from "node:url"
import { seedWithoutStage0 } from "./self/goldens.js"
import { linkWith, namedSeedSpec, withoutSeed } from "./self/seed.js"

const root = path.resolve(import.meta.dirname, "..")

/** Byte offset of every UTF-16 index, so the two trees can be compared. */
const byteOffsets = (source) => {
  const offsets = new Int32Array(source.length + 1)
  let bytes = 0
  for (let i = 0; i < source.length; i++) {
    offsets[i] = bytes
    const code = source.codePointAt(i)
    if (code < 0x80) {
      bytes += 1
    } else if (code < 0x800) {
      bytes += 2
    } else if (code < 0x10000) {
      bytes += 3
    } else {
      bytes += 4
      offsets[i + 1] = bytes
      i++
    }
  }
  offsets[source.length] = bytes
  return offsets
}

/**
 * Print the `typescript` tree of `source` in `dump_ast`'s format.
 *
 * The printer is a pair of mutually recursive emitters — one for the node
 * kinds `src/nodes.ts` models, one for the list wrappers — and every
 * unhandled kind raises, which is how a construct Nish-0 has no node for
 * becomes a skip rather than a silent difference.
 */
const printTypeScriptTree = (source, sf) => {
  const offsets = byteOffsets(source)
  const lines = []
  const at = (i) => offsets[i]

  const emit = (depth, kind, start, end, extra) => {
    lines.push(`${"  ".repeat(depth)}${kind} ${start} ${end}${extra === undefined ? "" : ` ${extra}`}`)
  }
  // A decorated node starts after its decorators in stage1's tree, where each
  // decorator is a DECORATOR around the rest (`decorated`), so its start is
  // recorded here and read in place of the `typescript` node's own.
  const startAfterDecorators = new Map()
  const span = (node) => [at(startAfterDecorators.get(node) ?? node.getStart(sf)), at(node.end)]
  const unsupported = (node) => {
    const e = new Error(ts.SyntaxKind[node.kind])
    e.unsupported = ts.SyntaxKind[node.kind]
    throw e
  }

  /** A list node: its elements' span, or nothing at all when empty. */
  const list = (depth, items, print) => {
    if (items.length === 0) {
      emit(depth, "LIST", 0, 0)
      return
    }
    emit(depth, "LIST", at(items[0].getStart(sf)), at(items[items.length - 1].end))
    for (const item of items) {
      print(item, depth + 1)
    }
  }
  const empty = (depth) => emit(depth, "EMPTY", 0, 0)
  const optional = (depth, node, print) => (node === undefined ? empty(depth) : print(node, depth))

  const exported = (node) =>
    node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? "+export" : ""

  /** `const` rather than `let`, which Nish spells as a flag on the statement. */
  const isConst = (declarationList) => (declarationList.flags & ts.NodeFlags.Const) !== 0

  /**
   * The statement's kind with its flags. `using` (WP29 P2) is `NodeFlags.Using`
   * here, which does not carry the `Const` bit; Nish flags it `const` as well,
   * because the binding cannot be reassigned, and prints both. `await using`
   * is a construct the language does not have.
   */
  const varKind = (declarationList) => {
    const flags = declarationList.flags & ts.NodeFlags.BlockScoped
    if (flags === ts.NodeFlags.AwaitUsing) {
      unsupported(declarationList)
    }
    if (flags === ts.NodeFlags.Using) {
      return "VAR+const+using"
    }
    return `VAR${letFlags(declarationList)}`
  }

  /**
   * What a `const`, `let` or `var` list prints after its kind. `var` is a flag
   * stage1 parses for Phase 0 to refuse (WP33 R1, `src/nodes.ts`), and it is
   * printed so that it is compared.
   */
  const letFlags = (declarationList) => {
    if (isConst(declarationList)) {
      return "+const"
    }
    return (declarationList.flags & ts.NodeFlags.BlockScoped) === 0 ? "+var" : ""
  }

  /** The declaration a `for` or `for...of` head holds: its VAR, then its list. */
  const declarationHead = (declarationList, depth) => {
    emit(depth, `VAR${letFlags(declarationList)}`, at(declarationList.getStart(sf)), at(declarationList.end))
    list(depth + 1, declarationList.declarations, variableDeclaration)
  }

  /**
   * `[Symbol.dispose]`, the one computed member name Nish parses (WP29 P2),
   * which it keeps as a name spelled with its brackets.
   */
  const isDisposeName = (name) =>
    ts.isComputedPropertyName(name) &&
    ts.isPropertyAccessExpression(name.expression) &&
    ts.isIdentifier(name.expression.expression) &&
    name.expression.expression.text === "Symbol" &&
    name.expression.name.text === "dispose"

  /** The two modifiers stage1's grammar reads on an `enum`; `declare` is not one (WP23). */
  const isEnumModifier = (m) =>
    m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.ConstKeyword

  const identifier = (node, depth) => {
    const [s, e] = span(node)
    emit(depth, "IDENT", s, e, node.text)
  }

  /**
   * `async` and the `*` of a generator, which stage1 parses into flags for
   * Phase 0 to refuse (NL1015, NL1044), in `kindWithFlags`'s order.
   */
  const functionFlags = (node) =>
    `${node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ? "+async" : ""}${
      node.asteriskToken === undefined ? "" : "+generator"
    }`

  /**
   * The decorators in front of `node` (NL1006): stage1 reads each as a
   * DECORATOR whose children are its expression and what it decorates, the
   * next decorator or the node itself, which starts after the last of them.
   * Answers the depth the node itself is printed at.
   */
  const decorated = (node, depth) => {
    const decorators = ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []
    if (decorators.length === 0) {
      return depth
    }
    const end = at(node.end)
    decorators.forEach((d, i) => {
      emit(depth + i, "DECORATOR", i === 0 ? at(node.getStart(sf)) : at(d.getStart(sf)), end)
      expression(d.expression, depth + i + 1)
    })
    startAfterDecorators.set(node, ts.skipTrivia(source, decorators[decorators.length - 1].end))
    return depth + decorators.length
  }

  // WP29: a function type and an arrow need printers declared further down;
  // the indirection is `statementOf`'s, for the same reason.
  const parameterOf = () => parameter
  const arrowParameterOf = () => arrowParameter
  const blockOf = () => block

  const type = (node, depth) => {
    const [s, e] = span(node)
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
        emit(depth, "TYPE_REF", s, e, source.slice(node.getStart(sf), node.end))
        emit(depth + 1, "LIST", 0, 0)
        return
      }
      case ts.SyntaxKind.TypeReference: {
        if (!ts.isIdentifier(node.typeName)) {
          unsupported(node)
        }
        emit(depth, "TYPE_REF", s, e, node.typeName.text)
        list(depth + 1, node.typeArguments ?? [], type)
        return
      }
      case ts.SyntaxKind.ParenthesizedType:
        emit(depth, "TYPE_PAREN", s, e)
        type(node.type, depth + 1)
        return
      case ts.SyntaxKind.ArrayType:
        emit(depth, "TYPE_ARRAY", s, e)
        type(node.elementType, depth + 1)
        return
      // `readonly T[]`. TypeScript models it as a TypeOperator and allows the
      // modifier on nothing else (TS1354), so any other operator here — `keyof`,
      // `unique` — is a type stage1 does not have a node for either.
      case ts.SyntaxKind.TypeOperator:
        // `keyof T` is read too, for the checker to refuse (NL2038); `unique`
        // is a type stage1 has no node for.
        if (node.operator === ts.SyntaxKind.KeyOfKeyword) {
          emit(depth, "TYPE_OPERATOR", s, e, "keyof")
          type(node.type, depth + 1)
          return
        }
        if (node.operator !== ts.SyntaxKind.ReadonlyKeyword) {
          unsupported(node)
        }
        emit(depth, "TYPE_READONLY", s, e)
        type(node.type, depth + 1)
        return
      case ts.SyntaxKind.UnionType:
        emit(depth, "TYPE_UNION", s, e)
        for (const member of node.types) {
          type(member, depth + 1)
        }
        return
      case ts.SyntaxKind.LiteralType:
        // WP31 §4: a numeric literal type, the bound of `integer<Lo, Hi>`. The
        // `typescript` parser reads `-5` as a prefix minus over the literal,
        // and stage1 as one node whose text keeps the sign.
        if (node.literal.kind === ts.SyntaxKind.NumericLiteral) {
          emit(depth, "TYPE_LITERAL", s, e, node.literal.getText(sf))
          return
        }
        if (
          ts.isPrefixUnaryExpression(node.literal) &&
          node.literal.operator === ts.SyntaxKind.MinusToken &&
          ts.isNumericLiteral(node.literal.operand)
        ) {
          emit(depth, "TYPE_LITERAL", s, e, `-${node.literal.operand.getText(sf)}`)
          return
        }
        if (node.literal.kind !== ts.SyntaxKind.NullKeyword) {
          unsupported(node)
        }
        emit(depth, "TYPE_NULL", s, e)
        return
      // WP29: `(x: T) => U`, the type of a compile-time function parameter.
      // `parameterOf` rather than `parameter`, because `parameter` is declared
      // below this printer and a `const` is not hoisted.
      case ts.SyntaxKind.FunctionType:
        if (node.typeParameters !== undefined) {
          unsupported(node)
        }
        emit(depth, "TYPE_FUNCTION", s, e)
        list(depth + 1, node.parameters, parameterOf())
        type(node.type, depth + 1)
        return
      default:
        unsupported(node)
    }
  }

  /** `x as T`, `<T>x` and `x satisfies T`: one N_AS, the expression and then the type. */
  const assertion = (node, depth, kind) => {
    const [s, e] = span(node)
    emit(depth, kind, s, e)
    expressionOf()(node.expression, depth + 1)
    type(node.type, depth + 1)
  }
  // `expression` is declared below `assertion`, and a `const` is not hoisted.
  const expressionOf = () => expression

  /** `+optional` for the link of a chain written with `?.` (FLAG_OPTIONAL). */
  const optionalChain = (node) => (node.questionDotToken === undefined ? "" : "+optional")

  const expression = (node, depth) => {
    const [s, e] = span(node)
    switch (node.kind) {
      case ts.SyntaxKind.Identifier:
        emit(depth, "IDENT", s, e, node.text)
        return
      case ts.SyntaxKind.NumericLiteral:
        // As written, less its separators: the parser drops them
        // (`withoutSeparators` in src/lexer.ts), and the lexer has already
        // refused one anywhere but between two digits.
        emit(depth, "NUMBER", s, e, source.slice(node.getStart(sf), node.end).replaceAll("_", ""))
        return
      case ts.SyntaxKind.BigIntLiteral:
        emit(depth, "BIGINT", s, e, source.slice(node.getStart(sf), node.end))
        return
      case ts.SyntaxKind.StringLiteral:
        emit(depth, "STRING", s, e, `#${Buffer.byteLength(node.text, "utf8")}`)
        return
      case ts.SyntaxKind.TrueKeyword:
        emit(depth, "TRUE", s, e)
        return
      case ts.SyntaxKind.FalseKeyword:
        emit(depth, "FALSE", s, e)
        return
      case ts.SyntaxKind.NullKeyword:
        emit(depth, "NULL", s, e)
        return
      case ts.SyntaxKind.ThisKeyword:
        emit(depth, "THIS", s, e)
        return
      case ts.SyntaxKind.SuperKeyword:
        emit(depth, "SUPER", s, e)
        return
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        emit(depth, "TEMPLATE", s, e)
        emit(depth + 1, "TEMPLATE_TEXT", s, e, `#${Buffer.byteLength(node.text, "utf8")}`)
        return
      case ts.SyntaxKind.TemplateExpression: {
        emit(depth, "TEMPLATE", s, e)
        const head = node.head
        emit(
          depth + 1,
          "TEMPLATE_TEXT",
          at(head.getStart(sf)),
          at(head.end),
          `#${Buffer.byteLength(head.text, "utf8")}`
        )
        for (const part of node.templateSpans) {
          expression(part.expression, depth + 1)
          const literal = part.literal
          emit(
            depth + 1,
            "TEMPLATE_TEXT",
            at(literal.getStart(sf)),
            at(literal.end),
            `#${Buffer.byteLength(literal.text, "utf8")}`
          )
        }
        return
      }
      case ts.SyntaxKind.ArrayLiteralExpression:
        emit(depth, "ARRAY", s, e)
        for (const element of node.elements) {
          expression(element, depth + 1)
        }
        return
      // WP33 R1: the forbidden expressions stage1 parses for the phase that
      // owns each rule to refuse (`src/nodes.ts`). A hole is an EMPTY element.
      case ts.SyntaxKind.OmittedExpression:
        empty(depth)
        return
      case ts.SyntaxKind.SpreadElement:
        emit(depth, "SPREAD", s, e)
        expression(node.expression, depth + 1)
        return
      case ts.SyntaxKind.RegularExpressionLiteral:
        emit(depth, "REGEX", s, e, node.text)
        return
      // The keyword of a dynamic `import(...)`, which stage1 reads as a name.
      case ts.SyntaxKind.ImportKeyword:
        emit(depth, "IDENT", s, e, "import")
        return
      // `typeof`, `void`, `delete`, `await` and `yield` are prefix operators
      // there, whose text is the word.
      case ts.SyntaxKind.TypeOfExpression:
      case ts.SyntaxKind.VoidExpression:
      case ts.SyntaxKind.DeleteExpression:
      case ts.SyntaxKind.AwaitExpression:
      case ts.SyntaxKind.YieldExpression:
        if (node.expression === undefined || node.asteriskToken !== undefined) {
          unsupported(node)
        }
        emit(depth, "UNARY+prefix", s, e, source.slice(node.getStart(sf)).match(/^[a-z]+/)[0])
        expression(node.expression, depth + 1)
        return
      case ts.SyntaxKind.AsExpression:
        assertion(node, depth, "AS")
        return
      case ts.SyntaxKind.TypeAssertionExpression:
        assertion(node, depth, "AS+angle")
        return
      case ts.SyntaxKind.SatisfiesExpression:
        assertion(node, depth, "AS+satisfies")
        return
      case ts.SyntaxKind.ObjectLiteralExpression:
        emit(depth, "OBJECT", s, e)
        for (const property of node.properties) {
          const [ps, pe] = span(property)
          if (ts.isPropertyAssignment(property)) {
            if (!ts.isIdentifier(property.name)) {
              unsupported(property)
            }
            emit(depth + 1, "PROPERTY", ps, pe, property.name.text)
            expression(property.initializer, depth + 2)
          } else if (ts.isShorthandPropertyAssignment(property)) {
            emit(depth + 1, "PROPERTY", ps, pe, property.name.text)
            emit(depth + 2, "IDENT", ps, pe, property.name.text)
          } else {
            unsupported(property)
          }
        }
        return
      case ts.SyntaxKind.BinaryExpression:
        emit(depth, "BINARY", s, e, ts.tokenToString(node.operatorToken.kind))
        expression(node.left, depth + 1)
        expression(node.right, depth + 1)
        return
      case ts.SyntaxKind.PrefixUnaryExpression:
        emit(depth, "UNARY+prefix", s, e, ts.tokenToString(node.operator))
        expression(node.operand, depth + 1)
        return
      case ts.SyntaxKind.PostfixUnaryExpression:
        emit(depth, "UNARY+postfix", s, e, ts.tokenToString(node.operator))
        expression(node.operand, depth + 1)
        return
      case ts.SyntaxKind.ConditionalExpression:
        emit(depth, "CONDITIONAL", s, e)
        expression(node.condition, depth + 1)
        expression(node.whenTrue, depth + 1)
        expression(node.whenFalse, depth + 1)
        return
      // `?.` is the member, element or call it precedes, flagged `+optional`.
      case ts.SyntaxKind.CallExpression:
        if (node.typeArguments !== undefined) {
          unsupported(node)
        }
        emit(depth, `CALL${optionalChain(node)}`, s, e)
        expression(node.expression, depth + 1)
        list(depth + 1, node.arguments, expression)
        return
      // A callee that is not a name is read as the expression it is, for the
      // checker to refuse (NL2144).
      case ts.SyntaxKind.NewExpression:
        emit(depth, "NEW", s, e)
        expression(node.expression, depth + 1)
        list(depth + 1, node.typeArguments ?? [], type)
        list(depth + 1, node.arguments ?? [], expression)
        return
      case ts.SyntaxKind.PropertyAccessExpression:
        if (!ts.isIdentifier(node.name)) {
          unsupported(node)
        }
        emit(depth, `MEMBER${optionalChain(node)}`, s, e, node.name.text)
        expression(node.expression, depth + 1)
        return
      case ts.SyntaxKind.ElementAccessExpression:
        emit(depth, `INDEX${optionalChain(node)}`, s, e)
        expression(node.expression, depth + 1)
        expression(node.argumentExpression, depth + 1)
        return
      case ts.SyntaxKind.ParenthesizedExpression:
        emit(depth, "PAREN", s, e)
        expression(node.expression, depth + 1)
        return
      // WP29: an arrow written as an argument. stage1 shapes it like its
      // `N_FUNCTION` — an absent name first, the type parameters last — and a
      // parameter's type and the return type may both be left out.
      case ts.SyntaxKind.ArrowFunction:
        if (
          node.typeParameters !== undefined ||
          node.modifiers?.some((m) => m.kind !== ts.SyntaxKind.AsyncKeyword)
        ) {
          unsupported(node)
        }
        emit(depth, `ARROW${functionFlags(node)}`, s, e)
        empty(depth + 1)
        list(depth + 1, node.parameters, arrowParameterOf())
        optional(depth + 1, node.type, type)
        if (ts.isBlock(node.body)) {
          blockOf()(node.body, depth + 1)
        } else {
          expression(node.body, depth + 1)
        }
        list(depth + 1, [], identifier)
        return
      default:
        unsupported(node)
    }
  }

  const variableDeclaration = (node, depth) => {
    if (!ts.isIdentifier(node.name)) {
      unsupported(node)
    }
    const [s, e] = span(node)
    emit(depth, "VAR_DECL", s, e)
    identifier(node.name, depth + 1)
    optional(depth + 1, node.type, type)
    optional(depth + 1, node.initializer, expression)
  }

  /**
   * WP18: the `<T, U>` of a generic function, as the fifth child of stage1's
   * `N_FUNCTION` — a `LIST` of plain identifiers, empty when there are none.
   * A constrained parameter is an unsupported construct for this oracle. A
   * default is read and dropped, and the identifier flagged, for the checker
   * to refuse (NL2292).
   */
  const typeParameters = (params, depth) => {
    for (const p of params ?? []) {
      if (p.constraint !== undefined) {
        unsupported(p)
      }
    }
    list(
      depth,
      (params ?? []).map((p) => p.name),
      (name, d) => {
        const [ns, ne] = span(name)
        emit(d, `IDENT${name.parent.default === undefined ? "" : "+default"}`, ns, ne, name.text)
      }
    )
  }

  const parameter = (node, parameterDepth) => {
    if (!ts.isIdentifier(node.name) || node.dotDotDotToken !== undefined) {
      unsupported(node)
    }
    if (node.questionToken !== undefined || node.initializer !== undefined) {
      unsupported(node)
    }
    const depth = decorated(node, parameterDepth)
    const [s, e] = span(node)
    emit(depth, "PARAM", s, e)
    identifier(node.name, depth + 1)
    if (node.type === undefined) {
      unsupported(node)
    }
    type(node.type, depth + 1)
  }
  // An arrow argument's parameter may leave its type out (WP29).
  const arrowParameter = (node, depth) => {
    if (!ts.isIdentifier(node.name) || node.dotDotDotToken !== undefined) {
      unsupported(node)
    }
    if (node.questionToken !== undefined || node.initializer !== undefined) {
      unsupported(node)
    }
    const [s, e] = span(node)
    emit(depth, "PARAM", s, e)
    identifier(node.name, depth + 1)
    optional(depth + 1, node.type, type)
  }

  const block = (node, depth) => {
    const [s, e] = span(node)
    emit(depth, "BLOCK", s, e)
    for (const statement of node.statements) {
      statementOf(node)(statement, depth + 1)
    }
  }
  // `statementOf` exists only so `block` can be defined before `statement`.
  const statementOf = () => statement

  const statement = (node, depth) => {
    const [s, e] = span(node)
    switch (node.kind) {
      case ts.SyntaxKind.Block:
        block(node, depth)
        return
      case ts.SyntaxKind.VariableStatement: {
        emit(depth, varKind(node.declarationList), s, e)
        list(depth + 1, node.declarationList.declarations, variableDeclaration)
        return
      }
      case ts.SyntaxKind.ExpressionStatement:
        emit(depth, "EXPR_STMT", s, e)
        expression(node.expression, depth + 1)
        return
      case ts.SyntaxKind.IfStatement:
        emit(depth, "IF", s, e)
        expression(node.expression, depth + 1)
        statement(node.thenStatement, depth + 1)
        optional(depth + 1, node.elseStatement, statement)
        return
      case ts.SyntaxKind.WhileStatement:
        emit(depth, "WHILE", s, e)
        expression(node.expression, depth + 1)
        statement(node.statement, depth + 1)
        return
      case ts.SyntaxKind.DoStatement:
        emit(depth, "DO", s, e)
        statement(node.statement, depth + 1)
        expression(node.expression, depth + 1)
        return
      case ts.SyntaxKind.ForStatement: {
        emit(depth, "FOR", s, e)
        if (node.initializer === undefined) {
          empty(depth + 1)
        } else if (ts.isVariableDeclarationList(node.initializer)) {
          declarationHead(node.initializer, depth + 1)
        } else {
          expression(node.initializer, depth + 1)
        }
        optional(depth + 1, node.condition, expression)
        optional(depth + 1, node.incrementor, expression)
        statement(node.statement, depth + 1)
        return
      }
      // `for...in`, `for await` and a head that assigns rather than declares
      // are the same FOR_OF with a flag or an expression for a head, for the
      // phase that owns each rule to refuse (WP33 R1, `src/nodes.ts`).
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.ForInStatement: {
        const forIn = node.kind === ts.SyntaxKind.ForInStatement ? "+in" : ""
        const isAwait = node.awaitModifier !== undefined ? "+await" : ""
        emit(depth, `FOR_OF${isAwait}${forIn}`, s, e)
        const initializer = node.initializer
        if (ts.isVariableDeclarationList(initializer)) {
          declarationHead(initializer, depth + 1)
        } else {
          expression(initializer, depth + 1)
        }
        expression(node.expression, depth + 1)
        statement(node.statement, depth + 1)
        return
      }
      case ts.SyntaxKind.BreakStatement:
        emit(depth, "BREAK", s, e, node.label?.text)
        return
      case ts.SyntaxKind.ContinueStatement:
        emit(depth, "CONTINUE", s, e, node.label?.text)
        return
      case ts.SyntaxKind.TryStatement: {
        emit(depth, "TRY", s, e)
        block(node.tryBlock, depth + 1)
        const clause = node.catchClause
        const binding = clause?.variableDeclaration?.name
        if (binding !== undefined && !ts.isIdentifier(binding)) {
          unsupported(node)
        }
        optional(depth + 1, binding, identifier)
        optional(depth + 1, clause?.block, block)
        optional(depth + 1, node.finallyBlock, block)
        return
      }
      case ts.SyntaxKind.WithStatement:
        emit(depth, "WITH", s, e)
        expression(node.expression, depth + 1)
        statement(node.statement, depth + 1)
        return
      case ts.SyntaxKind.LabeledStatement:
        emit(depth, "LABELED", s, e, node.label.text)
        statement(node.statement, depth + 1)
        return
      case ts.SyntaxKind.ReturnStatement:
        emit(depth, "RETURN", s, e)
        optional(depth + 1, node.expression, expression)
        return
      case ts.SyntaxKind.ThrowStatement:
        emit(depth, "THROW", s, e)
        expression(node.expression, depth + 1)
        return
      case ts.SyntaxKind.SwitchStatement: {
        emit(depth, "SWITCH", s, e)
        expression(node.expression, depth + 1)
        list(depth + 1, node.caseBlock.clauses, (clause, clauseDepth) => {
          const [cs, ce] = span(clause)
          if (ts.isCaseClause(clause)) {
            emit(clauseDepth, "CASE", cs, ce)
            expression(clause.expression, clauseDepth + 1)
          } else {
            emit(clauseDepth, "DEFAULT", cs, ce)
          }
          list(clauseDepth + 1, clause.statements, statement)
        })
        return
      }
      case ts.SyntaxKind.EmptyStatement:
        emit(depth, "EMPTY", s, e)
        return
      default:
        unsupported(node)
    }
  }

  const declaration = (node, declarationDepth) => {
    const depth = decorated(node, declarationDepth)
    const [s, e] = span(node)
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration: {
        const clause = node.importClause
        if (clause === undefined || clause.namedBindings === undefined) {
          unsupported(node)
        }
        if (!ts.isNamedImports(clause.namedBindings)) {
          unsupported(node)
        }
        emit(depth, "IMPORT", s, e, node.moduleSpecifier.text)
        list(depth + 1, clause.namedBindings.elements, (element, elementDepth) => {
          const [es, ee] = span(element)
          emit(elementDepth, "IMPORT_SPEC", es, ee, element.name.text)
          identifier(element.propertyName ?? element.name, elementDepth + 1)
        })
        return
      }
      case ts.SyntaxKind.FunctionDeclaration: {
        if (node.name === undefined || node.body === undefined || node.type === undefined) {
          unsupported(node)
        }
        emit(depth, `FUNCTION${exported(node)}${functionFlags(node)}`, s, e)
        identifier(node.name, depth + 1)
        list(depth + 1, node.parameters, parameter)
        type(node.type, depth + 1)
        block(node.body, depth + 1)
        // WP18: the type parameters are the fifth child, after the body, because
        // `src/nodes.ts` appends rather than renumbers.
        typeParameters(node.typeParameters, depth + 1)
        return
      }
      case ts.SyntaxKind.ClassDeclaration: {
        if (node.name === undefined) {
          unsupported(node)
        }
        emit(depth, `CLASS${exported(node)}`, s, e)
        identifier(node.name, depth + 1)
        const heritage = node.heritageClauses ?? []
        const extendsClause = heritage.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
        const implementsClause = heritage.find((h) => h.token === ts.SyntaxKind.ImplementsKeyword)
        if (extendsClause === undefined) {
          empty(depth + 1)
        } else {
          const base = extendsClause.types[0].expression
          if (!ts.isIdentifier(base)) {
            unsupported(node)
          }
          identifier(base, depth + 1)
        }
        // WP18 G5: an implemented interface may be an instantiation, so stage1
        // reads each entry with `parseType` and the node is a TYPE_REF whose
        // child is the type-argument list — empty for the ungeneric spelling.
        const implemented = implementsClause?.types ?? []
        list(depth + 1, implemented, (t, d) => {
          if (!ts.isIdentifier(t.expression)) {
            unsupported(node)
          }
          const [tStart, tEnd] = span(t)
          emit(d, "TYPE_REF", tStart, tEnd, t.expression.text)
          list(d + 1, t.typeArguments ?? [], type)
        })
        list(depth + 1, node.members, member)
        // The type parameters are the fifth child, after the members, because
        // `src/nodes.ts` appends rather than renumbers (WP18 G5).
        typeParameters(node.typeParameters, depth + 1)
        return
      }
      case ts.SyntaxKind.InterfaceDeclaration: {
        if (node.heritageClauses !== undefined) {
          unsupported(node)
        }
        emit(depth, `INTERFACE${exported(node)}`, s, e)
        identifier(node.name, depth + 1)
        list(depth + 1, node.members, (m, d) => {
          if (!ts.isPropertySignature(m) || !ts.isIdentifier(m.name) || m.type === undefined) {
            unsupported(m)
          }
          // An interface field takes the same modifiers and the same `?` a
          // class field does, and stage1's parser reads them with the same two
          // functions, so the same two suffixes are compared here. `!` is not a
          // spelling a property signature has at all.
          const [ms, me] = span(m)
          emit(d, `FIELD${memberFlags(m)}${memberMarker(m)}`, ms, me)
          identifier(m.name, d + 1)
          type(m.type, d + 1)
          empty(d + 1)
        })
        typeParameters(node.typeParameters, depth + 1)
        return
      }
      // `type X = T;` (WP23). An alias is a declaration in stage1's tree and a
      // type in its right-hand child, which is exactly TypeScript's shape.
      // Type parameters on one are a third child, only when written, for
      // Phase 0 to refuse (NL1054).
      case ts.SyntaxKind.TypeAliasDeclaration: {
        emit(depth, `TYPE_ALIAS${exported(node)}`, s, e)
        identifier(node.name, depth + 1)
        type(node.type, depth + 1)
        if (node.typeParameters !== undefined) {
          typeParameters(node.typeParameters, depth + 1)
        }
        return
      }
      // `namespace A.B { }`, `module "m" { }` and `declare global { }` (NL1027,
      // NL1019): one NAMESPACE whose text is the keyword, the name — a dotted
      // one is the member access it spells — and the body as a BLOCK stage1
      // passes over unread, or EMPTY for `declare module "m";`.
      case ts.SyntaxKind.ModuleDeclaration: {
        let keyword = "module"
        if ((node.flags & ts.NodeFlags.GlobalAugmentation) !== 0) {
          keyword = "global"
        } else if ((node.flags & ts.NodeFlags.Namespace) !== 0) {
          keyword = "namespace"
        }
        emit(depth, `NAMESPACE${exported(node)}`, s, e, keyword)
        let innermost = node
        const names = [node.name]
        while (innermost.body !== undefined && ts.isModuleDeclaration(innermost.body)) {
          innermost = innermost.body
          names.push(innermost.name)
        }
        if (ts.isStringLiteral(node.name)) {
          const [ns, ne] = span(node.name)
          emit(depth + 1, "STRING", ns, ne, `#${Buffer.byteLength(node.name.text, "utf8")}`)
        } else {
          const nameStart = at(names[0].getStart(sf))
          const member = (i, d) => {
            if (i === 0) {
              identifier(names[0], d)
              return
            }
            emit(d, "MEMBER", nameStart, at(names[i].end), names[i].text)
            member(i - 1, d + 1)
          }
          member(names.length - 1, depth + 1)
        }
        if (innermost.body === undefined) {
          empty(depth + 1)
        } else {
          const [bs, be] = span(innermost.body)
          emit(depth + 1, "BLOCK", bs, be)
        }
        return
      }
      // `enum X { A = 1, B }` (WP23). stage1 reads the members as a LIST of
      // ENUM_MEMBER, each one a name and an initialiser that is EMPTY when the
      // member is auto-numbered — which is TypeScript's shape flattened.
      // `const enum` is read too, and refused by the checker rather than the
      // grammar, so the `const` is a flag here exactly as it is on a module
      // constant; `declare enum` is the parser's to refuse and is skipped.
      case ts.SyntaxKind.EnumDeclaration: {
        const modifiers = node.modifiers ?? []
        if (modifiers.some((m) => !isEnumModifier(m))) {
          unsupported(node)
        }
        const constEnum = modifiers.some((m) => m.kind === ts.SyntaxKind.ConstKeyword) ? "+const" : ""
        emit(depth, `ENUM${exported(node)}${constEnum}`, s, e)
        identifier(node.name, depth + 1)
        list(depth + 1, node.members, (m, d) => {
          if (!ts.isIdentifier(m.name)) {
            unsupported(m)
          }
          const [ms, me] = span(m)
          emit(d, "ENUM_MEMBER", ms, me)
          identifier(m.name, d + 1)
          if (m.initializer !== undefined) {
            expression(m.initializer, d + 1)
          } else {
            empty(d + 1)
          }
        })
        return
      }
      case ts.SyntaxKind.VariableStatement: {
        // A top-level `let` or `var` is a module constant without `const`,
        // which the checker and Phase 0 refuse (WP33 R1).
        if (!isConst(node.declarationList)) {
          emit(depth, `MODULE_CONST${exported(node)}${letFlags(node.declarationList)}`, s, e)
          list(depth + 1, node.declarationList.declarations, variableDeclaration)
          return
        }
        // A module-level `const` bound to an arrow declares a *function*
        // (docs/wp22-arrow-functions.md), and stage1's parser builds the same
        // `N_FUNCTION` it builds for the `function` spelling -- so this side
        // normalises the same way. It is the one place the oracle reshapes a
        // `typescript` tree rather than transcribing it, and it does so
        // because the language says the two spellings declare one thing.
        const single = node.declarationList.declarations
        const arrow =
          single.length === 1 &&
          single[0].initializer !== undefined &&
          ts.isArrowFunction(single[0].initializer)
            ? single[0].initializer
            : undefined
        if (arrow !== undefined) {
          if (arrow.type === undefined) {
            unsupported(node)
          }
          if (single[0].type !== undefined || !ts.isIdentifier(single[0].name)) {
            unsupported(node)
          }
          emit(depth, `FUNCTION${exported(node)}${functionFlags(arrow)}`, s, e)
          identifier(single[0].name, depth + 1)
          list(depth + 1, arrow.parameters, parameter)
          type(arrow.type, depth + 1)
          // The body child is the block, or the expression a concise body
          // returns -- exactly what stage1 puts there.
          if (ts.isBlock(arrow.body)) {
            block(arrow.body, depth + 1)
          } else {
            expression(arrow.body, depth + 1)
          }
          typeParameters(arrow.typeParameters, depth + 1)
          return
        }
        emit(depth, `MODULE_CONST${exported(node)}+const`, s, e)
        list(depth + 1, node.declarationList.declarations, variableDeclaration)
        return
      }
      default:
        // A statement where a declaration belongs is read as the statement,
        // for the checker to refuse (NL2230); the rest is still unsupported.
        statement(node, depth)
    }
  }

  /**
   * `static` and `readonly` are recorded and `public` / `private` /
   * `protected` are ignored, exactly as Nish does (docs/LANGUAGE.md, Classes):
   * both are flags the checker refuses on rather than syntax the parser turns
   * down, so `src/ast-text.ts` prints them and this has to print the same
   * words in the same order. Anything else — `abstract`, `async`, `declare` —
   * is a construct the language does not have, so the file is skipped and
   * counted.
   *
   * `static` used to be skipped here, and that was the whole coverage of every
   * `static` member: the parse a stage0 oracle never compared
   * (docs/wp19-stage0-retirement.md §A5 — a parse no oracle compares is where a
   * column divergence hides). Accepting it while printing nothing for it was
   * half of that hole, because the *flag* then went uncompared.
   */
  const memberFlags = (node) => {
    let readonly = false
    let isStatic = false
    for (const modifier of node.modifiers ?? []) {
      // `async`, the `*` and a decorator are read for Phase 0 to refuse, and
      // printed by `functionFlags` and `decorated`.
      if (modifier.kind === ts.SyntaxKind.AsyncKeyword || modifier.kind === ts.SyntaxKind.Decorator) {
        continue
      }
      if (modifier.kind === ts.SyntaxKind.ReadonlyKeyword) {
        readonly = true
      } else if (modifier.kind === ts.SyntaxKind.StaticKeyword) {
        isStatic = true
      } else if (
        modifier.kind !== ts.SyntaxKind.PublicKeyword &&
        modifier.kind !== ts.SyntaxKind.PrivateKeyword &&
        modifier.kind !== ts.SyntaxKind.ProtectedKeyword
      ) {
        unsupported(modifier)
      }
    }
    return `${functionFlags(node)}${isStatic ? "+static" : ""}${readonly ? "+readonly" : ""}`
  }

  /** `?` and `!` after a member's name, in `kindWithFlags`'s order. */
  const memberMarker = (node) =>
    `${node.questionToken === undefined ? "" : "+optional"}${
      node.exclamationToken === undefined ? "" : "+definite"
    }`

  const member = (node, memberDepth) => {
    const depth = decorated(node, memberDepth)
    const [s, e] = span(node)
    if (ts.isPropertyDeclaration(node)) {
      if (!ts.isIdentifier(node.name) || node.type === undefined) {
        unsupported(node)
      }
      // `x?: T` and `x!: T` are parsed on both sides and refused by the
      // checker, so the marker changes no node and no span — but it does change
      // a flag, and the flag is compared.
      emit(depth, `FIELD${memberFlags(node)}${memberMarker(node)}`, s, e)
      identifier(node.name, depth + 1)
      type(node.type, depth + 1)
      optional(depth + 1, node.initializer, expression)
      return
    }
    if (ts.isMethodDeclaration(node)) {
      const dispose = isDisposeName(node.name)
      if ((!ts.isIdentifier(node.name) && !dispose) || node.body === undefined || node.type === undefined) {
        unsupported(node)
      }
      if (node.typeParameters !== undefined) {
        unsupported(node)
      }
      emit(depth, `METHOD${memberFlags(node)}${memberMarker(node)}`, s, e)
      if (dispose) {
        const [ns, ne] = span(node.name)
        emit(depth + 1, "IDENT", ns, ne, "[Symbol.dispose]")
      } else {
        identifier(node.name, depth + 1)
      }
      list(depth + 1, node.parameters, parameter)
      type(node.type, depth + 1)
      block(node.body, depth + 1)
      return
    }
    if (ts.isConstructorDeclaration(node)) {
      if (node.body === undefined) {
        unsupported(node)
      }
      emit(depth, `CONSTRUCTOR${memberFlags(node)}`, s, e)
      list(depth + 1, node.parameters, parameter)
      block(node.body, depth + 1)
      return
    }
    unsupported(node)
  }

  emit(0, "SOURCE_FILE", 0, Buffer.byteLength(source, "utf8"))
  for (const node of sf.statements) {
    declaration(node, 1)
  }
  return lines
}

const compare = (binary, file) => {
  const source = fs.readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS)
  if (sf.parseDiagnostics !== undefined && sf.parseDiagnostics.length > 0) {
    return { skipped: "typescript reports a syntax error" }
  }
  let want
  try {
    want = printTypeScriptTree(source, sf)
  } catch (err) {
    if (err.unsupported === undefined) {
      throw err
    }
    return { skipped: `needs ${err.unsupported}` }
  }
  const run = spawnSync(binary, [file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  if (run.status !== 0) {
    const first = run.stderr.trim().split("\n")[0] ?? ""
    return { skipped: `parser: ${first.replace(/^.*?:\d+:\d+: [a-z ]+: /, "")}` }
  }
  const ours = run.stdout.split("\n").filter((l) => l.length > 0)
  for (let i = 0; i < Math.max(ours.length, want.length); i++) {
    if (ours[i] !== want[i]) {
      return {
        failed: `line ${i + 1}: ours \`${ours[i] ?? "<end>"}\`, typescript \`${want[i] ?? "<end>"}\``,
      }
    }
  }
  return { nodes: want.length }
}

const corpus = () => {
  const files = []
  const dirs = [
    path.join(root, "tests", "cases"),
    path.join(root, "examples"),
    path.join(root, "src"),
    path.join(root, "tests", "differential", "corpus"),
    path.join(root, "docs", "cookbook"),
    path.join(root, "bench"),
    path.join(root, "tests", "parser"),
  ]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      continue
    }
    for (const name of fs.readdirSync(dir).sort()) {
      // `recovery.ts` is the one fixture the oracle cannot judge: the
      // `typescript` parser recovers from a syntax error and this one reports
      // and moves on, so it has a golden of its own in `tests/run.js`.
      if (name.endsWith(".ts") && name !== "recovery.ts") {
        files.push(path.join(dir, name))
      }
    }
  }
  return files
}

/**
 * `src/dump-ast.ts`, linked by the seed rather than by stage0 (WP19 G2.3):
 * what this oracle compares against is the `typescript` parser, which outlives
 * stage0's `src/`, so the compiler that builds its subject has to as well.
 */
const build = (seed) =>
  linkWith(seed, path.join("src", "dump-ast.ts"), path.join(root, "build", "self", "dump_ast"))

const main = (argv) => {
  const verbose = argv.includes("--verbose")
  const files = withoutSeed(argv).filter((a) => !a.startsWith("--"))
  const seed = seedWithoutStage0(namedSeedSpec(argv))
  if (seed.error !== undefined) {
    process.stderr.write(`${seed.error}\n`)
    return 1
  }
  const binary = build(seed)
  if (binary === null) {
    return 1
  }
  const inputs = files.length > 0 ? files.map((f) => path.resolve(f)) : corpus()
  let agreed = 0
  let nodes = 0
  const skipped = []
  const failed = []
  const reasons = new Map()
  for (const file of inputs) {
    const result = compare(binary, file)
    const name = path.relative(root, file)
    if (result.skipped !== undefined) {
      skipped.push(`${name}: ${result.skipped}`)
      reasons.set(result.skipped, (reasons.get(result.skipped) ?? 0) + 1)
    } else if (result.failed !== undefined) {
      failed.push(`${name}: ${result.failed}`)
    } else {
      agreed++
      nodes += result.nodes
    }
  }
  for (const f of failed) {
    process.stdout.write(`  FAIL ${f}\n`)
  }
  if (verbose) {
    for (const s of skipped) {
      process.stdout.write(`  skip ${s}\n`)
    }
    const ranked = [...reasons.entries()].sort((a, b) => b[1] - a[1])
    for (const [reason, count] of ranked) {
      process.stdout.write(`  ${String(count).padStart(4)}  ${reason}\n`)
    }
  }
  process.stdout.write(
    `${agreed}/${inputs.length - skipped.length} files agree (${nodes} nodes), ` +
      `${skipped.length} skipped, seed ${seed.label}\n`
  )
  return failed.length === 0 ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
}
export { printTypeScriptTree, compare, corpus, build }
