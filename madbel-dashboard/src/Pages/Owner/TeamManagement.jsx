import { useEffect, useState, useCallback } from "react";
import { message, Modal, Switch } from "antd";
import { Search, UserPlus, Trash2, Settings, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  listTeamMembers,
  searchUsers,
  assignTeamRole,
  revokeTeamRole,
  getUserPermissions,
  setUserPermissions,
} from "../../services/ownerApi";

const ROLE_LABELS = {
  supervisor: { label: "Supervisor", color: "bg-indigo-100 text-indigo-700" },
  staff: { label: "Staff", color: "bg-emerald-100 text-emerald-700" },
};

const TeamManagement = () => {
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");

  // Add member state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Assign role modal
  const [assignTarget, setAssignTarget] = useState(null);
  const [selectedRole, setSelectedRole] = useState("supervisor");
  const [assigning, setAssigning] = useState(false);

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

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await searchUsers(q);
      setSearchResults(res?.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAssignOpen = (user) => {
    setAssignTarget(user);
    setSelectedRole("supervisor");
  };

  const handleAssignConfirm = async () => {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      await assignTeamRole({ user_id: assignTarget.user_id, role_slug: selectedRole });
      message.success(`${assignTarget.name || assignTarget.email} assigned as ${selectedRole}.`);
      setAssignTarget(null);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      await loadTeam();
    } catch (err) {
      message.error(err?.message || "Failed to assign role.");
    } finally {
      setAssigning(false);
    }
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
    setSelectedPerms(null);
    setExpandedModules({});
    try {
      const res = await getUserPermissions(member.user_id);
      const d = res?.data || res;
      setPermData(d);
      setSelectedPerms(d?.allowed_permissions || null);
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

      {/* Search Panel */}
      {showSearch && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Search & Add User</h2>
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}>
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9] focus:ring-1 focus:ring-[#17b4c9]"
            />
          </div>

          {searching && <p className="text-sm text-slate-400">Searching...</p>}

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:border-[#17b4c9] hover:bg-cyan-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{u.email}</p>
                    {u.name && <p className="text-xs text-slate-500">{u.name}</p>}
                    <p className="text-xs text-slate-400">Current role: {u.current_role}</p>
                  </div>
                  <button
                    onClick={() => handleAssignOpen(u)}
                    className="rounded-lg bg-[#17b4c9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#149cb0]"
                  >
                    Assign Role
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {["", "supervisor", "staff"].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              roleFilter === r
                ? "bg-[#17b4c9] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {r === "" ? "All" : r === "supervisor" ? "Supervisors" : "Staff"}
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
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Permissions</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Assigned</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map((m) => {
                  const badge = ROLE_LABELS[m.role_slug] || { label: m.role_slug, color: "bg-slate-100 text-slate-600" };
                  const hasRestrictions = Array.isArray(m.allowed_permissions) && m.allowed_permissions.length > 0;
                  return (
                    <tr key={m.assignment_id} className="hover:bg-slate-50 transition-colors">
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            title="Manage Permissions"
                            onClick={() => handlePermOpen(m)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-[#17b4c9] hover:bg-cyan-50 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            title="Remove"
                            onClick={() => handleRevoke(m)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Role Modal */}
      <Modal
        open={Boolean(assignTarget)}
        onCancel={() => setAssignTarget(null)}
        title={`Assign Role — ${assignTarget?.email || ""}`}
        onOk={handleAssignConfirm}
        okText={assigning ? "Assigning..." : "Assign"}
        confirmLoading={assigning}
        okButtonProps={{ style: { background: "#17b4c9", borderColor: "#17b4c9" } }}
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">
            Select the role to assign to <strong>{assignTarget?.name || assignTarget?.email}</strong>:
          </p>
          <div className="flex gap-3">
            {["supervisor", "staff"].map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold capitalize transition-colors ${
                  selectedRole === r
                    ? "border-[#17b4c9] bg-cyan-50 text-[#17b4c9]"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            You can manage specific permissions after assigning.
          </p>
        </div>
      </Modal>

      {/* Permission Restriction Modal */}
      <Modal
        open={Boolean(permTarget)}
        onCancel={() => setPermTarget(null)}
        title={`Permissions — ${permTarget?.name || permTarget?.email || ""}`}
        width={600}
        onOk={handlePermSave}
        okText={permSaving ? "Saving..." : "Save Permissions"}
        confirmLoading={permSaving}
        okButtonProps={{ style: { background: "#17b4c9", borderColor: "#17b4c9" } }}
      >
        {permLoading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading...</div>
        ) : permData ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">
                {selectedPerms === null
                  ? "Using role defaults. Toggle permissions to restrict access."
                  : `${selectedPerms.length} permission${selectedPerms.length !== 1 ? "s" : ""} selected`}
              </p>
              {selectedPerms !== null && (
                <button
                  onClick={() => setSelectedPerms(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Reset to defaults
                </button>
              )}
            </div>

            {Object.entries(permData.all_permissions || {}).map(([mod, perms]) => {
              const current = selectedPerms || [];
              const modKeys = perms.map((p) => p.key);
              const allModSelected = modKeys.every((k) => current.includes(k));
              const someModSelected = modKeys.some((k) => current.includes(k));
              const isExpanded = expandedModules[mod] !== false;

              return (
                <div key={mod} className="rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    onClick={() => setExpandedModules((p) => ({ ...p, [mod]: !isExpanded }))}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={allModSelected}
                        ref={(el) => { if (el) el.indeterminate = someModSelected && !allModSelected; }}
                        onChange={() => {
                          if (selectedPerms === null) setSelectedPerms([]);
                          toggleModule(mod);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-[#17b4c9]"
                      />
                      <span className="font-semibold text-sm text-slate-700 capitalize">
                        {mod.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-slate-400">({perms.length})</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 py-3 grid grid-cols-2 gap-2">
                      {perms.map((p) => {
                        const checked = (selectedPerms || []).includes(p.key);
                        return (
                          <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedPerms === null ? true : checked}
                              onChange={() => {
                                if (selectedPerms === null) {
                                  const allKeys = Object.values(permData.all_permissions || {}).flat().map((pp) => pp.key);
                                  setSelectedPerms(allKeys.filter((k) => k !== p.key));
                                } else {
                                  togglePermKey(p.key);
                                }
                              }}
                              className="w-4 h-4 accent-[#17b4c9]"
                            />
                            <span className="text-xs text-slate-600 group-hover:text-slate-900 capitalize">
                              {p.action}
                            </span>
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
          <p className="text-sm text-slate-400 py-4">No permission data available.</p>
        )}
      </Modal>
    </div>
  );
};

export default TeamManagement;
