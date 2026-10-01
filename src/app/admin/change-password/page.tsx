import { getCrmUser } from "@/server/auth/requireCrmUser";
import { redirect } from "next/navigation";
import ChangePasswordForm from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getCrmUser();
  if (!user) redirect("/admin/login");
  if (!user.mustChangePassword) redirect("/admin/leads");
  return <ChangePasswordForm />;
}
