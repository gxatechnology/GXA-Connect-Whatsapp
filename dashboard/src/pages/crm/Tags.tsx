import { useState } from 'react';
import { Tag as TagIcon, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  useCrmTagsQuery,
  useCreateTagMutation,
  useDeleteTagMutation,
} from '../../hooks/queries';
import { useToast } from '../../hooks/useToast';
import './Tags.css';

const PRESET_COLORS = [
  '#0B4DBB', // GXA Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#64748B', // Slate
];

export function Tags() {
  const toast = useToast();
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const { data: tags = [], isLoading } = useCrmTagsQuery();
  const createMutation = useCreateTagMutation();
  const deleteMutation = useDeleteTagMutation();

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    createMutation.mutate(
      { name: tagName.trim(), color: selectedColor },
      {
        onSuccess: () => {
          toast.success('Tag created successfully');
          setTagName('');
        },
        onError: (err) => {
          toast.error((err as Error).message || 'Failed to create tag');
        },
      },
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete tag "${name}"? It will be removed from all leads.`)) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Tag deleted'),
      });
    }
  };

  return (
    <div className="crm-tags-page">
      <div className="tags-header">
        <div className="tags-title-group">
          <TagIcon size={24} color="var(--gxa-blue, #0B4DBB)" />
          <h1 className="tags-title">CRM Tags & Labels</h1>
        </div>
      </div>

      {/* Create Tag Card */}
      <div className="create-tag-card">
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Create New Tag</h3>
        <form onSubmit={handleCreateTag} className="create-tag-form">
          <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Tag Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. VIP, Hot Lead, High Value..."
              value={tagName}
              onChange={e => setTagName(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                fontSize: '0.875rem',
              }}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Badge Color</label>
            <div className="color-picker-group">
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  className={`color-swatch ${selectedColor === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setSelectedColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn-create-lead"
            disabled={createMutation.isPending || !tagName.trim()}
          >
            <Plus size={16} /> Create Tag
          </button>
        </form>
      </div>

      {/* Tags Table */}
      {isLoading ? (
        <div className="empty-tags-container">
          <Loader2 className="animate-spin" size={32} color="var(--gxa-blue)" />
          <p style={{ color: 'var(--text-secondary)' }}>Loading CRM tags...</p>
        </div>
      ) : tags.length === 0 ? (
        <div className="empty-tags-container">
          <TagIcon size={40} color="var(--gxa-blue)" />
          <h3 style={{ margin: 0, fontWeight: 700 }}>No Tags Created Yet</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Use tags to organize leads by priority, interest, campaign, or custom attributes.
          </p>
        </div>
      ) : (
        <div className="tags-table-container">
          <table className="tags-table">
            <thead>
              <tr>
                <th>Tag Preview</th>
                <th>Name</th>
                <th>Assigned Leads</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tags.map(t => (
                <tr key={t.id}>
                  <td>
                    <span
                      className="tag-display-pill"
                      style={{
                        backgroundColor: `${t.color}20`,
                        color: t.color,
                        border: `1px solid ${t.color}40`,
                      }}
                    >
                      <TagIcon size={12} /> {t.name}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td>{t.leadCount || 0} leads</td>
                  <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="action-icon-btn"
                      title="Delete Tag"
                      onClick={() => handleDelete(t.id, t.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
