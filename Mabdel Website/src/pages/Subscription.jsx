import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Mail,
  Sparkles,
  X,
} from "lucide-react";
import { publicApi } from "../api/services";
import { formatCstDate, formatCstTime } from "../utils/dateUtils";
import { useLanguage } from "../context/LanguageContext";

const BASE_PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$299",
    subtitleKey: "sub_starter_subtitle",
    descriptionKey: "sub_starter_desc",
    featureKeys: [
      "sub_feat_1_user",
      "sub_feat_ai_receptionist",
      "sub_feat_crm",
      "sub_feat_calendar",
      "sub_feat_missed_call",
      "sub_feat_basic_auto",
      "sub_feat_mobile_app",
    ],
    usage: ["300 call minutes", "500 SMS", "200 emails"],
    addOns: [
      "$25 -> 250 SMS or 100 call minutes",
      "$50 -> 600 SMS or 250 call minutes",
      "$100 -> 1,500 SMS or 600 call minutes",
    ],
    emailAddOns: [
      "$10 -> 10,000 emails",
      "$25 -> 30,000 emails",
      "$50 -> 80,000 emails",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$699",
    subtitleKey: "sub_growth_subtitle",
    descriptionKey: "sub_growth_desc",
    isPopular: true,
    icon: Sparkles,
    featureKeys: [
      "sub_feat_everything_starter",
      "sub_feat_unlimited_users",
      "sub_feat_fb_ig",
      "sub_feat_social_replies",
      "sub_feat_ai_reads_social",
      "sub_feat_bulk_sms",
      "sub_feat_bulk_email",
      "sub_feat_ai_social_post",
      "sub_feat_ai_marketing",
      "sub_feat_team_inbox",
      "sub_feat_adv_auto",
    ],
    usage: ["1,500 call minutes", "5,000 SMS", "10,000 emails"],
    addOns: [
      "$25 -> 300 SMS or 120 call minutes",
      "$50 -> 700 SMS or 300 call minutes",
      "$100 -> 2,000 SMS or 800 call minutes",
    ],
    emailAddOns: [
      "$10 -> 10,000 emails",
      "$25 -> 30,000 emails",
      "$50 -> 80,000 emails",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$999",
    subtitleKey: "sub_pro_subtitle",
    descriptionKey: "sub_pro_desc",
    featureKeys: [
      "sub_feat_everything_growth",
      "sub_feat_invoicing",
      "sub_feat_doc_gen",
      "sub_feat_adv_auto",
      "sub_feat_priority_support",
    ],
    usage: ["3,000 call minutes", "15,000 SMS", "50,000 emails"],
    addOns: [
      "$25 -> 350 SMS or 150 call minutes",
      "$50 -> 900 SMS or 400 call minutes",
      "$100 -> 2,500 SMS or 1,000 call minutes",
    ],
    emailAddOns: [
      "$10 -> 10,000 emails",
      "$25 -> 30,000 emails",
      "$50 -> 80,000 emails",
    ],
  },
];

function formatSlotLabel(startIso) {
  const start = new Date(startIso);
  return `${formatCstDate(start, { weekday: "short", year: undefined })} · ${formatCstTime(start)}`;
}

export default function Subscription() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [appointmentSlots, setAppointmentSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [appointmentSubmitting, setAppointmentSubmitting] = useState(false);
  const [appointmentSubmitted, setAppointmentSubmitted] = useState(false);
  const [appointmentError, setAppointmentError] = useState("");
  const [activeSections, setActiveSections] = useState({
    starter: "included",
    growth: "included",
    pro: "included",
  });
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    businessName: "",
    businessAddress: "",
    ownerDob: "",
    phoneNo: "",
    businessType: "",
  });
  const [demoForm, setDemoForm] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    message: "",
  });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoError, setDemoError] = useState("");

  const plans = useMemo(() => {
    return BASE_PLANS.map((plan) => ({
      ...plan,
      subtitle: t(plan.subtitleKey),
      description: t(plan.descriptionKey),
      features: plan.featureKeys.map((key) => t(key)),
    }));
  }, [t]);

  const featuredPlan = useMemo(
    () => plans.find((plan) => plan.isPopular),
    [plans],
  );

  useEffect(() => {
    if (!isDemoOpen) return;
    let ignore = false;
    setSlotsLoading(true);
    publicApi
      .getAvailableMeetingTimes()
      .then((res) => {
        if (ignore) return;
        const slots = res.data?.data || [];
        setAppointmentSlots(slots);
        setSelectedSlot((current) => current || slots[0] || null);
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (!ignore) setSlotsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [isDemoOpen]);

  const getSectionItems = (plan, section) => {
    if (section === "usage") return plan.usage;
    if (section === "addons") return plan.addOns;
    if (section === "email") return plan.emailAddOns;
    return plan.features;
  };

  const handleOpenModal = (planAction) => {
    setSelectedPlan(planAction);
    setIsSubmitted(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedPlan(null);
      setIsSubmitted(false);
      setFormData({
        fullName: "",
        email: "",
        businessName: "",
        businessAddress: "",
        ownerDob: "",
        phoneNo: "",
        businessType: "",
      });
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:8000/api/v1/auth/subscription-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.fullName,
          original_email: formData.email,
          business_name: formData.businessName,
          business_address: formData.businessAddress,
          owner_dob: formData.ownerDob,
          phone_no: formData.phoneNo,
          business_type: formData.businessType,
          plan: selectedPlan,
        }),
      });

      if (!response.ok) {
        throw new Error("Signup failed");
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error(error);
      window.alert(t("sub_err_request_failed"));
    }
  };

  const handleDemoSubmit = async () => {
    if (!demoForm.firstName || !demoForm.lastName || !demoForm.email || !demoForm.message) {
      setDemoError(t("sub_err_demo_fill"));
      return;
    }
    setDemoSubmitting(true);
    setDemoError("");
    try {
      await publicApi.submitDemoRequest({
        first_name: demoForm.firstName,
        last_name: demoForm.lastName,
        phone: demoForm.phoneNumber,
        email: demoForm.email,
        message: demoForm.message,
      });
      setDemoSubmitted(true);
      setDemoForm({ firstName: "", lastName: "", phoneNumber: "", email: "", message: "" });
    } catch (error) {
      console.error(error);
      setDemoError(
        error.response?.data?.message || t("sub_err_demo_failed")
      );
    } finally {
      setDemoSubmitting(false);
    }
  };

  const handleAppointmentConfirm = async () => {
    if (!demoForm.firstName || !demoForm.lastName || !demoForm.email) {
      setAppointmentError(t("sub_err_fill_left"));
      return;
    }
    if (!selectedSlot) {
      setAppointmentError(t("sub_err_select_slot"));
      return;
    }
    setAppointmentSubmitting(true);
    setAppointmentError("");
    try {
      await publicApi.bookMeetingSlot({
        first_name: demoForm.firstName,
        last_name: demoForm.lastName,
        email: demoForm.email,
        phone: demoForm.phoneNumber,
        date: selectedSlot.date,
        time: selectedSlot.time,
        notes: demoForm.message,
      });
      setAppointmentSubmitted(true);
    } catch (error) {
      console.error(error);
      if (error.response?.status === 409) {
        setAppointmentError(t("sub_err_slot_booked"));
        publicApi
          .getAvailableMeetingTimes()
          .then((res) => setAppointmentSlots(res.data?.data || []))
          .catch(() => {});
        setSelectedSlot(null);
      } else {
        setAppointmentError(
          error.response?.data?.message || t("sub_err_booking_failed")
        );
      }
    } finally {
      setAppointmentSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a13] px-4 sm:px-6 py-10 sm:py-20 text-white selection:bg-purple-500/30 overflow-x-hidden">
      <div className="fixed left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-teal-900/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto mb-10 sm:mb-14 max-w-3xl text-center"
      >
        <button
          onClick={() => navigate("/")}
          className="mx-auto mb-6 sm:mb-8 flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-400 transition-colors hover:text-white cursor-pointer"
        >
          &larr; {t("sub_btn_back_home")}
        </button>
        <h1 className="mb-3 sm:mb-4 text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
          {t("sub_hero_tag")}{" "}
          <span className="bg-gradient-to-r from-purple-400 to-blue-300 bg-clip-text text-transparent">
            {t("sub_hero_title")}
          </span>
        </h1>
        <p className="text-sm sm:text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">{t("sub_hero_subtitle")}</p>
      </motion.div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1480px] gap-6 sm:gap-8 xl:grid-cols-3">
        {plans.map((plan, index) => {
          const Icon = plan.icon;
          const isPopular = plan.isPopular;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * (index + 1) }}
              className="relative flex min-h-0 xl:min-h-[980px] flex-col overflow-hidden rounded-3xl border border-purple-500/50 bg-gradient-to-b from-gray-800/80 to-gray-900/40 p-5 sm:p-8 shadow-xl shadow-purple-500/10 backdrop-blur-md transition-all hover:border-purple-500"
            >
              {isPopular ? (
                <div className="absolute right-0 top-0 rounded-bl-xl bg-purple-500 px-3.5 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#070a13]">
                  {t("sub_badge_most_popular")}
                </div>
              ) : null}

              <div className="mb-4 sm:mb-6 mt-1 sm:mt-2">
                <h3 className="mb-2 flex items-center gap-2 text-xl sm:text-2xl font-bold">
                  {Icon ? <Icon className="text-purple-400" size={23} /> : null}
                  {plan.name}
                </h3>
                <p className="mb-2 text-xs sm:text-sm text-gray-400">{plan.subtitle}</p>
                <p className="text-xs sm:text-sm leading-6 text-gray-300">{plan.description}</p>
              </div>

              <div className="mb-6 sm:mb-8">
                <span className="text-3xl sm:text-4xl font-extrabold">{plan.price}</span>
                <span className="text-xs sm:text-sm text-gray-400">{t("sub_per_month")}</span>
              </div>

              <section className="mb-6 sm:mb-8 rounded-3xl border border-gray-800 bg-[#09111d]/90 p-3.5 sm:p-4">
                <div className="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
                  {[
                    ["included", t("sub_tab_included")],
                    ["usage", t("sub_tab_usage")],
                    ["addons", t("sub_tab_addons")],
                    ["email", t("sub_tab_email")],
                  ].map(([value, label]) => {
                    const isActive = activeSections[plan.id] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setActiveSections((current) => ({
                            ...current,
                            [plan.id]: value,
                          }))
                        }
                        className={
                          isActive
                            ? "rounded-full border border-purple-400 bg-purple-500/10 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-purple-200 cursor-pointer"
                            : "rounded-full border border-gray-700 bg-transparent px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-gray-400 transition hover:text-white cursor-pointer"
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="mb-4">
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
                    {activeSections[plan.id] === "included" && t("sub_hdr_included")}
                    {activeSections[plan.id] === "usage" && t("sub_hdr_usage")}
                    {activeSections[plan.id] === "addons" && t("sub_hdr_addons")}
                    {activeSections[plan.id] === "email" && t("sub_hdr_email")}
                  </p>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-400">
                    {activeSections[plan.id] === "included" && t("sub_sub_included")}
                    {activeSections[plan.id] === "usage" && t("sub_sub_usage")}
                    {activeSections[plan.id] === "addons" && t("sub_sub_addons")}
                    {activeSections[plan.id] === "email" && t("sub_sub_email")}
                  </p>
                </div>

                <div className="space-y-2.5 sm:space-y-3">
                  {getSectionItems(plan, activeSections[plan.id]).map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3"
                    >
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <CheckCircle
                          className="mt-0.5 shrink-0 text-purple-400"
                          size={16}
                        />
                        <span className="text-xs sm:text-sm leading-6 text-gray-200">
                          {item}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-6 xl:mt-auto flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenModal("subscribe")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-400 to-blue-400 py-3.5 sm:py-4 text-sm font-bold text-[#070a13] transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-purple-500/20 cursor-pointer"
                >
                  {t("sub_btn_subscribe_now")}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenModal("trial")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-transparent py-2.5 sm:py-3 text-sm font-bold text-gray-300 transition-all active:scale-[0.98] hover:bg-gray-800 hover:text-white cursor-pointer"
                >
                  {t("sub_btn_start_free_trial")} <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="relative z-10 mx-auto mt-10 flex w-full max-w-[1480px] justify-center">
        <button
          type="button"
          onClick={() => setIsDemoOpen(true)}
          className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-400 to-blue-400 px-8 py-4 font-bold text-[#070a13] transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-purple-500/20 cursor-pointer"
        >
          {t("sub_btn_request_demo")}
          <ChevronRight size={18} className="text-[#070a13]" />
        </button>
      </div>

      {featuredPlan ? (
        <div className="relative z-10 mx-auto mt-8 w-full max-w-[1480px] text-center text-sm text-gray-500">
          {t("sub_growth_recommendation_hint")}
        </div>
      ) : null}

      <AnimatePresence>
        {isModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 20 }}
              className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <button
                onClick={handleCloseModal}
                className="absolute right-4 top-4 z-20 text-gray-400 transition-colors hover:text-white cursor-pointer bg-gray-900/80 rounded-full p-1"
              >
                <X size={20} />
              </button>

              <div className="p-5 sm:p-8 overflow-y-auto">
                {isSubmitted ? (
                  <div className="py-6 sm:py-8 text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-purple-900/30">
                      <CheckCircle className="text-purple-400" size={32} />
                    </div>
                    <h3 className="mb-3 text-xl sm:text-2xl font-bold text-white">
                      {t("sub_modal_received_title")}
                    </h3>
                    <p className="mb-8 text-xs sm:text-sm leading-relaxed text-gray-400">
                      {t("sub_modal_received_desc")}
                    </p>
                    <button
                      onClick={handleCloseModal}
                      className="w-full rounded-xl bg-gray-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 cursor-pointer"
                    >
                      {t("sub_btn_close")}
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="mb-2 text-xl sm:text-2xl font-bold pr-6">
                      {selectedPlan === "trial" ? t("sub_title_trial") : t("sub_title_subscribe")}
                    </h3>
                    <p className="mb-5 sm:mb-6 text-xs sm:text-sm text-gray-400">
                      {t("sub_modal_subtitle")}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
                      <div>
                        <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-300">
                          {t("sub_lbl_full_name")}
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={(e) =>
                            setFormData({ ...formData, fullName: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white transition-all focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          placeholder="John Doe"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-300">
                          {t("sub_lbl_work_email")}
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white transition-all focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          placeholder="john@company.com"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-300">
                          {t("sub_lbl_business_name")}
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.businessName}
                          onChange={(e) =>
                            setFormData({ ...formData, businessName: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white transition-all focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          placeholder="Acme Corp"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-300">
                          {t("sub_lbl_business_address")}
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.businessAddress}
                          onChange={(e) =>
                            setFormData({ ...formData, businessAddress: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white transition-all focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          placeholder="123 Business St, City, Country"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-300">
                            {t("sub_lbl_phone_number")}
                          </label>
                          <input
                            type="tel"
                            required
                            value={formData.phoneNo}
                            onChange={(e) =>
                              setFormData({ ...formData, phoneNo: e.target.value })
                            }
                            className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white transition-all focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            placeholder="+1 234 567 8900"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-300">
                            {t("sub_lbl_owner_dob")}
                          </label>
                          <input
                            type="date"
                            required
                            value={formData.ownerDob}
                            onChange={(e) =>
                              setFormData({ ...formData, ownerDob: e.target.value })
                            }
                            className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white transition-all [color-scheme:dark] focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-300">
                          {t("sub_lbl_business_type")}
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.businessType}
                          onChange={(e) =>
                            setFormData({ ...formData, businessType: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white transition-all focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                          placeholder="e.g. Real Estate, E-commerce, Marketing"
                        />
                      </div>

                      <button
                        type="submit"
                        className="mt-3 sm:mt-4 w-full rounded-xl bg-gradient-to-r from-purple-400 to-blue-400 py-3 sm:py-3.5 text-sm font-bold text-[#070a13] shadow-lg shadow-purple-500/10 transition-all active:scale-[0.98] hover:shadow-purple-500/25 cursor-pointer"
                      >
                        {t("sub_btn_request_access")}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {isDemoOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md"
            onClick={() => setIsDemoOpen(false)}
          >
            <motion.aside
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-gray-800 bg-[#08111d] shadow-2xl shadow-purple-950/20 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-800 px-5 sm:px-6 py-4 shrink-0 bg-[#0c1525]">
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-purple-300">
                    {t("sub_demo_tag")}
                  </p>
                  <h2 className="mt-1 text-xl sm:text-2xl font-bold text-white">
                    {t("sub_demo_title")}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDemoOpen(false)}
                  className="rounded-full border border-gray-700 p-2 text-gray-400 transition-colors hover:text-white hover:bg-gray-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid flex-1 grid-cols-1 md:grid-cols-2 overflow-y-auto">
                <section className="border-b md:border-b-0 md:border-r border-gray-800 p-4 sm:p-6">
                  <div className="mb-5 sm:mb-6 flex items-center gap-3">
                    <div className="rounded-2xl bg-purple-500/10 p-2.5 sm:p-3 text-purple-300 shrink-0">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-white">
                        {t("sub_demo_contact_title")}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-400">
                        {t("sub_demo_contact_subtitle")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5 sm:space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                          {t("sub_lbl_first_name")}
                        </label>
                        <input
                          type="text"
                          value={demoForm.firstName}
                          onChange={(e) =>
                            setDemoForm((current) => ({
                              ...current,
                              firstName: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                          {t("sub_lbl_last_name")}
                        </label>
                        <input
                          type="text"
                          value={demoForm.lastName}
                          onChange={(e) =>
                            setDemoForm((current) => ({
                              ...current,
                              lastName: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                        {t("sub_lbl_phone_number")}
                      </label>
                      <input
                        type="tel"
                        value={demoForm.phoneNumber}
                        onChange={(e) =>
                          setDemoForm((current) => ({
                            ...current,
                            phoneNumber: e.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60"
                        placeholder="+1 234 567 8900"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                        {t("sub_lbl_email")}
                      </label>
                      <input
                        type="email"
                        value={demoForm.email}
                        onChange={(e) =>
                          setDemoForm((current) => ({
                            ...current,
                            email: e.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60"
                        placeholder="john@company.com"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                        {t("sub_lbl_message")}
                      </label>
                      <textarea
                        value={demoForm.message}
                        onChange={(e) =>
                          setDemoForm((current) => ({
                            ...current,
                            message: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full resize-none rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60"
                        placeholder={t("sub_ph_message")}
                      />
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-[#0c1525] p-3.5 sm:p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-gray-500">
                        {t("sub_demo_next_title")}
                      </p>
                      <ul className="space-y-1.5 text-xs sm:text-sm leading-6 text-gray-300">
                        <li>{t("sub_demo_next_1")}</li>
                        <li>{t("sub_demo_next_2")}</li>
                        <li>{t("sub_demo_next_3")}</li>
                      </ul>
                    </div>
                    {demoSubmitted ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-300">
                        <CheckCircle size={18} />
                        {t("sub_demo_success")}
                      </div>
                    ) : (
                      <>
                        {demoError && (
                          <p className="text-xs sm:text-sm text-red-400">{demoError}</p>
                        )}
                        <button
                          type="button"
                          onClick={handleDemoSubmit}
                          disabled={demoSubmitting}
                          className="w-full rounded-2xl border border-gray-700 bg-gray-800 px-4 py-3 text-xs sm:text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                        >
                          {demoSubmitting ? t("sub_btn_sending") : t("sub_btn_send_demo")}
                        </button>
                      </>
                    )}
                  </div>
                </section>

                <section className="p-4 sm:p-6">
                  <div className="mb-5 sm:mb-6 flex items-center gap-3">
                    <div className="rounded-2xl bg-teal-500/10 p-2.5 sm:p-3 text-teal-300 shrink-0">
                      <CalendarDays size={20} />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-white">
                        {t("sub_appt_title")}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-400">
                        {t("sub_appt_subtitle")}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-800 bg-[#0c1525] p-3.5 sm:p-4">
                    {appointmentSubmitted ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-300">
                        <CheckCircle size={18} />
                        {t("sub_appt_success")}
                      </div>
                    ) : (
                      <>
                        <p className="mb-3.5 text-xs uppercase tracking-[0.18em] text-gray-500">
                          {t("sub_appt_windows")}
                        </p>
                        {slotsLoading ? (
                          <p className="text-xs sm:text-sm text-gray-400">{t("sub_appt_loading")}</p>
                        ) : appointmentSlots.length === 0 ? (
                          <p className="text-xs sm:text-sm text-gray-400">
                            {t("sub_appt_no_slots")}
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                            {appointmentSlots.map((slot) => {
                              const isActive = slot.date === selectedSlot?.date && slot.time === selectedSlot?.time;
                              return (
                                <button
                                  key={`${slot.date}-${slot.time}`}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
                                  className={
                                    isActive
                                      ? "rounded-2xl border border-purple-400 bg-purple-500/10 px-3 py-2.5 text-xs sm:text-sm font-medium text-purple-200 cursor-pointer"
                                      : "rounded-2xl border border-gray-800 bg-[#09111d] px-3 py-2.5 text-xs sm:text-sm text-gray-300 cursor-pointer"
                                  }
                                >
                                  {formatSlotLabel(slot.start)}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-4 sm:mt-5 rounded-2xl border border-dashed border-gray-700 bg-[#09111d] p-3.5 sm:p-4">
                          <p className="mb-1.5 text-xs uppercase tracking-[0.18em] text-gray-500">
                            {t("sub_appt_selected")}
                          </p>
                          <p className="text-sm sm:text-base font-medium text-white">
                            {selectedSlot ? formatSlotLabel(selectedSlot.start) : t("sub_appt_none_selected")}
                          </p>
                        </div>

                        {appointmentError && (
                          <p className="mt-3 text-xs sm:text-sm text-red-400">{appointmentError}</p>
                        )}

                        <button
                          type="button"
                          onClick={handleAppointmentConfirm}
                          disabled={appointmentSubmitting || !selectedSlot}
                          className="mt-4 sm:mt-5 w-full rounded-2xl bg-gradient-to-r from-purple-400 to-blue-400 px-4 py-3 text-xs sm:text-sm font-bold text-[#070a13] transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                        >
                          {appointmentSubmitting ? t("sub_btn_booking") : t("sub_btn_confirm_appointment")}
                        </button>
                      </>
                    )}
                  </div>
                </section>
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
