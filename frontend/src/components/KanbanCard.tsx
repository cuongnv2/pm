import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { Card, Priority } from "@/lib/kanban";
import { isOverdue } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, updates: { title: string; details: string; priority: Priority; dueDate: string }) => void;
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low:      { label: "Low",      color: "bg-gray-200 text-gray-600" },
  medium:   { label: "Medium",   color: "bg-yellow-100 text-yellow-700" },
  high:     { label: "High",     color: "bg-orange-100 text-orange-700" },
  critical: { label: "Critical", color: "bg-red-100 text-red-700" },
};

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// ---- Delete confirm modal ----
type DeleteModalProps = { cardTitle: string; onConfirm: () => void; onCancel: () => void };
const DeleteModal = ({ cardTitle, onConfirm, onCancel }: DeleteModalProps) =>
  createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[0_24px_48px_rgba(3,33,71,0.18)]" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-dialog-title" className="font-display text-lg font-semibold text-[var(--navy-dark)]">Delete card?</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
          <span className="font-semibold text-[var(--navy-dark)]">&ldquo;{cardTitle}&rdquo;</span> will be permanently removed.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] transition hover:bg-[var(--surface)]" aria-label="Cancel delete">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600" aria-label="Confirm delete">Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );

// ---- Edit modal ----
type EditModalProps = {
  card: Card;
  onSave: (updates: { title: string; details: string; priority: Priority; dueDate: string }) => void;
  onCancel: () => void;
};
const EditModal = ({ card, onSave, onCancel }: EditModalProps) => {
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState(card.dueDate);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[0_24px_48px_rgba(3,33,71,0.18)]" onClick={(e) => e.stopPropagation()}>
        <h2 id="edit-dialog-title" className="font-display text-lg font-semibold text-[var(--navy-dark)]">Edit card</h2>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) onSave({ title: title.trim(), details: details.trim(), priority, dueDate });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
              required
              aria-label="Card title"
              data-testid="edit-title"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="resize-none rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--gray-text)] outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
              aria-label="Card details"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                aria-label="Card priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                aria-label="Card due date"
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] transition hover:bg-[var(--surface)]">Cancel</button>
            <button type="submit" className="rounded-lg bg-[var(--primary-blue)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-blue)]/85" aria-label="Save card">Save</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

// ---- KanbanCard ----
export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const priority = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.medium;
  const overdue = isOverdue(card.dueDate);

  return (
    <>
      <article
        ref={setNodeRef}
        style={style}
        className={clsx(
          "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)] cursor-grab active:cursor-grabbing",
          "transition-all duration-150",
          isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
        )}
        {...attributes}
        {...listeners}
        data-testid={`card-${card.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">{card.title}</h4>
            {card.details && (
              <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">{card.details}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", priority.color)}>
                {priority.label}
              </span>
              {card.dueDate && (
                <span className={clsx(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  overdue ? "bg-red-100 text-red-700" : "bg-[var(--surface)] text-[var(--gray-text)]"
                )}>
                  <CalendarIcon />
                  {card.dueDate}
                  {overdue && " (overdue)"}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowEdit(true); }}
              className="rounded-full p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--primary-blue)]"
              aria-label={`Edit ${card.title}`}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowDelete(true); }}
              className="rounded-full p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-red-500"
              aria-label={`Delete ${card.title}`}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </article>

      {showDelete && (
        <DeleteModal
          cardTitle={card.title}
          onConfirm={() => { setShowDelete(false); onDelete(card.id); }}
          onCancel={() => setShowDelete(false)}
        />
      )}
      {showEdit && (
        <EditModal
          card={card}
          onSave={(updates) => { setShowEdit(false); onEdit(card.id, updates); }}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </>
  );
};
