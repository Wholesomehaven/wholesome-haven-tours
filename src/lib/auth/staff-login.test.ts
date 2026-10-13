import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DEFAULT_STAFF_USERNAME, staffCredentialsMatch } from "./staff-login.ts";

const original = {
  STAFF_PASSWORD: process.env.STAFF_PASSWORD,
  STAFF_USERNAME: process.env.STAFF_USERNAME,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
};

afterEach(() => {
  if (original.STAFF_PASSWORD === undefined) delete process.env.STAFF_PASSWORD;
  else process.env.STAFF_PASSWORD = original.STAFF_PASSWORD;
  if (original.STAFF_USERNAME === undefined) delete process.env.STAFF_USERNAME;
  else process.env.STAFF_USERNAME = original.STAFF_USERNAME;
  if (original.BETTER_AUTH_SECRET === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = original.BETTER_AUTH_SECRET;
});

describe("tour desk staff login", () => {
  it("accepts the staff username with its password", () => {
    delete process.env.STAFF_PASSWORD;
    delete process.env.STAFF_USERNAME;
    process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret";
    assert.equal(DEFAULT_STAFF_USERNAME, "whstaff");
    assert.equal(staffCredentialsMatch("whstaff", "Wh-j1FiQuyBAhbD"), true);
    assert.equal(staffCredentialsMatch("WHStaff", "Wh-j1FiQuyBAhbD"), true);
    assert.equal(staffCredentialsMatch("whstaff", "wrong-password"), false);
    assert.equal(staffCredentialsMatch("someoneelse", "Wh-j1FiQuyBAhbD"), false);
  });

  it("prefers STAFF_PASSWORD when Railway sets one", () => {
    process.env.STAFF_PASSWORD = "override-secret";
    process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret";
    assert.equal(staffCredentialsMatch("whstaff", "override-secret"), true);
    assert.equal(staffCredentialsMatch("whstaff", "Wh-j1FiQuyBAhbD"), false);
  });
});
