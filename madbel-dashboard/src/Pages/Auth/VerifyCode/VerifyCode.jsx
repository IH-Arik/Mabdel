import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import brandlogo from "../../../assets/image/stone-logo.png";

const VerifyCode = () => {
  const [code, setCode] = useState(["", "", "", "", ""]);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
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
  const handleResend = (e) => {
    e.preventDefault();
    alert("Verification code resent!");
  };
  const handleVerify = (e) => {
    e.preventDefault();
    const verificationCode = code.join("");
    navigate("/new-password");
    alert(`Verifying code: ${verificationCode}`);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="py-10 px-8 md:px-10 rounded-2xl w-full max-w-[500px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
        <div className="flex justify-center mb-6">
          <img className="w-40 h-40 object-contain" src={brandlogo} alt="brandlogo" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">Verify Your Code</h1>
        <p className="text-slate-500 text-sm text-center mb-6">
          We sent a reset link to{" "}
          <span className="font-semibold text-slate-700">contact@dscode</span>.{" "}
          Enter the 5-digit code mentioned in the email.
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
              className="text-[#17b4c9] hover:text-[#149cb0] font-semibold transition-colors duration-200 focus:outline-none bg-transparent border-none p-0 cursor-pointer"
            >
              Resend
            </button>
          </div>

          <button
            type="submit"
            className="bg-[#17b4c9] hover:bg-[#149cb0] active:bg-[#0f8b9c] text-center w-full py-3 font-semibold text-white rounded-lg transition-colors duration-200 shadow-sm focus:outline-none"
          >
            Verify Code
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyCode;
