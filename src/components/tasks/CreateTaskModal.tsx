import React, { useState, useEffect } from 'react';
import { CheckSquare, X, Calendar, User, Layers, Plus, Trash2, ListPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import type { Task, UserProfile } from '../../types/index.ts';
import { batchCreateTasks, type CreateTaskInput } from '../../services/taskService.ts';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  members: UserProfile[];
  parentTask?: Task | null;
  onTaskCreated?: () => void;
}

interface TaskDraft {
  localId: string;
  title: string;
  description: string;
  assigneeId: string;
  deadline: string;
}

function createEmptyDraft(): TaskDraft {
  return {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    description: '',
    assigneeId: '',
    deadline: '',
  };
}

export function CreateTaskModal({
  isOpen,
  onClose,
  projectId,
  members,
  parentTask,
  onTaskCreated,
}: CreateTaskModalProps) {
  const { currentUser } = useAuth();
  const [entryMode, setEntryMode] = useState<'rows' | 'bulk'>('rows');
  const [drafts, setDrafts] = useState<TaskDraft[]>([createEmptyDraft()]);
  const [bulkText, setBulkText] = useState('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [bulkDeadline, setBulkDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDrafts([createEmptyDraft()]);
      setBulkText('');
      setBulkAssigneeId('');
      setBulkDeadline('');
      setEntryMode('rows');
      setError(null);
    }
  }, [isOpen, parentTask?.id]);

  if (!isOpen || !currentUser) return null;

  const updateDraft = (localId: string, field: keyof Omit<TaskDraft, 'localId'>, value: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.localId === localId ? { ...d, [field]: value } : d))
    );
  };

  const addDraftRow = () => {
    setDrafts((prev) => [...prev, createEmptyDraft()]);
  };

  const removeDraftRow = (localId: string) => {
    setDrafts((prev) => (prev.length > 1 ? prev.filter((d) => d.localId !== localId) : prev));
  };

  const buildInputs = (): CreateTaskInput[] => {
    if (entryMode === 'bulk') {
      const selectedMember = members.find((m) => m.uid === bulkAssigneeId);
      return bulkText
        .split('\n')
        .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter((line) => line.length > 0)
        .map((title) => ({
          title,
          description: '',
          parentTaskId: parentTask ? parentTask.id : null,
          assigneeId: selectedMember ? selectedMember.uid : null,
          assigneeEmail: selectedMember ? selectedMember.email : null,
          assigneeName: selectedMember ? selectedMember.displayName : null,
          deadline: bulkDeadline || null,
          status: 'todo',
        }));
    }

    return drafts
      .filter((d) => d.title.trim().length > 0)
      .map((d) => {
        const selectedMember = members.find((m) => m.uid === d.assigneeId);
        return {
          title: d.title.trim(),
          description: d.description.trim(),
          parentTaskId: parentTask ? parentTask.id : null,
          assigneeId: selectedMember ? selectedMember.uid : null,
          assigneeEmail: selectedMember ? selectedMember.email : null,
          assigneeName: selectedMember ? selectedMember.displayName : null,
          deadline: d.deadline || null,
          status: 'todo',
        };
      });
  };

  const pendingInputs = buildInputs();
  const pendingCount = pendingInputs.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputs = buildInputs();
    if (inputs.length === 0) {
      setError('Please enter at least one task title');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await batchCreateTasks(projectId, inputs, {
        uid: currentUser.uid,
        displayName: currentUser.displayName || undefined,
        email: currentUser.email || undefined,
      });

      setDrafts([createEmptyDraft()]);
      setBulkText('');
      if (onTaskCreated) onTaskCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create task(s)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center justify-between gap-3 mb-5 pr-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              {parentTask ? <Layers className="h-6 w-6" /> : <CheckSquare className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {parentTask ? 'Add Subtasks' : 'Add Tasks to To Do'}
              </h2>
              <p className="text-xs text-slate-500">
                {parentTask
                  ? `Subtasks of: "${parentTask.title}"`
                  : 'Create one or multiple deliverables at once'}
              </p>
            </div>
          </div>

          {/* Entry mode toggle */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setEntryMode('rows')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                entryMode === 'rows'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Task Cards
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('bulk')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                entryMode === 'bulk'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulk Lines
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 shrink-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {entryMode === 'rows' ? (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {drafts.map((draft, index) => (
                <div
                  key={draft.localId}
                  className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                      {parentTask ? `Subtask #${index + 1}` : `Task #${index + 1}`}
                    </span>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDraftRow(draft.localId)}
                        title="Remove this task"
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      required={index === 0}
                      maxLength={150}
                      value={draft.title}
                      onChange={(e) => updateDraft(draft.localId, 'title', e.target.value)}
                      placeholder={
                        parentTask
                          ? 'e.g. Write unit tests'
                          : 'Task title (e.g. Implement authentication flow)'
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>

                  <div>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={draft.description}
                      onChange={(e) => updateDraft(draft.localId, 'description', e.target.value)}
                      placeholder="Description or acceptance criteria (optional)..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      <select
                        value={draft.assigneeId}
                        onChange={(e) => updateDraft(draft.localId, 'assigneeId', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.uid} value={m.uid}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        value={draft.deadline}
                        onChange={(e) => updateDraft(draft.localId, 'deadline', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addDraftRow}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-300 py-2.5 text-xs font-bold text-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Another Task
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Enter multiple tasks (one per line)
                </label>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Design landing page wireframe\nSet up API endpoints\nWrite integration tests`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
                />
                <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
                  <ListPlus className="h-3.5 w-3.5 text-indigo-500" />
                  {pendingCount} task{pendingCount === 1 ? '' : 's'} detected
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Assignee (Optional)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    <select
                      value={bulkAssigneeId}
                      onChange={(e) => setBulkAssigneeId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.uid} value={m.uid}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Deadline (Optional)
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      value={bulkDeadline}
                      onChange={(e) => setBulkDeadline(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 mt-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || pendingCount === 0}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 active:scale-95 disabled:opacity-50 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              {loading
                ? 'Creating...'
                : pendingCount > 1
                ? `Create ${pendingCount} Tasks`
                : parentTask
                ? 'Add Subtask'
                : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
