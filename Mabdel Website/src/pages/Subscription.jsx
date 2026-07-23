import { useMemo, useState } from "react";
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

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$299",
    subtitle: "Best for Solo Business Owners",
    description:
      "Capture leads, respond instantly, and never miss a customer.",
    features: [
      "1 User",
      "AI Receptionist (calls + SMS handling)",
      "CRM (leads, contacts, pipeline)",
      "Calendar booking & scheduling",
      "Missed call text back",
      "Basic 1-to-1 follow-up automation",
      "Mobile app access",
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
    subtitle: "Best for Small Businesses Ready to Scale Revenue",
    description:
      "Turn conversations into customers with automation and marketing.",
    isPopular: true,
    icon: Sparkles,
    features: [
      "Everything in Starter",
      "Unlimited users",
      "Facebook + Instagram messaging integration",
      "AI auto-replies to social media posts",
      "AI reads & responds to messages (FB, IG, X where available)",
      "Bulk SMS campaigns",
      "Bulk email campaigns",
      "AI social media post creation",
      "AI marketing content generation",
      "Team inbox (shared conversations)",
      "Advanced automation workflows",
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
    subtitle: "Best for Growing & Operating Businesses",
    description:
      "Full AI-powered business system for operations and scale.",
    features: [
      "Everything in Growth",
      "Invoice generation & billing tools",
      "Business document generation (proposals, agreements, contracts & e-signatures)",
      "Advanced automation workflows",
      "Priority support",
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

const appointmentSlots = [
  "Mon - 10:00 AM",
  "Mon - 2:30 PM",
  "Tue - 11:30 AM",
  "Wed - 4:00 PM",
  "Thu - 12:00 PM",
  "Fri - 3:00 PM",
];

export default function Subscription() {
  const navigate = useNavigate();
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(appointmentSlots[1]);
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

  const featuredPlan = useMemo(
    () => plans.find((plan) => plan.isPopular),
    [],
  );

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
      alert("Failed to request access. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen bg-[#070a13] px-6 py-20 text-white selection:bg-cyan-500/30">
      <div className="fixed left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-cyan-900/20 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-teal-900/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto mb-14 max-w-3xl text-center"
      >
        <button
          onClick={() => navigate("/")}
          className="mx-auto mb-8 flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-white"
        >
          &larr; Back to Home
        </button>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight md:text-5xl">
          AI CRM <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">Pricing Plans</span>
        </h1>
        <p className="text-lg text-gray-400">
          Choose the right GoCustify plan for your team, then scale with usage-based add-ons when you need more.
        </p>
      </motion.div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1480px] gap-8 xl:grid-cols-3">
        {plans.map((plan, index) => {
          const Icon = plan.icon;
          const isPopular = plan.isPopular;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * (index + 1) }}
              className={
                isPopular
                  ? "relative flex min-h-[980px] flex-col overflow-hidden rounded-3xl border border-cyan-500/50 bg-gradient-to-b from-gray-800/80 to-gray-900/40 p-8 shadow-xl shadow-cyan-500/10"
                  : "flex min-h-[980px] flex-col rounded-3xl border border-gray-800 bg-gray-900/40 p-8 backdrop-blur-md transition-all hover:border-cyan-500/30"
              }
            >
              {isPopular ? (
                <div className="absolute right-0 top-0 rounded-bl-xl bg-cyan-500 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#070a13]">
                  Most Popular
                </div>
              ) : null}

              <div className="mb-6 mt-2">
                <h3 className="mb-2 flex items-center gap-2 text-2xl font-bold">
                  {Icon ? <Icon className="text-cyan-400" size={23} /> : null}
                  {plan.name}
                </h3>
                <p className="mb-2 text-sm text-gray-400">{plan.subtitle}</p>
                <p className="text-sm leading-6 text-gray-300">{plan.description}</p>
              </div>

              <div className="mb-8">
                <span className="text-4xl font-extrabold">{plan.price}</span>
                <span className="text-gray-400">/month</span>
              </div>

              <section className="mb-8 rounded-3xl border border-gray-800 bg-[#09111d]/90 p-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    ["included", "Included"],
                    ["usage", "Usage"],
                    ["addons", "Add-Ons"],
                    ["email", "Email Packs"],
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
                            ? "rounded-full border border-cyan-400 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200"
                            : "rounded-full border border-gray-700 bg-transparent px-3 py-2 text-xs font-semibold text-gray-400 transition hover:text-white"
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    {activeSections[plan.id] === "included" && "Included"}
                    {activeSections[plan.id] === "usage" && "Included Usage"}
                    {activeSections[plan.id] === "addons" && "When you exceed limits"}
                    {activeSections[plan.id] === "email" && "Email Add-On Packs"}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    {activeSections[plan.id] === "included" &&
                      "Core tools and AI workflows included in this plan."}
                    {activeSections[plan.id] === "usage" &&
                      "Monthly usage bundled with the subscription."}
                    {activeSections[plan.id] === "addons" &&
                      "Continue with usage credits when your limits are reached."}
                    {activeSections[plan.id] === "email" &&
                      "Extra email volume packs for campaign-heavy teams."}
                  </p>
                </div>

                <div className="space-y-3">
                  {getSectionItems(plan, activeSections[plan.id]).map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-gray-800 bg-[#0c1525] px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle
                          className="mt-0.5 shrink-0 text-cyan-400"
                          size={16}
                        />
                        <span className="text-sm leading-6 text-gray-200">
                          {item}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-auto flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenModal("subscribe")}
                  className={
                    isPopular
                      ? "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 py-4 font-bold text-[#070a13] transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-cyan-500/20"
                      : "flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 py-4 font-bold text-white transition-all active:scale-[0.98] hover:bg-gray-700"
                  }
                >
                  Subscribe Now
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenModal("trial")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-transparent py-3 font-bold text-gray-300 transition-all active:scale-[0.98] hover:bg-gray-800 hover:text-white"
                >
                  Start Free Trial <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="relative z-10 mx-auto mt-10 flex w-full max-w-[1480px] justify-center">
        <div className="rounded-[28px] border border-red-500/70 bg-[#070d18] p-2 shadow-[0_0_0_1px_rgba(239,68,68,0.12)]">
          <button
            type="button"
            onClick={() => setIsDemoOpen(true)}
            className="flex items-center gap-3 rounded-3xl bg-[#0f1727] px-7 py-4 text-sm font-semibold text-white transition-all hover:bg-[#162136]"
          >
            Request a Demo
            <ChevronRight size={18} className="text-cyan-300" />
          </button>
        </div>
      </div>

      {featuredPlan ? (
        <div className="relative z-10 mx-auto mt-8 w-full max-w-[1480px] text-center text-sm text-gray-500">
          Growth is currently highlighted as the recommended balance between revenue automation and team collaboration.
        </div>
      ) : null}

      <AnimatePresence>
        {isModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl"
            >
              <button
                onClick={handleCloseModal}
                className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-white"
              >
                <X size={20} />
              </button>

              <div className="p-8">
                {isSubmitted ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-900/30">
                      <CheckCircle className="text-cyan-400" size={32} />
                    </div>
                    <h3 className="mb-3 text-2xl font-bold text-white">
                      Request Received!
                    </h3>
                    <p className="mb-8 leading-relaxed text-gray-400">
                      Thanks! Our team will review your request and email you login credentials shortly.
                    </p>
                    <button
                      onClick={handleCloseModal}
                      className="w-full rounded-xl bg-gray-800 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="mb-2 text-2xl font-bold">
                      {selectedPlan === "trial" ? "Start Free Trial" : "Subscribe"}
                    </h3>
                    <p className="mb-6 text-sm text-gray-400">
                      Please provide your details below. Our team will set up your workspace.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-300">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={(e) =>
                            setFormData({ ...formData, fullName: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                          placeholder="John Doe"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-300">
                          Work Email
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                          placeholder="john@company.com"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-300">
                          Business Name
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.businessName}
                          onChange={(e) =>
                            setFormData({ ...formData, businessName: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                          placeholder="Acme Corp"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-300">
                          Business Address
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.businessAddress}
                          onChange={(e) =>
                            setFormData({ ...formData, businessAddress: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                          placeholder="123 Business St, City, Country"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-300">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            required
                            value={formData.phoneNo}
                            onChange={(e) =>
                              setFormData({ ...formData, phoneNo: e.target.value })
                            }
                            className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                            placeholder="+1 234 567 8900"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-300">
                            Owner Date of Birth
                          </label>
                          <input
                            type="date"
                            required
                            value={formData.ownerDob}
                            onChange={(e) =>
                              setFormData({ ...formData, ownerDob: e.target.value })
                            }
                            className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white transition-all [color-scheme:dark] focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-300">
                          Business Type / Industry
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.businessType}
                          onChange={(e) =>
                            setFormData({ ...formData, businessType: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-white transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                          placeholder="e.g. Real Estate, E-commerce, Marketing"
                        />
                      </div>

                      <button
                        type="submit"
                        className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 py-3.5 font-bold text-[#070a13] shadow-lg shadow-cyan-500/10 transition-all active:scale-[0.98] hover:shadow-cyan-500/25"
                      >
                        Request Access
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {isDemoOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsDemoOpen(false)}
            />
            <motion.aside
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="fixed inset-0 z-50 flex h-screen w-screen flex-col bg-[#08111d] shadow-2xl shadow-black/50"
            >
              <div className="flex items-center justify-between border-b border-gray-800 px-6 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                    Request a Demo
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-white">
                    Talk to GoCustify AI
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDemoOpen(false)}
                  className="rounded-full border border-gray-700 p-2 text-gray-400 transition-colors hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid flex-1 grid-cols-2 overflow-hidden max-md:grid-cols-1">
                <section className="border-r border-gray-800 px-6 py-6 max-md:border-r-0 max-md:border-b">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Contact us via mail
                      </h3>
                      <p className="text-sm text-gray-400">
                        Frontend placeholder for direct sales outreach.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-500">
                          First Name
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
                          className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/60"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-500">
                          Last Name
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
                          className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/60"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-500">
                        Phone Number
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
                        className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/60"
                        placeholder="+1 234 567 8900"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-500">
                        Email
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
                        className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/60"
                        placeholder="john@company.com"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-gray-500">
                        Message
                      </label>
                      <textarea
                        value={demoForm.message}
                        onChange={(e) =>
                          setDemoForm((current) => ({
                            ...current,
                            message: e.target.value,
                          }))
                        }
                        rows={5}
                        className="w-full resize-none rounded-2xl border border-gray-800 bg-[#0c1525] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/60"
                        placeholder="Tell us about your business and what you want to automate."
                      />
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-[#0c1525] p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-gray-500">
                        What happens next
                      </p>
                      <ul className="space-y-2 text-sm leading-6 text-gray-300">
                        <li>Share your use case and team size</li>
                        <li>We align the best plan and usage model</li>
                        <li>Then we schedule a live walkthrough</li>
                      </ul>
                    </div>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Send Demo Request
                    </button>
                  </div>
                </section>

                <section className="px-6 py-6">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-2xl bg-teal-500/10 p-3 text-teal-300">
                      <CalendarDays size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Set up an appointment
                      </h3>
                      <p className="text-sm text-gray-400">
                        Scheduling UI only for now. We will wire it later.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-800 bg-[#0c1525] p-4">
                    <p className="mb-4 text-xs uppercase tracking-[0.18em] text-gray-500">
                      Available demo windows
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {appointmentSlots.map((slot) => {
                        const isActive = slot === selectedSlot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={
                              isActive
                                ? "rounded-2xl border border-cyan-400 bg-cyan-500/10 px-3 py-3 text-sm font-medium text-cyan-200"
                                : "rounded-2xl border border-gray-800 bg-[#09111d] px-3 py-3 text-sm text-gray-300"
                            }
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 rounded-2xl border border-dashed border-gray-700 bg-[#09111d] p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-gray-500">
                        Selected slot
                      </p>
                      <p className="text-base font-medium text-white">
                        {selectedSlot}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3 text-sm font-bold text-[#070a13]"
                    >
                      Confirm Appointment
                    </button>
                  </div>
                </section>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
