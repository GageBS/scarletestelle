"use client";
import { useActionState } from "react";
import { Checkbox, Field, Input, Notice, Select, Textarea } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { PROJECT_TYPES } from "@/lib/constants";
import { savePackage, type FormState } from "./actions";

export type PackageValues = {
  id?: string;
  name: string;
  projectType: string;
  price: string;
  description: string;
  inclusions: string;
  isAddon: boolean;
  active: boolean;
  showOnSite: boolean;
};

export function PackageForm({ values }: { values: PackageValues }) {
  const [state, action] = useActionState<FormState, FormData>(savePackage, {});
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Field label="Name">
        <Input name="name" defaultValue={values.name} required placeholder="The Signature" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Session type">
          <Select name="projectType" defaultValue={values.projectType}>
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Price ($)">
          <Input name="price" defaultValue={values.price} inputMode="decimal" required placeholder="3,200" />
        </Field>
      </div>
      <Field label="Description" className="md:col-span-2">
        <Textarea name="description" defaultValue={values.description} className="min-h-20" />
      </Field>
      <Field label="What's included" hint="One per line — shown as a list on the proposal." className="md:col-span-2">
        <Textarea
          name="inclusions"
          defaultValue={values.inclusions}
          placeholder={"Up to 8 hours of coverage\nFilm + digital\nOnline gallery"}
        />
      </Field>
      <div className="flex flex-wrap gap-x-6 gap-y-3 md:col-span-2">
        <Checkbox name="isAddon" defaultChecked={values.isAddon} label="Add-on (not a collection)" />
        <Checkbox name="active" defaultChecked={values.active} label="Active (can be offered)" />
        <Checkbox name="showOnSite" defaultChecked={values.showOnSite} label="Show on website" />
      </div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <SubmitButton>{values.id ? "Save changes" : "Add"}</SubmitButton>
        {state.ok && <span className="font-sans text-sm text-moss-deep">{state.ok} ✓</span>}
      </div>
      {state.error && (
        <div className="md:col-span-2">
          <Notice tone="bad">{state.error}</Notice>
        </div>
      )}
    </form>
  );
}
