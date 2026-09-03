import assert from "node:assert/strict";
import test from "node:test";
import { AccountScopeTransition } from "../src/accounts/accountScopeTransition";

test("newer account evidence invalidates older in-flight ownership", () => {
  const transition = new AccountScopeTransition();
  const accountB = transition.begin();
  const accountA = transition.begin();
  assert.equal(transition.isPending, true);
  assert.equal(transition.isCurrent(accountB), false);
  assert.equal(transition.complete(accountB), false);
  assert.equal(transition.isPending, true);
  assert.equal(transition.isCurrent(accountA), true);
  assert.equal(transition.complete(accountA), true);
  assert.equal(transition.isPending, false);
});

test("logout starts a new fail-closed transition until its state is applied", () => {
  const transition = new AccountScopeTransition();
  const signedIn = transition.begin();
  assert.equal(transition.complete(signedIn), true);
  assert.equal(transition.isPending, false);
  const logout = transition.begin();
  assert.equal(transition.isPending, true);
  assert.equal(transition.complete(logout), true);
  assert.equal(transition.isPending, false);
});
