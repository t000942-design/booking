import { z } from "zod";
import { branding } from "@/lib/config/branding";

const phoneRegex = /^\+?[\d\s-]{6,20}$/;

export const createBookingSchema = z.object({
  customerName: z.string().trim().min(2, "Name is too short").max(80),
  customerPhone: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid phone number"),
  teamName: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  hour: z
    .number()
    .int()
    .min(branding.openingHour)
    .max(branding.closingHour - 1),
  pitch: z.string().refine(
    (value) => branding.pitches.includes(value),
    { message: "Pick one of the available pitches" },
  ),
});

export type CreateBookingDTO = z.infer<typeof createBookingSchema>;
