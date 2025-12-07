Rego Grammar Implementation GuideThis document explains the structure and logic of the syntax.grammar file used to parse Rego (Open Policy Agent) for CodeMirror 6.1. High-Level StructureThe grammar is defined using Lezer, a GLR (Generalized Left-to-Right) parser generator designed for incremental parsing in editors.The entry point is @top Script, which defines a Rego module as a sequence of specific high-level constructs.JavaScript@top Script {
  PackageDeclaration?   // 1. Optional package definition
  ImportStatement* // 2. Zero or more imports
  (Rule | defaultKeyword Rule)* // 3. The main logic (Rules)
}
2. The Ambiguity ProblemRego is syntactically ambiguous because curly braces { ... } are overloaded. They can represent:Rule Bodies: allow { input.admin }Object Literals: x := { "a": 1 }Set Literals: y := { 1, 2, 3 }How we solve itWe use Lezer's GLR capabilities to attempt multiple parse paths simultaneously, but we structure the grammar to disambiguate as early as possible.Objects require a colon : (e.g., key: value).Rule Bodies contain Statements (keyword constructs or expressions).Sets contain a comma-separated list of Expressions.3. Core ConstructsRulesRules are the core logic units. We handle three main variations:Boolean Rules: allow { ... }Value Rules (Functions): f(x) = y { ... }Partial Rules: deny contains msg if { ... }JavaScriptRule {
  RuleHead  // The name and arguments (e.g., "pred(x, y)")
  (
    (kw<"if"> | kw<"else">)? Body |           // Standard body
    (AssignOp | kw<"if">) Expression |        // One-line assignment
    kw<"contains"> Expression (kw<"if"> Body)? // Set generation
  )
}
ComprehensionsRego allows Python-style comprehensions (e.g., [ x | x := input[_] ]).The grammar distinguishes these from standard Arrays or Objects by looking for the pipe | operator inside the delimiters.JavaScriptArrayComprehension { "[" Expression "|" Body "]" }
4. Operator PrecedencePrecedence is critical for ensuring math and logic evaluate in the correct order (e.g., 3 + 4 * 5 should be 23, not 35).We define precedence levels using the ! notation:Precedence NameUsageDirectionprefixUnary operators (-, !)Right-associativemult*, /, %Left-associativeadd+, -Left-associativecompare==, <, !=, etc.Left-associativelogic& (intersection)Left-associativeassign:=Left-associativeExample in Grammar:JavaScriptExpression !mult ArithOp<"*" | "/" | "%"> Expression
This ensures mult binds tighter than add.5. Tokenizer Logic (@tokens)We define raw lexical tokens at the bottom of the file.Keywords vs Identifiers: We use @specialize to treat specific strings (like package or default) as keywords, while everything else matching [a-zA-Z_]+ is an Identifier.Operators: We explicitly define multi-character operators like := or >= so the parser doesn't split them into two separate tokens (like : and =).JavaScript@tokens {
  Identifier { $[a-zA-Z_] $[a-zA-Z0-9_]* }
  AssignOp { ":=" | "=" } // Defined together to prevent splitting
}
6. Styles and HighlightsThe grammar maps nodes to styling tags (either via an external prop or internal mapping).RuleHead/Identifier $\to$ Function Definition ColorCallExpression/Identifier $\to$ Function Call ColorPackageDeclaration/Identifier $\to$ Namespace ColorThis hierarchical naming allows us to color the word main differently depending on whether it is being defined (package main) or used (data.main).