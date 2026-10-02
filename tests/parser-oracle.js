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

  /**
   * The modifiers stage1's grammar reads on an `enum`: `export`, `const`, and
   * `declare` (WP33 R1), which is a flag the dump does not print, as a
   * `declare function`'s is not.
   */
  const isEnumModifier = (m) =>
    m.kind === ts.SyntaxKind.ExportKeyword ||
    m.kind === ts.SyntaxKind.ConstKeyword ||
    m.kind === ts.SyntaxKind.DeclareKeyword

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

  /** Whether an arrow's parameters open with `(` or `<`, after any `async`. */
  const parenthesisedArrow = (arrow) => {
    const modifiers = arrow.modifiers ?? []
    const opens =
      modifiers.length === 0 ? arrow.getStart(sf) : ts.skipTrivia(source, modifiers[modifiers.length - 1].end)
    return source[opens] === "(" || source[opens] === "<"
  }

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
  const classLikeOf = () => classLike

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
      // `import.meta`, which stage1 reads as the member `meta` of that name.
      // `new.target` is the other meta-property, and stays a syntax error.
      case ts.SyntaxKind.MetaProperty:
        if (node.keywordToken !== ts.SyntaxKind.ImportKeyword) {
          unsupported(node)
        }
        emit(depth, "MEMBER", s, e, node.name.text)
        emit(depth + 1, "IDENT", s, at(node.getStart(sf) + "import".length), "import")
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
      case ts.SyntaxKind.ClassExpression:
        classLikeOf()(node, depth)
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
          if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
            emit(depth + 1, "PROPERTY", ps, pe, property.name.text)
            expression(property.initializer, depth + 2)
          } else if (ts.isPropertyAssignment(property)) {
            // A key written as a string or a number is a second child (NL2223),
            // and so is a computed one, with `+computed` (NL1041).
            emit(depth + 1, `PROPERTY${ts.isComputedPropertyName(property.name) ? "+computed" : ""}`, ps, pe)
            expression(property.initializer, depth + 2)
            memberName(property.name, depth + 2)
          } else if (
            ts.isMethodDeclaration(property) ||
            ts.isGetAccessorDeclaration(property) ||
            ts.isSetAccessorDeclaration(property)
          ) {
            // A method is the METHOD that is the property's value (NL2258).
            const accessor = ts.isMethodDeclaration(property) ? "" : "+accessor"
            const computed = ts.isComputedPropertyName(property.name)
            emit(depth + 1, "PROPERTY", ps, pe, computed ? undefined : propertyText(property.name))
            emit(
              depth + 2,
              `METHOD${functionFlags(property)}${accessor}${computed ? "+computed" : ""}`,
              ps,
              pe
            )
            memberName(property.name, depth + 3)
            list(depth + 3, property.parameters, arrowParameter)
            optional(depth + 3, property.type, type)
            block(property.body, depth + 3)
            if (property.typeParameters !== undefined) {
              typeParameters(property.typeParameters, depth + 3)
            }
          } else if (ts.isShorthandPropertyAssignment(property)) {
            emit(depth + 1, "PROPERTY", ps, pe, property.name.text)
            emit(depth + 2, "IDENT", ps, pe, property.name.text)
          } else if (ts.isSpreadAssignment(property)) {
            // `...a` is the SPREAD among the properties (NL1061).
            emit(depth + 1, "SPREAD", ps, pe)
            expression(property.expression, depth + 2)
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
    const [s, e] = span(node)
    emit(depth, "VAR_DECL", s, e)
    bindingName(node.name, depth + 1)
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

  /**
   * A parameter. A default, `...` and `?` are flags stage1 reads for the
   * checker to refuse (NL2233, NL2235), in `kindWithFlags`'s order, and the
   * default's value is dropped; a destructuring pattern is the name's
   * BINDING_PATTERN (NL2192). None of those needs its annotation, and an
   * arrow argument's parameter may leave its type out (WP29).
   */
  const parameter = (node, parameterDepth, typed = true) => {
    const depth = decorated(node, parameterDepth)
    const [s, e] = span(node)
    // A modifier in front of the name is a parameter property (NL2234).
    const property = (node.modifiers ?? []).some((m) => m.kind !== ts.SyntaxKind.Decorator)
    const flags = `${node.initializer === undefined ? "" : "+default"}${
      node.dotDotDotToken === undefined ? "" : "+rest"
    }${property ? "+property" : ""}${node.questionToken === undefined ? "" : "+optional"}`
    emit(depth, `PARAM${flags}`, s, e)
    bindingName(node.name, depth + 1)
    if (node.type === undefined && typed && flags === "" && ts.isIdentifier(node.name)) {
      unsupported(node)
    }
    optional(depth + 1, node.type, type)
  }
  const arrowParameter = (node, depth) => parameter(node, depth, false)

  /** A bound name, or the destructuring pattern stage1 passes over unread (NL2191–NL2193). */
  const bindingName = (node, depth) => {
    if (ts.isIdentifier(node)) {
      identifier(node, depth)
      return
    }
    const [s, e] = span(node)
    emit(depth, "BINDING_PATTERN", s, e)
  }

  const block = (node, depth) => {
    const [s, e] = span(node)
    emit(depth, "BLOCK", s, e)
    for (const statement of node.statements) {
      statementOf(node)(statement, depth + 1)
    }
  }
  // `statementOf` exists only so `block` can be defined before `statement`,
  // and `declarationOf` so `statement` can hand a nested one back.
  const statementOf = () => statement
  const declarationOf = () => declaration

  /** A name in an import or export list: an IDENT, or a STRING (NL1058). */
  const moduleExportName = (name, depth) => {
    if (ts.isStringLiteral(name)) {
      expression(name, depth)
    } else {
      identifier(name, depth)
    }
  }

  /**
   * One specifier of an import's or an export's braces: an IMPORT_SPEC whose
   * text is the name after `as` (or the only one), whose child is the name
   * before it, with `type` in front a flag (NL2243).
   */
  const specifierLine = (element, depth) => {
    const [es, ee] = span(element)
    emit(depth, `IMPORT_SPEC${element.isTypeOnly ? "+type" : ""}`, es, ee, element.name.text)
    moduleExportName(element.propertyName ?? element.name, depth + 1)
  }

  /** `A.B.C` in `import x = A.B.C`: the IDENT, or a MEMBER for each dot. */
  const entityName = (name, depth) => {
    if (ts.isIdentifier(name)) {
      identifier(name, depth)
      return
    }
    emit(depth, "MEMBER", at(name.getStart(sf)), at(name.end), name.right.text)
    entityName(name.left, depth + 1)
  }

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
      // A declaration written where a statement stands is the node it is at
      // the top level, for the checker to refuse (NL2260).
      case ts.SyntaxKind.FunctionDeclaration:
      case ts.SyntaxKind.ImportDeclaration:
      case ts.SyntaxKind.ImportEqualsDeclaration:
        declarationOf()(node, depth)
        return
      default:
        unsupported(node)
    }
  }

  const declaration = (node, declarationDepth) => {
    const depth = decorated(node, declarationDepth)
    const [s, e] = span(node)
    switch (node.kind) {
      // Every import form: the named one, and the rest stage1 reads for the
      // phase that owns its rule to refuse (WP33 R1). The bindings child is
      // the braces' LIST, the name after `* as`, or EMPTY, and a default
      // import is a second child after it, there only when written.
      case ts.SyntaxKind.ImportDeclaration: {
        const clause = node.importClause
        const specifier = node.moduleSpecifier
        const literal = ts.isStringLiteral(specifier)
        const phase = clause?.phaseModifier
        emit(
          depth,
          `IMPORT${exported(node)}${phase === ts.SyntaxKind.TypeKeyword ? "+type" : ""}${
            phase === ts.SyntaxKind.DeferKeyword ? "+defer" : ""
          }${literal ? "" : "+computed"}${node.attributes === undefined ? "" : "+attributes"}`,
          s,
          e,
          literal && specifier.text.length > 0 ? specifier.text : undefined
        )
        const bindings = clause?.namedBindings
        if (bindings === undefined) {
          empty(depth + 1)
        } else if (ts.isNamespaceImport(bindings)) {
          identifier(bindings.name, depth + 1)
        } else {
          list(depth + 1, bindings.elements, specifierLine)
        }
        if (clause?.name !== undefined) {
          identifier(clause.name, depth + 1)
        }
        return
      }
      // `import x = require("./m")` and `import x = A.B` (NL2230, NL2226).
      case ts.SyntaxKind.ImportEqualsDeclaration: {
        emit(depth, `IMPORT_EQUALS${exported(node)}${node.isTypeOnly ? "+type" : ""}`, s, e)
        identifier(node.name, depth + 1)
        const reference = node.moduleReference
        if (ts.isExternalModuleReference(reference)) {
          expression(reference.expression, depth + 1)
        } else {
          entityName(reference, depth + 1)
        }
        return
      }
      // `export { a }`, `export * from` and `export * as ns from` (NL2128).
      case ts.SyntaxKind.ExportDeclaration: {
        const specifier = node.moduleSpecifier
        const literal = specifier === undefined || ts.isStringLiteral(specifier)
        const text = specifier !== undefined && literal ? specifier.text : ""
        emit(
          depth,
          `EXPORT_DECLARATION${node.isTypeOnly ? "+type" : ""}${literal ? "" : "+computed"}`,
          s,
          e,
          text.length > 0 ? text : undefined
        )
        const clause = node.exportClause
        if (clause === undefined) {
          empty(depth + 1)
        } else if (ts.isNamespaceExport(clause)) {
          moduleExportName(clause.name, depth + 1)
        } else {
          list(depth + 1, clause.elements, specifierLine)
        }
        return
      }
      // `export default <value>` and `export = <value>` (NL2129).
      case ts.SyntaxKind.ExportAssignment:
        emit(depth, "EXPORT_ASSIGNMENT", s, e, node.isExportEquals ? "=" : "default")
        expression(node.expression, depth + 1)
        return
      // `export as namespace X` (NL2230).
      case ts.SyntaxKind.NamespaceExportDeclaration:
        emit(depth, "NAMESPACE_EXPORT", s, e)
        identifier(node.name, depth + 1)
        return
      case ts.SyntaxKind.FunctionDeclaration: {
        // A missing name (`export default function ()`, NL2203), return type
        // (NL2096) or body (NL2204) is an EMPTY child, and `export default`
        // a flag (NL2130), for the checker to refuse; a `declare function`'s
        // shape is not compared here.
        const modifiers = node.modifiers ?? []
        const isDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
        if (modifiers.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) {
          unsupported(node)
        }
        emit(depth, `FUNCTION${exported(node)}${functionFlags(node)}${isDefault ? "+default" : ""}`, s, e)
        optional(depth + 1, node.name, identifier)
        list(depth + 1, node.parameters, parameter)
        optional(depth + 1, node.type, type)
        optional(depth + 1, node.body, block)
        // WP18: the type parameters are the fifth child, after the body, because
        // `src/nodes.ts` appends rather than renumbers.
        typeParameters(node.typeParameters, depth + 1)
        return
      }
      case ts.SyntaxKind.ClassDeclaration: {
        classLike(node, depth)
        return
      }
      case ts.SyntaxKind.InterfaceDeclaration: {
        const heritage = node.heritageClauses ?? []
        const isDefault = (node.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
        emit(depth, `INTERFACE${exported(node)}${isDefault ? "+default" : ""}`, s, e)
        identifier(node.name, depth + 1)
        list(depth + 1, node.members, interfaceMember)
        typeParameters(node.typeParameters, depth + 1)
        // `extends A, B` is a fourth child spanning the clause, there only
        // when written, for the checker to refuse (NL2215).
        if (heritage.length > 0) {
          const [hs, he] = span(heritage[0])
          emit(depth + 1, "LIST", hs, he)
          for (const t of heritage[0].types) {
            heritageType(node, t, depth + 2)
          }
        }
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
      // constant; so is `declare enum` (NL2286), whose flag is not printed.
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
        //
        // It is the first declarator that decides: an unannotated name bound to
        // an arrow whose parameters are parenthesised, as `startsArrowDeclaration`
        // reads it. Its return type may be missing (NL2096), and the names after
        // it are a sixth child, a LIST of VAR_DECL (NL2274).
        const declarations = node.declarationList.declarations
        const first = declarations[0]
        const arrow =
          first.initializer !== undefined &&
          ts.isArrowFunction(first.initializer) &&
          first.type === undefined &&
          ts.isIdentifier(first.name) &&
          parenthesisedArrow(first.initializer)
            ? first.initializer
            : undefined
        if (arrow !== undefined) {
          emit(depth, `FUNCTION${exported(node)}${functionFlags(arrow)}`, s, e)
          identifier(first.name, depth + 1)
          list(depth + 1, arrow.parameters, parameter)
          optional(depth + 1, arrow.type, type)
          // The body child is the block, or the expression a concise body
          // returns -- exactly what stage1 puts there.
          if (ts.isBlock(arrow.body)) {
            block(arrow.body, depth + 1)
          } else {
            expression(arrow.body, depth + 1)
          }
          typeParameters(arrow.typeParameters, depth + 1)
          if (declarations.length > 1) {
            list(depth + 1, declarations.slice(1), variableDeclaration)
          }
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
   * words in the same order. `async` and the `*` of a generator are printed
   * first, by `functionFlags`, and a decorator is `decorated`'s, all three for
   * Phase 0 to refuse (WP33 R1). Anything else — `abstract`, `declare` — is a
   * construct the language does not have, so the file is skipped and counted.
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
    let abstract = false
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
      } else if (modifier.kind === ts.SyntaxKind.AbstractKeyword) {
        // Left off after `static`, which is written first and is the refusal.
        abstract = !isStatic
      } else if (
        modifier.kind !== ts.SyntaxKind.PublicKeyword &&
        modifier.kind !== ts.SyntaxKind.PrivateKeyword &&
        modifier.kind !== ts.SyntaxKind.ProtectedKeyword
      ) {
        unsupported(modifier)
      }
    }
    const accessor = ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) ? "+accessor" : ""
    // A computed name (NL1041) is FLAG_COMPUTED on the member, `[Symbol.dispose]` aside.
    const computed =
      node.name !== undefined && ts.isComputedPropertyName(node.name) && !isDisposeName(node.name)
    return `${functionFlags(node)}${accessor}${abstract ? "+abstract" : ""}${computed ? "+computed" : ""}${
      isStatic ? "+static" : ""
    }${readonly ? "+readonly" : ""}`
  }

  /** `?` and `!` after a member's name, in `kindWithFlags`'s order. */
  const memberMarker = (node) =>
    `${node.questionToken === undefined ? "" : "+optional"}${
      node.exclamationToken === undefined ? "" : "+definite"
    }`

  /**
   * A member's name: its IDENT, or the STRING or NUMBER stage1 keeps in its
   * place for the checker to refuse (NL2092), or for a computed name the
   * expression between the brackets, for Phase 0 to refuse (NL1041).
   */
  const memberName = (name, depth) => {
    if (ts.isComputedPropertyName(name)) {
      expression(name.expression, depth)
      return
    }
    if (!ts.isIdentifier(name) && !ts.isStringLiteral(name) && !ts.isNumericLiteral(name)) {
      unsupported(name)
    }
    expression(name, depth)
  }

  /** The text stage1 keeps on an object literal's PROPERTY for a method named `name`. */
  const propertyText = (name) =>
    ts.isNumericLiteral(name) ? source.slice(name.getStart(sf), name.end).replaceAll("_", "") : name.text

  /**
   * A class, declared or written where an operand stands: an anonymous one
   * (NL2018) has an EMPTY name, and `export default` (NL2131) and `abstract`
   * are flags (NL2168); `declare` (NL2083) is one the dump does not print.
   */
  const classLike = (node, depth) => {
    const [s, e] = span(node)
    const modifiers = node.modifiers ?? []
    const isDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    const isAbstract = modifiers.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword)
    emit(depth, `CLASS${exported(node)}${isDefault ? "+default" : ""}${isAbstract ? "+abstract" : ""}`, s, e)
    optional(depth + 1, node.name, identifier)
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
    list(depth + 1, implementsClause?.types ?? [], (t, d) => heritageType(node, t, d))
    list(depth + 1, node.members, member)
    // The type parameters are the fifth child, after the members, because
    // `src/nodes.ts` appends rather than renumbers (WP18 G5).
    typeParameters(node.typeParameters, depth + 1)
  }

  /** One name in an `implements` or an interface's `extends`, as the TYPE_REF `parseType` reads. */
  const heritageType = (owner, t, d) => {
    if (!ts.isIdentifier(t.expression)) {
      unsupported(owner)
    }
    const [tStart, tEnd] = span(t)
    emit(d, "TYPE_REF", tStart, tEnd, t.expression.text)
    list(d + 1, t.typeArguments ?? [], type)
  }

  /** `[k: string]: T` in a class or an interface (NL2213, NL2214). */
  const indexSignature = (node, depth) => {
    const [s, e] = span(node)
    const key = node.parameters[0]
    if (node.parameters.length !== 1 || key.type === undefined || !ts.isIdentifier(key.name)) {
      unsupported(node)
    }
    emit(depth, `INDEX_SIGNATURE${memberFlags(node)}`, s, e)
    const [ks, ke] = span(key)
    emit(depth + 1, "PARAM", ks, ke)
    identifier(key.name, depth + 2)
    type(key.type, depth + 2)
    type(node.type, depth + 1)
  }

  /**
   * One member of an interface: a field, or — for the checker to refuse — a
   * method or accessor signature (NL2048), an index signature (NL2214), or a
   * call or construct signature, a METHOD whose name is EMPTY (NL2257).
   */
  const interfaceMember = (m, d) => {
    const [ms, me] = span(m)
    if (ts.isIndexSignatureDeclaration(m)) {
      indexSignature(m, d)
      return
    }
    if (ts.isCallSignatureDeclaration(m) || ts.isConstructSignatureDeclaration(m)) {
      emit(d, `METHOD${ts.isConstructSignatureDeclaration(m) ? "+construct" : ""}`, ms, me)
      empty(d + 1)
      list(d + 1, m.parameters, arrowParameter)
      optional(d + 1, m.type, type)
      empty(d + 1)
      if (m.typeParameters !== undefined) {
        typeParameters(m.typeParameters, d + 1)
      }
      return
    }
    if (
      (ts.isMethodSignature(m) || ts.isGetAccessorDeclaration(m) || ts.isSetAccessorDeclaration(m)) &&
      m.body === undefined
    ) {
      emit(d, `METHOD${memberFlags(m)}${memberMarker(m)}`, ms, me)
      memberName(m.name, d + 1)
      list(d + 1, m.parameters, arrowParameter)
      optional(d + 1, m.type, type)
      empty(d + 1)
      if (m.typeParameters !== undefined) {
        typeParameters(m.typeParameters, d + 1)
      }
      return
    }
    if (!ts.isPropertySignature(m) || m.type === undefined) {
      unsupported(m)
    }
    // An interface field takes the same modifiers and the same `?` a class
    // field does, and stage1's parser reads them with the same two functions,
    // so the same two suffixes are compared here. `!` is not a spelling a
    // property signature has at all.
    emit(d, `FIELD${memberFlags(m)}${memberMarker(m)}`, ms, me)
    memberName(m.name, d + 1)
    type(m.type, d + 1)
    empty(d + 1)
  }

  const member = (node, memberDepth) => {
    const depth = decorated(node, memberDepth)
    const [s, e] = span(node)
    // `static { }` is the BLOCK among the members, spanning the word (NL2255).
    if (ts.isClassStaticBlockDeclaration(node)) {
      emit(depth, "BLOCK", s, e)
      for (const inner of node.body.statements) {
        statement(inner, depth + 1)
      }
      return
    }
    if (ts.isIndexSignatureDeclaration(node)) {
      indexSignature(node, depth)
      return
    }
    if (ts.isPropertyDeclaration(node)) {
      if (node.type === undefined) {
        unsupported(node)
      }
      // `x?: T` and `x!: T` are parsed on both sides and refused by the
      // checker, so the marker changes no node and no span — but it does change
      // a flag, and the flag is compared.
      emit(depth, `FIELD${memberFlags(node)}${memberMarker(node)}`, s, e)
      memberName(node.name, depth + 1)
      type(node.type, depth + 1)
      optional(depth + 1, node.initializer, expression)
      return
    }
    // A getter or setter is a METHOD with `+accessor` (NL2209), and a method
    // may leave its return type out (NL2096): the checker refuses both.
    if (
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      // A missing body is EMPTY (NL2090).
      const dispose = isDisposeName(node.name)
      if (node.typeParameters !== undefined) {
        unsupported(node)
      }
      emit(depth, `METHOD${memberFlags(node)}${memberMarker(node)}`, s, e)
      if (dispose) {
        const [ns, ne] = span(node.name)
        emit(depth + 1, "IDENT", ns, ne, "[Symbol.dispose]")
      } else {
        memberName(node.name, depth + 1)
      }
      // An accessor's parameter may leave its type out: the accessor is refused whole.
      list(depth + 1, node.parameters, ts.isMethodDeclaration(node) ? parameter : arrowParameter)
      optional(depth + 1, node.type, type)
      optional(depth + 1, node.body, block)
      return
    }
    // A missing body is EMPTY (NL2091), and a return type (NL2189) a third
    // child, there only when written.
    if (ts.isConstructorDeclaration(node)) {
      emit(depth, `CONSTRUCTOR${memberFlags(node)}`, s, e)
      list(depth + 1, node.parameters, parameter)
      optional(depth + 1, node.body, block)
      if (node.type !== undefined) {
        type(node.type, depth + 1)
      }
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
