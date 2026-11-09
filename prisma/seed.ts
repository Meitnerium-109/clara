/**
 * Seeds the demo staff user and sample orders. Safe to run any number of
 * times: orders and results are only created when missing, never overwritten,
 * so a re-seed can't undo what an import changed (e.g. un-sign an order).
 *
 * Signed orders without a report link then go through the real sign-off
 * delivery (link, message, callback task), the same code an import uses.
 *
 * Run with: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import { assessResult, isOrderCritical } from "../src/lib/flags";
import { parseLisStatus } from "../src/lib/lisStatus";
import { maskMobile, normaliseMobile } from "../src/lib/mobile";
import { normalisePatientName } from "../src/lib/patientName";
import { deliverPendingSignoffs } from "../src/server/delivery";
import { hashPassword } from "../src/server/password";
import { SEED_ORDERS, type SeedOrder } from "./seed-data";

const prisma = new PrismaClient();

async function seedStaff() {
  const email = process.env.SEED_STAFF_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_STAFF_PASSWORD;
  if (!email || !email.includes("@")) {
    throw new Error("SEED_STAFF_EMAIL must be set to an email address in .env");
  }
  if (!password) {
    throw new Error("SEED_STAFF_PASSWORD is empty in .env");
  }
  if (password.length < 12) {
    throw new Error("SEED_STAFF_PASSWORD in .env is shorter than 12 characters");
  }

  const passwordHash = await hashPassword(password);
  // Updating the hash means changing the password in .env and re-seeding just works.
  await prisma.staffUser.upsert({
    where: { email },
    create: { email, passwordHash, name: "Front desk (demo)" },
    update: { passwordHash },
  });
  return email;
}

async function seedOrder(seed: SeedOrder) {
  const mobile = normaliseMobile(seed.mobile);
  if (!mobile.ok) throw new Error(`${seed.orderId}: ${mobile.reason}`);
  const lis = parseLisStatus(seed.status);
  if (!lis) throw new Error(`${seed.orderId}: unknown status "${seed.status}"`);

  const results = seed.results.map((r) => ({
    parameter: r.parameter,
    unit: r.unit,
    valueText: r.value,
    refText: r.range,
    ...assessResult({ parameter: r.parameter, unit: r.unit, valueText: r.value, refText: r.range }),
  }));
  const critical = isOrderCritical(
    lis.lisCritical,
    results.map((r) => r.flag),
  );

  const name = normalisePatientName(seed.patient);
  const patient = await prisma.patient.upsert({
    where: { mobile_name: { mobile: mobile.e164, name } },
    create: { mobile: mobile.e164, name },
    update: {},
  });

  const order = await prisma.order.upsert({
    where: { lisOrderId: seed.orderId },
    create: {
      lisOrderId: seed.orderId,
      patientId: patient.id,
      referringDoctor: seed.doctor,
      status: lis.status,
      critical,
      signedAt: lis.status === "READY" ? new Date() : null,
    },
    update: {},
  });

  for (const r of results) {
    await prisma.result.upsert({
      where: { orderId_parameter: { orderId: order.id, parameter: r.parameter } },
      create: { orderId: order.id, ...r },
      update: {},
    });
  }

  return { seed, mobile: mobile.e164, critical, flags: results.map((r) => `${r.parameter}: ${r.flag}`) };
}

async function main() {
  const staffEmail = await seedStaff();
  console.log(`Staff user: ${staffEmail}`);

  const seeded = [];
  for (const seed of SEED_ORDERS) seeded.push(await seedOrder(seed));

  console.table(
    seeded.map(({ seed, mobile, critical, flags }) => ({
      order: seed.orderId,
      patient: seed.patient,
      mobile: maskMobile(mobile),
      status: seed.status,
      critical,
      results: flags.join(", "),
    })),
  );

  const [patients, orders, results] = await Promise.all([
    prisma.patient.count(),
    prisma.order.count(),
    prisma.result.count(),
  ]);
  console.log(`Totals in database: ${patients} patients, ${orders} orders, ${results} results`);

  const delivery = await deliverPendingSignoffs(prisma);
  console.log(`Sign-off delivery: ${delivery.sent} report links queued, ${delivery.callbacks} callback tasks created`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
