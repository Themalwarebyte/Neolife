import { prisma } from "@/server/db/prisma";
import { requireAdmin } from "@/server/auth/requireCrmUser";
import { toggleUserActive } from "../actions";
import CreateUserForm from "./create-user-form";

export default async function UsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">Users</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Manage CRM users. Only Owner accounts can create and deactivate users.
      </p>

      <CreateUserForm />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-neutral-800">
          Existing users
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase text-neutral-400">
                <th className="pb-3 pl-1">Name</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Password</th>
                <th className="pb-3">Created</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-neutral-100">
                  <td className="py-3 pl-1 font-medium text-neutral-900">
                    {u.name}
                  </td>
                  <td className="py-3 text-neutral-600">{u.email}</td>
                  <td className="py-3">
                    <span
                      className={
                        u.role === "admin"
                          ? "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                          : "inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800"
                      }
                    >
                      {u.role === "admin" ? "Owner" : "Staff"}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={
                        u.isActive
                          ? "text-green-600"
                          : "text-neutral-400"
                      }
                    >
                      {u.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="py-3">
                    {u.mustChangePassword && u.role !== "admin" ? (
                      <span className="text-xs text-amber-600">
                        Change required
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-neutral-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    <form action={toggleUserActive.bind(null, u.id)}>
                      <button
                        type="submit"
                        disabled={u.role === "admin"}
                        className={
                          u.role === "admin"
                            ? "cursor-not-allowed text-xs text-neutral-300"
                            : "rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                        }
                      >
                        {u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-neutral-400">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
