import { useEffect, useState } from "react";
import { getMyProfile } from "../../services/adminApi";

function Profile({ setActiveTab }) {
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    number: "",
    address: "",
  });

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
        if (mounted) {
          setUserData({ name: "", email: "", number: "", address: "" });
        }
      }
    };

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <p className="mb-5 text-2xl font-bold text-center ">Your Profile</p>
      <form className="space-y-2 w-auto md:w-[480px]">
        <div>
          <label className="mb-2 text-xl font-bold ">User Name</label>
          <input type="text" value={userData.name} className="w-full px-5 py-3 mt-5 rounded-md outline-none placeholder:text-xl" disabled />
        </div>
        <div>
          <label className="mb-2 text-xl font-bold ">Email</label>
          <input type="email" value={userData.email} className="w-full px-5 py-3 mt-5 rounded-md outline-none placeholder:text-xl" disabled />
        </div>
        <div>
          <label className="mb-2 text-xl font-bold ">Contact No</label>
          <input type="text" value={userData.number} className="w-full px-5 py-3 mt-5 rounded-md outline-none placeholder:text-xl" disabled />
        </div>

        <div className="py-3 text-center">
          <button onClick={() => setActiveTab("/settings/editProfile")} className="bg-[#17b4c9] text-white font-semibold w-full py-2 rounded-lg" type="button">
            Edit
          </button>
        </div>
      </form>
    </div>
  );
}

export default Profile;
