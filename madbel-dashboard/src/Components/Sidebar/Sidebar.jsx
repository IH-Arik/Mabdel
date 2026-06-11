import { FiLogOut } from "react-icons/fi";
import { BiChevronDown } from "react-icons/bi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MdDashboard } from "react-icons/md";
import brandlogo from "../../assets/image/stone-logo.png";
import {
  AlignCenterVertical,
  CalendarCog,
  ChartColumnIncreasing,
  Crown,
  Settings,
  TriangleAlert,
  UserCog,
  Users,
  Brain,
  MessageSquare
} from "lucide-react";
import { BsBadgeAd } from "react-icons/bs";
import { SiActivitypub } from "react-icons/si";
import { clearAdminSession } from "../../utils/auth";

const Sidebar = ({ closeDrawer }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: <MdDashboard className="w-5 h-5" />,
      label: "Dashboard",
      Link: "/",
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: "User List",
      Link: "/user-list",
    },
    {
      icon: <ChartColumnIncreasing className="w-5 h-5" />,
      label: "Earnings",
      Link: "/earnings",
    },
    {
      icon: <Crown className="w-5 h-5" />,
      label: "Subscriptions",
      Link: "/subscriptions",
    },
    {
      icon: <UserCog className="w-5 h-5" />,
      label: "Create Admin",
      Link: "/create-admin",
    },
    {
      icon: <Brain className="w-5 h-5" />,
      label: "AI Analysis",
      Link: "/analysis-page",
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      label: "Support Chat",
      Link: "/messages",
    },
    {
      icon: <TriangleAlert className="w-5 h-5" />,
      label: "Reports",
      Link: "/reports",
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: "Settings",
      Link: "/settings",
    },
  ];

  const handleLogout = () => {
    clearAdminSession();
    if (closeDrawer) closeDrawer();
    navigate("/sign-in", { replace: true });
  };

  return (
    <div className="flex flex-col h-full p-4 bg-white w-72">
      <div className="mx-auto">
        <img src={brandlogo} alt="logo" className="w-40 h-40" />
      </div>

      <div className="flex-1 pr-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.Link;

          return (
            <div key={item.label}>
              <div
                className={`flex justify-between items-center px-5 py-2 my-2 rounded-lg cursor-pointer transition-all hover:bg-[#17b4c9] hover:text-white hover:font-semibold ${
                  isActive
                    ? "bg-[#17b4c9] text-white font-semibold"
                    : "text-black"
                }`}
              >
                <Link
                  to={item.Link}
                  onClick={closeDrawer}
                  className="flex items-center w-full gap-3"
                >
                  {item.icon}
                  <p>{item.label}</p>
                  {item.isDropdown && (
                    <BiChevronDown
                      className={`${isActive ? "rotate-180" : ""}`}
                    />
                  )}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 pt-4 mt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center w-full gap-3 px-5 py-3 text-sm font-semibold text-red-600 transition-colors rounded-xl bg-red-50 hover:bg-red-100"
        >
          <FiLogOut className="text-lg" />
          <p>Log out</p>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
