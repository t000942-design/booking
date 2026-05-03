import { redirect } from "next/navigation";
import { getSession, type Session } from "./session";

export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");
  return session;
}

export async function requireCustomer(): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== "customer") redirect("/");
  return session;
}
