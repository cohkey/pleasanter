"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var resolverSource = fs.readFileSync(
  path.join(__dirname, "permission-resolver.js"),
  "utf8"
);
var sandbox = {};
vm.createContext(sandbox);
vm.runInContext(resolverSource, sandbox);

var resolver = sandbox.PermissionResolver;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

assert.equal(resolver.isTemporaryUser("user-x001"), true);
assert.equal(resolver.isTemporaryUser("USER-X001"), true);
assert.equal(resolver.isTemporaryUser("user-001"), false);

assert.deepEqual(
  plain(resolver.resolvePermissions({
    userId: "user-001",
    organization: {
      ClassB: "2",
      ClassC: "1",
      ClassD: "2",
      ClassE: "0"
    },
    userOverride: {}
  })),
  {
    appAccess: true,
    recordCreate: true,
    recordUpdate: true,
    recordDelete: false
  }
);

assert.deepEqual(
  plain(resolver.resolvePermissions({
    userId: "user-x001",
    organization: {
      ClassB: "2",
      ClassC: "1",
      ClassD: "2",
      ClassE: "0"
    },
    userOverride: {
      ClassC: "1",
      ClassD: "2"
    }
  })),
  {
    appAccess: true,
    recordCreate: true,
    recordUpdate: false,
    recordDelete: false
  }
);

assert.deepEqual(
  plain(resolver.resolvePermissions({
    userId: "user-001",
    organization: {
      ClassB: "0",
      ClassC: "2",
      ClassD: "2",
      ClassE: "2"
    },
    userOverride: {}
  })),
  {
    appAccess: false,
    recordCreate: false,
    recordUpdate: false,
    recordDelete: false
  }
);

console.log("permission-resolver tests passed");
