import React, { useState } from "react";
import { Form, Input, Button, message, Card } from "antd";
import { CloseOutlined } from "@ant-design/icons"; // Import Close Icon

const ContactUS = () => {
  const [email, setEmail] = useState(""); // Email state
  const [isEditing, setIsEditing] = useState(false); // Track if editing is enabled
  const [loading, setLoading] = useState(false); // Track loading state

  const handleSubmit = async (value) => {
    setLoading(true);
    // Simulate API call to update email
    setTimeout(() => {
      if (isEditing) {
        message.success("Email updated successfully");
      } else {
        message.success("Email added successfully");
      }
      setEmail(value.email); // Update email
      setLoading(false);
      setIsEditing(false); // Close the form after save
    }, 1000);
  };

  const handleCloseForm = () => {
    setIsEditing(false); // Close the form
  };

  return (
    <div className="container mx-auto max-w-4xl mt-10">
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-700">
            Contact Email Configuration
          </h2>
        </div>

        {/* Email Configuration Card */}
        <Card
          //   title="Email Configuration"
          className="mt-5 p-6 rounded-xl shadow-md border-2"
          style={{ backgroundColor: "#f9fafb" }}
        >
          <h3 className="font-semibold mb-4 text-gray-600">
            Admin Contact Email
          </h3>
          <p className="text-lg">{email || "No email configured yet!"}</p>
          <Button
            type="primary"
            onClick={() => setIsEditing(true)}
            className="mt-4"
            style={{
              backgroundColor: "#FF4D4F", // Primary color for button
              color: "white",
              borderRadius: "8px",
              padding: "8px 20px",
              fontWeight: "500",
            }}
          >
            {email ? "Edit Email" : "Add New Email"}
          </Button>
        </Card>

        {/* Form to Add or Edit Email */}
        {isEditing && (
          <div className="mt-8 relative">
            <CloseOutlined
              onClick={handleCloseForm}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                fontSize: "20px",
                color: "#FF4D4F",
                cursor: "pointer",
              }}
            />
            <Form
              name="contact-us"
              initialValues={{ email }}
              onFinish={handleSubmit}
              layout="vertical"
              className=" bg-white py-10 md:py-20 px-6 md:px-10 rounded-2xl border-2 shadow-xl"
            >
              <div className="mb-4 text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">
                  {email ? "Edit Email" : "Add New Email"}
                </h2>
              </div>

              <Form.Item
                name="email"
                label={
                  <p className="text-md font-semibold text-gray-700">Email :</p>
                }
                rules={[{ required: true, message: "Please input an email!" }]}
              >
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    borderColor: "#e2e8f0",
                    fontSize: "16px",
                    backgroundColor: "#f1f5f9",
                  }}
                  placeholder="Enter admin contact email"
                />
              </Form.Item>

              <Form.Item className="text-center mt-8">
                <Button
                  type="submit"
                  className="bg-[#52B5D1] w-full p-3 text-white font-semibold rounded-lg shadow-lg"
                  loading={loading}
                  style={{ backgroundColor: "#FF4D4F", color: "white" }}
                >
                  {loading ? "Saving..." : "Save"}
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactUS;
