import { useEffect, useState, useCallback, Fragment } from "react";
import { message, Modal } from "antd";
import { Search, UserPlus, Building2, ChevronDown, ChevronRight, Users } from "lucide-react";
import { listOwners, createOwner } from "../../services/adminApi";

const ClientManagement = () => {
  const [owners, setOwners] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [expandedRows, setExpandedRows] = useState(new Set());
  
  const toggleRow = (ownerId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(ownerId)) {
      newExpanded.delete(ownerId);
    } else {
      newExpanded.add(ownerId);
    }
    setExpandedRows(newExpanded);
  };

  // Add member state
  const [showSearch, setShowSearch] = useState(false);
  const [newOwnerForm, setNewOwnerForm] = useState({ fullName: "", email: "", organizationName: "" });
  const [creatingOwner, setCreatingOwner] = useState(false);

  const loadOwners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOwners();
      const d = res?.data || res;
      setOwners(d?.items || []);
      setTotal(d?.total || 0);
    } catch {
      message.error("Failed to load owners.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOwners(); }, [loadOwners]);

  const handleCreateOwner = async () => {
    if (!newOwnerForm.fullName || !newOwnerForm.email || !newOwnerForm.organizationName) {
      message.error("Name, Email, and Organization are required.");
      return;
    }
    setCreatingOwner(true);
    try {
      await createOwner({
        full_name: newOwnerForm.fullName,
        original_email: newOwnerForm.email,
        organization_name: newOwnerForm.organizationName,
      });
      
      message.success(`Owner account created. Login credentials have been emailed to ${newOwnerForm.email}.`);
      setShowSearch(false);
      setNewOwnerForm({ fullName: "", email: "", organizationName: "" });
      await loadOwners();

    } catch (err) {
      message.error(err?.message || "Failed to create owner.");
    } finally {
      setCreatingOwner(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-500 bg-indigo-50 p-1.5 rounded-lg" />
            Client Management
          </h1>
          <p className="text-slate-500 mt-1">Manage owner accounts and organizations.</p>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
        >
          <UserPlus className="w-5 h-5" />
          Create New Owner
        </button>
      </div>

      {/* Create Form inline or Modal */}
      {showSearch && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Add New Owner</h3>
            <button onClick={() => setShowSearch(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <Search className="w-5 h-5 rotate-45" /> {/* Just an X visually if using rotate or we can use regular close */}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Jane Doe"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                value={newOwnerForm.fullName}
                onChange={(e) => setNewOwnerForm({ ...newOwnerForm, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Real Email</label>
              <input
                type="email"
                placeholder="e.g. jane@company.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                value={newOwnerForm.email}
                onChange={(e) => setNewOwnerForm({ ...newOwnerForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Organization Name</label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                value={newOwnerForm.organizationName}
                onChange={(e) => setNewOwnerForm({ ...newOwnerForm, organizationName: e.target.value })}
              />
            </div>
            <button
              onClick={handleCreateOwner}
              disabled={creatingOwner}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 h-[46px]"
            >
              {creatingOwner ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Create</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Owners List Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* List Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-semibold">
              {total} Total Owners
            </div>
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p>Loading owners...</p>
          </div>
        ) : owners.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Owners Found</h3>
            <p className="text-slate-500 max-w-sm mb-6">Start by creating your first owner account to manage organizations.</p>
            <button
              onClick={() => setShowSearch(true)}
              className="text-indigo-600 font-semibold hover:text-indigo-700 hover:underline"
            >
              Create New Owner
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="py-4 px-6 text-xs font-semibold tracking-wider text-slate-500 uppercase">Owner</th>
                  <th className="py-4 px-6 text-xs font-semibold tracking-wider text-slate-500 uppercase">Organization</th>
                  <th className="py-4 px-6 text-xs font-semibold tracking-wider text-slate-500 uppercase">Login Email</th>
                  <th className="py-4 px-6 text-xs font-semibold tracking-wider text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {owners.map((owner) => {
                  const isExpanded = expandedRows.has(owner.id);
                  const hasSubordinates = owner.subordinates && owner.subordinates.length > 0;
                  return (
                  <Fragment key={owner.id}>
                    <tr onClick={() => hasSubordinates && toggleRow(owner.id)} className={`transition-colors ${hasSubordinates ? "cursor-pointer hover:bg-slate-50" : "hover:bg-slate-50/50"}`}>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {hasSubordinates ? (
                            <button className="text-slate-400 hover:text-slate-600 transition-colors">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            {owner.full_name?.charAt(0).toUpperCase() || "O"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{owner.full_name}</p>
                            <p className="text-sm text-slate-500">{owner.original_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-slate-700 font-medium">{owner.organization_name || "-"}</p>
                        {hasSubordinates && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md w-fit">
                            <Users className="w-3.5 h-3.5" />
                            {owner.subordinates.length} Team Member{owner.subordinates.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-sm border border-slate-200">
                          {owner.login_email}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          owner.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {owner.status || "Active"}
                        </span>
                      </td>
                    </tr>
                    
                    {isExpanded && hasSubordinates && (
                      <tr>
                        <td colSpan="4" className="p-0 border-b border-slate-100 bg-slate-50/50">
                          <div className="px-16 py-4">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                  <tr>
                                    <th className="py-3 px-5 text-xs font-semibold tracking-wider text-slate-500 uppercase">Team Member</th>
                                    <th className="py-3 px-5 text-xs font-semibold tracking-wider text-slate-500 uppercase">Role</th>
                                    <th className="py-3 px-5 text-xs font-semibold tracking-wider text-slate-500 uppercase">Login Email</th>
                                    <th className="py-3 px-5 text-xs font-semibold tracking-wider text-slate-500 uppercase">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {owner.subordinates.map((sub, idx) => (
                                    <tr key={sub.id || idx} className="hover:bg-slate-50/30 transition-colors">
                                      <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200">
                                            {sub.full_name?.charAt(0).toUpperCase() || "T"}
                                          </div>
                                          <div>
                                            <p className="font-semibold text-slate-800 text-sm">{sub.full_name}</p>
                                            <p className="text-xs text-slate-500">{sub.original_email}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-3 px-5">
                                        <span className="capitalize text-sm font-medium text-slate-700">{sub.role}</span>
                                      </td>
                                      <td className="py-3 px-5">
                                        <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 font-mono text-xs border border-slate-200">
                                          {sub.login_email}
                                        </div>
                                      </td>
                                      <td className="py-3 px-5">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                          sub.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                          {sub.status || "Active"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientManagement;
