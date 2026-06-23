import { Checkbox, Form, Input, message } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import brandlogo from "../../../assets/image/stone-logo.png";
import { isAdminAuthenticated, setAdminSession } from "../../../utils/auth";
import { loginAdmin } from "../../../services/authApi";

const STATIC_MODE = import.meta.env.VITE_STATIC_MODE !== "false";
const STATIC_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbi0wMDEiLCJleHAiOjQxMDI0NDQ4MDB9.static-signature";

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showpassword, setShowpassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const redirectPath = location.state?.from?.pathname || "/dashboard";

  const togglePasswordVisibility = () => {
    setShowpassword((previous) => !previous);
  };

  useEffect(() => {
    if (isAdminAuthenticated()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const onFinish = async (values) => {
    setLoading(true);
    const normalizedEmail = values.email.trim().toLowerCase();

    try {
      if (STATIC_MODE) {
        setAdminSession({
          email: normalizedEmail,
          accessToken: STATIC_ACCESS_TOKEN,
          refreshToken: null,
          profile: { name: "Static Admin", email: normalizedEmail },
        });
        message.success("Static mode enabled");
        navigate(redirectPath, { replace: true });
        return;
      }

      const payload = await loginAdmin({
        email: normalizedEmail,
        password: values.password,
      });

      const data = payload?.data || payload;
      const email =
        data?.email || data?.admin?.email || data?.user?.email || normalizedEmail;
      const accessToken =
        data?.accessToken ||
        data?.token ||
        data?.access_token ||
        data?.tokens?.accessToken ||
        payload?.token;
      const refreshToken =
        data?.refreshToken ||
        data?.refresh_token ||
        data?.tokens?.refreshToken ||
        payload?.refreshToken;
      const profile = data?.admin || data?.user || null;

      if (!accessToken) {
        throw new Error("Login response did not include access token.");
      }

      setAdminSession({
        email,
        accessToken,
        refreshToken,
        profile,
      });

      message.success(payload?.message || "Login successful");
      navigate(redirectPath, { replace: true });
    } catch (error) {
      message.error(error.message || "Unable to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f8b9c 0%, #17b4c9 50%, #e0f7fa 100%)" }}
    >
      <Form
        name="login"
        initialValues={{ remember: true }}
        onFinish={onFinish}
        layout="vertical"
        requiredMark={false}
        className="py-10 px-8 md:px-10 rounded-2xl w-full max-w-[500px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)]"
      >
        <div className="flex justify-center mb-6">
          <img src={brandlogo} className="w-40 h-40 object-contain" alt="brandlogo" />
        </div>

        <Form.Item
          name="email"
          label={<span className="text-sm font-semibold text-slate-700">Email</span>}
          rules={[{ required: true, message: "Please enter your email" }]}
          className="mb-5"
        >
          <Input
            className="h-11 px-4 text-sm text-slate-800 rounded-lg border border-slate-300 hover:border-slate-400 focus:border-[#17b4c9] focus:shadow-none placeholder:text-slate-400"
            type="text"
            autoComplete="username"
            placeholder="mostain@gmail.com"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label={<span className="text-sm font-semibold text-slate-700">Password</span>}
          rules={[
            { required: true, message: "Please enter your password" },
            {
              min: 6,
              message: "Password must be at least 6 characters",
            },
          ]}
          className="mb-5"
        >
          <Input.Password
            className="h-11 text-sm text-slate-800 rounded-lg border border-slate-300 hover:border-slate-400 focus:border-[#17b4c9] focus:shadow-none placeholder:text-slate-400"
            autoComplete="current-password"
            placeholder="Enter your password"
            visibilityToggle={false}
            iconRender={() => null}
            type={showpassword ? "text" : "password"}
            suffix={
              <button
                onClick={togglePasswordVisibility}
                type="button"
                className="text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center"
              >
                {showpassword ? (
                  <FaRegEye className="w-5 h-5" />
                ) : (
                  <FaRegEyeSlash className="w-5 h-5" />
                )}
              </button>
            }
          />
        </Form.Item>

        <div className="flex items-center justify-between mb-6">
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox className="text-slate-600 text-sm hover:text-slate-700">
              Remember password
            </Checkbox>
          </Form.Item>
          <Link
            to="/forgate-password"
            className="text-[#17b4c9] hover:text-[#149cb0] text-sm font-medium transition-colors duration-200"
          >
            Forgot password?
          </Link>
        </div>

        <Form.Item className="mb-0 text-center">
          <button
            className="bg-[#17b4c9] hover:bg-[#149cb0] active:bg-[#0f8b9c] text-center w-full py-3 font-semibold text-white rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default SignIn;
