import React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { CiUser } from "react-icons/ci";
import { FaEdit } from "react-icons/fa";
import { MdPrivacyTip } from "react-icons/md";
import { RiTerminalWindowLine } from "react-icons/ri";

const Settings = () => {
  const subItems = [
    {
      icon: <CiUser className="w-5 h-5" />,
      label: "Profile",
      link: "/settings/profile",
    },
    {
      icon: <CiUser className="w-5 h-5" />,
      label: "Change Password",
      link: "/settings/change-password",
    },
    {
      icon: <FaEdit className="w-5 h-5" />,
      label: "About Us",
      link: "/settings/about-us",
    },
    {
      icon: <MdPrivacyTip className="w-5 h-5" />,
      label: "Privacy Policy",
      link: "/settings/privacy-policy",
    },
    {
      icon: <RiTerminalWindowLine className="w-5 h-5" />,
      label: "Terms & Conditions",
      link: "/settings/terms-condition",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div
        style={{ boxShadow: "0px 1px 6px 0px rgba(0, 0, 0, 0.24)" }}
        className="mx-auto mt-20 rounded-md "
      >
        {/* Header */}
        <div className="px-6 py-8  bg-[#17b4c9] rounded-tl-md rounded-tr-md ">
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
        </div>

        {/* ==========================Menu Items ==========================*/}
        <div className="mx-4 mt-4">
          {subItems.map((item, index) => (
            <div key={index}>
              <Link to={item.link}>
                <div className="flex items-center justify-between w-full px-2 py-4 transition-colors hover:bg-gray-50">
                  <p className="text-xl font-medium">
                    {item.label}
                  </p>
                  <ChevronRight className="text-black size-6" />
                </div>
              </Link>
              {index < subItems.length - 1 && (
                <div className="border-2 border-b border-[#9D9FA2]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
