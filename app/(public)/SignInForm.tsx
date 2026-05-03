"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import {
  requestSignInAction,
  type AuthState,
} from "@/lib/server/authActions";

const initial: AuthState = { error: null };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(requestSignInAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field
        label="Phone number"
        htmlFor="signin-phone"
        hint="Kuwait local format (8 digits) or include +965."
        error={state.error}
      >
        <Input
          id="signin-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="9XXX XXXX"
          invalid={Boolean(state.error)}
          disabled={pending}
        />
      </Field>
      <Button type="submit" size="block" disabled={pending}>
        {pending ? "Sending code…" : "Continue"}
      </Button>
    </form>
  );
}
