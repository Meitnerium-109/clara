-- CreateTable
CREATE TABLE "StaffLoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffLoginAttempt_email_at_idx" ON "StaffLoginAttempt"("email", "at");
