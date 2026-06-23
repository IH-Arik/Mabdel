import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "../Layout/Main/Main";
import SignIn from "../Pages/Auth/SignIn/SignIn";
import AboutUs from "../Pages/Settings/AboutUS/AboutUs";
import PrivacyPolicy from "../Pages/Settings/PrivacyPolicy/PrivacyPolicy";
import TermsCondition from "../Pages/Settings/TermsCondition/TermsCondition";
import PrivateRoute from "./PrivateRoute";
import RoleRedirect from "./RoleRedirect";
import Dashboard from "../Pages/Dashboard/Dashboard";
import ProfilePage from "../Pages/AdminProfile/ProfilePage";
import Notifications from "../Pages/Notifications/Notifications";
import AnalysisPage from "../Pages/Analysis/AnalysisPage";
import Subscriptions from "../Pages/Subscriptions/Subscriptions";
import Analysis from "../Pages/Analysis/Analysis";
import RestaurantRequest from "../Pages/RestaurantRequest/RestaurantRequest";
import UserList from "../Pages/UserList/UserList";
import Earnings from "../Pages/Earnings/Earnings";
import Categories from "../Pages/Categories/Categories";
import Reports from "../Pages/Reports/Reports";
import Settings from "../Pages/Settings/Settings";
import AllMessages from "../Pages/Messages/AllMessages";
import BlockedList from "../Pages/BlockedList/BlockedList";
import ChangePass from "../Pages/AdminProfile/ChangePass";
import AdsSetup from "../Pages/AdsSetup/AdsSetup";
import ActivityEvents from "../Pages/Activity & Events/ActivityEvents";
import EventCreators from "../Pages/EventCreator/EventCreators";
import EventCreatorDetails from "../Pages/EventCreator/EventCreatorDetails";
import MakeAdmin from "../Pages/MakeAdmin/MakeAdmin";
import OwnerDashboard from "../Pages/Owner/OwnerDashboard";
import TeamManagement from "../Pages/Owner/TeamManagement";

export const router = createBrowserRouter([
  {
    path: "/sign-in",
    element: <SignIn />,
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { path: "/", element: <RoleRedirect /> },
          { path: "/dashboard", element: <Dashboard /> },
          // Owner routes
          { path: "/owner", element: <OwnerDashboard /> },
          { path: "/owner/team", element: <TeamManagement /> },
          // Admin / Super Admin routes
          { path: "/user-list", element: <UserList /> },
          { path: "/block-list", element: <BlockedList /> },
          { path: "/earnings", element: <Earnings /> },
          { path: "/restaurant-request", element: <RestaurantRequest /> },
          { path: "/analysis-page", element: <AnalysisPage /> },
          { path: "/analysis/:id", element: <Analysis /> },
          { path: "/subscriptions", element: <Subscriptions /> },
          { path: "/create-admin", element: <MakeAdmin /> },
          { path: "/categories", element: <Categories /> },
          { path: "/reports", element: <Reports /> },
          { path: "/ads-setup", element: <AdsSetup /> },
          { path: "/activity&events", element: <ActivityEvents /> },
          { path: "/event-creator", element: <EventCreators /> },
          { path: "/event-creator/:id", element: <EventCreatorDetails /> },
          { path: "/notifications", element: <Notifications /> },
          { path: "/settings", element: <Settings /> },
          { path: "/settings/about-us", element: <AboutUs /> },
          { path: "/settings/privacy-policy", element: <PrivacyPolicy /> },
          { path: "/settings/terms-condition", element: <TermsCondition /> },
          { path: "/settings/profile", element: <ProfilePage /> },
          { path: "/settings/change-password", element: <ChangePass /> },
          { path: "/messages", element: <AllMessages /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
