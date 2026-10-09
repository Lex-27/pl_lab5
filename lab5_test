/*
PL LAB 5 - TESTS for the Rule Engine DSL
Run:  node lab5_test.js
*/
const { Environment, run } = require("./lab5_rule_engine");

let passed = 0, failed = 0;

function expect(name, src, expected) {
  try {
    const { result } = run(src);
    if (result === expected) { passed++; console.log(`PASS  ${name}`); }
    else { failed++; console.log(`FAIL  ${name}  (expected ${expected}, got ${result})`); }
  } catch (e) { failed++; console.log(`FAIL  ${name}  (threw: ${e.message})`); }
}

function expectError(name, src, messagePart) {
  try {
    run(src);
    failed++; console.log(`FAIL  ${name}  (no error thrown)`);
  } catch (e) {
    if (e.message.includes(messagePart)) { passed++; console.log(`PASS  ${name}`); }
    else { failed++; console.log(`FAIL  ${name}  (wrong error: ${e.message})`); }
  }
}

// ---------- Environment (parent pointer) ----------
console.log("\n-- Environment --");
{
  const global = new Environment();
  const child = new Environment(global);
  global.set("x", 1);
  child.set("y", 2);

  const check = (name, cond) => {
    if (cond) { passed++; console.log(`PASS  ${name}`); }
    else { failed++; console.log(`FAIL  ${name}`); }
  };

  check("child reads parent variable", child.get("x") === 1);
  check("parent cannot see child variable", (() => { try { global.get("y"); return false; } catch { return true; } })());
  child.assign("x", 50);
  check("assign updates parent binding", global.get("x") === 50);
  child.set("x", 7);
  check("set shadows parent binding", child.get("x") === 7 && global.get("x") === 50);
  check("assign to undeclared throws", (() => { try { child.assign("z", 1); return false; } catch { return true; } })());
}

// ---------- Basics ----------
console.log("\n-- Expressions --");
expect("variable + arithmetic", "let x = 10; x = x + 5; x * 2;", 30);
expect("precedence", "2 + 3 * 4;", 14);
expect("power right-assoc", "2 ^ 3 ^ 2;", 512);
expect("parentheses", "(2 + 3) * 4;", 20);
expect("comparison true", "3 < 5;", true);

// ---------- Conditionals ----------
console.log("\n-- If / else --");
expect("if true branch", "let x = 3; let r = 0; if (x < 5) { r = 1; } else { r = 2; } r;", 1);
expect("else branch", "let x = 9; let r = 0; if (x < 5) { r = 1; } else { r = 2; } r;", 2);
expect("if without else", "let r = 5; if (1 > 2) { r = 0; } r;", 5);
expect("else-if chain", "let s = 75; let g = 0; if (s >= 90) { g = 4; } else if (s >= 70) { g = 3; } else { g = 1; } g;", 3);

// ---------- Loops ----------
console.log("\n-- Loops --");
expect("for sum 0..4", "let sum = 0; for (let i = 0; i < 5; i++) { sum = sum + i; } sum;", 10);
expect("for with i = i + 1", "let c = 0; for (let i = 0; i < 3; i = i + 1) { c = c + 2; } c;", 6);
expect("while loop", "let n = 0; while (2 ^ n <= 100) { n = n + 1; } n;", 7);
expect("zero-iteration loop", "let c = 1; for (let i = 0; i < 0; i++) { c = 99; } c;", 1);
expect("nested loop + if", "let c = 0; for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) { if (i == j) { c = c + 1; } } } c;", 4);

// ---------- Arrays ----------
console.log("\n-- Arrays --");
expect("array index", "let a = [10, 20, 30]; a[1];", 20);
expect("sum array in loop", "let nums = [10, 20, 30]; let t = 0; for (let i = 0; i < 3; i++) { t = t + nums[i]; } t;", 60);

// ---------- Scoping ----------
console.log("\n-- Scoping --");
expect("block shadowing doesn't leak", "let x = 1; if (1 < 2) { let x = 99; } x;", 1);
expect("assignment reaches outer scope", "let x = 1; if (1 < 2) { x = 42; } x;", 42);
expect("loop var not visible after loop", "let r = 0; for (let i = 0; i < 3; i++) { r = r + 1; } r;", 3);
expectError("loop var out of scope", "for (let i = 0; i < 3; i++) { } i;", "Undefined variable");

// ---------- Errors ----------
console.log("\n-- Errors --");
expectError("undefined variable", "y + 1;", "Undefined variable");
expectError("division by zero", "let a = 1 / 0;", "Division by zero");
expectError("index out of bounds", "let a = [1, 2]; a[5];", "out of bounds");
expectError("infinite loop guard", "while (1 < 2) { }", "Loop limit");
expectError("bad syntax", "let = 5;", "Expected IDENTIFIER");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
