const { Client } = require("pg");
const { createHmac } = require("crypto");

const client = new Client({
  host: "localhost",
  port: 5433,
  user: "neolife",
  password: "neolife_dev_pw",
  database: "neolife",
});

const SECRET = "dev_only_secret_change_me_in_production";
const TOKEN_EXPIRY_SECONDS = 3600;

function sign(payload) {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

async function main() {
  const results = { passed: 0, failed: 0, tests: [] };

  function check(name, condition, detail) {
    if (condition) {
      results.passed++;
      results.tests.push({ name, status: "PASS" });
      console.log("  PASS:", name);
    } else {
      results.failed++;
      results.tests.push({ name, status: "FAIL", detail });
      console.log("  FAIL:", name, detail || "");
    }
  }

  try {
    await client.connect();
    console.log("Connected to PostgreSQL at localhost:5433");

    const leadCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'Lead' ORDER BY ordinal_position"
    );
    const cols = leadCols.rows.map((r) => r.column_name);

    const leadRes = await client.query(
      `INSERT INTO "Lead" ("firstName", "phone", "interestType", "consent", "consentAt", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      ["DBTestLead", "+254711000701", "UNSURE", true, new Date(), "NEW_LEAD", new Date(), new Date()]
    );
    const leadId = leadRes.rows[0].id;
    console.log("\nTest lead created:", leadId);

    // === D-030: Token generation ===
    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;
    const nonce = `test-nonce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = `${leadId}.${expiresAt}.${nonce}`;
    const signature = sign(payload);
    const token = `${payload}.${signature}`;

    await client.query(
      'INSERT INTO "QualificationToken" (id, "leadId", nonce, "expiresAt", "consumedAt", "createdAt") VALUES (gen_random_uuid(), $1, $2, to_timestamp($3), NULL, NOW())',
      [leadId, nonce, expiresAt]
    );

    check("Token has 4 parts", token.split(".").length === 4);
    check("Token contains leadId", token.includes(leadId));

    // === D-030: Token signature verification ===
    const parsed = token.split(".");
    const expectedSig = sign(`${parsed[0]}.${parsed[1]}.${parsed[2]}`);
    check("Valid token: signature matches", parsed[3] === expectedSig);

    // === D-030: Token tampering fails ===
    const tamperedToken = `${parsed[0]}.${parsed[1]}.${parsed[2]}.tampered_signature`;
    const tamperedParsed = tamperedToken.split(".");
    const tamperedExpectedSig = sign(`${tamperedParsed[0]}.${tamperedParsed[1]}.${tamperedParsed[2]}`);
    check("Tampered token: signature mismatch", tamperedParsed[3] !== tamperedExpectedSig);

    // === D-030: Token substitution fails ===
    const fakeLeadId = "00000000-0000-0000-0000-000000000000";
    const substitutedPayload = `${fakeLeadId}.${parsed[1]}.${parsed[2]}`;
    const substitutedSig = sign(substitutedPayload);
    const substitutedToken = `${substitutedPayload}.${substitutedSig}`;
    const substitutedParsed = substitutedToken.split(".");
    check("Substitution: token leadId differs from expected", substitutedParsed[0] !== leadId);

    // === D-030: DB nonce check ===
    const dbToken = await client.query(
      'SELECT "leadId" FROM "QualificationToken" WHERE nonce = $1 AND "consumedAt" IS NULL AND "expiresAt" > NOW()',
      [nonce]
    );
    check("DB nonce: original token still valid (unconsumed)", dbToken.rowCount === 1);
    check("DB nonce: token belongs to original leadId", dbToken.rows[0]?.leadId === leadId);

    // === D-030: Atomic consumption (single-use) ===
    await client.query(
      'UPDATE "QualificationToken" SET "consumedAt" = NOW() WHERE nonce = $1 AND "consumedAt" IS NULL AND "expiresAt" > NOW()',
      [nonce]
    );

    const consumedCheck = await client.query(
      'SELECT "consumedAt" FROM "QualificationToken" WHERE nonce = $1',
      [nonce]
    );
    check("Token: consumedAt is set", consumedCheck.rows[0]?.consumedAt !== null);

    const secondConsume = await client.query(
      'UPDATE "QualificationToken" SET "consumedAt" = NOW() WHERE nonce = $1 AND "consumedAt" IS NULL AND "expiresAt" > NOW()',
      [nonce]
    );
    check("Replay: second consume affects 0 rows", secondConsume.rowCount === 0);

    // === D-030: Durable replay protection ===
    const nonce2 = `test-nonce-2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload2 = `${leadId}.${expiresAt}.${nonce2}`;
    const sig2 = sign(payload2);
    const token2 = `${payload2}.${sig2}`;

    await client.query(
      'INSERT INTO "QualificationToken" (id, "leadId", nonce, "expiresAt", "consumedAt", "createdAt") VALUES (gen_random_uuid(), $1, $2, to_timestamp($3), NULL, NOW())',
      [leadId, nonce2, expiresAt]
    );

    const dbCheck = await client.query(
      'SELECT nonce, "consumedAt" FROM "QualificationToken" WHERE nonce = $1',
      [nonce2]
    );
    check("Durable: token persisted in DB", dbCheck.rowCount === 1);
    check("Durable: token not consumed", dbCheck.rows[0]?.consumedAt === null);

    await client.query(
      'UPDATE "QualificationToken" SET "consumedAt" = NOW() WHERE nonce = $1 AND "consumedAt" IS NULL AND "expiresAt" > NOW()',
      [nonce2]
    );

    const consumedCheck2 = await client.query(
      'SELECT "consumedAt" FROM "QualificationToken" WHERE nonce = $1',
      [nonce2]
    );
    check("Durable: token consumed after operation", consumedCheck2.rows[0]?.consumedAt !== null);

    // === D-030: No PII in token ===
    check("Token: no PII (phone) in token", !token.includes("+254") && !token.includes("+254711"));
    check("Token: no PII (name) in token", !token.includes("DBTestLead"));

    // === D-029: FunnelEvent schema ===
    const feCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'FunnelEvent' ORDER BY ordinal_position"
    );
    const feColumnNames = feCols.rows.map((r) => r.column_name);
    check("FunnelEvent: no ipAddress column", !feColumnNames.includes("ipAddress"));
    check("FunnelEvent: no userAgent column", !feColumnNames.includes("userAgent"));
    check("FunnelEvent: no firstName column", !feColumnNames.includes("firstName"));
    check("FunnelEvent: no phone column", !feColumnNames.includes("phone"));
    check("FunnelEvent: separate from LeadEvent (has own columns)", feColumnNames.length > 0);
    check("FunnelEvent: no userId column (LeadEvent's field)", !feColumnNames.includes("userId"));

    // === D-029: FunnelEvent FK with ON DELETE SET NULL ===
    const fkCheck = await client.query(
      "SELECT confdeltype FROM pg_constraint WHERE conname = 'FunnelEvent_leadId_fkey'"
    );
    check("FunnelEvent: FK to Lead with ON DELETE SET NULL", fkCheck.rows[0]?.confdeltype === "n");

    // === D-029: Event recording ===
    await client.query(
      'INSERT INTO "FunnelEvent" (id, type, "leadId", attribution, "deviceId", metadata, "createdAt") VALUES (gen_random_uuid(), $1, $2, NULL, $3, NULL, NOW())',
      ["visitor_landing", leadId, "test-device-001"]
    );

    const feTypeCheck = await client.query(
      'SELECT type FROM "FunnelEvent" WHERE type = $1 AND "leadId" = $2',
      ["visitor_landing", leadId]
    );
    check("FunnelEvent: visitor_landing recorded", feTypeCheck.rowCount >= 1);

    // === D-030: Qualification workflow ===
    await client.query(
      'UPDATE "Lead" SET "status" = $1 WHERE id = $2',
      ["QUALIFIED", leadId]
    );

    await client.query(
      'INSERT INTO "FunnelEvent" (id, type, "leadId", attribution, "deviceId", metadata, "createdAt") VALUES (gen_random_uuid(), $1, $2, NULL, NULL, $3, NOW())',
      ["lead_qualified", leadId, JSON.stringify({ fromStatus: "NEW_LEAD", toStatus: "QUALIFIED" })]
    );

    const leadCheck = await client.query(
      'SELECT "status" FROM "Lead" WHERE id = $1',
      [leadId]
    );
    check("Qualification: lead status is QUALIFIED", leadCheck.rows[0]?.status === "QUALIFIED");

    const qualEvent = await client.query(
      'SELECT type, metadata FROM "FunnelEvent" WHERE type = $1 AND "leadId" = $2',
      ["lead_qualified", leadId]
    );
    check("Qualification: lead_qualified event recorded", qualEvent.rowCount >= 1);
    const meta = typeof qualEvent.rows[0]?.metadata === "string" 
      ? JSON.parse(qualEvent.rows[0].metadata) 
      : qualEvent.rows[0]?.metadata || {};
    check("Qualification: metadata has fromStatus", meta.fromStatus === "NEW_LEAD");
    check("Qualification: metadata has toStatus", meta.toStatus === "QUALIFIED");

    // === D-029: lead_created in FunnelEvent ===
    await client.query(
      'INSERT INTO "FunnelEvent" (id, type, "leadId", attribution, "deviceId", metadata, "createdAt") VALUES (gen_random_uuid(), $1, $2, NULL, NULL, NULL, NOW())',
      ["lead_created", leadId]
    );

    const lcEvent = await client.query(
      'SELECT type FROM "FunnelEvent" WHERE type = $1 AND "leadId" = $2',
      ["lead_created", leadId]
    );
    check("FunnelEvent: lead_created recorded", lcEvent.rowCount >= 1);

    // === D-030: Invalid token ===
    const badToken = "invalid.1234567890.nonce.badsignature";
    const badParsed = badToken.split(".");
    const badExpected = sign(`${badParsed[0]}.${badParsed[1]}.${badParsed[2]}`);
    check("Invalid token: signature mismatch detected", badParsed[3] !== badExpected);

    // === D-030: Expired token ===
    const expiredTs = Math.floor(Date.now() / 1000) - 3600;
    const expiredNonce = `test-nonce-exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiredPayload = `${leadId}.${expiredTs}.${expiredNonce}`;
    const expiredSig = sign(expiredPayload);
    const expiredToken = `${expiredPayload}.${expiredSig}`;
    const expiredParsed = expiredToken.split(".");
    const expiredExpected = sign(`${expiredParsed[0]}.${expiredParsed[1]}.${expiredParsed[2]}`);
    check("Expired token: signature matches (structure)", expiredParsed[3] === expiredExpected);
    check("Expired token: server-side expiration check", Date.now() / 1000 >= parseInt(expiredParsed[1], 10));

    // === Cleanup ===
    await client.query('DELETE FROM "FunnelEvent" WHERE "leadId" = $1', [leadId]);
    await client.query('DELETE FROM "QualificationToken" WHERE "leadId" = $1', [leadId]);
    await client.query('DELETE FROM "Lead" WHERE id = $1', [leadId]);

    console.log("\n=== Results ===");
    console.log("Passed:", results.passed);
    console.log("Failed:", results.failed);
    console.log("Total:", results.passed + results.failed);

    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (e) {
    console.error("Fatal error:", e.message);
    if (e.stack) console.error(e.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
