import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Task, TaskStatus } from '@make-now/core';
import { listTasks, getTask, updateTaskStatus } from '../storage';
import { useAuth } from '../auth/authContext';

type FilterStatus = 'all' | 'open' | 'scheduled' | 'done' | 'cancelled';

export default function TasksOverviewScreen() {
  const { user, firebaseUser } = useAuth();
  const userId = user?.id || firebaseUser?.uid || '';

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'duration'>('updated');

  const allTasks = useMemo(() => {
    return listTasks(userId);
  }, [userId]);

  const filteredAndSortedTasks = useMemo(() => {
    let tasks = allTasks;

    // Filter by status
    if (filter !== 'all') {
      tasks = tasks.filter((t) => t.status === filter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.notes?.toLowerCase().includes(term)
      );
    }

    // Sort
    if (sortBy === 'created') {
      tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'updated') {
      tasks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (sortBy === 'duration') {
      tasks.sort((a, b) => (b.duration_max_minutes || 30) - (a.duration_max_minutes || 30));
    }

    return tasks;
  }, [allTasks, filter, searchTerm, sortBy]);

  const stats = useMemo(() => {
    return {
      total: allTasks.length,
      open: allTasks.filter((t) => t.status === 'open').length,
      scheduled: allTasks.filter((t) => t.status === 'scheduled').length,
      done: allTasks.filter((t) => t.status === 'done').length,
      cancelled: allTasks.filter((t) => t.status === 'cancelled').length,
    };
  }, [allTasks]);

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'open':
        return '#f59e0b';
      case 'scheduled':
        return '#3b82f6';
      case 'in_progress':
        return '#8b5cf6';
      case 'done':
        return '#10b981';
      case 'cancelled':
        return '#6b7280';
      default:
        return '#9ca3af';
    }
  };

  const getStatusEmoji = (status: TaskStatus) => {
    switch (status) {
      case 'open':
        return '⭕';
      case 'scheduled':
        return '📅';
      case 'in_progress':
        return '⏳';
      case 'done':
        return '✅';
      case 'cancelled':
        return '❌';
      default:
        return '•';
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'open':
        return 'Offen';
      case 'scheduled':
        return 'Geplant';
      case 'in_progress':
        return 'Läuft';
      case 'done':
        return 'Erledigt';
      case 'cancelled':
        return 'Gelöscht';
      default:
        return status;
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>📋 Task-Übersicht</h1>
        <Link to="/today" className="button" style={{ textDecoration: 'none' }}>
          → Zum Tagesplan
        </Link>
      </div>

      {/* Stats */}
      <div
        className="grid"
        style={{
          gap: 12,
          marginBottom: 24,
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        }}
      >
        {[
          { label: 'Gesamt', count: stats.total, color: '#6b7280' },
          { label: 'Offen', count: stats.open, color: '#f59e0b' },
          { label: 'Geplant', count: stats.scheduled, color: '#3b82f6' },
          { label: 'Erledigt', count: stats.done, color: '#10b981' },
          { label: 'Gelöscht', count: stats.cancelled, color: '#d1d5db' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card"
            style={{
              borderLeft: `4px solid ${stat.color}`,
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 600, color: stat.color }}>
              {stat.count}
            </div>
            <div className="muted" style={{ fontSize: '12px', marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          }}
        >
          {/* Search */}
          <div>
            <label className="label">Suche</label>
            <input
              type="text"
              placeholder="Task-Titel oder Notiz..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Filter */}
          <div>
            <label className="label">Status</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterStatus)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            >
              <option value="all">Alle ({stats.total})</option>
              <option value="open">Offen ({stats.open})</option>
              <option value="scheduled">Geplant ({stats.scheduled})</option>
              <option value="done">Erledigt ({stats.done})</option>
              <option value="cancelled">Gelöscht ({stats.cancelled})</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="label">Sortieren</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'created' | 'updated' | 'duration')}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            >
              <option value="updated">Zuletzt bearbeitet</option>
              <option value="created">Zuletzt erstellt</option>
              <option value="duration">Längste zuerst</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      {filteredAndSortedTasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
          <div className="muted" style={{ fontSize: '14px' }}>
            {searchTerm ? '❌ Keine Tasks gefunden' : '✨ Keine Tasks in dieser Kategorie'}
          </div>
        </div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {filteredAndSortedTasks.map((task) => (
            <div
              key={task.id}
              className="card"
              style={{
                borderLeft: `4px solid ${getStatusColor(task.status)}`,
                padding: '12px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 12,
                alignItems: 'start',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: '16px' }}>{getStatusEmoji(task.status)}</div>
                  <div style={{ fontWeight: 600, flex: 1 }}>{task.title}</div>
                  <div
                    className="badge"
                    style={{
                      background:
                        task.importance === 'high'
                          ? '#fee2e2'
                          : task.importance === 'medium'
                            ? '#fef3c7'
                            : '#ecfdf5',
                      color:
                        task.importance === 'high'
                          ? '#991b1b'
                          : task.importance === 'medium'
                            ? '#92400e'
                            : '#065f46',
                    }}
                  >
                    {task.importance === 'high'
                      ? '🔴 Hoch'
                      : task.importance === 'medium'
                        ? '🟡 Mittel'
                        : '🟢 Niedrig'}
                  </div>
                </div>

                <div className="muted" style={{ fontSize: '12px', marginBottom: 8 }}>
                  ⏱️ {task.duration_min_minutes}-{task.duration_max_minutes} Min •
                  {task.due_at ? ` Bis ${new Date(task.due_at).toLocaleDateString('de-DE')}` : ' Keine Deadline'}
                </div>

                {task.notes && (
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: 8 }}>
                    {task.notes}
                  </div>
                )}

                <div className="muted" style={{ fontSize: '11px', marginTop: 8 }}>
                  Erstellt: {new Date(task.created_at).toLocaleDateString('de-DE')} •
                  Bearbeitet: {new Date(task.updated_at).toLocaleDateString('de-DE')}
                </div>
              </div>

              {/* Status selector */}
              <select
                value={task.status}
                onChange={(e) =>
                  updateTaskStatus(userId, task.id, e.target.value as TaskStatus, firebaseUser)
                }
                style={{
                  padding: '6px 10px',
                  border: `1px solid ${getStatusColor(task.status)}`,
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  color: getStatusColor(task.status),
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <option value="open">Offen</option>
                <option value="scheduled">Geplant</option>
                <option value="in_progress">Läuft</option>
                <option value="done">Erledigt</option>
                <option value="cancelled">Gelöscht</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
