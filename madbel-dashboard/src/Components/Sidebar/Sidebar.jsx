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
  MessageSquare,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";
import { BsBadgeAd } from "react-icons/bs";
import { SiActivitypub } from "react-icons/si";
import { clearAdminSession, getAdminRole } from "../../utils/auth";

const ADMIN_MENU = [
  { icon: <MdDashboard className="w-5 h-5" />, label: "Dashboard", Link: "/dashboard" },
  { icon: <Users className="w-5 h-5" />, label: "User List", Link: "/user-list" },
  { icon: <ChartColumnIncreasing className="w-5 h-5" />, label: "Earnings", Link: "/earnings" },
  { icon: <Crown className="w-5 h-5" />, label: "Subscriptions", Link: "/subscriptions" },
  { icon: <UserCog className="w-5 h-5" />, label: "Create Admin", Link: "/create-admin" },
  { icon: <LayoutDashboard className="w-5 h-5" />, label: "Team Management", Link: "/owner/team" },
  { icon: <Brain className="w-5 h-5" />, label: "AI Analysis", Link: "/analysis-page" },
  { icon: <MessageSquare className="w-5 h-5" />, label: "Support Chat", Link: "/messages" },
  { icon: <TriangleAlert className="w-5 h-5" />, label: "Reports", Link: "/reports" },
  { icon: <Settings className="w-5 h-5" />, label: "Settings", Link: "/settings" },
];

const OWNER_MENU = [
  { icon: <LayoutDashboard className="w-5 h-5" />, label: "Overview", Link: "/owner" },
  { icon: <Users className="w-5 h-5" />, label: "Team Management", Link: "/owner/team" },
  { icon: <TrendingUp className="w-5 h-5" />, label: "Team Analysis", Link: "/owner/analysis" },
  { icon: <Settings className="w-5 h-5" />, label: "Settings", Link: "/settings" },
];

const MANAGER_MENU = [
  { icon: <LayoutDashboard className="w-5 h-5" />, label: "Overview", Link: "/owner" },
  { icon: <Users className="w-5 h-5" />, label: "My Team", Link: "/owner/team" },
  { icon: <TrendingUp className="w-5 h-5" />, label: "Team Analysis", Link: "/owner/analysis" },
  { icon: <Settings className="w-5 h-5" />, label: "Settings", Link: "/settings" },
];

const STAFF_MENU = [
  { icon: <LayoutDashboard className="w-5 h-5" />, label: "Overview", Link: "/owner" },
  { icon: <Settings className="w-5 h-5" />, label: "Settings", Link: "/settings" },
];

const ASSISTANT_MENU = [
  { icon: <LayoutDashboard className="w-5 h-5" />, label: "Overview", Link: "/owner" },
  { icon: <Settings className="w-5 h-5" />, label: "Settings", Link: "/settings" },
];

const ROLE_MENU = {
  super_admin: ADMIN_MENU,
  admin: ADMIN_MENU,
  owner: OWNER_MENU,
  manager: MANAGER_MENU,
  staff: STAFF_MENU,
  assistant: ASSISTANT_MENU,
};

const Sidebar = ({ closeDrawer }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const role = getAdminRole();

  const menuItems = ROLE_MENU[role] || ADMIN_MENU;

  const handleLogout = () => {
    clearAdminSession();
    if (closeDrawer) closeDrawer();
    window.location.replace("/sign-in");
  };

  return (
    <div className="flex flex-col h-full p-4 bg-white w-72">
      <div className="mx-auto">
        <img src={brandlogo} alt="logo" className="w-40 h-40" />
      </div>

      {role && !["super_admin", "admin"].includes(role) && (
        <div className="mx-3 mb-2 rounded-lg bg-cyan-50 px-3 py-1.5 text-center">
          <span className="text-xs font-semibold text-[#17b4c9] capitalize">{role} Dashboard</span>
        </div>
      )}

      <div className="flex-1 pr-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive =
            item.Link === "/owner"
              ? location.pathname === "/owner"
              : location.pathname.startsWith(item.Link);

          return (
            <div key={item.label}>
              <div
                className={`flex justify-between items-center px-5 py-2 my-2 rounded-lg cursor-pointer transition-all hover:bg-[#17b4c9] hover:text-white hover:font-semibold ${
                  isActive ? "bg-[#17b4c9] text-white font-semibold" : "text-black"
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
                    <BiChevronDown className={`${isActive ? "rotate-180" : ""}`} />
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
