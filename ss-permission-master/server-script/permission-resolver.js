(function (root) {
  "use strict";

  var SCOPE = Object.freeze({
    DENY: "0",
    REGULAR_ONLY: "1",
    ALL_EMPLOYEES: "2"
  });

  var OVERRIDE = Object.freeze({
    USE_ORGANIZATION: "0",
    ALLOW: "1",
    DENY: "2"
  });

  var ACTION_COLUMNS = Object.freeze({
    appAccess: "ClassB",
    recordCreate: "ClassC",
    recordUpdate: "ClassD",
    recordDelete: "ClassE"
  });

  function normalizeCode(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value);
  }

  function isTemporaryUser(userId) {
    return String(userId || "").toUpperCase().includes("X");
  }

  function resolveOrganizationScope(scopeCode, userId) {
    var scope = normalizeCode(scopeCode, SCOPE.DENY);

    if (scope === SCOPE.ALL_EMPLOYEES) return true;
    if (scope === SCOPE.REGULAR_ONLY) return !isTemporaryUser(userId);
    return false;
  }

  function resolveAction(options) {
    var overrideCode = normalizeCode(
      options.userOverrideCode,
      OVERRIDE.USE_ORGANIZATION
    );

    if (overrideCode === OVERRIDE.ALLOW) return true;
    if (overrideCode === OVERRIDE.DENY) return false;

    return resolveOrganizationScope(options.organizationScopeCode, options.userId);
  }

  function resolvePermissions(options) {
    var organization = options.organization || {};
    var userOverride = options.userOverride || {};
    var permissions = {};

    Object.keys(ACTION_COLUMNS).forEach(function (action) {
      var columnName = ACTION_COLUMNS[action];
      permissions[action] = resolveAction({
        userId: options.userId,
        organizationScopeCode: organization[columnName],
        userOverrideCode: userOverride[columnName]
      });
    });

    if (!permissions.appAccess) {
      permissions.recordCreate = false;
      permissions.recordUpdate = false;
      permissions.recordDelete = false;
    }

    return permissions;
  }

  var api = Object.freeze({
    SCOPE: SCOPE,
    OVERRIDE: OVERRIDE,
    ACTION_COLUMNS: ACTION_COLUMNS,
    isTemporaryUser: isTemporaryUser,
    resolveOrganizationScope: resolveOrganizationScope,
    resolveAction: resolveAction,
    resolvePermissions: resolvePermissions
  });

  root.PermissionResolver = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
