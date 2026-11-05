import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStudio } from "@/lib/auth";
import { formatDay, todayIn } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { ConfirmButton } from "@/components/studio/client-ui";
import { Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/studio/ui";
import { ActionForm } from "../_crm/action-form";
import { RowList, TaskCheck, projectHref } from "../_crm/parts";
import { addTask, deleteTask, toggleTask } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "To-dos" };

type Item = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  projectId: string | null;
  projectTitle: string | null;
};

function TaskRow({ t, today }: { t: Item; today: string }) {
  const overdue = !t.done && t.dueDate && t.dueDate < today;
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <TaskCheck id={t.id} done={t.done} action={toggleTask} />
      <div className="min-w-0 flex-1 py-2">
        <p className={t.done ? "truncate font-sans text-[0.95rem] text-muted line-through" : "truncate font-sans text-[0.95rem]"}>
          {t.title}
        </p>
        <p className="truncate font-sans text-xs text-ink-soft">
          {t.dueDate && <span className={overdue ? "text-scarlet" : undefined}>{formatDay(t.dueDate, "medium")}</span>}
          {t.dueDate && t.projectId && " · "}
          {t.projectId && (
            <Link href={projectHref(t.projectId)} className="hover:underline">
              {t.projectTitle}
            </Link>
          )}
        </p>
      </div>
      <form action={deleteTask}>
        <input type="hidden" name="id" value={t.id} />
        <ConfirmButton variant="ghost" confirmText="Delete?" className="min-h-11">
          Delete
        </ConfirmButton>
      </form>
    </div>
  );
}

function Group({ title, items, today, tone }: { title: string; items: Item[]; today: string; tone?: string }) {
  if (items.length === 0) return null;
  return (
    <Card title={<span className={tone}>{`${title} · ${items.length}`}</span>} pad={false}>
      <RowList>
        {items.map((t) => (
          <TaskRow key={t.id} t={t} today={today} />
        ))}
      </RowList>
    </Card>
  );
}

export default async function TasksPage() {
  await requireStudio();
  const today = todayIn((await getSettings()).business.timezone);
  const T = schema.tasks;
  const [rows, projects] = await Promise.all([
    db
      .select({
        id: T.id,
        title: T.title,
        dueDate: T.dueDate,
        done: T.done,
        projectId: T.projectId,
        projectTitle: schema.projects.title,
      })
      .from(T)
      .leftJoin(schema.projects, eq(T.projectId, schema.projects.id))
      .orderBy(asc(T.dueDate), desc(T.createdAt)),
    db
      .select({ id: schema.projects.id, title: schema.projects.title })
      .from(schema.projects)
      .where(eq(schema.projects.archived, false))
      .orderBy(desc(schema.projects.createdAt))
      .limit(300),
  ]);

  const open = rows.filter((r) => !r.done);
  const overdue = open.filter((r) => r.dueDate && r.dueDate < today);
  const dueToday = open.filter((r) => r.dueDate === today);
  const upcoming = open.filter((r) => r.dueDate && r.dueDate > today);
  const undated = open.filter((r) => !r.dueDate);
  const done = rows.filter((r) => r.done).reverse().slice(0, 100);

  return (
    <>
      <PageHeader eyebrow="Things to remember" title="To-dos" />

      <Card title="Add a to-do" className="mb-6">
        <ActionForm action={addTask} reset submitLabel="Add to-do" pendingLabel="Adding…">
          <div className="grid gap-3 md:grid-cols-[1fr_12rem_16rem]">
            <Field label="What needs doing?">
              <Input name="title" required placeholder="Order prints for the Sample wedding" />
            </Field>
            <Field label="Due">
              <Input name="dueDate" type="date" />
            </Field>
            <Field label="Project (optional)">
              <Select name="projectId" defaultValue="">
                <option value="">Not tied to a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </ActionForm>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="Nothing to do">Add your first to-do above. Automations can add them for you too.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          <Group title="Overdue" items={overdue} today={today} tone="text-scarlet" />
          <Group title="Today" items={dueToday} today={today} />
          <Group title="Upcoming" items={upcoming} today={today} />
          <Group title="No date" items={undated} today={today} />
          {open.length === 0 && (
            <Card>
              <EmptyState title="All done">Nothing open right now.</EmptyState>
            </Card>
          )}
          {done.length > 0 && (
            <details className="group">
              <summary className="label flex min-h-11 cursor-pointer items-center text-ink-soft">
                Done · {done.length}
              </summary>
              <div className="mt-2">
                <Card pad={false}>
                  <RowList>
                    {done.map((t) => (
                      <TaskRow key={t.id} t={t} today={today} />
                    ))}
                  </RowList>
                </Card>
              </div>
            </details>
          )}
        </div>
      )}
    </>
  );
}
