"use server";

import { redirect } from "next/navigation";
import { endStaffSession } from "@/server/staffSession";

export async function signOut() {
  await endStaffSession();
  redirect("/staff/login");
}
