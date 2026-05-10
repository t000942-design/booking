"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  createDiscount,
  deleteDiscount,
  DiscountValidationError,
  toggleDiscount,
} from "@/lib/services/discounts";

export interface DiscountState {
  error: string | null;
  fieldErrors?: Record<string, string>;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");
}

export async function createDiscountAction(
  _prev: DiscountState,
  formData: FormData,
): Promise<DiscountState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const percentOff = Number(formData.get("percentOff") ?? NaN);
  const validFrom = String(formData.get("validFrom") ?? "").trim();
  const validTo = String(formData.get("validTo") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const daysOfWeek = (formData.getAll("daysOfWeek") as string[])
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6);

  try {
    await createDiscount({
      name,
      description,
      percentOff,
      validFrom,
      validTo,
      daysOfWeek,
      code: code || null,
    });
    revalidatePath("/admin");
    revalidatePath("/book");
    return { error: null };
  } catch (err) {
    if (err instanceof DiscountValidationError) {
      return {
        error: err.message,
        fieldErrors: { [err.field]: err.message },
      };
    }
    if (err instanceof Error && err.message.includes("already exists")) {
      return {
        error: err.message,
        fieldErrors: { code: err.message },
      };
    }
    throw err;
  }
}

export async function deleteDiscountAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteDiscount(id);
  revalidatePath("/admin");
  revalidatePath("/book");
}

export async function toggleDiscountAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  await toggleDiscount(id, next);
  revalidatePath("/admin");
  revalidatePath("/book");
}
