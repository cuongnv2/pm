import { useState, type FormEvent } from "react";
import type { Priority } from "@/lib/kanban";
import { useLang } from "@/lib/i18nContext";

const initialFormState = { title: "", details: "", priority: "medium" as Priority, dueDate: "" };

type NewCardFormProps = {
  onAdd: (title: string, details: string, priority: Priority, dueDate: string) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) return;
    onAdd(formState.title.trim(), formState.details.trim(), formState.priority, formState.dueDate);
    setFormState(initialFormState);
    setIsOpen(false);
  };

  const inputClass = "w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";

  return (
    <div className="mt-4">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={formState.title}
            onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t.cardTitlePlaceholder}
            className={`${inputClass} font-medium`}
            required
          />
          <textarea
            value={formState.details}
            onChange={(e) => setFormState((prev) => ({ ...prev, details: e.target.value }))}
            placeholder={t.detailsPlaceholder}
            rows={2}
            className={`resize-none ${inputClass} text-[var(--gray-text)]`}
          />
          <div className="flex gap-2">
            <select
              value={formState.priority}
              onChange={(e) => setFormState((prev) => ({ ...prev, priority: e.target.value as Priority }))}
              className={`flex-1 ${inputClass} text-xs font-semibold`}
              aria-label="Priority"
            >
              <option value="low">{t.low}</option>
              <option value="medium">{t.medium}</option>
              <option value="high">{t.high}</option>
              <option value="critical">{t.critical}</option>
            </select>
            <input
              type="date"
              value={formState.dueDate}
              onChange={(e) => setFormState((prev) => ({ ...prev, dueDate: e.target.value }))}
              className={`flex-1 ${inputClass} text-xs`}
              aria-label="Due date"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
            >
              {t.addCard}
            </button>
            <button
              type="button"
              onClick={() => { setIsOpen(false); setFormState(initialFormState); }}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)] hover:bg-[var(--surface)]"
        >
          {t.addACard}
        </button>
      )}
    </div>
  );
};
