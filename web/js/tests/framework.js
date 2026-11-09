/**
 * Lightweight Hermetic Test Runner Framework for Browser Unit Tests
 */

export const suites = [];

export function describe(suiteName, fn) {
  const tests = [];
  fn((testName, testFn) => tests.push({ name: testName, fn: testFn }));
  suites.push({ name: suiteName, tests });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || "assertEqual failed"}: expected [${expected}], got [${actual}]`);
  }
}

export function assertNear(actual, expected, tolerance = 1e-4, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message || "assertNear failed"}: expected [${expected}], got [${actual}] (diff: ${Math.abs(actual - expected)})`);
  }
}

