import { Checkbox, Field, Input, Select, Textarea } from "@/components/studio/ui";
import { SubmitButton } from "@/components/studio/client-ui";
import { ActionForm, type FormAction } from "../_components/action-form";
import { PhotoPicker, type PickPhoto } from "./photo-picker";

export type ReviewFormValues = {
  id?: string;
  name: string;
  sessionType: string;
  quote: string;
  pullQuote: string;
  photoId: string | null;
  projectId: string | null;
  rating: number | null;
  featured: boolean;
  published: boolean;
  sort: number;
};

export function ReviewForm({
  action,
  values,
  photos,
  projects,
  submitLabel,
}: {
  action: FormAction;
  values: ReviewFormValues;
  photos: PickPhoto[];
  projects: { id: string; title: string }[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Field label="Name to show" hint="How the client wants to be credited, like “Hannah & Eric”.">
        <Input name="name" defaultValue={values.name} required maxLength={120} />
      </Field>
      <Field label="Session line" hint="Like “Wedding · Sedona”.">
        <Input name="sessionType" defaultValue={values.sessionType} maxLength={120} />
      </Field>
      <Field label="Full quote" className="md:col-span-2">
        <Textarea name="quote" defaultValue={values.quote} required maxLength={4000} className="min-h-32" />
      </Field>
      <Field
        label="Pull quote (short line in script)"
        hint="One warm line that shows in handwriting on the site."
        className="md:col-span-2"
      >
        <Input name="pullQuote" defaultValue={values.pullQuote} maxLength={220} />
      </Field>
      <div className="md:col-span-2">
        <span className="label mb-1 block text-ink-soft">Photo (optional)</span>
        <PhotoPicker photos={photos} initialId={values.photoId} />
      </div>
      <Field label="Linked project (optional)">
        <Select name="projectId" defaultValue={values.projectId ?? ""}>
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Stars">
          <Select name="rating" defaultValue={values.rating ? String(values.rating) : ""}>
            <option value="">None</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "star" : "stars"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order" hint="Lower shows first.">
          <Input name="sort" type="number" inputMode="numeric" defaultValue={values.sort} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-5 md:col-span-2">
        <Checkbox name="featured" defaultChecked={values.featured} label="Featured (home page)" />
        <Checkbox name="published" defaultChecked={values.published} label="Published on the website" />
      </div>
      <div className="md:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
