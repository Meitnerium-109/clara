"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signInStaff } from "@/server/staffAuth";
import { startStaffSession } from "@/server/staffSession";

const SignInSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(200),
});

export type SignInState = { error?: string; email?: string };

const MESSAGES = {
  invalid: "Email or password is incorrect.",
  locked: "Too many failed attempts. Please wait 15 minutes and try again.",
};

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const typedEmail = String(formData.get("email") ?? "");
  const parsed = SignInSchema.safeParse({ email: typedEmail, password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Enter a valid email address and your password.", email: typedEmail };
  }

  const result = await signInStaff(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: MESSAGES[result.reason], email: typedEmail };

  await startStaffSession(result.staffId);
  redirect("/staff");
}
