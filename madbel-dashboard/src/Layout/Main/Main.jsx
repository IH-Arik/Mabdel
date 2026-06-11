import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../../Components/Sidebar/Sidebar";
import { Drawer } from "antd";
import Header from "../../Components/Sidebar/Header";

const MainLayout = () => {
  const onClose = () => setOpen(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const contentRef = useRef(null);

  const showDrawer = () => setOpen(true);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="fixed top-0 left-0 z-10 hidden h-full shadow-md w-72 lg:block">
        <Sidebar />
      </div>

      {/* Drawer for Mobile */}
      <Drawer placement="left" onClose={onClose} open={open} width={250}>
        <Sidebar closeDrawer={onClose} />
      </Drawer>

      {/* Main Content Wrapper */}
      <div className="flex flex-col flex-1 h-full lg:ml-72">
        {/* Styled Header */}
        <div className="fixed inset-x-0 top-0 z-20 bg-white shadow-sm px-4 py-3 sm:px-6 lg:left-72 lg:right-0 lg:w-[calc(100%-18rem)]">
          <Header showDrawer={showDrawer} />
        </div>

        {/* Scrollable Outlet Section */}
        <div
          ref={contentRef}
          className="flex-1 p-4 mt-24 overflow-y-auto bg-gray-50 sm:mt-28"
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
