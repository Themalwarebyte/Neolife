import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { Container } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Office Sign in — NEOLIFE" };

export default function AdminLoginPage() {
  return (
    <main id="main-content">
      <Container className="flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-sm">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-brand-600">
            Office
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold text-neutral-900">
            Sign in to the CRM
          </h1>
          <div className="mt-6 rounded-3xl border border-neutral-100 bg-white p-6 shadow-xl shadow-neutral-900/5 sm:p-8">
            <LoginForm />
          </div>
        </div>
      </Container>
    </main>
  );
}
