import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Layout from '@theme/Layout';
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
import styles from './tracker.module.css';

// ============ Constants ============
const STORAGE_KEY = 'csgrad_tracker_data';
const COLUMNS = [
  { id: 'reach', title: '彩票', subtitle: 'Lottery', colorClass: styles.colReach },
  { id: 'match', title: '冲刺', subtitle: 'Target', colorClass: styles.colMatch },
  { id: 'target', title: '主申', subtitle: 'Match', colorClass: styles.colTarget },
  { id: 'safety', title: '保底', subtitle: 'Safety', colorClass: styles.colSafety },
];

const ESSAY_STATUSES = [
  { value: 'not_started', label: '未开始' },
  { value: 'drafting', label: '草稿中' },
  { value: 'reviewing', label: '修改中' },
  { value: 'done', label: '已完成' },
];

const SORT_OPTIONS = [
  { value: 'manual', label: '手动排序' },
  { value: 'deadline', label: '按截止日期' },
  { value: 'school', label: '按学校名称' },
];

// ============ Helpers ============
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
      { name: '推荐信 1', done: false },
      { name: '推荐信 2', done: false },
      { name: '推荐信 3', done: false },
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
  const days = daysUntil(card.deadline);
  const progress = computeProgress(card);

  return (
    <>
      <div className={styles.cardActions}>
        {onEdit && (
          <button
            className={styles.cardActionBtn}
            onClick={(e) => { e.stopPropagation(); onEdit(card); }}
            title="编辑"
          >
            &#9998;
          </button>
        )}
        {onDelete && (
          <button
            className={styles.cardActionBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
            title="删除"
          >
            &times;
          </button>
        )}
      </div>
      <p className={styles.cardSchool}>{card.school || '未命名学校'}</p>
      <p className={styles.cardProgram}>{card.program || '未命名项目'}</p>
      <div className={styles.cardTags}>
        {card.tier && <span className={`${styles.tag} ${styles.tagTier}`}>{card.tier}</span>}
        {card.fromLibrary && <span className={`${styles.tag} ${styles.tagCustom}`}>项目库</span>}
        {!card.fromLibrary && card.school && <span className={`${styles.tag} ${styles.tagCustom}`}>自定义</span>}
      </div>
      {card.deadline && (
        <div className={styles.cardDeadline}>
          <span className={styles.deadlineIcon}>&#128197;</span>
          <div>
            <div className={styles.deadlineText}>
              截止日期: {card.deadline}
            </div>
            {days !== null && (
              <div className={`${styles.deadlineCountdown} ${days < 0 ? styles.deadlineOverdue : ''}`}>
                {days > 0 ? `还剩 ${days} 天` : days === 0 ? '今天截止!' : `已过期 ${Math.abs(days)} 天`}
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
        进度: {card.lors.filter(l => l.done).length}/{card.lors.length} 推荐信
        {card.toefl ? ' | 语言 ✓' : ''}
        {card.essayStatus === 'done' ? ' | 文书 ✓' : ''}
      </div>
      {card.slug && (
        <a
          href={card.slug}
          className={styles.programLink}
          onClick={(e) => e.stopPropagation()}
        >
          &#8599; 查看项目介绍
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
          <span style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: 6, opacity: 0.7 }}>
            {column.subtitle}
          </span>
        </h3>
        <span className={styles.columnCount}>{cards.length}</span>
      </div>
      <div ref={setNodeRef} className={styles.columnBody}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.length === 0 && (
            <div className={styles.emptyColumn}>拖拽项目到此列或点击下方添加</div>
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
          + 添加项目
        </button>
      </div>
    </div>
  );
}

// Add/Edit Card Modal
function CardModal({ card, onSave, onClose }) {
  const [form, setForm] = useState(
    card || makeEmptyCard('reach')
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
      lors: [...f.lors, { name: `推荐信 ${f.lors.length + 1}`, done: false }],
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
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{card ? '编辑项目' : '添加自定义项目'}</h3>
          <button className={styles.modalClose} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>学校名称</label>
              <input
                className={styles.formInput}
                value={form.school}
                onChange={(e) => set('school', e.target.value)}
                placeholder="如: Stanford University"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>项目名称</label>
              <input
                className={styles.formInput}
                value={form.program}
                onChange={(e) => set('program', e.target.value)}
                placeholder="如: MSCS"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>分类</label>
              <select
                className={styles.formSelect}
                value={form.column}
                onChange={(e) => set('column', e.target.value)}
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.subtitle})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>截止日期</label>
              <input
                type="date"
                className={styles.formInput}
                value={form.deadline}
                onChange={(e) => set('deadline', e.target.value)}
              />
            </div>
          </div>

          {/* LORs */}
          <div className={styles.detailSection}>
            <h4 className={styles.detailSectionTitle}>推荐信 (LORs)</h4>
            {form.lors.map((lor, idx) => (
              <div key={idx} className={styles.lorRow}>
                <input
                  type="checkbox"
                  className={styles.lorCheck}
                  checked={lor.done}
                  onChange={(e) => setLor(idx, 'done', e.target.checked)}
                />
                <input
                  className={styles.lorInput}
                  value={lor.name}
                  onChange={(e) => setLor(idx, 'name', e.target.value)}
                  placeholder="推荐人姓名"
                />
                <button
                  className={styles.cardActionBtn}
                  onClick={() => removeLor(idx)}
                  title="删除"
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
              + 添加推荐信
            </button>
          </div>

          {/* Test scores */}
          <div className={styles.detailSection}>
            <h4 className={styles.detailSectionTitle}>标准化考试</h4>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>TOEFL / IELTS</label>
                <input
                  className={styles.formInput}
                  value={form.toefl}
                  onChange={(e) => set('toefl', e.target.value)}
                  placeholder="如: 110"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>GRE</label>
                <input
                  className={styles.formInput}
                  value={form.gre}
                  onChange={(e) => set('gre', e.target.value)}
                  placeholder="如: 330"
                />
              </div>
            </div>
          </div>

          {/* Essay */}
          <div className={styles.detailSection}>
            <h4 className={styles.detailSectionTitle}>文书进度</h4>
            <div className={styles.essayStatus}>
              {ESSAY_STATUSES.map((s) => (
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
            <label className={styles.formLabel}>备注</label>
            <input
              className={styles.formInput}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="任何备注信息..."
            />
          </div>

          <button
            className={styles.formSubmitBtn}
            disabled={!form.school && !form.program}
            onClick={() => onSave(form)}
          >
            {card ? '保存修改' : '添加项目'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Library Import Modal
function LibraryModal({ programs, existingIds, onImport, onClose }) {
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
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>从项目库导入</h3>
          <button className={styles.modalClose} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.modalBody}>
          <input
            className={styles.librarySearch}
            placeholder="搜索学校或项目名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.libraryList}>
            {filtered.map((p) => {
              const added = existingIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className={styles.libraryItem}
                  onClick={() => !added && onImport(p)}
                  style={added ? { opacity: 0.5 } : {}}
                >
                  <div className={styles.libraryItemInfo}>
                    <span className={styles.libraryItemSchool}>{p.school}</span>
                    <span className={styles.libraryItemProgram}>{p.program}</span>
                  </div>
                  {added ? (
                    <span className={styles.libraryItemAdded}>已添加</span>
                  ) : (
                    <span className={styles.libraryItemTier}>{p.tier}</span>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className={styles.emptyColumn}>未找到匹配的项目</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Confirm dialog
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className={styles.confirmOverlay} onClick={onCancel}>
      <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
        <p className={styles.confirmText}>{message}</p>
        <div className={styles.confirmBtns}>
          <button className={styles.confirmCancel} onClick={onCancel}>取消</button>
          <button className={styles.confirmDelete} onClick={onConfirm}>删除</button>
        </div>
      </div>
    </div>
  );
}

// ============ Main Page ============
export default function TrackerPage() {
  const [cards, setCards] = useState([]);
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
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCards(parsed);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (e) {
      // ignore
    }
  }, [cards]);

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
    const overCol = COLUMNS.find((c) => c.id === overId)
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
    if (COLUMNS.find((c) => c.id === overId)) {
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
    const blob = new Blob([JSON.stringify(cards, null, 2)], {
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
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) {
          setCards(data);
        }
      } catch (err) {
        alert('导入失败: JSON 格式无效');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const totalCards = cards.length;

  return (
    <Layout title="申请进度追踪器" description="管理你的研究生申请进度">
      <div className={styles.pageWrapper}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <a href="/" className={styles.backLink}>
            &larr; 返回首页
          </a>
          <div className={styles.topBarRight}>
            <span className={styles.topBarLink} onClick={handleExport}>
              &#128190; 导出数据
            </span>
            <span
              className={styles.topBarLink}
              onClick={() => fileInputRef.current?.click()}
            >
              &#128194; 导入数据
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className={styles.hiddenInput}
              onChange={handleImportFile}
            />
          </div>
        </div>

        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            &#128203; 申请跟踪器
            <span className={styles.badge}>{totalCards}</span>
          </h1>
          <p className={styles.subtitle}>
            全面管理你的申请进度：轮次选择、考试状态、推荐信跟踪、面试安排等一站式管理
          </p>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.viewToggle}>
              <button className={`${styles.viewBtn} ${styles.viewBtnActive}`}>
                &#128202; 看板
              </button>
            </div>
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="" disabled>分类方式:</option>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.toolbarRight}>
            <button
              className={`${styles.actionBtn} ${styles.importBtn}`}
              onClick={handleAddCustomCard}
            >
              + 添加自定义项目
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <DndContext
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
        </DndContext>

        {/* Modals */}
        {showAddModal && (
          <CardModal
            card={null}
            onSave={(card) => handleSaveNewCard({ ...card, column: showAddModal.column })}
            onClose={() => setShowAddModal(null)}
          />
        )}
        {showEditModal && (
          <CardModal
            card={showEditModal}
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
            message="确定要删除此项目吗？此操作不可撤销。"
            onConfirm={confirmDelete}
            onCancel={() => setShowConfirm(null)}
          />
        )}
      </div>
    </Layout>
  );
}
