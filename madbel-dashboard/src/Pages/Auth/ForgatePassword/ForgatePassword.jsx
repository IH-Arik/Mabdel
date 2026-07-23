import React, { useState } from "react";
import { Form, Input, message } from "antd";
import { useNavigate } from "react-router-dom";
import brandlogo from "../../../assets/image/gocustify-mark.png";
import { forgotPassword } from "../../../services/authApi";

const ForgatePassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async ({ email }) => {
    setLoading(true);
    try {
      await forgotPassword({ email });
      sessionStorage.setItem("reset_email", email);
      message.success("Reset code sent to your email!");
      navigate("/verify-code");
    } catch (error) {
      message.error(error?.message || "Failed to send reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <Form
        name="forgotPassword"
        onFinish={onFinish}
        layout="vertical"
        requiredMark={false}
        className="py-10 px-8 md:px-10 rounded-2xl w-full max-w-[500px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]"
      >
        <div className="flex justify-center mb-6">
          <img className="w-40 h-40 object-contain" src={brandlogo} alt="brandlogo" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">Forgot Password</h1>
        <p className="text-slate-500 text-sm text-center mb-6">
          Enter your email address to receive password reset instructions
        </p>

        <Form.Item
          name="email"
          label={<span className="text-sm font-semibold text-slate-700">Email</span>}
          rules={[
            { required: true, message: "Please input your email!" },
            { type: "email", message: "Please enter a valid email!" },
          ]}
          className="mb-6"
        >
          <Input
            placeholder="Enter your email"
            className="h-11 px-4 text-sm text-slate-800 rounded-lg border border-slate-300 hover:border-slate-400 focus:border-[#17b4c9] focus:shadow-none placeholder:text-slate-400"
          />
        </Form.Item>

        <Form.Item className="mb-4">
          <button
            type="submit"
            className="bg-[#17b4c9] hover:bg-[#149cb0] active:bg-[#0f8b9c] text-center w-full py-3 font-semibold text-white rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Code"}
          </button>
        </Form.Item>

        <p className="text-center text-slate-500 text-sm">
          Remember your password?{" "}
          <button
            type="button"
            className="text-[#17b4c9] hover:text-[#149cb0] font-semibold transition-colors duration-200 focus:outline-none"
            onClick={() => navigate("/sign-in")}
          >
            Sign In
          </button>
        </p>
      </Form>
    </div>
  );
};

export default ForgatePassword;
