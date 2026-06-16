import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  NotebookPen,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { DailyNotesEmailModal, EmailDeliveryBadge } from '@components/notes/DailyNotesEmailModal'
import { RichTextContent, RichTextEditor } from '@components/notes/RichTextEditor'
import { SearchableEmployeeMultiSelect } from '@components/notes/SearchableEmployeeMultiSelect'
import { SearchableProjectSelect } from '@components/notes/SearchableProjectSelect'
import { TopDismissNotice, type TopNotice } from '@components/pdk/TopDismissNotice'
import { ROUTES } from '@/constants/routes'
import {
  createChildBlock,
  deleteChildBlock,
  deleteDailyBlock,
  employeesForProject,
  getDailyBlockByDate,
  listNoteProjects,
  listTimesheetEmployees,
  reorderChildBlocks,
  updateChildBlock,
  updateDailyBlock,
} from '@/services/notesService'
import type { Employee } from '@/types'
import type {
  ChildBlockInput,
  DailyNoteBlock,
  DailyNoteStatus,
  NoteChildBlock,
  NoteProjectOption,
} from '@/types/notes'
import { formatDateTime } from '@/utils/formatDate'
import { highlightPlainText } from '@/utils/notesHighlight'
import { formatDailyBlockTitle, toDateKey } from '@/utils/notesWeek'
import { parseISO } from 'date-fns'
import './admin-notes.css'

function deliveryStatusLabel(status: DailyNoteStatus) {
  return status === 'email_sent' ? 'Email sent' : 'Not sent'
}

const EMPTY_CHILD_FORM: ChildBlockInput = {
  title: '',
  projectId: '',
  employeeIds: [],
  description: '',
  includeInEmail: false,
}

function statusClass(status: DailyNoteStatus) {
  return `admin-notes-status admin-notes-status--${status}`
}

export function AdminNotesDayPage() {
  const { dateKey = '' } = useParams<{ dateKey: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusChildId = searchParams.get('child') ?? ''
  const highlightQuery = searchParams.get('highlight') ?? ''

  const [block, setBlock] = useState<DailyNoteBlock | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<TopNotice | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showArchivedChildren, setShowArchivedChildren] = useState(false)

  const [projects, setProjects] = useState<NoteProjectOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(true)

  const [showChildModal, setShowChildModal] = useState(false)
  const [editingChild, setEditingChild] = useState<NoteChildBlock | null>(null)
  const [childForm, setChildForm] = useState<ChildBlockInput>(EMPTY_CHILD_FORM)
  const [savingChild, setSavingChild] = useState(false)

  const [confirmDeleteChild, setConfirmDeleteChild] = useState<NoteChildBlock | null>(null)
  const [confirmDeleteDaily, setConfirmDeleteDaily] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [busyAction, setBusyAction] = useState(false)

  const emailIncludeCount = useMemo(
    () => block?.childBlocks.filter((child) => child.includeInEmail && !child.archived).length ?? 0,
    [block],
  )

  const pageTitle = useMemo(() => {
    if (!dateKey) return 'Daily notes'
    try {
      return formatDailyBlockTitle(parseISO(dateKey))
    } catch {
      return dateKey
    }
  }, [dateKey])

  const visibleChildren = useMemo(() => {
    if (!block) return []
    return block.childBlocks
      .filter((child) => showArchivedChildren || !child.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [block, showArchivedChildren])

  const loadBlock = useCallback(async () => {
    if (!dateKey) return
    setLoading(true)
    try {
      const data = await getDailyBlockByDate(dateKey)
      setBlock(data)
      const focusChild = focusChildId
        ? data.childBlocks.find((child) => child._id === focusChildId)
        : null
      if (focusChild?.archived) setShowArchivedChildren(true)
      setExpandedIds((prev) => {
        const next = new Set(prev)
        data.childBlocks.forEach((child) => {
          if (!child.archived) next.add(child._id)
        })
        if (focusChildId) next.add(focusChildId)
        return next
      })
    } catch {
      setBlock(null)
      setNotice({ kind: 'error', title: 'Daily block not found', details: ['Create it from the weekly view first.'] })
    } finally {
      setLoading(false)
    }
  }, [dateKey, focusChildId])

  useEffect(() => {
    loadBlock()
  }, [loadBlock])

  useEffect(() => {
    if (!block || !focusChildId) return
    const timer = window.setTimeout(() => {
      document.getElementById(`child-block-${focusChildId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [block, focusChildId])

  useEffect(() => {
    setProjectsLoading(true)
    listNoteProjects()
      .then(setProjects)
      .catch(() => {
        setNotice({
          kind: 'error',
          title: 'Projects failed to load',
          details: ['Could not load projects from the timesheet workspace.'],
        })
      })
      .finally(() => setProjectsLoading(false))
  }, [])

  useEffect(() => {
    setEmployeesLoading(true)
    listTimesheetEmployees()
      .then(setAllEmployees)
      .catch(() => {
        setAllEmployees([])
        setNotice({
          kind: 'error',
          title: 'Employees failed to load',
          details: ['Could not load employees from Employee Management.'],
        })
      })
      .finally(() => setEmployeesLoading(false))
  }, [])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === childForm.projectId) ?? null,
    [projects, childForm.projectId],
  )

  const projectEmployees = useMemo(
    () => employeesForProject(allEmployees, selectedProject),
    [allEmployees, selectedProject],
  )

  const employeeOptions = useMemo(() => {
    const map = new Map(projectEmployees.map((employee) => [employee.id, employee]))
    for (const employee of editingChild?.employees || []) {
      if (!map.has(employee.id)) {
        map.set(employee.id, {
          id: employee.id,
          employeeId: employee.id,
          name: employee.name,
        })
      }
    }
    return Array.from(map.values())
  }, [projectEmployees, editingChild])

  const toggleExpanded = (childId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(childId)) next.delete(childId)
      else next.add(childId)
      return next
    })
  }

  const expandAll = () => setExpandedIds(new Set(visibleChildren.map((c) => c._id)))
  const collapseAll = () => setExpandedIds(new Set())

  const openCreateChild = () => {
    setEditingChild(null)
    setChildForm(EMPTY_CHILD_FORM)
    setShowChildModal(true)
  }

  const openEditChild = (child: NoteChildBlock) => {
    setEditingChild(child)
    setChildForm({
      title: child.title,
      projectId: child.projectId,
      employeeIds: child.employeeIds,
      description: child.description,
      includeInEmail: child.includeInEmail,
    })
    setShowChildModal(true)
  }

  const handleProjectChange = (projectId: string) => {
    setChildForm((form) => ({
      ...form,
      projectId,
      employeeIds: [],
    }))
  }

  const handleArchiveDaily = async () => {
    if (!block) return
    setBusyAction(true)
    try {
      const updated = await updateDailyBlock(block._id, { archived: !block.archived })
      setBlock(updated)
      setNotice({
        kind: 'success',
        title: updated.archived ? 'Daily block archived' : 'Daily block restored',
        details: [],
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update daily block'
      setNotice({ kind: 'error', title: 'Action failed', details: [message] })
    } finally {
      setBusyAction(false)
    }
  }

  const handleDeleteDaily = async () => {
    if (!block) return
    setBusyAction(true)
    try {
      await deleteDailyBlock(block._id)
      setConfirmDeleteDaily(false)
      navigate(ROUTES.NOTES)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete daily block'
      setNotice({ kind: 'error', title: 'Delete failed', details: [message] })
    } finally {
      setBusyAction(false)
    }
  }

  const handleSaveChild = async () => {
    if (!block) return
    const title = childForm.title.trim()
    if (!title) {
      setNotice({ kind: 'error', title: 'Title required', details: ['Enter a title for the work description.'] })
      return
    }
    if (!childForm.projectId) {
      setNotice({ kind: 'error', title: 'Project required', details: ['Select a project from the list.'] })
      return
    }

    setSavingChild(true)
    try {
      const payload: ChildBlockInput = {
        title,
        projectId: childForm.projectId,
        employeeIds: childForm.employeeIds || [],
        description: childForm.description || '',
        includeInEmail: childForm.includeInEmail,
      }
      const updated = editingChild
        ? await updateChildBlock(block._id, editingChild._id, payload)
        : await createChildBlock(block._id, payload)
      setBlock(updated)
      setShowChildModal(false)
      setEditingChild(null)
      setChildForm(EMPTY_CHILD_FORM)
      if (!editingChild) {
        const newest = updated.childBlocks[updated.childBlocks.length - 1]
        if (newest) setExpandedIds((prev) => new Set(prev).add(newest._id))
      }
      setNotice({
        kind: 'success',
        title: editingChild ? 'Work description updated' : 'Work description created',
        details: [title],
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save work description'
      setNotice({ kind: 'error', title: 'Save failed', details: [message] })
    } finally {
      setSavingChild(false)
    }
  }

  const handleArchiveChild = async (child: NoteChildBlock) => {
    if (!block) return
    setBusyAction(true)
    try {
      const updated = await updateChildBlock(block._id, child._id, { archived: !child.archived })
      setBlock(updated)
      setNotice({
        kind: 'success',
        title: child.archived ? 'Work description restored' : 'Work description archived',
        details: [child.title],
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update work description'
      setNotice({ kind: 'error', title: 'Action failed', details: [message] })
    } finally {
      setBusyAction(false)
    }
  }

  const handleDeleteChild = async () => {
    if (!block || !confirmDeleteChild) return
    setBusyAction(true)
    try {
      const updated = await deleteChildBlock(block._id, confirmDeleteChild._id)
      setBlock(updated)
      setConfirmDeleteChild(null)
      setNotice({ kind: 'success', title: 'Work description deleted', details: [confirmDeleteChild.title] })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete work description'
      setNotice({ kind: 'error', title: 'Delete failed', details: [message] })
    } finally {
      setBusyAction(false)
    }
  }

  const moveChild = async (childId: string, direction: -1 | 1) => {
    if (!block) return
    const activeIds = block.childBlocks
      .filter((c) => !c.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c._id)
    const index = activeIds.indexOf(childId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= activeIds.length) return

    const next = [...activeIds]
    ;[next[index], next[target]] = [next[target], next[index]]

    setBusyAction(true)
    try {
      const updated = await reorderChildBlocks(block._id, next)
      setBlock(updated)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reorder'
      setNotice({ kind: 'error', title: 'Reorder failed', details: [message] })
    } finally {
      setBusyAction(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-hub-page-wrap flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-2 font-body sm:px-5">
        <div className="crewiq-dashboard admin-notes-page relative flex min-h-0 flex-1 flex-col" data-admin-notes>
          <PageWrapper scrollable className="relative z-10 max-w-4xl py-6">
            <div className="admin-notes-loading" aria-busy="true" aria-label="Loading daily block">
              <Loader2 className="h-5 w-5 animate-spin text-[#1e5a3d]" />
              <span>Loading daily block…</span>
            </div>
            <div className="admin-notes-skeleton admin-notes-skeleton--header" />
            <div className="admin-notes-skeleton admin-notes-skeleton--panel" />
            <div className="admin-notes-skeleton admin-notes-skeleton--panel" />
          </PageWrapper>
        </div>
      </div>
    )
  }

  if (!block) {
    return (
      <div className="admin-hub-page-wrap flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-2 font-body sm:px-5">
        <PageWrapper scrollable className="relative z-10 max-w-none py-6">
          <Link to={ROUTES.NOTES} className="admin-notes-back-link">
            <ChevronLeft className="h-4 w-4" />
            Back to weekly view
          </Link>
          <div className="admin-notes-empty-state">
            <NotebookPen className="admin-notes-empty-state__icon" />
            <h2 className="admin-notes-empty-state__title">No daily block yet</h2>
            <p className="admin-notes-empty-state__text">
              No daily block exists for {dateKey}. Create one from the weekly Notes view.
            </p>
            <Link to={ROUTES.NOTES}>
              <Button type="button" variant="primary">Go to weekly view</Button>
            </Link>
          </div>
        </PageWrapper>
        <TopDismissNotice notice={notice} onDismiss={() => setNotice(null)} />
      </div>
    )
  }

  return (
    <div className="admin-hub-page-wrap flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-2 font-body sm:px-5">
      <div className="crewiq-dashboard admin-notes-page relative flex min-h-0 flex-1 flex-col" data-admin-notes>
        <div className="dashboard-page-bg pointer-events-none" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <PageWrapper scrollable className="relative z-10 max-w-5xl py-6 sm:py-8">
          <Link to={ROUTES.NOTES} className="admin-notes-back-link">
            <ChevronLeft className="h-4 w-4" />
            Back to weekly view
          </Link>

          <header className="admin-notes-day-hero">
            <div className="admin-notes-day-hero__main">
              <div className="admin-notes-day-hero__title-row">
                <span className="admin-notes-day-hero__icon" aria-hidden>
                  <NotebookPen className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="admin-notes-day-hero__eyebrow">Daily notes</p>
                  <h1 className="admin-notes-day-hero__title">{pageTitle}</h1>
                </div>
              </div>
              <p className="admin-notes-day-hero__meta">
                Created {formatDateTime(block.createdAt)} by {block.createdBy.name}
                {block.updatedAt !== block.createdAt ? (
                  <> · Last updated {formatDateTime(block.updatedAt)}</>
                ) : null}
              </p>
            </div>
            <div className="admin-notes-day-hero__aside">
              <div className="admin-notes-day-hero__badges">
                <span className={statusClass(block.status)}>{deliveryStatusLabel(block.status)}</span>
                {block.archived ? (
                  <span className="admin-notes-archived-badge">Archived</span>
                ) : null}
              </div>
              <div className="admin-notes-day-hero__menu">
                <button
                  type="button"
                  className="admin-notes-hero-btn"
                  disabled={busyAction}
                  onClick={handleArchiveDaily}
                >
                  <Archive className="h-4 w-4" />
                  {block.archived ? 'Restore' : 'Archive'}
                </button>
                <button
                  type="button"
                  className="admin-notes-hero-btn admin-notes-hero-btn--danger"
                  disabled={busyAction}
                  onClick={() => setConfirmDeleteDaily(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </header>

          <section className="admin-notes-day-panel admin-notes-day-panel--email">
            <div className="admin-notes-day-panel__lead">
              <span className="admin-notes-day-panel__icon" aria-hidden>
                <Mail className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="admin-notes-day-panel__title">Send daily notes</h2>
                <p className="admin-notes-day-panel__text">
                  {emailIncludeCount === 0
                    ? 'Mark work descriptions as “Include in email” to enable sending.'
                    : `${emailIncludeCount} work description${emailIncludeCount === 1 ? '' : 's'} will be emailed to all working employees.`}
                </p>
              </div>
            </div>
            <div className="admin-notes-day-panel__aside">
              <Button
                type="button"
                variant="primary"
                icon={<Send className="h-4 w-4" />}
                disabled={busyAction || block.archived || emailIncludeCount === 0}
                onClick={() => setShowEmailModal(true)}
              >
                Send Daily Notes
              </Button>
              <EmailDeliveryBadge delivery={block.lastEmailDelivery} />
            </div>
          </section>

          <section className="admin-notes-day-section">
            <div className="admin-notes-day-section__head">
              <div>
                <h2 className="admin-notes-day-section__title">Work descriptions</h2>
                <p className="admin-notes-day-section__subtitle">
                  {block.childBlockCount} active · {block.childBlocks.length} total
                </p>
              </div>
              <div className="admin-notes-day-section__tools">
                <label className="admin-notes-chip-toggle">
                  <input
                    type="checkbox"
                    checked={showArchivedChildren}
                    onChange={(e) => setShowArchivedChildren(e.target.checked)}
                  />
                  Show archived
                </label>
                <div className="admin-notes-chip-group" role="group" aria-label="Accordion controls">
                  <button type="button" className="admin-notes-chip-btn" onClick={expandAll}>
                    Expand all
                  </button>
                  <button type="button" className="admin-notes-chip-btn" onClick={collapseAll}>
                    Collapse all
                  </button>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  disabled={block.archived}
                  onClick={openCreateChild}
                >
                  Add work description
                </Button>
              </div>
            </div>

            <div className="admin-notes-day-section__body">
          {visibleChildren.length === 0 ? (
            <div className="admin-notes-empty-children">
              <Plus className="admin-notes-empty-children__icon" aria-hidden />
              <h3 className="admin-notes-empty-children__title">No work descriptions yet</h3>
              <p>Add the first work description to start planning this day.</p>
              {!block.archived ? (
                <Button type="button" size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreateChild}>
                  Add work description
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="admin-notes-accordion" role="list">
              {visibleChildren.map((child, index) => {
                const expanded = expandedIds.has(child._id)
                const activeSiblings = visibleChildren.filter((c) => !c.archived)
                const activeIndex = activeSiblings.findIndex((c) => c._id === child._id)
                const isFocused = focusChildId === child._id
                return (
                  <article
                    key={child._id}
                    id={`child-block-${child._id}`}
                    className={`admin-notes-accordion__item${child.archived ? ' admin-notes-accordion__item--archived' : ''}${isFocused ? ' admin-notes-accordion__item--focused' : ''}`}
                    role="listitem"
                  >
                    <div className="admin-notes-accordion__head">
                      <button
                        type="button"
                        className="admin-notes-accordion__toggle"
                        onClick={() => toggleExpanded(child._id)}
                        aria-expanded={expanded}
                      >
                        <ChevronRight
                          className={`admin-notes-accordion__chevron${expanded ? ' admin-notes-accordion__chevron--open' : ''}`}
                        />
                        <span className="admin-notes-accordion__index">{index + 1}</span>
                        <span className="admin-notes-accordion__title">
                          {highlightPlainText(child.title, highlightQuery)}
                        </span>
                        {child.includeInEmail ? (
                          <span className="admin-notes-email-badge" title="Include in email">
                            <Mail className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                        {child.archived ? (
                          <span className="admin-notes-archived-badge">Archived</span>
                        ) : null}
                      </button>
                      <div className="admin-notes-accordion__actions">
                        {!child.archived ? (
                          <>
                            <button
                              type="button"
                              className="admin-notes-icon-btn"
                              title="Move up"
                              disabled={busyAction || activeIndex <= 0}
                              onClick={() => moveChild(child._id, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="admin-notes-icon-btn"
                              title="Move down"
                              disabled={busyAction || activeIndex < 0 || activeIndex >= activeSiblings.length - 1}
                              onClick={() => moveChild(child._id, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="admin-notes-icon-btn"
                          title="Edit"
                          disabled={block.archived}
                          onClick={() => openEditChild(child)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="admin-notes-icon-btn"
                          title={child.archived ? 'Restore' : 'Archive'}
                          disabled={busyAction}
                          onClick={() => handleArchiveChild(child)}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="admin-notes-icon-btn admin-notes-icon-btn--danger"
                          title="Delete"
                          disabled={busyAction}
                          onClick={() => setConfirmDeleteChild(child)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {expanded ? (
                      <div className="admin-notes-accordion__body">
                        <dl className="admin-notes-child-meta">
                          <div>
                            <dt>Project</dt>
                            <dd>
                              {child.projectName
                                ? highlightPlainText(child.projectName, highlightQuery)
                                : '—'}
                            </dd>
                          </div>
                          <div>
                            <dt>Employees</dt>
                            <dd>
                              {child.employees.length > 0
                                ? highlightPlainText(
                                    child.employees.map((employee) => employee.name).join(', '),
                                    highlightQuery,
                                  )
                                : '—'}
                            </dd>
                          </div>
                          <div>
                            <dt>Include in email</dt>
                            <dd>
                              <span
                                className={
                                  child.includeInEmail
                                    ? 'admin-notes-inline-badge admin-notes-inline-badge--yes'
                                    : 'admin-notes-inline-badge admin-notes-inline-badge--no'
                                }
                              >
                                {child.includeInEmail ? 'Yes' : 'No'}
                              </span>
                            </dd>
                          </div>
                        </dl>
                        {child.description ? (
                          <div className="admin-notes-child-description">
                            <p className="admin-notes-child-description__label">Description</p>
                            <RichTextContent
                              html={child.description}
                              className={highlightQuery ? 'admin-notes-rich-text__content--search-target' : undefined}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
            </div>
          </section>
        </PageWrapper>
      </div>

      <TopDismissNotice notice={notice} onDismiss={() => setNotice(null)} />

      <Modal
        isOpen={showChildModal}
        title={editingChild ? 'Edit work description' : 'Add work description'}
        onClose={() => {
          setShowChildModal(false)
          setEditingChild(null)
        }}
        size="lg"
        modal
      >
        <div className="space-y-4">
          <Input
            label="Title"
            required
            value={childForm.title}
            onChange={(e) => setChildForm((f) => ({ ...f, title: e.target.value }))}
          />
          <SearchableProjectSelect
            value={childForm.projectId || ''}
            onChange={(projectId) => handleProjectChange(projectId)}
            projects={projects}
            loading={projectsLoading}
          />
          <SearchableEmployeeMultiSelect
            value={childForm.employeeIds || []}
            onChange={(employeeIds) => setChildForm((form) => ({ ...form, employeeIds }))}
            employees={employeeOptions}
            loading={employeesLoading}
            disabled={!childForm.projectId}
          />
          <RichTextEditor
            value={childForm.description || ''}
            onChange={(description) => setChildForm((form) => ({ ...form, description }))}
          />
          <label className="admin-notes-checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(childForm.includeInEmail)}
              onChange={(e) => setChildForm((f) => ({ ...f, includeInEmail: e.target.checked }))}
            />
            Include in email
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowChildModal(false)
                setEditingChild(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="primary" disabled={savingChild} onClick={handleSaveChild}>
              {savingChild ? 'Saving…' : editingChild ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(confirmDeleteChild)}
        title="Delete work description"
        onClose={() => setConfirmDeleteChild(null)}
        size="sm"
        modal
      >
        <p className="text-sm text-muted">
          Permanently delete <strong>{confirmDeleteChild?.title}</strong>? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmDeleteChild(null)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={busyAction} onClick={handleDeleteChild}>
            Delete
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={confirmDeleteDaily}
        title="Delete daily block"
        onClose={() => setConfirmDeleteDaily(false)}
        size="sm"
        modal
      >
        <p className="text-sm text-muted">
          Permanently delete the daily block for <strong>{toDateKey(parseISO(dateKey))}</strong> and all
          work descriptions?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmDeleteDaily(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={busyAction} onClick={handleDeleteDaily}>
            Delete
          </Button>
        </div>
      </Modal>

      <DailyNotesEmailModal
        block={block}
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSent={(result) => {
          setBlock(result.block)
          if (result.delivery.deliveryStatus === 'failed') {
            setNotice({
              kind: 'error',
              title: 'Email delivery failed',
              details: [
                result.delivery.errorMessage || 'No recipients received the email.',
              ],
            })
            return
          }
          const detail =
            result.delivery.deliveryStatus === 'partial'
              ? `Delivered to ${result.delivery.successCount} of ${result.delivery.recipientCount} recipients. This day is now marked as email sent.`
              : `Delivered to ${result.delivery.recipientCount} recipient${result.delivery.recipientCount === 1 ? '' : 's'}. This day is now marked as email sent.`
          setNotice({
            kind: result.delivery.deliveryStatus === 'partial' ? 'error' : 'success',
            title:
              result.delivery.deliveryStatus === 'partial'
                ? 'Email partially sent'
                : 'Daily notes email sent',
            details: [detail],
          })
        }}
        onError={(message) => {
          setNotice({ kind: 'error', title: 'Email failed', details: [message] })
        }}
      />
    </div>
  )
}

export default AdminNotesDayPage
