/**
 * Proves against a real Postgres that a report link is sent exactly once, no
 * matter how often or how concurrently an import or delivery runs.
 *
 * Writes to the configured database, so it only runs with RUN_DB_TESTS=1
 * (npm run test:db). Uses TEST- order IDs and its own placeholder mobile, and
 * removes everything it created.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CSV_COLUMNS } from "@/lib/import/csv";
import { signoffDedupeKey } from "@/lib/messages";
import { hashToken } from "@/lib/tokens";
import { db } from "./db";
import { deliverSignoff } from "./delivery";
import { commitImport, previewImport } from "./import";

const RUN = process.env.RUN_DB_TESTS === "1";
const MOBILE = "+919000000098";
const FILE_NAME = "db-test.csv";

function csv(rows: string[][]): string {
  return [CSV_COLUMNS.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

const READY = ["TEST-DB-1", "Test Patient A", "9000000098", "Haemoglobin", "g/dL", "10.2", "12.0-15.5", "Ready", "Dr. Test"];
const CRITICAL = ["TEST-DB-2", "Test Patient B", "9000000098", "Potassium", "mmol/L", "6.8", "3.5-5.1", "Ready (critical)", "Dr. Test"];
const PROCESSING = ["TEST-DB-3", "Test Patient A", "9000000098", "TSH", "µIU/mL", "2.2", "0.4-4.0", "Processing", "Dr. Test"];

async function cleanUp() {
  const orders = await db.order.findMany({ where: { lisOrderId: { startsWith: "TEST-DB-" } }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await db.callbackTask.deleteMany({ where: { orderId: { in: ids } } });
  await db.reportLink.deleteMany({ where: { orderId: { in: ids } } });
  await db.message.deleteMany({ where: { OR: [{ orderId: { in: ids } }, { to: MOBILE }] } });
  await db.order.deleteMany({ where: { id: { in: ids } } }); // results cascade
  await db.patient.deleteMany({ where: { mobile: MOBILE } });
  await db.importBatch.deleteMany({ where: { fileName: FILE_NAME } });
}

async function countsFor(lisOrderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { lisOrderId }, select: { id: true } });
  const [messages, links, tasks] = await Promise.all([
    db.message.count({ where: { orderId: order.id } }),
    db.reportLink.count({ where: { orderId: order.id } }),
    db.callbackTask.count({ where: { orderId: order.id } }),
  ]);
  return { messages, links, tasks };
}

async function importFile(text: string) {
  const preview = await previewImport(text);
  if (!preview.ok) throw new Error(preview.error);
  const result = await commitImport(text, FILE_NAME, staffId, preview.fingerprint);
  if (!result.ok) throw new Error(result.error);
  return result.summary;
}

let staffId = "";

describe.skipIf(!RUN)("sign-off delivery against the database", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    staffId = (await db.staffUser.findFirstOrThrow({ select: { id: true } })).id;
    await cleanUp();
  });
  beforeEach(async () => {
    await cleanUp();
    process.env.DEMO_MODE = "true";
    process.env.APP_URL = "http://localhost:3000";
  });
  afterAll(async () => {
    await cleanUp();
    await db.$disconnect();
  });

  it("importing the same file twice sends each link once", async () => {
    const file = csv([READY, CRITICAL, PROCESSING]);

    const first = await importFile(file);
    expect(first).toMatchObject({ ordersSaved: 3, linksQueued: 2, callbacksCreated: 1 });
    expect(first.signedOrderIds).toHaveLength(2);

    const second = await importFile(file);
    expect(second).toMatchObject({ ordersSaved: 0, linksQueued: 0, callbacksCreated: 0 });

    expect(await countsFor("TEST-DB-1")).toEqual({ messages: 1, links: 1, tasks: 0 });
    expect(await countsFor("TEST-DB-2")).toEqual({ messages: 1, links: 1, tasks: 1 });
    expect(await countsFor("TEST-DB-3")).toEqual({ messages: 0, links: 0, tasks: 0 });
  });

  it("signing a Processing order later sends exactly one link, and only for it", async () => {
    await importFile(csv([READY, PROCESSING]));
    const signed = [...PROCESSING.slice(0, 7), "Ready", "Dr. Test"];
    const later = await importFile(csv([READY, signed]));
    expect(later).toMatchObject({ ordersSaved: 1, linksQueued: 1 });
    expect(await countsFor("TEST-DB-1")).toEqual({ messages: 1, links: 1, tasks: 0 });
    expect(await countsFor("TEST-DB-3")).toEqual({ messages: 1, links: 1, tasks: 0 });
  });

  it("calling delivery again for an already-delivered order does nothing", async () => {
    await importFile(csv([CRITICAL]));
    const order = await db.order.findUniqueOrThrow({ where: { lisOrderId: "TEST-DB-2" } });
    const again = await db.$transaction((tx) =>
      deliverSignoff(tx, { id: order.id, lisOrderId: order.lisOrderId, critical: true, mobile: MOBILE, callbackReason: "x" }),
    );
    expect(again).toEqual({ sent: false, callbackCreated: false });
    expect(await countsFor("TEST-DB-2")).toEqual({ messages: 1, links: 1, tasks: 1 });
  });

  it("five deliveries racing at the same moment still send one link", async () => {
    await importFile(csv([[...READY.slice(0, 7), "Processing", "Dr. Test"]]));
    const order = await db.order.findUniqueOrThrow({ where: { lisOrderId: "TEST-DB-1" } });
    const attempt = () =>
      db.$transaction(
        (tx) =>
          deliverSignoff(tx, { id: order.id, lisOrderId: order.lisOrderId, critical: true, mobile: MOBILE, callbackReason: "x" }),
        { maxWait: 20_000, timeout: 30_000 },
      );
    const results = await Promise.all([attempt(), attempt(), attempt(), attempt(), attempt()]);
    expect(results.filter((r) => r.sent)).toHaveLength(1);
    expect(await countsFor("TEST-DB-1")).toEqual({ messages: 1, links: 1, tasks: 1 });
  });

  it("a signed order re-sent as critical gets one callback task and no second link", async () => {
    await importFile(csv([READY]));
    const critical = [...READY.slice(0, 7), "Ready (critical)", "Dr. Test"];
    expect(await importFile(csv([critical]))).toMatchObject({ ordersSaved: 1, linksQueued: 0, callbacksCreated: 1 });
    expect(await importFile(csv([critical]))).toMatchObject({ ordersSaved: 0, callbacksCreated: 0 });
    expect(await countsFor("TEST-DB-1")).toEqual({ messages: 1, links: 1, tasks: 1 });
    const order = await db.order.findUniqueOrThrow({ where: { lisOrderId: "TEST-DB-1" } });
    expect(order.critical).toBe(true);
  });

  it("refuses to commit when the preview is stale", async () => {
    const file = csv([READY]);
    const preview = await previewImport(file);
    if (!preview.ok) throw new Error(preview.error);
    await importFile(file); // someone else commits first
    const late = await commitImport(file, FILE_NAME, staffId, preview.fingerprint);
    expect(late).toMatchObject({ ok: false, stale: true });
    expect(await countsFor("TEST-DB-1")).toEqual({ messages: 1, links: 1, tasks: 0 });
  });

  it("in demo mode, the stored message holds a link whose hash matches the stored token hash", async () => {
    await importFile(csv([READY]));
    const message = await db.message.findUniqueOrThrow({ where: { dedupeKey: signoffDedupeKey("TEST-DB-1") } });
    const token = message.body?.match(/\/r\/([A-Za-z0-9_-]{43})/)?.[1];
    expect(token).toBeDefined();
    const link = await db.reportLink.findFirstOrThrow({ where: { orderId: message.orderId! } });
    expect(link.tokenHash).toBe(hashToken(token!));
    expect(link.tokenHash).not.toBe(token);
    expect(link.expiresAt.getTime() - link.createdAt.getTime()).toBe(72 * 60 * 60 * 1000);
  });

  it("outside demo mode, the message body is not stored", async () => {
    process.env.DEMO_MODE = "false";
    await importFile(csv([READY]));
    const message = await db.message.findUniqueOrThrow({ where: { dedupeKey: signoffDedupeKey("TEST-DB-1") } });
    expect(message.body).toBeNull();
    expect(message).toMatchObject({ to: MOBILE, kind: "REPORT_LINK", status: "SENT" }); // accepted by the mock provider
  });
});
