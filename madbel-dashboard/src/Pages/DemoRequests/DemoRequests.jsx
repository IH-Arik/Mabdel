import { useState } from "react";
import MessagesTab from "./MessagesTab";
import MeetingRequestsTab from "./MeetingRequestsTab";
import AvailabilityTab from "./AvailabilityTab";

const TABS = [
  { key: "messages", label: "Messages" },
  { key: "meetings", label: "Meeting Requests" },
  { key: "availability", label: "My Availability" },
];

const DemoRequests = () => {
  const [activeTab, setActiveTab] = useState("messages");
  const [summary, setSummary] = useState({});

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Demo Requests</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {summary.total ?? 0} total &middot; {summary.new ?? summary.pending ?? 0} needs attention
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-[#17b4c9] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "messages" && <MessagesTab onSummary={setSummary} />}
      {activeTab === "meetings" && <MeetingRequestsTab onSummary={setSummary} />}
      {activeTab === "availability" && <AvailabilityTab />}
    </div>
  );
};

export default DemoRequests;
