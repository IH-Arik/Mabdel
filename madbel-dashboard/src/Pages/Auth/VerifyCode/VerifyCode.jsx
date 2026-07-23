import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { message } from "antd";
import brandlogo from "../../../assets/image/gocustify-mark.png";
import { forgotPassword, verifyOtp } from "../../../services/authApi";

const VerifyCode = () => {
  const [code, setCode] = useState(["", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRefs = useRef([]);
  const navigate = useNavigate();

  const email = sessionStorage.getItem("reset_email") || "";

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 5);
  }, []);

  const handleChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(0, 1);
    setCode(newCode);
    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email) {
      message.error("Email not found. Please go back and try again.");
      return;
    }
    setResendLoading(true);
    try {
      await forgotPassword({ email });
      message.success("Verification code resent!");
    } catch (error) {
      message.error(error?.message || "Failed to resend code.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const otp = code.join("");
    if (otp.length < 5) {
      message.error("Please enter the full 5-digit code.");
      return;
    }
    if (!email) {
      message.error("Email not found. Please go back and try again.");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp({ email, otp });
      sessionStorage.setItem("reset_otp", otp);
      navigate("/new-password");
    } catch (error) {
      message.error(error?.message || "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="py-10 px-8 md:px-10 rounded-2xl w-full max-w-[500px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
        <div className="flex justify-center mb-6">
          <img className="w-40 h-40 object-contain" src={brandlogo} alt="brandlogo" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">Verify Your Code</h1>
        <p className="text-slate-500 text-sm text-center mb-6">
          We sent a reset code to{" "}
          <span className="font-semibold text-slate-700">{email || "your email"}</span>.{" "}
          Enter the 5-digit code below.
        </p>

        <form onSubmit={handleVerify} className="mt-6">
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3, 4].map((index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                value={code[index]}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-12 text-xl font-bold text-center text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#17b4c9] focus:border-[#17b4c9]"
                maxLength={1}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 mb-6 text-sm">
            <p className="text-slate-500">Didn't receive the email?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="text-[#17b4c9] hover:text-[#149cb0] font-semibold transition-colors duration-200 focus:outline-none bg-transparent border-none p-0 cursor-pointer disabled:opacity-50"
            >
              {resendLoading ? "Sending..." : "Resend"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-[#17b4c9] hover:bg-[#149cb0] active:bg-[#0f8b9c] text-center w-full py-3 font-semibold text-white rounded-lg transition-colors duration-200 shadow-sm focus:outline-none disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyCode;
