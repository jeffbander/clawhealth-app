/**
 * E2E Test: Patient Creation Flow
 * Tests full lifecycle via test setup API: physician → patient → verify encryption → cleanup
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3001";

async function setup(body: unknown) {
  const res = await fetch(`${BASE_URL}/api/test/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data };
}

let physicianId: string;
let patientId: string;

describe("Patient Creation E2E", () => {
  before(async () => {
    await setup({ action: "cleanup" });
    const res = await setup({
      action: "create_physician",
      clerkUserId: `clerk_test_phys_${Date.now()}`,
      name: "Dr. E2E Tester",
      specialty: "Cardiology",
    });
    assert.equal(res.status, 200, `Physician creation failed: ${JSON.stringify(res.data)}`);
    physicianId = res.data.id;
    console.log(`  ✓ Test physician created: ${physicianId}`);
  });

  after(async () => {
    await setup({ action: "cleanup" });
    console.log(`  ✓ Test data cleaned up`);
  });

  it("should create a patient with all required fields", async () => {
    const res = await setup({
      action: "create_patient",
      clerkUserId: `clerk_test_patient_${Date.now()}`,
      physicianId,
      firstName: "Jane",
      lastName: "TestPatient",
      dateOfBirth: "1985-03-15",
      mrn: "MRN-E2E-001",
      phone: "(212) 555-0199",
      email: "jane.test@clawhealth-e2e.com",
      riskLevel: "HIGH",
      primaryDx: "I50.9",
      conditions: ["Heart Failure", "Hypertension"],
    });

    assert.equal(res.status, 201, `Patient creation failed: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.id, "Patient should have an ID");
    assert.equal(res.data.riskLevel, "HIGH");
    assert.equal(res.data.primaryDx, "I50.9");
    patientId = res.data.id;
    console.log(`  ✓ Patient created: ${patientId}`);
  });

  it("should have encrypted PHI fields in the database", async () => {
    assert.ok(patientId, "Patient must exist from previous test");

    const res = await setup({ action: "get_patient", patientId });
    assert.equal(res.status, 200);
    const patient = res.data;

    // Encrypted fields should NOT contain plaintext
    assert.ok(patient.encFirstName, "encFirstName should exist");
    assert.ok(patient.encLastName, "encLastName should exist");
    assert.ok(patient.encMrn, "encMrn should exist");
    assert.notEqual(patient.encFirstName, "Jane", "First name should be encrypted");
    assert.notEqual(patient.encLastName, "TestPatient", "Last name should be encrypted");
    assert.notEqual(patient.encMrn, "MRN-E2E-001", "MRN should be encrypted");

    // Encrypted format: base64 packed (iv + tag + ciphertext)
    assert.ok(patient.encFirstName.length > 40, "Encrypted field should be longer than plaintext (base64 packed)");
    console.log(`  ✓ PHI encryption verified — all fields encrypted at rest`);
  });

  it("should store correct metadata alongside encrypted PHI", async () => {
    const res = await setup({ action: "get_patient", patientId });
    const patient = res.data;

    assert.equal(patient.riskLevel, "HIGH", "Risk level should be stored as plaintext");
    assert.equal(patient.primaryDx, "I50.9", "Primary diagnosis should be stored as plaintext");
    assert.equal(patient.organizationId, "org_test", "Organization should be org_test");
    assert.equal(patient.physicianId, physicianId, "Physician ID should match");
    assert.ok(patient.createdAt, "Should have creation timestamp");
    console.log(`  ✓ Metadata stored correctly (riskLevel, primaryDx, physicianId)`);
  });

  it("should have encrypted phone number that can match via Twilio lookup", async () => {
    const res = await setup({ action: "get_patient", patientId });
    const patient = res.data;

    assert.ok(patient.encPhone, "Phone should be stored encrypted");
    assert.notEqual(patient.encPhone, "(212) 555-0199", "Phone should not be plaintext");
    assert.ok(patient.encPhone.length > 40, "Phone should be base64 encrypted (longer than plaintext)");
    console.log(`  ✓ Phone number encrypted — ready for Twilio lookup`);
  });

  it("should create multiple patients for the same physician", async () => {
    const res = await setup({
      action: "create_patient",
      clerkUserId: `clerk_test_patient2_${Date.now()}`,
      physicianId,
      firstName: "Robert",
      lastName: "SecondPatient",
      dateOfBirth: "1970-08-22",
      mrn: "MRN-E2E-002",
      riskLevel: "CRITICAL",
      primaryDx: "I48.91",
      conditions: ["Atrial Fibrillation", "Hypertension"],
    });

    assert.equal(res.status, 201);
    assert.notEqual(res.data.id, patientId, "Should be a different patient");
    assert.equal(res.data.riskLevel, "CRITICAL");
    console.log(`  ✓ Second patient created: ${res.data.id}`);
  });
});
