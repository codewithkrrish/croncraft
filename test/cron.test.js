/**
 * CronCraft logic tests — zero dependencies, runs with: node --test test/cron.test.js
 *
 * The unit under test is the <script id="croncraft-logic"> block inside
 * index.html (the exact code users download), extracted and evaluated here.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/<script id="croncraft-logic">([\s\S]*?)<\/script>/);
assert.ok(m, "logic script block must exist in index.html");

const sandbox = {};
new Function("window", m[1])(sandbox);
const CC = sandbox.CronCraft;
assert.ok(CC, "CronCraft namespace must be defined");

function fields(expr) {
  return CC.parseExpression(expr).fields;
}
function raw(expr) {
  return expr.trim().split(/\s+/);
}
function sentence(expr) {
  const p = CC.parseExpression(expr);
  return CC.describe(p, raw(expr));
}
function assertThrowsCron(fn, part) {
  assert.throws(fn, (e) => {
    assert.ok(e instanceof CC.CronParseError, "must throw CronParseError, got " + e);
    if (part) assert.match(e.message, part);
    return true;
  });
}
// No raw stack traces leak to users: message must be a single human line.
function assertHumanError(fn) {
  try {
    fn();
  } catch (e) {
    assert.ok(!/\bat\b .*\(.*:\d+:\d+\)/.test(e.stack.split("\n").slice(1).join("\n")) ||
              e instanceof CC.CronParseError);
    assert.ok(!e.message.includes("\n"), "error message must be single-line");
    return;
  }
  assert.fail("expected an error");
}

describe("parseExpression — happy path", () => {
  it("parses a standard expression into 5 fields", () => {
    const p = CC.parseExpression("30 9 * * MON-FRI");
    assert.equal(p.fields.length, 5);
    assert.equal(p.expression, "30 9 * * MON-FRI");
  });
  it("tolerates extra whitespace", () => {
    const p = CC.parseExpression("  0\t9  *   *  * ");
    assert.equal(p.expression, "0 9 * * *");
  });
  it("accepts month and weekday names (any case)", () => {
    const p = CC.parseExpression("0 0 1 JAN mon");
    assert.deepEqual(fields("0 0 1 JAN mon")[3].values, [1]);
    assert.deepEqual(p.fields[4].values, [1]);
  });
  it("accepts steps, ranges, lists and combos", () => {
    const f = fields("*/15 9-17 1,15 * 1-5/2");
    assert.deepEqual(f[0].values, [0, 15, 30, 45]);
    assert.deepEqual(f[1].values, [9, 10, 11, 12, 13, 14, 15, 16, 17]);
    assert.deepEqual(f[2].values, [1, 15]);
    assert.deepEqual(f[4].values, [1, 3, 5]);
  });
  it("treats ? as a wildcard", () => {
    assert.ok(fields("0 0 ? * *")[2].wildcard);
  });
  it("normalizes day-of-week 7 to Sunday (0)", () => {
    assert.deepEqual(fields("* * * * 7")[4].values, [0]);
  });
  it("dedupes and sorts values", () => {
    assert.deepEqual(fields("* * * * 5,1,5")[4].values, [1, 5]);
  });
});

describe("parseExpression — edge cases", () => {
  it("rejects empty input", () => assertThrowsCron(() => CC.parseExpression(""), /empty/i));
  it("rejects wrong field count", () => {
    assertThrowsCron(() => CC.parseExpression("* * * *"), /5 fields/);
    assertThrowsCron(() => CC.parseExpression("* * * * * *"), /5 fields/);
  });
  it("rejects out-of-range values with the field name", () => {
    assertThrowsCron(() => CC.parseExpression("60 * * * *"), /Minute.*out of range/);
    assertThrowsCron(() => CC.parseExpression("* 24 * * *"), /Hour.*out of range/);
    assertThrowsCron(() => CC.parseExpression("* * 0 * *"), /Day of month/);
    assertThrowsCron(() => CC.parseExpression("* * * 13 *"), /Month/);
    assertThrowsCron(() => CC.parseExpression("* * * * 8"), /Day of week/);
  });
  it("rejects reversed ranges", () => assertThrowsCron(() => CC.parseExpression("30-10 * * * *"), /reversed/));
  it("rejects zero/negative/non-numeric steps", () => {
    assertThrowsCron(() => CC.parseExpression("*/0 * * * *"), /step/);
    assertThrowsCron(() => CC.parseExpression("*/* * * * *"), /step/);
    assertThrowsCron(() => CC.parseExpression("*/x * * * *"), /step/);
  });
  it("rejects unknown names and garbage", () => {
    assertThrowsCron(() => CC.parseExpression("* * * FOO *"), /not a number/);
    assertThrowsCron(() => CC.parseExpression("abc * * * *"), /not a number/);
  });
  it("rejects empty list entries", () => assertThrowsCron(() => CC.parseExpression("1,,2 * * * *"), /empty entry/));
  it("rejects empty fields", () => assertThrowsCron(() => CC.parseField("", CC.FIELD_SPECS[0]), /empty/));
  it("error messages are human-readable single lines", () => {
    assertHumanError(() => CC.parseExpression("99 99 * * *"));
    assertHumanError(() => CC.parseExpression("nope"));
  });
});

describe("nextRuns", () => {
  // Fixed anchor: Monday 2026-10-12 09:00 local.
  const anchor = new Date(2026, 9, 12, 9, 0, 0);

  it("finds the next run of a daily schedule", () => {
    const runs = CC.nextRuns(CC.parseExpression("30 9 * * *"), 1, anchor);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].getHours(), 9);
    assert.equal(runs[0].getMinutes(), 30);
    assert.equal(runs[0].getDate(), 12); // later today
  });
  it("rolls over to tomorrow when today's slot passed", () => {
    const runs = CC.nextRuns(CC.parseExpression("0 8 * * *"), 1, anchor);
    assert.equal(runs[0].getDate(), 13);
    assert.equal(runs[0].getHours(), 8);
  });
  it("computes every-5-minutes correctly", () => {
    const runs = CC.nextRuns(CC.parseExpression("*/5 * * * *"), 3, anchor);
    assert.deepEqual(runs.map((d) => d.getMinutes()), [5, 10, 15].map((m) => m)); // 09:05, 09:10, 09:15
    assert.ok(runs[0] > anchor);
  });
  it("returns strictly increasing times", () => {
    const runs = CC.nextRuns(CC.parseExpression("*/7 * * * *"), 10, anchor);
    for (let i = 1; i < runs.length; i++) assert.ok(runs[i] > runs[i - 1]);
  });
  it("honours weekday restriction (next Monday)", () => {
    // Anchor is Monday 09:00; "0 8 * * MON" already passed today -> next Monday 19th.
    const runs = CC.nextRuns(CC.parseExpression("0 8 * * MON"), 1, anchor);
    assert.equal(runs[0].getDay(), 1);
    assert.equal(runs[0].getDate(), 19);
  });
  it("applies day-of-month OR day-of-week semantics", () => {
    // 15th of month OR Friday at noon: from Mon 12th, next is Thu 15th 12:00
    // (the 15th comes before Friday the 16th).
    const runs = CC.nextRuns(CC.parseExpression("0 12 15 * FRI"), 1, anchor);
    assert.equal(runs[0].getDate(), 15);
    assert.equal(runs[0].getDay(), 4);
  });
  it("crosses month boundaries", () => {
    const end = new Date(2026, 9, 31, 23, 50, 0); // Oct 31
    const runs = CC.nextRuns(CC.parseExpression("0 0 1 * *"), 1, end);
    assert.equal(runs[0].getMonth(), 10); // November
    assert.equal(runs[0].getDate(), 1);
  });
  it("throws a friendly error when the schedule never fires", () => {
    assertThrowsCron(() => CC.nextRuns(CC.parseExpression("0 0 30 2 *"), 1, anchor), /never fire|within a year/);
  });
});

describe("describe — plain English", () => {
  const cases = [
    ["* * * * *", "Every minute"],
    ["*/5 * * * *", "Every 5 minutes"],
    ["0 * * * *", "At 0 minutes past every hour"],
    ["30 9 * * *", "At 09:30 every day"],
    ["0 9 * * MON-FRI", "At 09:00 every weekday"],
    ["0 18 * * 6,0", "At 18:00 every weekend"],
    ["0 8 * * MON", "At 08:00 every Monday"],
    ["0 9 1 * *", "At 09:00 on the 1st of every month"],
    ["0 0 1 1 *", "At 00:00 on the 1st of January"],
    ["30 14 1,15 * *", "At 14:30 on the 1st and 15th of every month"],
    ["0 9 * * MON,WED,FRI", "At 09:00 every Monday, Wednesday and Friday"],
  ];
  for (const [expr, expected] of cases) {
    it(`${expr} -> "${expected}"`, () => {
      assert.equal(sentence(expr), expected);
    });
  }
  it("never returns an empty sentence", () => {
    for (const expr of ["*/20 2-4 * * *", "5 4,6 * JAN,MAR SUN", "0 0 * * *"]) {
      assert.ok(sentence(expr).length > 5, expr);
    }
  });
});

describe("misc", () => {
  it("PRESETS are all valid expressions", () => {
    for (const p of CC.PRESETS) {
      CC.parseExpression(p.expr); // must not throw
      assert.ok(p.label.length > 0);
    }
  });
  it("ordinal suffixes are correct", () => {
    assert.equal(CC.ordinal(1), "1st");
    assert.equal(CC.ordinal(2), "2nd");
    assert.equal(CC.ordinal(3), "3rd");
    assert.equal(CC.ordinal(11), "11th");
    assert.equal(CC.ordinal(21), "21st");
    assert.equal(CC.ordinal(23), "23rd");
  });
});
