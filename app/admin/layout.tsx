import { requireAdmin } from "@/lib/auth/guards";
import { branding } from "@/lib/config/branding";
import { signOutAction } from "@/lib/server/authActions";
import { Button } from "@/components/ui/Button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-white text-xs font-bold">
              A
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">
                {branding.pitchName} · Admin
              </div>
              <div className="text-[11px] text-slate-500">
                Signed in as <span className="font-mono">{session.phone}</span>
              </div>
            </div>
          </div>
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
