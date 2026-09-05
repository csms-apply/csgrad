import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import Translate, { translate } from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { STORAGE_KEYS } from '../lib/storage-keys';
import { localizedInternalPath } from '../lib/seo/localizedAlternates.mjs';
import { MAX_BACKUP_BYTES, parseTrackerBackup, TRACKER_BACKUP_KEY } from '../lib/tracker/backup.mjs';
import { attachDialogBehavior } from '../lib/tracker/dialog.mjs';
import styles from './tracker.module.css';

function getColumns() {
  return [
    { id: 'reach', title: translate({ id: 'tracker.column.reach', message: '彩票' }), subtitle: 'Reach', colorClass: styles.colReach },
    { id: 'match', title: translate({ id: 'tracker.column.match', message: '冲刺' }), subtitle: 'Match', colorClass: styles.colMatch },
    { id: 'target', title: translate({ id: 'tracker.column.target', message: '主申' }), subtitle: 'Target', colorClass: styles.colTarget },
    { id: 'safety', title: translate({ id: 'tracker.column.safety', message: '保底' }), subtitle: 'Safety', colorClass: styles.colSafety },
  ];
}

function getEssayStatuses() {
  return [
    { value: 'not_started', label: translate({ id: 'tracker.essay.notStarted', message: '未开始' }) },
    { value: 'drafting', label: translate({ id: 'tracker.essay.drafting', message: '草稿中' }) },
    { value: 'reviewing', label: translate({ id: 'tracker.essay.reviewing', message: '修改中' }) },
    { value: 'done', label: translate({ id: 'tracker.essay.done', message: '已完成' }) },
  ];
}

function getSortOptions() {
  return [
    { value: 'manual', label: translate({ id: 'tracker.sort.manual', message: '手动排序' }) },
    { value: 'deadline', label: translate({ id: 'tracker.sort.deadline', message: '按截止日期' }) },
    { value: 'school', label: translate({ id: 'tracker.sort.school', message: '按学校名称' }) },
  ];
}

// Column IDs (no translation needed, used for logic)
const COLUMN_IDS = ['reach', 'match', 'target', 'safety'];

// ============ Helpers ============
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function useDialog(onClose) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => attachDialogBehavior(dialogRef.current, () => closeRef.current()), []);
  return dialogRef;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function makeEmptyCard(column) {
  return {
    id: genId(),
    school: '',
    program: '',
    column,
    deadline: '',
    lors: [
      { name: translate({ id: 'tracker.lor.default1', message: '推荐信 1' }), done: false },
      { name: translate({ id: 'tracker.lor.default2', message: '推荐信 2' }), done: false },
      { name: translate({ id: 'tracker.lor.default3', message: '推荐信 3' }), done: false },
    ],
    toefl: '',
    gre: '',
    essayStatus: 'not_started',
    notes: '',
    fromLibrary: false,
    tier: '',
    slug: '',
  };
}

function computeProgress(card) {
  let total = 0;
  let done = 0;
  // LORs
  card.lors.forEach((l) => {
    total++;
    if (l.done) done++;
  });
  // Test scores
  total += 2;
  if (card.toefl) done++;
  if (card.gre) done++;
  // Essay
  total++;
  if (card.essayStatus === 'done') done++;
  else if (card.essayStatus === 'reviewing') done += 0.7;
  else if (card.essayStatus === 'drafting') done += 0.3;
  return { total, done, pct: total > 0 ? done / total : 0 };
}

// ============ Sub-components ============

// Sortable Card
function SortableCard({ card, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${styles.card} ${isDragging ? styles.cardDragging : ''}`}
    >
      <CardContent card={card} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

// Card display (shared between sortable and overlay)
function CardContent({ card, onEdit, onDelete }) {
  const {i18n: {currentLocale}} = useDocusaurusContext();
  const days = daysUntil(card.deadline);
  const progress = computeProgress(card);
  const lorsDone = card.lors.filter(l => l.done).length;
  const lorsTotal = card.lors.length;

  return (
    <>
      <div className={styles.cardActions}>
        {onEdit && (
          <button
            className={styles.cardActionBtn}
            onClick={(e) => { e.stopPropagation(); onEdit(card); }}
            title={translate({ id: 'tracker.action.edit', message: '编辑' })}
          >
            &#9998;
          </button>
        )}
        {onDelete && (
          <button
            className={styles.cardActionBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
            title={translate({ id: 'tracker.action.delete', message: '删除' })}
          >
            &times;
          </button>
        )}
      </div>
      <p className={styles.cardSchool}>
        {card.school || translate({ id: 'tracker.card.unnamedSchool', message: '未命名学校' })}
      </p>
      <p className={styles.cardProgram}>
        {card.program || translate({ id: 'tracker.card.unnamedProgram', message: '未命名项目' })}
      </p>
      <div className={styles.cardTags}>
        {card.tier && <span className={`${styles.tag} ${styles.tagTier}`}>{card.tier}</span>}
        {card.fromLibrary && (
          <span className={`${styles.tag} ${styles.tagCustom}`}>
            <Translate id="tracker.tag.library">项目库</Translate>
          </span>
        )}
        {!card.fromLibrary && card.school && (
          <span className={`${styles.tag} ${styles.tagCustom}`}>
            <Translate id="tracker.tag.custom">自定义</Translate>
          </span>
        )}
      </div>
      {card.deadline && (
        <div className={styles.cardDeadline}>
          <span className={styles.deadlineIcon}>&#128197;</span>
          <div>
            <div className={styles.deadlineText}>
              {translate({ id: 'tracker.card.deadlineLabel', message: '截止日期: {date}' }, { date: card.deadline })}
            </div>
            {days !== null && (
              <div className={`${styles.deadlineCountdown} ${days < 0 ? styles.deadlineOverdue : ''}`}>
                {days > 0
                  ? translate({ id: 'tracker.card.daysLeft', message: '还剩 {days} 天' }, { days })
                  : days === 0
                    ? translate({ id: 'tracker.card.dueToday', message: '今天截止!' })
                    : translate({ id: 'tracker.card.overdue', message: '已过期 {days} 天' }, { days: Math.abs(days) })}
              </div>
            )}
          </div>
        </div>
      )}
      <div className={styles.cardProgress}>
        <span
          className={`${styles.progressDot} ${
            progress.pct >= 0.8 ? styles.dotDone : progress.pct > 0.2 ? styles.dotPartial : styles.dotNone
          }`}
        />
        {translate({ id: 'tracker.card.progressLors', message: '进度: {done}/{total} 推荐信' }, { done: lorsDone, total: lorsTotal })}
        {card.toefl ? translate({ id: 'tracker.card.langDone', message: ' | 语言 ✓' }) : ''}
        {card.essayStatus === 'done' ? translate({ id: 'tracker.card.essayDone', message: ' | 文书 ✓' }) : ''}
      </div>
      {card.slug && (
        <a
          href={localizedInternalPath(card.slug, currentLocale)}
          className={styles.programLink}
          onClick={(e) => e.stopPropagation()}
        >
          &#8599; <Translate id="tracker.card.viewProgram">查看项目介绍</Translate>
        </a>
      )}
    </>
  );
}

// Droppable Column
function KanbanColumn({ column, cards, onAddCard, onEditCard, onDeleteCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const cardIds = cards.map((c) => c.id);

  return (
    <div
      className={`${styles.column} ${column.colorClass} ${isOver ? styles.columnOver : ''}`}
    >
      <div className={styles.columnHeader}>
        <h3 className={styles.columnTitle}>
          {column.title}
          {column.title !== column.subtitle && (
            <span style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: 6, opacity: 0.8 }}>
              {column.subtitle}
            </span>
          )}
        </h3>
        <span className={styles.columnCount}>{cards.length}</span>
      </div>
      <div ref={setNodeRef} className={styles.columnBody}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.length === 0 && (
            <div className={styles.emptyColumn}>
              <Translate id="tracker.column.empty">拖拽项目到此列或点击下方添加</Translate>
            </div>
          )}
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
            />
          ))}
        </SortableContext>
        <button className={styles.addCardBtn} onClick={() => onAddCard(column.id)}>
          + <Translate id="tracker.action.addProgram">添加项目</Translate>
        </button>
      </div>
    </div>
  );
}

// Add/Edit Card Modal
function CardModal({ card, initialCard, columns, essayStatuses, onSave, onClose }) {
  const dialogRef = useDialog(onClose);
  const [form, setForm] = useState(
    card || initialCard || makeEmptyCard('reach')
  );

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const setLor = (idx, key, val) => {
    setForm((f) => {
      const lors = [...f.lors];
      lors[idx] = { ...lors[idx], [key]: val };
      return { ...f, lors };
    });
  };

  const addLor = () => {
    setForm((f) => ({
      ...f,
      lors: [...f.lors, {
        name: translate({ id: 'tracker.lor.defaultN', message: '推荐信 {n}' }, { n: f.lors.length + 1 }),
        done: false,
      }],
    }));
  };

  const removeLor = (idx) => {
    setForm((f) => ({
      ...f,
      lors: f.lors.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tracker-card-title" tabIndex={-1} className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 id="tracker-card-title" className={styles.modalTitle}>
            {card
              ? translate({ id: 'tracker.modal.editTitle', message: '编辑项目' })
              : translate({ id: 'tracker.modal.addTitle', message: '添加自定义项目' })}
          </h3>
          <button aria-label={translate({id: 'tracker.action.close', message: '关闭'})} className={styles.modalClose} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <Translate id="tracker.form.schoolName">学校名称</Translate>
              </label>
              <input
                data-dialog-initial-focus
                aria-label={translate({id: 'tracker.form.schoolName', message: '学校名称'})}
                className={styles.formInput}
                value={form.school}
                onChange={(e) => set('school', e.target.value)}
                placeholder={translate({ id: 'tracker.form.schoolPlaceholder', message: '如: Stanford University' })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <Translate id="tracker.form.programName">项目名称</Translate>
              </label>
              <input
                className={styles.formInput}
                aria-label={translate({id: 'tracker.form.programName', message: '项目名称'})}
                value={form.program}
                onChange={(e) => set('program', e.target.value)}
                placeholder={translate({ id: 'tracker.form.programPlaceholder', message: '如: MSCS' })}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <Translate id="tracker.form.category">分类</Translate>
              </label>
              <select
                aria-label={translate({id: 'tracker.form.category', message: '分类'})}
                className={styles.formSelect}
                value={form.column}
                onChange={(e) => set('column', e.target.value)}
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}{c.title !== c.subtitle ? ` (${c.subtitle})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <Translate id="tracker.form.deadline">截止日期</Translate>
              </label>
              <input
                type="date"
                aria-label={translate({id: 'tracker.form.deadline', message: '截止日期'})}
                className={styles.formInput}
                value={form.deadline}
                onChange={(e) => set('deadline', e.target.value)}
              />
            </div>
          </div>

          {/* LORs */}
          <div className={styles.detailSection}>
            <h4 className={styles.detailSectionTitle}>
              <Translate id="tracker.form.lors">推荐信 (LORs)</Translate>
            </h4>
            {form.lors.map((lor, idx) => (
              <div key={idx} className={styles.lorRow}>
                <input
                  type="checkbox"
                  aria-label={lor.name}
                  className={styles.lorCheck}
                  checked={lor.done}
                  onChange={(e) => setLor(idx, 'done', e.target.checked)}
                />
                <input
                  aria-label={translate({id: 'tracker.form.lorPlaceholder', message: '推荐人姓名'})}
                  className={styles.lorInput}
                  value={lor.name}
                  onChange={(e) => setLor(idx, 'name', e.target.value)}
                  placeholder={translate({ id: 'tracker.form.lorPlaceholder', message: '推荐人姓名' })}
                />
                <button
                  className={styles.cardActionBtn}
                  onClick={() => removeLor(idx)}
                  title={translate({ id: 'tracker.action.delete', message: '删除' })}
                  type="button"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              className={styles.addCardBtn}
              onClick={addLor}
              type="button"
              style={{ marginTop: 6 }}
            >
              + <Translate id="tracker.action.addLor">添加推荐信</Translate>
            </button>
          </div>

          {/* Test scores */}
          <div className={styles.detailSection}>
            <h4 className={styles.detailSectionTitle}>
              <Translate id="tracker.form.tests">标准化考试</Translate>
            </h4>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>TOEFL / IELTS</label>
                <input
                  aria-label="TOEFL / IELTS"
                  className={styles.formInput}
                  value={form.toefl}
                  onChange={(e) => set('toefl', e.target.value)}
                  placeholder={translate({ id: 'tracker.form.toeflPlaceholder', message: '如: 110' })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>GRE</label>
                <input
                  aria-label="GRE"
                  className={styles.formInput}
                  value={form.gre}
                  onChange={(e) => set('gre', e.target.value)}
                  placeholder={translate({ id: 'tracker.form.grePlaceholder', message: '如: 330' })}
                />
              </div>
            </div>
          </div>

          {/* Essay */}
          <div className={styles.detailSection}>
            <h4 className={styles.detailSectionTitle}>
              <Translate id="tracker.form.essayProgress">文书进度</Translate>
            </h4>
            <div className={styles.essayStatus}>
              {essayStatuses.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`${styles.essayBtn} ${
                    form.essayStatus === s.value ? styles.essayBtnActive : ''
                  }`}
                  onClick={() => set('essayStatus', s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <Translate id="tracker.form.notes">备注</Translate>
            </label>
            <input
              aria-label={translate({id: 'tracker.form.notes', message: '备注'})}
              className={styles.formInput}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={translate({ id: 'tracker.form.notesPlaceholder', message: '任何备注信息...' })}
            />
          </div>

          <button
            className={styles.formSubmitBtn}
            disabled={!form.school && !form.program}
            onClick={() => onSave(form)}
          >
            {card
              ? translate({ id: 'tracker.action.saveChanges', message: '保存修改' })
              : translate({ id: 'tracker.action.addProgram', message: '添加项目' })}
          </button>
        </div>
      </div>
    </div>
  );
}

// Library Import Modal
function LibraryModal({ programs, existingIds, onImport, onClose }) {
  const dialogRef = useDialog(onClose);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return programs;
    const q = search.toLowerCase();
    return programs.filter(
      (p) =>
        p.school.toLowerCase().includes(q) ||
        p.program.toLowerCase().includes(q) ||
        p.tier.toLowerCase().includes(q)
    );
  }, [programs, search]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tracker-library-title" tabIndex={-1} className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 id="tracker-library-title" className={styles.modalTitle}>
            <Translate id="tracker.library.title">从项目库导入</Translate>
          </h3>
          <button aria-label={translate({id: 'tracker.action.close', message: '关闭'})} className={styles.modalClose} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.modalBody}>
          <input
            className={styles.librarySearch}
            aria-label={translate({id: 'tracker.library.searchPlaceholder', message: '搜索学校或项目名称...' })}
            placeholder={translate({ id: 'tracker.library.searchPlaceholder', message: '搜索学校或项目名称...' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-dialog-initial-focus
          />
          <div className={styles.libraryList}>
            {filtered.map((p) => {
              const added = existingIds.has(p.id);
              return (
                <button
                  type="button"
                  disabled={added}
                  key={p.id}
                  className={styles.libraryItem}
                  onClick={() => !added && onImport(p)}
                  style={added ? { opacity: 0.5 } : {}}
                >
                  <span className={styles.libraryItemInfo}>
                    <span className={styles.libraryItemSchool}>{p.school}</span>
                    <span className={styles.libraryItemProgram}>{p.program}</span>
                  </span>
                  {added ? (
                    <span className={styles.libraryItemAdded}>
                      <Translate id="tracker.library.added">已添加</Translate>
                    </span>
                  ) : (
                    <span className={styles.libraryItemTier}>{p.tier}</span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className={styles.emptyColumn}>
                <Translate id="tracker.library.noResults">未找到匹配的项目</Translate>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Confirm dialog
function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel }) {
  const dialogRef = useDialog(onCancel);
  return (
    <div className={styles.confirmOverlay} onClick={onCancel}>
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="tracker-confirm-message" tabIndex={-1} className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
        <p id="tracker-confirm-message" className={styles.confirmText}>{message}</p>
        <div className={styles.confirmBtns}>
          <button className={styles.confirmCancel} onClick={onCancel}>
            <Translate id="tracker.action.cancel">取消</Translate>
          </button>
          <button className={styles.confirmDelete} onClick={onConfirm}>
            {confirmLabel || <Translate id="tracker.action.confirmDelete">删除</Translate>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Main Page ============
export default function TrackerPage() {
  const {i18n: {currentLocale}} = useDocusaurusContext();
  const COLUMNS = getColumns();
  const ESSAY_STATUSES = getEssayStatuses();
  const SORT_OPTIONS = getSortOptions();

  const [cards, setCards] = useState([]);
  const [storageStatus, setStorageStatus] = useState('loading');
  const [storageError, setStorageError] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [canUndoImport, setCanUndoImport] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [activeCard, setActiveCard] = useState(null);
  const [showAddModal, setShowAddModal] = useState(null); // null or column id
  const [showEditModal, setShowEditModal] = useState(null); // null or card object
  const [showLibrary, setShowLibrary] = useState(null); // null or column id string
  const [showConfirm, setShowConfirm] = useState(null); // null or card id
  const [sortBy, setSortBy] = useState('manual');
  const fileInputRef = useRef(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.trackerData);
      if (saved) setCards(parseTrackerBackup(saved));
      setCanUndoImport(localStorage.getItem(TRACKER_BACKUP_KEY) !== null);
      setStorageStatus('ready');
    } catch (e) {
      setStorageStatus('error');
      setStorageError(translate({id: 'tracker.storage.loadFailed', message: '无法读取当前清单，原始数据已保留。请先导出原始备份，再尝试导入有效备份。'}));
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (storageStatus !== 'ready') return;
    try {
      localStorage.setItem(STORAGE_KEYS.trackerData, JSON.stringify(cards));
    } catch (e) {
      setStorageError(translate({id: 'tracker.storage.saveFailed', message: '浏览器未能保存清单，请导出备份，避免刷新后丢失更改。'}));
    }
  }, [cards, storageStatus]);

  // Fetch program library
  useEffect(() => {
    fetch('/data/programs.json')
      .then((r) => r.json())
      .then((data) => setPrograms(data))
      .catch(() => {});
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Get cards per column with sorting
  const getColumnCards = useCallback(
    (colId) => {
      let filtered = cards.filter((c) => c.column === colId);
      if (sortBy === 'deadline') {
        filtered.sort((a, b) => {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline) - new Date(b.deadline);
        });
      } else if (sortBy === 'school') {
        filtered.sort((a, b) => a.school.localeCompare(b.school));
      }
      return filtered;
    },
    [cards, sortBy]
  );

  // Find which column a card is in
  const findColumn = (cardId) => {
    const card = cards.find((c) => c.id === cardId);
    return card ? card.column : null;
  };

  // DnD handlers
  const handleDragStart = (event) => {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card || null);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeCol = findColumn(activeId);
    // Over might be a column id or a card id
    const overCol = COLUMN_IDS.includes(overId)
      ? overId
      : findColumn(overId);

    if (!activeCol || !overCol || activeCol === overCol) return;

    // Move card to new column
    setCards((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, column: overCol } : c))
    );
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // If dropped on a column directly
    if (COLUMN_IDS.includes(overId)) {
      setCards((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, column: overId } : c))
      );
      return;
    }

    // Reorder within or across columns
    const activeCol = findColumn(activeId);
    const overCol = findColumn(overId);

    if (activeCol === overCol && activeId !== overId) {
      setCards((prev) => {
        const colCards = prev.filter((c) => c.column === activeCol);
        const rest = prev.filter((c) => c.column !== activeCol);
        const oldIdx = colCards.findIndex((c) => c.id === activeId);
        const newIdx = colCards.findIndex((c) => c.id === overId);
        const reordered = arrayMove(colCards, oldIdx, newIdx);
        return [...rest, ...reordered];
      });
    }
  };

  // Card CRUD
  const handleAddCard = (columnId) => {
    setShowLibrary(columnId);
  };

  const handleAddCustomCard = () => {
    const card = makeEmptyCard('reach');
    setShowAddModal(card);
  };

  const handleSaveNewCard = (card) => {
    if (!card.id || cards.find((c) => c.id === card.id)) {
      card = { ...card, id: genId() };
    }
    setCards((prev) => [...prev, card]);
    setShowAddModal(null);
  };

  const handleEditCard = (card) => {
    setShowEditModal({ ...card });
  };

  const handleSaveEditCard = (updated) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setShowEditModal(null);
  };

  const handleDeleteCard = (cardId) => {
    setShowConfirm(cardId);
  };

  const confirmDelete = () => {
    setCards((prev) => prev.filter((c) => c.id !== showConfirm));
    setShowConfirm(null);
  };

  // Library import
  const handleImportFromLibrary = (program) => {
    const column = showLibrary || 'reach';
    const card = {
      ...makeEmptyCard(column),
      id: genId(),
      school: program.school,
      program: program.program,
      tier: program.tier,
      slug: program.slug,
      fromLibrary: true,
      libraryId: program.id,
    };
    setCards((prev) => [...prev, card]);
  };

  const existingLibraryIds = useMemo(
    () => new Set(cards.filter((c) => c.libraryId).map((c) => c.libraryId)),
    [cards]
  );

  // Export/Import JSON
  const handleExport = () => {
    const data = storageStatus === 'error' ? localStorage.getItem(STORAGE_KEYS.trackerData) : JSON.stringify(cards, null, 2);
    const blob = new Blob([data], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csgrad-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage(null);
    setPendingImport(null);
    e.target.value = '';
    const failed = () => setImportMessage(translate({id: 'tracker.import.invalid', message: '导入失败：请使用完整有效的清单 JSON 备份（不超过 10 MB）。原清单未更改。'}));
    if (file.size > MAX_BACKUP_BYTES) { failed(); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        setPendingImport(parseTrackerBackup(ev.target.result));
      } catch (err) {
        failed();
      }
    };
    reader.onerror = failed;
    reader.readAsText(file);
  };

  const confirmImport = () => {
    let previousUndoBackup;
    let undoBackupChanged = false;
    try {
      // Keep the previous raw value, including an unreadable legacy backup, before replacing it.
      const previous = storageStatus === 'ready'
        ? JSON.stringify(cards)
        : localStorage.getItem(STORAGE_KEYS.trackerData) ?? '[]';
      previousUndoBackup = localStorage.getItem(TRACKER_BACKUP_KEY);
      localStorage.setItem(TRACKER_BACKUP_KEY, previous);
      undoBackupChanged = true;
      localStorage.setItem(STORAGE_KEYS.trackerData, JSON.stringify(pendingImport));
      setCards(pendingImport);
      setStorageStatus('ready');
      setStorageError(null);
      setCanUndoImport(true);
      setPendingImport(null);
      setImportMessage(translate({id: 'tracker.import.success', message: '导入完成。已保留导入前的清单，可撤销最近一次导入。'}));
    } catch {
      if (undoBackupChanged) {
        try {
          // The main write failed: restore the undo history as well as retaining the current list.
          if (previousUndoBackup === null) localStorage.removeItem(TRACKER_BACKUP_KEY);
          else localStorage.setItem(TRACKER_BACKUP_KEY, previousUndoBackup);
        } catch {
          setCanUndoImport(false);
          setImportMessage(translate({id: 'tracker.import.rollbackFailed', message: '导入未完成，当前清单未更改。但浏览器也无法恢复之前的撤销备份，本次会话已停用撤销入口。请立即导出当前清单；不要依赖现有撤销备份。'}));
          return;
        }
      }
      setImportMessage(translate({id: 'tracker.import.storageFailed', message: '浏览器无法保存导入前的备份或新清单，导入未完成。原清单未更改。'}));
    }
  };

  const undoImport = () => {
    try {
      const previous = localStorage.getItem(TRACKER_BACKUP_KEY);
      if (previous === null) return;
      // Validate before restoring. An unreadable legacy value remains available for export.
      let restored;
      try { restored = parseTrackerBackup(previous); } catch { restored = null; }
      localStorage.setItem(STORAGE_KEYS.trackerData, previous);
      setCards(restored || []);
      setStorageStatus(restored ? 'ready' : 'error');
      setStorageError(restored ? null : translate({id: 'tracker.storage.loadFailed', message: '无法读取当前清单，原始数据已保留。请先导出原始备份，再尝试导入有效备份。'}));
      setCanUndoImport(false);
      localStorage.removeItem(TRACKER_BACKUP_KEY);
      setImportMessage(translate({id: 'tracker.import.undone', message: '已恢复导入前的清单。'}));
      setShowUndoConfirm(false);
    } catch {
      setImportMessage(translate({id: 'tracker.storage.saveFailed', message: '浏览器未能保存清单，请导出备份，避免刷新后丢失更改。'}));
    }
  };

  const totalCards = cards.length;

  const pageTitle = translate({ id: 'tracker.page.title', message: '申请进度追踪器' });
  const pageDesc = translate({
    id: 'tracker.page.description',
    message: '申请进度追踪：管理研究生申请的轮次、推荐信、文书与截止日期',
  });

  return (
    <Layout title={pageTitle} description={pageDesc}>
      <Head>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="website" />
      </Head>
      <div className={styles.pageWrapper}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <a href={localizedInternalPath('/', currentLocale)} className={styles.backLink}>
            &larr; <Translate id="tracker.nav.backHome">返回首页</Translate>
          </a>
          <div className={styles.topBarRight}>
            <button type="button" className={styles.topBarLink} onClick={handleExport} disabled={storageStatus === 'loading'}>
              &#128190; {translate({ id: 'tracker.action.export', message: '导出数据' })}
            </button>
            <button type="button"
              className={styles.topBarLink}
              onClick={() => fileInputRef.current?.click()}
            >
              &#128194; {translate({ id: 'tracker.action.import', message: '导入数据' })}
            </button>
            {canUndoImport && <button type="button" className={styles.topBarLink} onClick={() => setShowUndoConfirm(true)}>
              <Translate id="tracker.import.undo">撤销最近导入</Translate>
            </button>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className={styles.hiddenInput}
              onChange={handleImportFile}
            />
          </div>
        </div>

        {storageError && <p role="alert" className={styles.notice}>{storageError}</p>}
        {importMessage && <p role="status" className={styles.notice}>{importMessage}</p>}

        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            &#128203; <Translate id="tracker.header.title">申请跟踪器</Translate>
            <span className={styles.badge}>{totalCards}</span>
          </h1>
          <p className={styles.subtitle}>
            <Translate id="tracker.header.subtitle">
              全面管理你的申请进度：轮次选择、考试状态、推荐信跟踪、面试安排等一站式管理
            </Translate>
          </p>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.viewToggle}>
              <button className={`${styles.viewBtn} ${styles.viewBtnActive}`}>
                &#128202; {translate({ id: 'tracker.view.kanban', message: '看板' })}
              </button>
            </div>
            <select
              className={styles.sortSelect}
              aria-label={translate({id: 'tracker.sort.label', message: '分类方式:'})}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="" disabled>
                {translate({ id: 'tracker.sort.label', message: '分类方式:' })}
              </option>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.toolbarRight}>
            <button
              disabled={storageStatus !== 'ready'}
              className={`${styles.actionBtn} ${styles.importBtn}`}
              onClick={handleAddCustomCard}
            >
              + <Translate id="tracker.action.addCustomProgram">添加自定义项目</Translate>
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        {storageStatus === 'ready' && <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.board}>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                cards={getColumnCards(col.id)}
                onAddCard={handleAddCard}
                onEditCard={handleEditCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className={styles.card} style={{ transform: 'rotate(3deg)', boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}>
                <CardContent card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>}

        {/* Modals */}
        {showAddModal && (
          <CardModal
            card={null}
            initialCard={showAddModal}
            columns={COLUMNS}
            essayStatuses={ESSAY_STATUSES}
            onSave={handleSaveNewCard}
            onClose={() => setShowAddModal(null)}
          />
        )}
        {showEditModal && (
          <CardModal
            card={showEditModal}
            columns={COLUMNS}
            essayStatuses={ESSAY_STATUSES}
            onSave={handleSaveEditCard}
            onClose={() => setShowEditModal(null)}
          />
        )}
        {showLibrary && (
          <LibraryModal
            programs={programs}
            existingIds={existingLibraryIds}
            onImport={handleImportFromLibrary}
            onClose={() => setShowLibrary(null)}
          />
        )}
        {showConfirm && (
          <ConfirmDialog
            message={translate({ id: 'tracker.confirm.deleteMessage', message: '确定要删除此项目吗？此操作不可撤销。' })}
            onConfirm={confirmDelete}
            onCancel={() => setShowConfirm(null)}
          />
        )}
        {pendingImport && <ConfirmDialog
          message={translate({id: 'tracker.import.confirm', message: '此备份包含 {count} 个项目，将替换当前 {current} 个项目（不是合并）。导入前的清单会保留为可撤销备份，覆盖上一次导入备份。是否继续？'}, {count: pendingImport.length, current: cards.length})}
          confirmLabel={translate({id: 'tracker.import.replace', message: '确认替换'})}
          onConfirm={confirmImport}
          onCancel={() => setPendingImport(null)}
        />}
        {showUndoConfirm && <ConfirmDialog
          message={translate({id: 'tracker.import.undoConfirm', message: '恢复最近一次导入前的清单？导入后的编辑将被替换。请先导出当前清单以保留这些编辑。'})}
          confirmLabel={translate({id: 'tracker.import.restore', message: '恢复旧清单'})}
          onConfirm={undoImport}
          onCancel={() => setShowUndoConfirm(false)}
        />}
      </div>
    </Layout>
  );
}
