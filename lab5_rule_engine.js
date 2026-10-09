// 1. ENVIRONMENT  (scope chain via parent pointer)
class Environment {
  constructor(parent = null) {
    this.vars = new Map();   // bindings that live in THIS scope only
    this.parent = parent;    // enclosing scope (null for global)
  }

  // Recursive: find the nearest scope that owns `name`
  resolve(name) {
    if (this.vars.has(name)) return this;
    if (this.parent) return this.parent.resolve(name);
    return null;
  }

  // Read: walks up the parent chain
  get(name) {
    const scope = this.resolve(name);
    if (!scope) throw new Error(`Undefined variable: ${name}`);
    return scope.vars.get(name);
  }

  // Declare (let/var/const): always binds in the CURRENT scope (shadows parents)
  set(name, value) {
    this.vars.set(name, value);
    return value;
  }

  // Assign (x = ...): updates the nearest scope that already has `name`
  assign(name, value) {
    const scope = this.resolve(name);
    if (!scope) throw new Error(`Cannot assign to undeclared variable: ${name}`);
    scope.vars.set(name, value);
    return value;
  }
}

// LEXER
class Lexer {
  constructor(src) {
    this.src = src;
    this.rules = [
      { type: "SPACE",      regex: /^\s+/ },
      { type: "KEYWORD",    regex: /^(let|const|var|for|while|if|else)\b/ },
      { type: "REL_OP",     regex: /^(<=|>=|==|!=|<|>)/ },
      { type: "ASSIGN",     regex: /^=/ },
      { type: "INCREMENT",  regex: /^\+\+/ },
      { type: "DECREMENT",  regex: /^--/ },
      { type: "POWER",      regex: /^\^/ },
      { type: "ADD",        regex: /^\+/ },
      { type: "SUB",        regex: /^-/ },
      { type: "MULT",       regex: /^\*/ },
      { type: "DIV",        regex: /^\// },
      { type: "NUMBER",     regex: /^(\d+(\.\d+)?|\.\d+)/ },
      { type: "IDENTIFIER", regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
      { type: "LPAREN",     regex: /^\(/ },
      { type: "RPAREN",     regex: /^\)/ },
      { type: "LBRACE",     regex: /^\{/ },
      { type: "RBRACE",     regex: /^\}/ },
      { type: "LBRACKET",   regex: /^\[/ },
      { type: "RBRACKET",   regex: /^\]/ },
      { type: "COMMA",      regex: /^,/ },
      { type: "TERMINATOR", regex: /^;/ },
    ];
  }

  tokenize() {
    const tokens = [];
    let rest = this.src;
    while (rest.length) {
      let matched = false;
      for (const { type, regex } of this.rules) {
        const m = regex.exec(rest);
        if (m) {
          if (type !== "SPACE") tokens.push({ type, value: m[0] });
          rest = rest.slice(m[0].length);
          matched = true;
          break;
        }
      }
      if (!matched) throw new Error(`Unexpected character: '${rest[0]}'`);
    }
    tokens.push({ type: "EOF", value: "" });
    return tokens;
  }
}

// ------------------------------------------------------------
// PARSER (recursive descent, follows the EBNF)
//  <Program>    ::= <Statement>*
//  <Statement>  ::= <If> | <For> | <While> | <VarDecl> | <ExprStmt>
//  <If>         ::= "if" "(" <Expr> ")" <Block> [ "else" (<Block> | <If>) ]
//  <For>        ::= "for" "(" [<VarDecl-no-;>] ";" <Expr> ";" <Expr> ")" <Block>
//  <While>      ::= "while" "(" <Expr> ")" <Block>
//  <Expression> ::= <Comparison> [ "=" <Expression> ]  | postfix ++ / --
// ------------------------------------------------------------
class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }

  Peek() { return this.tokens[this.pos]; }

  Consume(type, value) {
    const t = this.Peek();
    if (t.type !== type || (value !== undefined && t.value !== value))
      throw new Error(`Expected ${type}${value ? " '" + value + "'" : ""} but got ${t.type} '${t.value}'`);
    this.pos++;
    return t;
  }

  Parse_Program() {
    const body = [];
    while (this.Peek().type !== "EOF" && this.Peek().type !== "RBRACE")
      body.push(this.Parse_Statement());
    return { type: "Program", body };
  }

  Parse_Statement() {
    const t = this.Peek();
    if (t.type === "KEYWORD") {
      if (t.value === "if")    return this.Parse_If();
      if (t.value === "for")   return this.Parse_For();
      if (t.value === "while") return this.Parse_While();
      // let / var / const
      const decl = this.Parse_VarDecl();
      if (this.Peek().type === "TERMINATOR") this.Consume("TERMINATOR");
      return decl;
    }
    const expr = this.Parse_Expression();
    if (this.Peek().type === "TERMINATOR") this.Consume("TERMINATOR");
    return expr;
  }

  Parse_VarDecl() {
    this.Consume("KEYWORD");
    const name = this.Consume("IDENTIFIER").value;
    this.Consume("ASSIGN");
    const init = this.Parse_Expression();
    return { type: "VarDeclaration", name, init };
  }

  Parse_If() {
    this.Consume("KEYWORD", "if");
    this.Consume("LPAREN");
    const test = this.Parse_Expression();
    this.Consume("RPAREN");
    const consequent = this.Parse_Block();
    let alternate = null;
    if (this.Peek().type === "KEYWORD" && this.Peek().value === "else") {
      this.Consume("KEYWORD", "else");
      // allow "else if"
      alternate = (this.Peek().type === "KEYWORD" && this.Peek().value === "if")
        ? this.Parse_If()
        : this.Parse_Block();
    }
    return { type: "IfStatement", test, consequent, alternate };
  }

  Parse_For() {
    this.Consume("KEYWORD", "for");
    this.Consume("LPAREN");
    let init = null;
    if (this.Peek().type === "KEYWORD") init = this.Parse_VarDecl();
    else if (this.Peek().type !== "TERMINATOR") init = this.Parse_Expression();
    this.Consume("TERMINATOR");
    const test = this.Parse_Expression();
    this.Consume("TERMINATOR");
    const update = this.Parse_Expression();
    this.Consume("RPAREN");
    const body = this.Parse_Block();
    return { type: "ForStatement", init, test, update, body };
  }

  Parse_While() {
    this.Consume("KEYWORD", "while");
    this.Consume("LPAREN");
    const test = this.Parse_Expression();
    this.Consume("RPAREN");
    const body = this.Parse_Block();
    return { type: "WhileStatement", test, body };
  }

  Parse_Block() {
    this.Consume("LBRACE");
    const body = [];
    while (this.Peek().type !== "RBRACE" && this.Peek().type !== "EOF")
      body.push(this.Parse_Statement());
    this.Consume("RBRACE");
    return { type: "BlockStatement", body };
  }

  Parse_Expression() {
    const node = this.Parse_Comparison();
    if (this.Peek().type === "ASSIGN") {
      this.Consume("ASSIGN");
      const right = this.Parse_Expression();
      return { type: "AssignmentExpression", name: node.name, right };
    }
    // i++  /  i--  desugar to  i = i +/- 1
    if (this.Peek().type === "INCREMENT" || this.Peek().type === "DECREMENT") {
      const op = this.Consume(this.Peek().type).type === "INCREMENT" ? "+" : "-";
      return {
        type: "AssignmentExpression",
        name: node.name,
        right: {
          type: "BinaryExpression", operator: op,
          left: { type: "Identifier", name: node.name },
          right: { type: "NumericLiteral", value: 1 },
        },
      };
    }
    return node;
  }

  Parse_Binary(next, types) {
    let left = next.call(this);
    while (types.includes(this.Peek().type)) {
      const op = this.Consume(this.Peek().type);
      const right = next.call(this);
      left = { type: "BinaryExpression", operator: op.value, left, right };
    }
    return left;
  }
  Parse_Comparison() { return this.Parse_Binary(this.Parse_Additive, ["REL_OP"]); }
  Parse_Additive()   { return this.Parse_Binary(this.Parse_Term, ["ADD", "SUB"]); }
  Parse_Term()       { return this.Parse_Binary(this.Parse_Power, ["MULT", "DIV"]); }

  Parse_Power() {
    const left = this.Parse_Factor();
    if (this.Peek().type === "POWER") {
      this.Consume("POWER");
      return { type: "BinaryExpression", operator: "^", left, right: this.Parse_Power() };
    }
    return left;
  }

  Parse_Factor() {
    const t = this.Peek();
    switch (t.type) {
      case "NUMBER":
        this.Consume("NUMBER");
        return { type: "NumericLiteral", value: parseFloat(t.value) };
      case "IDENTIFIER":
        this.Consume("IDENTIFIER");
        if (this.Peek().type === "LBRACKET") {
          this.Consume("LBRACKET");
          const index = this.Parse_Expression();
          this.Consume("RBRACKET");
          return { type: "MemberExpression", name: t.value, index };
        }
        return { type: "Identifier", name: t.value };
      case "LBRACKET": {
        this.Consume("LBRACKET");
        const elements = [];
        if (this.Peek().type !== "RBRACKET") {
          elements.push(this.Parse_Expression());
          while (this.Peek().type === "COMMA") {
            this.Consume("COMMA");
            elements.push(this.Parse_Expression());
          }
        }
        this.Consume("RBRACKET");
        return { type: "ArrayLiteral", elements };
      }
      case "LPAREN": {
        this.Consume("LPAREN");
        const inside = this.Parse_Expression();
        this.Consume("RPAREN");
        return inside;
      }
    }
    throw new Error("Invalid factor token: " + t.type);
  }
}

// 2. RECURSIVE TREE-WALK EVALUATOR
const MAX_ITERATIONS = 100000; // guard against infinite loops in the DSL

function evaluate_AST(node, env = new Environment()) {
  if (!node) return null;

  switch (node.type) {
    case "Program": {
      let last = null;
      for (const stmt of node.body) last = evaluate_AST(stmt, env);
      return last;
    }

    case "BlockStatement": {
      const blockEnv = new Environment(env);        // new child scope
      let last = null;
      for (const stmt of node.body) last = evaluate_AST(stmt, blockEnv);
      return last;
    }

    case "NumericLiteral": return node.value;

    case "ArrayLiteral": return node.elements.map(el => evaluate_AST(el, env));

    case "Identifier": return env.get(node.name);

    case "MemberExpression": {
      const arr = env.get(node.name);
      const idx = evaluate_AST(node.index, env);
      if (!Array.isArray(arr)) throw new Error(`${node.name} is not an array`);
      if (idx < 0 || idx >= arr.length) throw new Error(`Index ${idx} out of bounds for ${node.name}`);
      return arr[idx];
    }

    case "VarDeclaration":                          // declare in current scope
      return env.set(node.name, evaluate_AST(node.init, env));

    case "AssignmentExpression":                    // update nearest existing binding
      return env.assign(node.name, evaluate_AST(node.right, env));

    // ---------- conditional branch ----------
    case "IfStatement": {
      if (evaluate_AST(node.test, env)) return evaluate_AST(node.consequent, env);
      if (node.alternate)               return evaluate_AST(node.alternate, env);
      return null;
    }

    // ---------- loops ----------
    case "ForStatement": {
      const forEnv = new Environment(env);          // scope for the loop variable
      if (node.init) evaluate_AST(node.init, forEnv);
      let last = null, count = 0;
      while (evaluate_AST(node.test, forEnv)) {
        if (++count > MAX_ITERATIONS) throw new Error("Loop limit exceeded");
        last = evaluate_AST(node.body, forEnv);     // body gets its own child scope
        if (node.update) evaluate_AST(node.update, forEnv);
      }
      return last;
    }

    case "WhileStatement": {
      let last = null, count = 0;
      while (evaluate_AST(node.test, env)) {
        if (++count > MAX_ITERATIONS) throw new Error("Loop limit exceeded");
        last = evaluate_AST(node.body, env);
      }
      return last;
    }

    case "BinaryExpression": {
      const l = evaluate_AST(node.left, env);
      const r = evaluate_AST(node.right, env);
      switch (node.operator) {
        case "+":  return l + r;
        case "-":  return l - r;
        case "*":  return l * r;
        case "/":
          if (r === 0) throw new Error("Division by zero");
          return l / r;
        case "^":  return l ** r;
        case ">":  return l > r;
        case "<":  return l < r;
        case ">=": return l >= r;
        case "<=": return l <= r;
        case "==": return l == r;
        case "!=": return l != r;
      }
      throw new Error("Unknown operator: " + node.operator);
    }
  }
  throw new Error("Unknown node type: " + node.type);
}

// Run helper (lexer -> parser -> evaluator)
function run(src, env = new Environment()) {
  const ast = new Parser(new Lexer(src).tokenize()).Parse_Program();
  return { result: evaluate_AST(ast, env), env };
}

module.exports = { Environment, Lexer, Parser, evaluate_AST, run };
