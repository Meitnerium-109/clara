-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PROCESSING', 'READY');

-- CreateEnum
CREATE TYPE "ResultFlag" AS ENUM ('NORMAL', 'LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'TE', 'HI');

-- CreateEnum
CREATE TYPE "SummarySource" AS ENUM ('TEMPLATE', 'AI', 'FALLBACK', 'NONE');

-- CreateEnum
CREATE TYPE "LinkReason" AS ENUM ('SIGNOFF', 'RESEND');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('REPORT_LINK', 'OTP');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('PATIENT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('LINK_OPENED', 'OTP_SENT', 'OTP_VERIFIED', 'OTP_FAILED', 'REPORT_VIEWED', 'PDF_DOWNLOADED', 'SUMMARY_FLAGGED', 'LINK_RESENT', 'CALLBACK_DONE');

-- CreateEnum
CREATE TYPE "CallbackStatus" AS ENUM ('OPEN', 'DONE');

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "wordingVersion" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "lisOrderId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "referringDoctor" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "valueText" TEXT NOT NULL,
    "valueNum" DOUBLE PRECISION,
    "refText" TEXT NOT NULL,
    "refLow" DOUBLE PRECISION,
    "refHigh" DOUBLE PRECISION,
    "flag" "ResultFlag" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "text" TEXT NOT NULL,
    "source" "SummarySource" NOT NULL,
    "flaggedAt" TIMESTAMP(3),
    "flagNote" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportLink" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "reason" "LinkReason" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "body" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "orderId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "staffUserId" TEXT,
    "patientId" TEXT,
    "action" "AccessAction" NOT NULL,
    "orderId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallbackTask" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CallbackStatus" NOT NULL DEFAULT 'OPEN',
    "note" VARCHAR(1000),
    "doneById" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_mobile_name_key" ON "Patient"("mobile", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_mobile_wordingVersion_key" ON "Consent"("mobile", "wordingVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Order_lisOrderId_key" ON "Order"("lisOrderId");

-- CreateIndex
CREATE INDEX "Order_patientId_idx" ON "Order"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_orderId_parameter_key" ON "Result"("orderId", "parameter");

-- CreateIndex
CREATE UNIQUE INDEX "Summary_resultId_language_key" ON "Summary"("resultId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "ReportLink_tokenHash_key" ON "ReportLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ReportLink_orderId_idx" ON "ReportLink"("orderId");

-- CreateIndex
CREATE INDEX "OtpChallenge_mobile_createdAt_idx" ON "OtpChallenge"("mobile", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_dedupeKey_key" ON "Message"("dedupeKey");

-- CreateIndex
CREATE INDEX "Message_to_createdAt_idx" ON "Message"("to", "createdAt");

-- CreateIndex
CREATE INDEX "Message_orderId_idx" ON "Message"("orderId");

-- CreateIndex
CREATE INDEX "AccessLog_orderId_at_idx" ON "AccessLog"("orderId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "CallbackTask_orderId_key" ON "CallbackTask"("orderId");

-- CreateIndex
CREATE INDEX "CallbackTask_status_createdAt_idx" ON "CallbackTask"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportLink" ADD CONSTRAINT "ReportLink_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportLink" ADD CONSTRAINT "ReportLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackTask" ADD CONSTRAINT "CallbackTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackTask" ADD CONSTRAINT "CallbackTask_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
