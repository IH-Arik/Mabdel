import { useEffect, useState, useCallback } from "react";
import { message, Modal, Switch } from "antd";
import { Search, UserPlus, Trash2, Settings, X, ChevronDown, ChevronUp, ShieldOff, ShieldCheck } from "lucide-react";
import {
  listTeamMembers,
  searchUsers,
  assignTeamRole,
  revokeTeamRole,
  getUserPermissions,
  setUserPermissions,
  banTeamMember,
  unbanTeamMember,
} from "../../services/ownerApi";

const ROLE_LABELS = {
  manager:   { label: "Manager",   color: "bg-indigo-100 text-indigo-700" },
  staff:     { label: "Staff",     color: "bg-emerald-100 text-emerald-700" },
  assistant: { label: "Assistant", color: "bg-amber-100 text-amber-700" },
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
  const [selectedRole, setSelectedRole] = useState("manager");
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
    setSelectedRole("manager");
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
              {searchResults.map((u) => {
                const teamMember = members.find((m) => m.user_id === u.user_id);
                const alreadyInTeam = !!teamMember;
                return (
                  <div
                    key={u.user_id}
                    className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                      alreadyInTeam
                        ? "border-slate-200 bg-slate-50 opacity-70"
                        : "border-slate-100 hover:border-[#17b4c9] hover:bg-cyan-50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{u.email}</p>
                      {u.name && <p className="text-xs text-slate-500">{u.name}</p>}
                      <p className="text-xs text-slate-400">Current role: {u.current_role}</p>
                    </div>
                    {alreadyInTeam ? (
                      <span className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 capitalize">
                        Already {teamMember.role_slug}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAssignOpen(u)}
                        className="rounded-lg bg-[#17b4c9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#149cb0]"
                      >
                        Assign Role
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
            {["manager", "staff", "assistant"].map((r) => (
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
