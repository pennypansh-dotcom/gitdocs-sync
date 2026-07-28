const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");
const { parseLicenseKey } = require("../src/action");

const root = join(__dirname, "..");
const script = join(root, "scripts", "generate-license-key.js");

test("manual license key generator creates readable keys for launch plans", () => {
  const output = execFileSync(process.execPath, [script, "free", "acme-docs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GITDOCS_LICENSE_DATE: "202607" },
  }).trim();

  assert.match(output, /^gds_free_202607_acme-docs_[a-f0-9]{12}$/);
  assert.deepEqual(parseLicenseKey(output), {
    plan: "free",
    issuedMonth: "202607",
    customer: "acme-docs",
  });
});

test("manual license key generator supports paid launch plans", () => {
  const pro = execFileSync(process.execPath, [script, "pro", "acme"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GITDOCS_LICENSE_DATE: "202607" },
  }).trim();
  const team = execFileSync(process.execPath, [script, "team", "acme"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GITDOCS_LICENSE_DATE: "202607" },
  }).trim();

  assert.match(pro, /^gds_pro_202607_acme_[a-f0-9]{12}$/);
  assert.match(team, /^gds_team_202607_acme_[a-f0-9]{12}$/);
});

test("manual license key generator rejects unknown plans", () => {
  assert.throws(
    () => execFileSync(process.execPath, [script, "enterprise", "acme"], { cwd: root, encoding: "utf8" }),
    /plan must be one of/,
  );
});
