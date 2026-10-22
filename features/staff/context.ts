import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_DEVICE_COOKIE } from "@/lib/auth/route-rules";
import { getAuthUser } from "@/lib/auth/session";
import { getStaffSession } from "./server";

/** Turno vigente en este dispositivo, o de vuelta al teclado de PIN. */
export async function requireStaffShift() {
  const user = await getAuthUser();
  const token = (await cookies()).get(STAFF_DEVICE_COOKIE)?.value;
  const session = user?.isAnonymous ? await getStaffSession(user.id, token) : null;
  if (!session) redirect("/staff");
  return session;
}
