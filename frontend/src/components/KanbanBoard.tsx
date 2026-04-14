"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { ChatSidebar } from "@/components/ChatSidebar";
import { createPortal } from "react-dom";
import { createId, moveCard, type BoardData, type BoardMeta, type Priority } from "@/lib/kanban";
import { useLang } from "@/lib/i18nContext";

interface KanbanBoardProps {
  initialData: BoardData | null;
  boards: BoardMeta[];
  activeBoardId: number;
  onUpdate: (data: BoardData) => void;
  onLogout: () => void;
  onRefresh: () => void;
  onToggleDark: () => void;
  darkMode: boolean;
  onSwitchBoard: (boardId: number) => void;
  onCreateBoard: (name: string) => void;
  onDeleteBoard: (boardId: number) => void;
  onRenameBoard: (boardId: number, name: string) => void;
}

const KanbanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="18" rx="1" />
    <rect x="14" y="3" width="7" height="10" rx="1" />
    <rect x="14" y="17" width="7" height="4" rx="1" />
  </svg>
);

// ---- Board Selector Dropdown ----
type BoardSelectorProps = {
  boards: BoardMeta[];
  activeBoardId: number;
  onSwitch: (id: number) => void;
  onCreate: (name: string) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, name: string) => void;
};

const BoardSelector = ({ boards, activeBoardId, onSwitch, onCreate, onDelete, onRename }: BoardSelectorProps) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] shadow-sm transition hover:border-[var(--primary-blue)]"
        aria-label={t.switchBoard}
        data-testid="board-selector"
      >
        <span className="max-w-[160px] truncate">{activeBoard?.name ?? t.selectBoard}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-2 shadow-[0_16px_40px_rgba(3,33,71,0.18)]">
          <p className="mb-1 px-2 pt-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">{t.yourBoards}</p>
          <div className="max-h-56 overflow-y-auto">
            {boards.map((board) => (
              <div
                key={board.id}
                className={`group flex items-center gap-2 rounded-xl px-2 py-2 ${board.id === activeBoardId ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]"}`}
              >
                {renamingId === board.id ? (
                  <form
                    className="flex flex-1 gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (renameValue.trim()) { onRename(board.id, renameValue.trim()); setRenamingId(null); }
                    }}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--primary-blue)] bg-[var(--surface-strong)] px-2 py-1 text-sm text-[var(--navy-dark)] outline-none"
                    />
                    <button type="submit" className="rounded-lg bg-[var(--primary-blue)] px-2 py-1 text-xs font-semibold text-white">{t.save}</button>
                    <button type="button" onClick={() => setRenamingId(null)} className="rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)]">{t.cancel}</button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex-1 truncate text-left text-sm font-medium text-[var(--navy-dark)]"
                      onClick={() => { onSwitch(board.id); setOpen(false); }}
                    >
                      {board.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Rename ${board.name}`}
                      onClick={() => { setRenamingId(board.id); setRenameValue(board.name); }}
                      className="hidden shrink-0 rounded p-1 text-[var(--gray-text)] hover:text-[var(--navy-dark)] group-hover:block"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    {boards.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Delete ${board.name}`}
                        onClick={() => { onDelete(board.id); setOpen(false); }}
                        className="hidden shrink-0 rounded p-1 text-[var(--gray-text)] hover:text-red-500 group-hover:block"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2 border-t border-[var(--stroke)] pt-2">
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim()) { onCreate(newName.trim()); setNewName(""); setOpen(false); }
              }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.newBoardNamePlaceholder}
                className="flex-1 rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                aria-label="New board name"
              />
              <button type="submit" className="rounded-lg bg-[var(--primary-blue)] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-85" aria-label="Create board">
                +
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Delete Board Confirm Modal ----
type DeleteBoardModalProps = { boardName: string; onConfirm: () => void; onCancel: () => void };
const DeleteBoardModal = ({ boardName, onConfirm, onCancel }: DeleteBoardModalProps) => {
  const { t } = useLang();
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.25)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">{t.deleteBoardTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
          <span className="font-semibold text-[var(--navy-dark)]">&ldquo;{boardName}&rdquo;</span> {t.deleteBoardSuffix}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] transition hover:bg-[var(--surface)]" aria-label="Cancel board delete">{t.cancel}</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600" aria-label="Confirm board delete">{t.confirmDelete}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};


// ---- Main KanbanBoard ----
export const KanbanBoard = ({
  initialData, boards, activeBoardId, onUpdate, onLogout, onRefresh,
  onToggleDark, darkMode, onSwitchBoard, onCreateBoard, onDeleteBoard, onRenameBoard,
}: KanbanBoardProps) => {
  const { t, lang, toggleLang } = useLang();
  const [board, setBoard] = useState<BoardData>(() => initialData || { columns: [], cards: {} });
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [deletingBoardId, setDeletingBoardId] = useState<number | null>(null);

  useEffect(() => {
    if (initialData) setBoard(initialData);
  }, [initialData]);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const cardsById = useMemo(() => board.cards, [board.cards]);

  const handleDragStart = (event: DragStartEvent) => setActiveCardId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id) return;
    const newBoard = { ...board, columns: moveCard(board.columns, active.id as string, over.id as string) };
    setBoard(newBoard);
    onUpdate(newBoard);
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    const newBoard = {
      ...board,
      columns: board.columns.map((col) => col.id === columnId ? { ...col, title } : col),
    };
    setBoard(newBoard);
    onUpdate(newBoard);
  };

  const handleAddCard = (columnId: string, title: string, details: string, priority: Priority, dueDate: string) => {
    const id = createId("card");
    const newBoard = {
      ...board,
      cards: { ...board.cards, [id]: { id, title, details: details || "", priority, dueDate } },
      columns: board.columns.map((col) =>
        col.id === columnId ? { ...col, cardIds: [...col.cardIds, id] } : col
      ),
    };
    setBoard(newBoard);
    onUpdate(newBoard);
  };

  const handleEditCard = (_columnId: string, cardId: string, updates: { title: string; details: string; priority: Priority; dueDate: string }) => {
    const newBoard = {
      ...board,
      cards: { ...board.cards, [cardId]: { ...board.cards[cardId], ...updates } },
    };
    setBoard(newBoard);
    onUpdate(newBoard);
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    const newBoard = {
      ...board,
      cards: Object.fromEntries(Object.entries(board.cards).filter(([id]) => id !== cardId)),
      columns: board.columns.map((col) =>
        col.id === columnId ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) } : col
      ),
    };
    setBoard(newBoard);
    onUpdate(newBoard);
  };

  const handleAddColumn = () => {
    const id = createId("col");
    const newBoard = {
      ...board,
      columns: [...board.columns, { id, title: t.newColumn, cardIds: [] }],
    };
    setBoard(newBoard);
    onUpdate(newBoard);
  };

  const handleDeleteColumn = (columnId: string) => {
    const col = board.columns.find((c) => c.id === columnId);
    if (!col) return;
    const newCards = { ...board.cards };
    col.cardIds.forEach((cardId) => delete newCards[cardId]);
    const newBoard = {
      ...board,
      cards: newCards,
      columns: board.columns.filter((c) => c.id !== columnId),
    };
    setBoard(newBoard);
    onUpdate(newBoard);
  };

  const handleDeleteBoard = (boardId: number) => setDeletingBoardId(boardId);
  const confirmDeleteBoard = () => {
    if (deletingBoardId !== null) { onDeleteBoard(deletingBoardId); setDeletingBoardId(null); }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;
  const deletingBoard = boards.find((b) => b.id === deletingBoardId);

  const btnBase = "rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.15)_0%,_rgba(32,157,215,0.03)_55%,_transparent_70%)]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.12)_0%,_rgba(117,57,145,0.03)_55%,_transparent_75%)]" />

      {/* Slim sticky navbar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--stroke)] bg-[var(--surface-strong)]/90 px-6 py-3 shadow-sm backdrop-blur-md">
        {/* Logo + title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary-blue)]">
            <KanbanIcon />
          </div>
          <span className="font-display text-base font-semibold text-[var(--navy-dark)]">{t.appName}</span>
        </div>

        {/* Board selector */}
        <div className="mx-4 flex-1">
          <BoardSelector
            boards={boards}
            activeBoardId={activeBoardId}
            onSwitch={onSwitchBoard}
            onCreate={onCreateBoard}
            onDelete={handleDeleteBoard}
            onRename={onRenameBoard}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={toggleLang} className={btnBase} aria-label="Toggle language">
            {lang === "en" ? "VI" : "EN"}
          </button>
          <button type="button" onClick={onToggleDark} className={btnBase}>
            {darkMode ? t.light : t.dark}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg bg-[var(--secondary-purple)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t.logout}
          </button>
        </div>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100vh-52px)] max-w-[1600px] flex-col gap-6 px-6 pb-16 pt-6 pr-80">
        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <section className="flex gap-4 overflow-x-auto pb-2">
            {board.columns.map((column) => (
              <div key={column.id} className="w-[280px] shrink-0">
                <KanbanColumn
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onEditCard={handleEditCard}
                  onDeleteColumn={handleDeleteColumn}
                />
              </div>
            ))}
            <div className="w-[280px] shrink-0">
              <button
                type="button"
                onClick={handleAddColumn}
                className="flex h-full min-h-[120px] w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[var(--stroke)] text-sm font-semibold text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                aria-label="Add column"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t.addColumn}
              </button>
            </div>
          </section>
          <DragOverlay>
            {activeCard ? <div className="w-[260px]"><KanbanCardPreview card={activeCard} /></div> : null}
          </DragOverlay>
        </DndContext>
      </main>

      <ChatSidebar boardId={activeBoardId} onRefresh={onRefresh} onAuthError={onLogout} />

      {deletingBoard && (
        <DeleteBoardModal
          boardName={deletingBoard.name}
          onConfirm={confirmDeleteBoard}
          onCancel={() => setDeletingBoardId(null)}
        />
      )}
    </div>
  );
};
