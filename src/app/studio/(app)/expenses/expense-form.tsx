import { Field, Input, Select, Textarea } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { ActionForm, type FormAction } from "../_components/action-form";

export type ExpenseValues = {
  id?: string;
  date: string;
  category: string;
  vendor: string;
  amount: string; // dollars, e.g. "24.50"
  notes: string;
  projectId: string | null;
};

export function ExpenseForm({
  action,
  values,
  projects,
  submitLabel,
}: {
  action: FormAction;
  values: ExpenseValues;
  projects: { id: string; title: string }[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Field label="Date">
        <Input name="date" type="date" defaultValue={values.date} required />
      </Field>
      <Field label="Amount ($)">
        <Input
          name="amount"
          inputMode="decimal"
          defaultValue={values.amount}
          required
          placeholder="24.50"
          autoComplete="off"
        />
      </Field>
      <Field label="Category">
        <Select name="category" defaultValue={values.category} required>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Vendor / store">
        <Input name="vendor" defaultValue={values.vendor} maxLength={120} placeholder="Kodak, Adobe, Delta…" />
      </Field>
      <Field label="Project (optional)" hint="Tie it to a client job, like film for one wedding.">
        <Select name="projectId" defaultValue={values.projectId ?? ""}>
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes (optional)">
        <Textarea name="notes" defaultValue={values.notes} maxLength={1000} className="min-h-12" />
      </Field>
      <div className="md:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
