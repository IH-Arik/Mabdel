import { useEffect, useMemo, useState } from "react";
import { Search, Eye, Ban, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { listUsersSafe, updateUserStatus } from "../../services/adminApi";

const SafeAvatar = ({ src, name, className }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const initials = (name || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");

    return (
      <div
        className={`${className} flex items-center justify-center bg-slate-200 text-slate-700 font-semibold`}
      >
        {initials || "?"}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || "avatar"}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};

const toAbsoluteAvatarUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  if (/^(https?:)?\/\//i.test(url) || /^data:|^blob:/i.test(url)) return url;
  if (url.startsWith("/")) {
    const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "");
    return base ? `${base}${url}` : url;
  }
  return url;
};

const getOriginalAvatarUrl = (user) =>
  user?.avatarUrl ||
  user?.avatarURL ||
  user?.avatar ||
  user?.profileImage ||
  user?.profile_image ||
  user?.profilePhoto ||
  user?.photoUrl ||
  user?.photo ||
  user?.imageUrl ||
  user?.image ||
  user?.profile?.avatar ||
  user?.profile?.avatarUrl ||
  "";

const normalizeUser = (user, index, startIndex) => ({
  id: user?.id || user?._id || user?.userId || startIndex + index + 1,
  name: user?.name || user?.fullName || user?.username || "Unknown",
  email: user?.email || "N/A",
  joinedDate: user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString()
    : user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString()
      : user?.joinedDate || "N/A",
  avatar: toAbsoluteAvatarUrl(getOriginalAvatarUrl(user)),
});

const extractItemsAndTotal = (payload) => {
  const data = payload?.data ?? payload;

  const visited = new Set();
  const findFirstArray = (value) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return null;
    if (visited.has(value)) return null;
    visited.add(value);

    const priorityKeys = ["users", "items", "rows", "results", "docs", "data", "list"];
    for (const key of priorityKeys) {
      if (Array.isArray(value[key])) return value[key];
    }

    for (const key of Object.keys(value)) {
      const found = findFirstArray(value[key]);
      if (found) return found;
    }

    return null;
  };

  const items = findFirstArray(data) || [];
  const total =
    Number(data?.total) ||
    Number(data?.totalCount) ||
    Number(data?.count) ||
    Number(data?.meta?.total) ||
    Number(data?.pagination?.total) ||
    Number(data?.pageInfo?.total) ||
    Number(data?.meta?.count) ||
    items.length;

  return { items, total };
};

const UserList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToBlock, setUserToBlock] = useState(null);
  const [blocking, setBlocking] = useState(false);

  const usersPerPage = 8;

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      try {
        setLoading(true);
        const payload = await listUsersSafe({
          page: currentPage,
          limit: usersPerPage,
          search: searchTerm || undefined,
        });
        if (!mounted) return;

        const { items, total } = extractItemsAndTotal(payload);

        setUsers(Array.isArray(items) ? items : []);
        setTotalUsers(total);
      } catch {
        if (mounted) {
          setUsers([]);
          setTotalUsers(0);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadUsers();
    return () => {
      mounted = false;
    };
  }, [currentPage, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / usersPerPage));
  const startIndex = (currentPage - 1) * usersPerPage;

  const currentUsers = useMemo(
    () => users.map((user, index) => normalizeUser(user, index, startIndex)),
    [users, startIndex]
  );

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleBanUser = (user) => {
    setUserToBlock(user);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmBlock = async () => {
    if (!userToBlock?.id) return;
    try {
      setBlocking(true);
      await updateUserStatus({ id: userToBlock.id, status: "blocked" });
      setUsers((prev) => prev.filter((entry) => (entry.id || entry._id) !== userToBlock.id));
    } finally {
      setBlocking(false);
      setIsConfirmModalOpen(false);
      setUserToBlock(null);
    }
  };

  const handleCancelBlock = () => {
    setIsConfirmModalOpen(false);
    setUserToBlock(null);
  };

  const renderPaginationNumbers = () => {
    const pages = [];
    pages.push(1);

    if (currentPage > 3) pages.push("...");

    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i += 1) {
      if (!pages.includes(i)) pages.push(i);
    }

    if (currentPage < totalPages - 2) pages.push("...");

    if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages);

    return pages;
  };

  return (
    <div className="p-4 bg-gray-50">
      <div className="mx-auto overflow-hidden bg-white border rounded-2xl border-slate-100 shadow-sm">
        <div className="sticky top-0 z-10 px-6 py-4 bg-[#17b4c9] rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-white">User List</h1>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
                <input
                  type="text"
                  placeholder="Search User"
                  value={searchTerm}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setSearchTerm(e.target.value);
                  }}
                  className="w-64 py-2 pl-10 pr-4 text-sm bg-white border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>
              <Link to="/block-list">
                <button className="px-4 py-2 text-sm font-medium bg-white rounded-lg text-cyan-600 hover:bg-gray-50">Blocked Users</button>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-[#17b4c9] uppercase">S.ID</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-[#17b4c9] uppercase">Full Name</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-[#17b4c9] uppercase">Email</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-[#17b4c9] uppercase">Joined Date</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-[#17b4c9] uppercase">Action</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {currentUsers.map((user, index) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{String(startIndex + index + 1).padStart(2, "0")}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <SafeAvatar src={user.avatar} name={user.name} className="w-8 h-8 rounded-full" />
                        <span className="ml-3 text-sm font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{user.joinedDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleBanUser(user)} className="p-1 text-red-500 rounded-full hover:bg-red-50">
                          <Ban className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleViewUser(user)} className="flex items-center gap-1 p-1 text-[#17b4c9] rounded-full hover:bg-blue-50">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && currentUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No users found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <span className="text-sm text-gray-700">SHOWING {totalUsers === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + usersPerPage, totalUsers)} OF {totalUsers}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-2 text-gray-400 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" />
              </button>

              {renderPaginationNumbers().map((page, index) => (
                <button
                  key={`${page}-${index}`}
                  onClick={() => typeof page === "number" && setCurrentPage(page)}
                  disabled={page === "..."}
                  className={`min-w-[32px] rounded-lg px-3 py-1 text-sm ${
                    page === currentPage
                      ? "bg-[#17b4c9] text-white"
                      : page === "..."
                      ? "text-gray-400 cursor-default"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-2 text-gray-400 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={handleCloseModal}>
          <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="flex-1 text-2xl font-semibold text-center text-[#17b4c9]">User Details</h2>
              <button onClick={handleCloseModal} className="ml-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6">
              <div className="flex items-center mb-6">
                <SafeAvatar
                  src={selectedUser.avatar}
                  name={selectedUser.name}
                  className="w-16 h-16 mr-4 rounded-full"
                />
                <h3 className="text-xl font-medium text-[#17b4c9]">{selectedUser.name}</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between"><span className="font-medium text-gray-700">Name</span><span className="text-gray-900">{selectedUser.name}</span></div>
                <div className="flex justify-between"><span className="font-medium text-gray-700">Email</span><span className="text-gray-900">{selectedUser.email}</span></div>
                <div className="flex justify-between"><span className="font-medium text-gray-700">Joining Date</span><span className="text-gray-900">{selectedUser.joinedDate}</span></div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t">
              <button onClick={handleCloseModal} className="flex-1 px-4 py-2 text-sm font-medium bg-white border rounded-lg">Cancel</button>
              <button onClick={() => handleBanUser(selectedUser)} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg">Block</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmModalOpen && userToBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={handleCancelBlock}>
          <div className="w-full max-w-sm p-6 mx-4 text-center bg-white rounded-lg shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="mb-6 text-xl font-semibold text-gray-900">Do you want to block this user?</h2>
            <div className="flex gap-3">
              <button onClick={handleCancelBlock} className="flex-1 px-4 py-2 text-sm bg-white border rounded-lg">Cancel</button>
              <button onClick={handleConfirmBlock} disabled={blocking} className="flex-1 px-4 py-2 text-sm text-white bg-red-600 rounded-lg disabled:opacity-50">{blocking ? "Blocking..." : "Yes, Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
