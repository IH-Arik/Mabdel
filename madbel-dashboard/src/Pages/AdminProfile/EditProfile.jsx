import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "../../services/adminApi";

function EditProfile() {
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    number: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const payload = await getMyProfile();
        if (!mounted) return;
        const data = payload?.data || payload;
        setUserData({
          name: data?.fullName || data?.name || "",
          email: data?.email || "",
          number: data?.contactNo || data?.phone || data?.number || "",
          address: data?.address || "",
        });
      } catch {
        if (mounted) setUserData({ name: "", email: "", number: "", address: "" });
      }
    };

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateMyProfile({
        fullName: userData.name,
        email: userData.email,
        contactNo: userData.number,
        phone: userData.number,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-5 text-2xl font-bold text-center text-black">Edit Your Profile</p>
      <form className="space-y-4  w-auto md:w-[480px]" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 text-xl font-bold text-balck">User Name</label>
          <input
            type="text"
            value={userData.name}
            onChange={(e) => setUserData((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full px-5 py-3 text-[#5C5C5C] bg-white border-2 border-white rounded-md outline-none placeholder:text-xl"
            placeholder="Enter full name"
            required
          />
        </div>

        <div>
          <label className="mb-2 text-xl font-bold text-black">Email</label>
          <input
            type="email"
            value={userData.email}
            onChange={(e) => setUserData((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full px-5 py-3 mt-5 text-[#5C5C5C] bg-white border-2 border-white rounded-md placeholder:text-xl"
            placeholder="Enter Email"
            required
          />
        </div>

        <div>
          <label className="mb-2 text-xl font-bold text-black">Contact No</label>
          <input
            type="text"
            value={userData.number}
            onChange={(e) => setUserData((prev) => ({ ...prev, number: e.target.value }))}
            className="w-full px-5 py-3 mt-5 text-[#5C5C5C] bg-white  border-2 border-white  rounded-md placeholder:text-xl"
            placeholder="Contact No"
            required
          />
        </div>

        <div className="py-3 text-center">
          <button type="submit" disabled={saving} className="bg-[#17b4c9] text-white font-semibold w-full py-2 rounded-lg disabled:opacity-50">
            {saving ? "Saving..." : "Save Change"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditProfile;
