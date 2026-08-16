import { useState } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Key,
  Edit2,
  X,
  Loader2,
} from 'lucide-react';
import {
  useUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useResetPasswordMutation,
} from '../../hooks/queries';
import { useRole } from '../../hooks/useRole';
import { useToast } from '../../hooks/useToast';
import type { User } from '../../services/api';
import './Users.css';

export function Users() {
  const toast = useToast();
  const { isAdmin, user: currentUser } = useRole();

  const { data: users = [], isLoading } = useUsersQuery();
  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const resetPasswordMutation = useResetPasswordMutation();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);

  // Add Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'agent' | 'viewer'>('agent');

  // Edit Form state
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'manager' | 'agent' | 'viewer'>('agent');
  const [editStatus, setEditStatus] = useState<'active' | 'disabled'>('active');

  // Reset Password state
  const [newPassword, setNewPassword] = useState('');

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      toast.error('All fields are required');
      return;
    }

    createMutation.mutate(
      { fullName: fullName.trim(), email: email.trim(), password, role },
      {
        onSuccess: () => {
          toast.success('User created successfully');
          setShowAddModal(false);
          setFullName('');
          setEmail('');
          setPassword('');
        },
        onError: (err) => {
          toast.error((err as Error).message || 'Failed to create user');
        },
      },
    );
  };

  const handleStartEdit = (user: User) => {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditRole(user.role);
    setEditStatus(user.status);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    updateMutation.mutate(
      {
        id: editingUser.id,
        body: {
          fullName: editFullName.trim(),
          role: editRole,
          status: editStatus,
        },
      },
      {
        onSuccess: () => {
          toast.success('User updated successfully');
          setEditingUser(null);
        },
        onError: (err) => {
          toast.error((err as Error).message || 'Failed to update user');
        },
      },
    );
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser || !newPassword) return;

    resetPasswordMutation.mutate(
      { id: passwordResetUser.id, newPassword },
      {
        onSuccess: () => {
          toast.success('Password reset successfully');
          setPasswordResetUser(null);
          setNewPassword('');
        },
        onError: (err) => {
          toast.error((err as Error).message || 'Failed to reset password');
        },
      },
    );
  };

  return (
    <div className="team-users-page">
      {/* Header */}
      <div className="users-header">
        <div className="users-title-group">
          <UsersIcon size={24} color="var(--gxa-blue, #0B4DBB)" />
          <h1 className="users-title">Team & Role Access</h1>
        </div>
        {isAdmin && (
          <button
            className="btn-create-lead"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Add Team Member
          </button>
        )}
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="crm-leads-page">
          <div className="empty-leads-container">
            <Loader2 className="animate-spin" size={32} color="var(--gxa-blue)" />
            <p style={{ color: 'var(--text-secondary)' }}>Loading team members...</p>
          </div>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Member Name & Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{u.fullName} {u.id === currentUser?.id && '(You)'}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge role-${u.role}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${u.status}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>
                    {u.lastLoginAt ? (
                      new Date(u.lastLoginAt).toLocaleString()
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Never</span>
                    )}
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                        <button
                          className="action-icon-btn"
                          title="Edit User"
                          onClick={() => handleStartEdit(u)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="action-icon-btn"
                          title="Reset Password"
                          onClick={() => setPasswordResetUser(u)}
                        >
                          <Key size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="crm-leads-page">
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Add Team Member</h2>
                <button className="action-icon-btn" onClick={() => setShowAddModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Jane Doe"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="jane@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      className="filter-select"
                      value={role}
                      onChange={e => setRole(e.target.value as typeof role)}
                    >
                      <option value="admin">Administrator (Full Access)</option>
                      <option value="manager">Manager (CRM & Team View)</option>
                      <option value="agent">Agent (Chats & CRM)</option>
                      <option value="viewer">Viewer (Read Only)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="action-icon-btn"
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-create-lead"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Adding...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="crm-leads-page">
          <div className="modal-overlay" onClick={() => setEditingUser(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Edit User: {editingUser.email}</h2>
                <button className="action-icon-btn" onClick={() => setEditingUser(null)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFullName}
                    onChange={e => setEditFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      className="filter-select"
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as typeof editRole)}
                    >
                      <option value="admin">Administrator</option>
                      <option value="manager">Manager</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Account Status</label>
                    <select
                      className="filter-select"
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value as typeof editStatus)}
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled (Blocked)</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="action-icon-btn"
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={() => setEditingUser(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-create-lead"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {passwordResetUser && (
        <div className="crm-leads-page">
          <div className="modal-overlay" onClick={() => setPasswordResetUser(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Reset Password: {passwordResetUser.fullName}</h2>
                <button className="action-icon-btn" onClick={() => setPasswordResetUser(null)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="modal-form">
                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter new password (min 6 characters)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="action-icon-btn"
                    style={{ padding: '0.5rem 1rem' }}
                    onClick={() => setPasswordResetUser(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-create-lead"
                    disabled={resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending ? 'Resetting...' : 'Set New Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
