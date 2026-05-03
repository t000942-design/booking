"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import {
  requestSignUpAction,
  type AuthState,
} from "@/lib/server/authActions";

const initial: AuthState = { error: null };

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(requestSignUpAction, initial);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field
        label="Your name"
        htmlFor="signup-name"
        required
        error={fieldErrors.name}
      >
        <Input
          id="signup-name"
          name="name"
          autoComplete="name"
          placeholder="e.g. Ahmed"
          required
          invalid={Boolean(fieldErrors.name)}
          disabled={pending}
        />
      </Field>
      <Field
        label="Phone number"
        htmlFor="signup-phone"
        hint="Kuwait local format (8 digits) or include +965."
        required
        error={fieldErrors.phone}
      >
        <Input
          id="signup-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="9XXX XXXX"
          invalid={Boolean(fieldErrors.phone)}
          disabled={pending}
        />
      </Field>
      {state.error && !state.fieldErrors ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      <Button type="submit" size="block" disabled={pending}>
        {pending ? "Sending code…" : "Create account"}
      </Button>
    </form>
  );
}
