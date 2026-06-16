import { Form, Input, message } from "antd";
import { FaRegEyeSlash } from "react-icons/fa";
import { FaRegEye } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import brandlogo from "../../../assets/image/stone-logo.png";
import { resetPassword } from "../../../services/authApi";

const NewPass = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onFinish = async ({ newPassword, confirmPassword }) => {
    if (newPassword !== confirmPassword) {
      message.error("Passwords do not match!");
      return;
    }

    const email = sessionStorage.getItem("reset_email") || "";
    const otp = sessionStorage.getItem("reset_otp") || "";

    if (!email || !otp) {
      message.error("Session expired. Please start the reset process again.");
      navigate("/forgot-password");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ email, otp, newPassword });
      sessionStorage.removeItem("reset_email");
      sessionStorage.removeItem("reset_otp");
      message.success("Password changed successfully!");
      navigate("/sign-in");
    } catch (error) {
      message.error(error?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <Form
        name="new-password"
        onFinish={onFinish}
        layout="vertical"
        requiredMark={false}
        className="py-10 px-8 md:px-10 rounded-2xl w-full max-w-[500px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]"
      >
        <div className="flex justify-center mb-6">
          <img src={brandlogo} alt="brandlogo" className="w-40 h-40 object-contain" />
        </div>

        <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">
          Create New Password
        </h2>
        <p className="text-slate-500 text-sm text-center mb-6">
          Create a new password. Ensure it differs from previous ones for security.
        </p>

        <Form.Item
          name="newPassword"
          label={<span className="text-sm font-semibold text-slate-700">New Password</span>}
          rules={[{ required: true, message: "Please input your new password!" }]}
          className="mb-5"
        >
          <div className="relative flex items-center w-full">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="New Password"
              className="w-full h-11 pl-4 pr-10 text-sm text-slate-800 rounded-lg border border-slate-300 hover:border-slate-400 focus:border-[#17b4c9] focus:shadow-none placeholder:text-slate-400"
            />
            <div className="absolute right-3 flex items-center">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
              >
                {showPassword ? <FaRegEye className="w-5 h-5" /> : <FaRegEyeSlash className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label={<span className="text-sm font-semibold text-slate-700">Confirm Password</span>}
          rules={[{ required: true, message: "Please confirm your password!" }]}
          className="mb-6"
        >
          <div className="relative flex items-center w-full">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              className="w-full h-11 pl-4 pr-10 text-sm text-slate-800 rounded-lg border border-slate-300 hover:border-slate-400 focus:border-[#17b4c9] focus:shadow-none placeholder:text-slate-400"
            />
            <div className="absolute right-3 flex items-center">
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
              >
                {showConfirmPassword ? <FaRegEye className="w-5 h-5" /> : <FaRegEyeSlash className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </Form.Item>

        <Form.Item className="mb-0 mt-6 text-center">
          <button
            className="bg-[#17b4c9] hover:bg-[#149cb0] active:bg-[#0f8b9c] text-center w-full py-3 font-semibold text-white rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default NewPass;
