import { useEffect, useState, useCallback } from "react";
import { message, Modal, Switch } from "antd";
import { Search, UserPlus, Trash2, Settings, X, ChevronDown, ChevronUp, ShieldOff, ShieldCheck } from "lucide-react";
import {
  listTeamMembers,
  revokeTeamRole,
  getUserPermissions,
  setUserPermissions,
  banTeamMember,
  unbanTeamMember,
  createSubordinate,
} from "../../services/ownerApi";
import { getAdminRole } from "../../utils/auth";

const ROLE_LABELS = {
  owner:     { label: "Owner",     color: "bg-slate-200 text-slate-700" },
  manager:   { label: "Manager",   color: "bg-indigo-100 text-indigo-700" },
  staff:     { label: "Staff",     color: "bg-emerald-100 text-emerald-700" },
  assistant: { label: "Assistant", color: "bg-amber-100 text-amber-700" },
};

const ROLE_HIERARCHY = { owner: 60, manager: 40, staff: 20, assistant: 10 };

const TeamManagement = () => {
  const currentRole = getAdminRole();
  const isManagerViewer = currentRole === "manager";
  const viewerHierarchy = ROLE_HIERARCHY[currentRole] ?? 0;
  const assignableRoles = isManagerViewer
    ? [{ value: "staff", label: "Staff" }, { value: "assistant", label: "Assistant" }]
    : [{ value: "manager", label: "Manager" }, { value: "staff", label: "Staff" }, { value: "assistant", label: "Assistant" }];

  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");

  // Add member state
  const [showSearch, setShowSearch] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({ fullName: "", email: "", role: "staff" });
  const [creatingMember, setCreatingMember] = useState(false);


  // Permission modal
  const [permTarget, setPermTarget] = useState(null);
  const [permData, setPermData] = useState(null);
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTeamMembers({ roleFilter: roleFilter || undefined });
      const d = res?.data || res;
      setMembers(d?.items || []);
      setTotal(d?.total || 0);
    } catch {
      message.error("Failed to load team members.");
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const handleCreateMember = async () => {
    if (!newMemberForm.fullName || !newMemberForm.email) {
      message.error("Name and Email are required.");
      return;
    }
    setCreatingMember(true);
    try {
      const res = await createSubordinate({
        full_name: newMemberForm.fullName,
        original_email: newMemberForm.email,
        target_role: newMemberForm.role,
      });
      const data = res?.data || res || {};
      
      message.success("New team member created successfully.");
      setShowSearch(false);
      setNewMemberForm({ fullName: "", email: "", role: "staff" });
      await loadTeam();

      Modal.success({
        title: "Subordinate Account Created",
        content: (
          <div className="mt-4 space-y-2">
            <p>An email has been sent to <strong>{newMemberForm.email}</strong> with these credentials.</p>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="mb-1"><strong>Login Email:</strong> <span className="font-mono text-slate-700">{data.login_email}</span></p>
              <p><strong>Password:</strong> <span className="font-mono text-slate-700">{data.generated_password}</span></p>
            </div>
            <p className="text-red-500 text-sm mt-2 font-medium">Please save this password securely. For security reasons, it will not be shown again.</p>
          </div>
        ),
        width: 500,
      });
    } catch (err) {
      message.error(err?.message || "Failed to create member.");
    } finally {
      setCreatingMember(false);
    }
  };


  const handleBanToggle = (member) => {
    const isBanned = member.status === "blocked";
    Modal.confirm({
      title: isBanned ? `Unban ${member.name || member.email}?` : `Ban ${member.name || member.email}?`,
      content: isBanned
        ? "This will restore their access to the platform."
        : "This will block their access immediately.",
      okText: isBanned ? "Unban" : "Ban",
      okButtonProps: { danger: !isBanned, style: isBanned ? { background: "#17b4c9", borderColor: "#17b4c9" } : {} },
      onOk: async () => {
        try {
          if (isBanned) {
            await unbanTeamMember(member.user_id);
            message.success(`${member.name || member.email} unbanned.`);
          } else {
            await banTeamMember(member.user_id);
            message.success(`${member.name || member.email} banned.`);
          }
          await loadTeam();
        } catch (err) {
          message.error(err?.message || "Failed to update status.");
        }
      },
    });
  };

  const handleRevoke = async (member) => {
    Modal.confirm({
      title: `Remove ${member.name || member.email}?`,
      content: `This will revoke their '${member.role_slug}' role.`,
      okText: "Remove",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await revokeTeamRole({ user_id: member.user_id, role_slug: member.role_slug });
          message.success("Role revoked.");
          await loadTeam();
        } catch (err) {
          message.error(err?.message || "Failed to revoke role.");
        }
      },
    });
  };

  const handlePermOpen = async (member) => {
    setPermTarget(member);
    setPermLoading(true);
    setSelectedPerms([]);
    setExpandedModules({});
    try {
      const res = await getUserPermissions(member.user_id);
      const d = res?.data || res;
      setPermData(d);
      // Use stored permissions if available, else fall back to empty list
      setSelectedPerms(Array.isArray(d?.allowed_permissions) ? d.allowed_permissions : []);
    } catch {
      message.error("Failed to load permissions.");
    } finally {
      setPermLoading(false);
    }
  };

  const togglePermKey = (key) => {
    setSelectedPerms((prev) => {
      const current = prev || [];
      return current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
    });
  };

  const toggleModule = (mod) => {
    const allKeys = (permData?.all_permissions?.[mod] || []).map((p) => p.key);
    const current = selectedPerms || [];
    const allSelected = allKeys.every((k) => current.includes(k));
    if (allSelected) {
      setSelectedPerms(current.filter((k) => !allKeys.includes(k)));
    } else {
      setSelectedPerms([...new Set([...current, ...allKeys])]);
    }
  };

  const handlePermSave = async () => {
    if (!permTarget) return;
    setPermSaving(true);
    try {
      await setUserPermissions(permTarget.user_id, selectedPerms || []);
      message.success("Permissions updated.");
      setPermTarget(null);
      await loadTeam();
    } catch (err) {
      message.error(err?.message || "Failed to save permissions.");
    } finally {
      setPermSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} team member{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-2 rounded-xl bg-[#17b4c9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#149cb0] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Add Member Panel */}
      {showSearch && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Create New Team Member</h2>
            <button onClick={() => { setShowSearch(false); setNewMemberForm({ fullName: "", email: "", role: "staff" }); }}>
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={newMemberForm.fullName}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, fullName: e.target.value })}
                placeholder="John Doe"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9] focus:ring-1 focus:ring-[#17b4c9]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Real Email</label>
              <input
                type="email"
                value={newMemberForm.email}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                placeholder="john@example.com"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9] focus:ring-1 focus:ring-[#17b4c9]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                value={newMemberForm.role}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, role: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9] focus:ring-1 focus:ring-[#17b4c9]"
              >
                {assignableRoles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {isManagerViewer && (
                <p className="mt-1 text-xs text-slate-400">Managers can add Staff or Assistant members.</p>
              )}
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <button
              onClick={handleCreateMember}
              disabled={creatingMember}
              className={`rounded-xl bg-[#17b4c9] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#149cb0] transition-colors ${creatingMember ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {creatingMember ? "Creating..." : "Create Member"}
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { value: "",          label: "All" },
          { value: "manager",   label: "Managers" },
          { value: "staff",     label: "Staff" },
          { value: "assistant", label: "Assistants" },
        ].map((r) => (
          <button
            key={r.value}
            onClick={() => setRoleFilter(r.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              roleFilter === r.value
                ? "bg-[#17b4c9] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Team Table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading team...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No team members yet. Click "Add Member" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Member</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Role</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Permissions</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Assigned</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map((m) => {
                  const badge = ROLE_LABELS[m.role_slug] || { label: m.role_slug, color: "bg-slate-100 text-slate-600" };
                  const hasRestrictions = Array.isArray(m.allowed_permissions) && m.allowed_permissions.length > 0;
                  const isBanned = m.status === "blocked";
                  const canManage = (ROLE_HIERARCHY[m.role_slug] ?? 0) < viewerHierarchy;
                  return (
                    <tr key={m.assignment_id} className={`transition-colors ${isBanned ? "bg-red-50/40" : "hover:bg-slate-50"}`}>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-800">{m.name || "—"}</div>
                        <div className="text-xs text-slate-500">{m.email}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isBanned ? (
                          <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-600">
                            Banned
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-600">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {hasRestrictions ? (
                          <span className="text-xs text-amber-600 font-medium">
                            {m.allowed_permissions.length} permission{m.allowed_permissions.length !== 1 ? "s" : ""} set
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Role defaults</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {m.assigned_at ? new Date(m.assigned_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        {canManage ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              title="Manage Permissions"
                              onClick={() => handlePermOpen(m)}
                              className="rounded-lg p-1.5 text-slate-400 hover:text-[#17b4c9] hover:bg-cyan-50 transition-colors"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              title={isBanned ? "Unban member" : "Ban member"}
                              onClick={() => handleBanToggle(m)}
                              className={`rounded-lg p-1.5 transition-colors ${
                                isBanned
                                  ? "text-emerald-500 hover:bg-emerald-50"
                                  : "text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                              }`}
                            >
                              {isBanned ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                            </button>
                            <button
                              title="Remove"
                              onClick={() => handleRevoke(m)}
                              className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-right text-xs text-slate-300">—</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permission Restriction Modal */}
      <Modal
        open={Boolean(permTarget)}
        onCancel={() => setPermTarget(null)}
        title={
          <div>
            <p className="font-bold text-slate-900">{permTarget?.name || permTarget?.email || "Member"}</p>
            <p className="text-xs font-normal text-slate-400 mt-0.5 capitalize">
              {permTarget?.role_slug} · CRM Permission Control
            </p>
          </div>
        }
        width={640}
        onOk={handlePermSave}
        okText={permSaving ? "Saving..." : "Save Permissions"}
        confirmLoading={permSaving}
        okButtonProps={{ style: { background: "#17b4c9", borderColor: "#17b4c9" } }}
        cancelText="Cancel"
      >
        {permLoading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading permissions...</div>
        ) : permData ? (
          <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1 pt-1">
            {/* Summary bar */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 mb-3">
              <p className="text-sm text-slate-600">
                <span className="font-bold text-[#17b4c9]">
                  {(selectedPerms || []).length}
                </span>
                {" "}of{" "}
                <span className="font-semibold text-slate-700">
                  {Object.values(permData.all_permissions || {}).flat().length}
                </span>
                {" "}permissions enabled
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const all = Object.values(permData.all_permissions || {}).flat().map((p) => p.key);
                    setSelectedPerms(all);
                  }}
                  className="text-xs font-semibold text-[#17b4c9] hover:underline"
                >
                  Enable all
                </button>
                <button
                  onClick={() => setSelectedPerms([])}
                  className="text-xs font-semibold text-red-400 hover:underline"
                >
                  Disable all
                </button>
              </div>
            </div>

            {Object.entries(permData.all_permissions || {}).map(([mod, perms]) => {
              const current = selectedPerms || [];
              const modKeys = perms.map((p) => p.key);
              const enabledCount = modKeys.filter((k) => current.includes(k)).length;
              const allModSelected = enabledCount === modKeys.length;
              const someModSelected = enabledCount > 0 && !allModSelected;
              const isExpanded = expandedModules[mod] !== false;

              return (
                <div key={mod} className="rounded-xl border border-slate-200 overflow-hidden">
                  {/* Module header */}
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedModules((p) => ({ ...p, [mod]: !isExpanded }))}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={allModSelected}
                        ref={(el) => { if (el) el.indeterminate = someModSelected; }}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (allModSelected) {
                            setSelectedPerms((current || []).filter((k) => !modKeys.includes(k)));
                          } else {
                            setSelectedPerms([...new Set([...(current || []), ...modKeys])]);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-[#17b4c9] cursor-pointer"
                      />
                      <span className="font-semibold text-sm text-slate-800 capitalize">
                        {mod.replace(/_/g, " ")}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        allModSelected ? "bg-cyan-100 text-[#17b4c9]" :
                        someModSelected ? "bg-amber-100 text-amber-600" :
                        "bg-slate-100 text-slate-400"
                      }`}>
                        {enabledCount}/{modKeys.length}
                      </span>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />
                    }
                  </button>

                  {/* Permission checkboxes */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {perms.map((p) => {
                        const checked = (selectedPerms || []).includes(p.key);
                        return (
                          <label
                            key={p.key}
                            className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${
                              checked ? "bg-cyan-50/60" : "hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  setSelectedPerms((selectedPerms || []).filter((k) => k !== p.key));
                                } else {
                                  setSelectedPerms([...(selectedPerms || []), p.key]);
                                }
                              }}
                              className="w-4 h-4 accent-[#17b4c9] cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${checked ? "text-slate-900" : "text-slate-500"}`}>
                                {p.label || p.action}
                              </p>
                              {p.description && (
                                <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-6 text-center">No permissions available.</p>
        )}
      </Modal>
    </div>
  );
};

export default TeamManagement;
