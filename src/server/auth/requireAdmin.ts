/** Legacy admin-only guard, now using the same active-account DB check. */
import { getCrmUser } from "@/server/auth/requireCrmUser";

export async function getAdminUser() {
  const user = await getCrmUser();
  return user?.role === "admin" ? user : null;
}

export async function isAdmin() {
  return (await getAdminUser()) !== null;
}
