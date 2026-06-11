import { useMemo, useState } from "react";
import { Eye, Ban, X } from "lucide-react";
import { updateUserStatus } from "../../services/adminApi";

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

const normalizeUser = (user, index) => ({
  id: user?.id || user?._id || user?.userId || index + 1,
  name: user?.name || user?.fullName || user?.username || "Unknown",
  email: user?.email || "N/A",
  joinedDate: user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString()
    : user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString()
      : user?.joinedDate || "N/A",
  avatar: getOriginalAvatarUrl(user),
  raw: user,
});

const RecentUsersTable = ({ users = [] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToBlock, setUserToBlock] = useState(null);
  const [blocking, setBlocking] = useState(false);

  const displayedUsers = useMemo(
    () => users.slice(0, 5).map((user, index) => normalizeUser(user, index)),
    [users]
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

  return (
    <div className="w-full">
      <div className="flex flex-col h-full p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
        <div className="mb-6 space-y-1">
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">Accounts</p>
          <h1 className="text-2xl font-semibold text-slate-900">Recent Users</h1>
        </div>

        <div className="overflow-x-auto border rounded-xl border-slate-100">
          <div>
            <table className="w-full min-w-[680px]">
              <thead className="bg-[#17b4c9]">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-white uppercase">S.ID</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-white uppercase">Full Name</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-white uppercase">Email</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-white uppercase">Joined Date</th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-white uppercase">Action</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-slate-200">
                {displayedUsers.map((user, index) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{String(index + 1).padStart(2, "0")}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img src={user.avatar || "/placeholder.svg"} className="w-8 h-8 rounded-full" />
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
                {displayedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={handleCloseModal}>
          <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="flex-1 text-2xl font-semibold text-center text-[#17b4c9]">User Details</h2>
              <button onClick={handleCloseModal} className="ml-4 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center mb-6">
                <img src={selectedUser.avatar || "/placeholder.svg"} className="w-16 h-16 mr-4 rounded-full" />
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
            <h2 className="mb-6 text-xl font-semibold text-gray-900">Are you sure you want to block this user?</h2>
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

export default RecentUsersTable;
