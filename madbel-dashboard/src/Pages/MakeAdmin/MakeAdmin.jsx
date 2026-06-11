import { useEffect, useState } from "react";
import { Form, Input, Select, message, Spin, Table, Tag } from "antd";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { ImageUp } from "lucide-react";
import { listAdmins, createAdmin } from "../../services/adminApi";

const MakeAdmin = () => {
  const [form] = Form.useForm();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch admin list
  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await listAdmins();
      const adminList = res?.data || res || [];
      setAdmins(adminList);
    } catch (error) {
      console.error("Failed to load admins:", error);
      message.error("Failed to fetch administrators list");
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleSubmit = async (values) => {
    if (values.password !== values.confirmPassword) {
      message.error("Password and confirm password do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await createAdmin({
        full_name: values.fullName,
        email: values.email,
        password: values.password,
        role: values.role || "admin",
      });
      message.success("New administrator created successfully.");
      form.resetFields();
      setPreviewImage("");
      fetchAdmins();
    } catch (error) {
      console.error("Failed to create admin:", error);
      const msg = error?.payload?.message || error?.message || "Failed to create administrator";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreviewImage(objectUrl);
    event.target.value = "";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateString;
    }
  };

  // Columns for admins table
  const columns = [
    {
      title: "Name",
      dataIndex: "full_name",
      key: "full_name",
      render: (text) => <span className="font-semibold text-slate-800 text-lg">{text}</span>,
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (text) => <span className="text-slate-600 text-lg">{text}</span>,
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role) => (
        <Tag color={role === "super_admin" ? "purple" : "cyan"} className="text-sm px-3 py-1 font-medium capitalize">
          {role?.replace("_", " ")}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={status === "active" ? "green" : "red"} className="text-sm px-3 py-1 font-medium capitalize">
          {status || "Active"}
        </Tag>
      ),
    },
    {
      title: "Created At",
      dataIndex: "created_at",
      key: "created_at",
      render: (val) => <span className="text-slate-500 text-lg">{formatDate(val)}</span>,
    },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Create Admin Form Card */}
      <div className="overflow-hidden bg-white border rounded-2xl border-slate-100 shadow-sm">
        <div className="px-6 py-4 bg-[#17b4c9]">
          <h1 className="text-4xl font-semibold text-white">Create Admin</h1>
        </div>

        <div className="p-6 md:p-8">
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Form.Item
                name="fullName"
                label={<span className="text-2xl font-medium text-slate-700">Name</span>}
                rules={[{ required: true, message: "Please enter name" }]}
              >
                <Input
                  placeholder="john doe"
                  className="h-14 rounded-xl border-slate-300 text-xl"
                />
              </Form.Item>

              <Form.Item
                name="email"
                label={<span className="text-2xl font-medium text-slate-700">Email</span>}
                rules={[
                  { required: true, message: "Please enter email" },
                  { type: "email", message: "Please enter valid email" },
                ]}
              >
                <Input
                  placeholder="abc@gmail.com"
                  className="h-14 rounded-xl border-slate-300 text-xl"
                />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Form.Item
                name="password"
                label={
                  <span className="text-2xl font-medium text-slate-700">
                    Password
                  </span>
                }
                rules={[
                  { required: true, message: "Please enter password" },
                  { min: 6, message: "Password must be at least 6 characters" },
                ]}
              >
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    className="h-14 rounded-xl border-slate-300 pr-12 text-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                  >
                    {showPassword ? <FaRegEyeSlash /> : <FaRegEye />}
                  </button>
                </div>
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label={
                  <span className="text-2xl font-medium text-slate-700">
                    Confirm Password
                  </span>
                }
                rules={[
                  { required: true, message: "Please confirm password" },
                  { min: 6, message: "Password must be at least 6 characters" },
                ]}
              >
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="********"
                    className="h-14 rounded-xl border-slate-300 pr-12 text-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                  >
                    {showConfirmPassword ? <FaRegEyeSlash /> : <FaRegEye />}
                  </button>
                </div>
              </Form.Item>

              <Form.Item
                name="role"
                label={<span className="text-2xl font-medium text-slate-700">Role</span>}
                initialValue="admin"
                rules={[{ required: true, message: "Please select a role" }]}
              >
                <Select className="h-14 rounded-xl border-slate-300 text-xl font-normal admin-role-select">
                  <Select.Option value="admin">Admin</Select.Option>
                  <Select.Option value="super_admin">Super Admin</Select.Option>
                </Select>
              </Form.Item>
            </div>

            <div className="mb-2 text-2xl font-medium text-slate-700">Profile Image</div>

            <label
              htmlFor="admin-profile-image"
              className="group flex min-h-48 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6"
            >
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="New admin preview"
                  className="h-40 w-40 rounded-xl object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <ImageUp className="h-10 w-10" />
                  <p className="text-2xl">Upload Image</p>
                </div>
              )}
            </label>
            <input
              id="admin-profile-image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />

            <div className="mt-8 flex justify-center">
              <button
                type="submit"
                disabled={submitting}
                className={`w-full max-w-[760px] rounded-xl bg-[#17b4c9] px-8 py-4 text-3xl font-semibold text-white transition-colors hover:bg-[#10a3b7] ${
                  submitting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {submitting ? "Creating..." : "Create Admin"}
              </button>
            </div>
          </Form>
        </div>
      </div>

      {/* Admin List Card */}
      <div className="overflow-hidden bg-white border rounded-2xl border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-slate-800">Administrators List</h2>
          {loadingAdmins && <Spin size="small" />}
        </div>
        <div className="p-6">
          <Table
            columns={columns}
            dataSource={admins}
            rowKey="id"
            loading={loadingAdmins}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            className="border border-slate-100 rounded-xl overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default MakeAdmin;
