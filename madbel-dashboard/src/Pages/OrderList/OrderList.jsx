import React, { useState } from "react";
import {
  Table,
  Input,
  Pagination,
  Modal,
  Button,
  Popconfirm,
  Dropdown,
  Menu,
  Select,
  Row,
  Col,
  Divider,
} from "antd";
import { EyeOutlined, EditOutlined } from "@ant-design/icons";
import { AllImages } from "../../assets/image/AllImages";

const { Search } = Input;

const OrderList = () => {
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orders, setOrders] = useState([
    {
      id: "00001",
      name: "Christine Brooks",
      address: "089 Kutch Green Apt. 448",
      date: "04 Sep 2019",
      type: "Electric",
      status: "Ordered",
      items: [
        { image: AllImages.book, name: "Allah Made All of Me", price: 120 },
      ],
    },
    {
      id: "00002",
      name: "Rosie Pearson",
      address: "979 Immanuel Ferry Suite 526",
      date: "28 May 2019",
      type: "Book",
      status: "Ongoing",
      items: [{ image: AllImages.book, name: "React JS Book", price: 30 }],
    },
    {
      id: "00003",
      name: "Darrell Caldwell",
      address: "8587 Frida Ports",
      date: "23 Nov 2019",
      type: "Medicine",
      status: "Delivered",
      items: [{ image: AllImages.book, name: "Painkiller", price: 15 }],
    },
    // Add more orders as necessary
  ]);

  const pageSize = 5;

  const getStatusColor = (status) => {
    switch (status) {
      case "Ordered":
        return "gold"; // Yellow
      case "Ongoing":
        return "blue"; // Blue
      case "Delivered":
        return "green"; // Green
      default:
        return "gray";
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", key: "id", responsive: ["sm"] },
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
      responsive: ["md"],
    },
    { title: "Date", dataIndex: "date", key: "date", responsive: ["sm"] },
    { title: "Type", dataIndex: "type", key: "type" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <span style={{ color: getStatusColor(status), fontWeight: "bold" }}>
          {status}
        </span>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (text, record) => (
        <div className="flex items-center gap-4">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => showOrderDetails(record)}
          />
          <Dropdown
            overlay={
              <Menu onClick={(e) => updateOrderStatus(record, e.key)}>
                <Menu.Item key="Ordered">Ordered</Menu.Item>
                <Menu.Item key="Ongoing">Ongoing</Menu.Item>
                <Menu.Item key="Delivered">Delivered</Menu.Item>
              </Menu>
            }
            trigger={["click"]}
          >
            <Button type="link" icon={<EditOutlined />} />
          </Dropdown>
        </div>
      ),
    },
  ];

  const filteredData = orders.filter((item) =>
    Object.values(item).some((value) =>
      value.toString().toLowerCase().includes(searchText.toLowerCase())
    )
  );

  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const showOrderDetails = (order) => {
    setCurrentOrder(order);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const updateOrderStatus = (order, newStatus) => {
    setOrders(
      orders.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o))
    );
  };

  const modalContent = currentOrder ? (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <p>
            <strong>Order ID:</strong> {currentOrder.id}
          </p>
          <p>
            <strong>Order Date:</strong> {currentOrder.date}
          </p>
        </Col>
        <Col span={12}>
          <p>
            <strong>Status:</strong>{" "}
            <span
              style={{
                color: getStatusColor(currentOrder.status),
                fontWeight: "bold",
              }}
            >
              {currentOrder.status}
            </span>
          </p>
          <p>
            <strong>Product Type:</strong> {currentOrder.type}
          </p>
        </Col>
      </Row>
      <Divider />
      <Row gutter={16}>
        <Col span={12}>
          <p>
            <strong>Name:</strong> {currentOrder.name}
          </p>
          <p>
            <strong>Email:</strong> customer@example.com
          </p>
          <p>
            <strong>Phone:</strong> +1234567890
          </p>
        </Col>
        <Col span={12}>
          <p>
            <strong>Address:</strong> {currentOrder.address}
          </p>
        </Col>
      </Row>
      <Divider />
      <p>
        <strong>Items:</strong>
      </p>
      <ul>
        {currentOrder.items.map((item, index) => (
          <li key={index} className="flex items-center mb-2">
            <img
              src={AllImages.book}
              alt={item.name}
              className="w-12 h-12 mr-4"
            />
            <span>
              {item.name} - ${item.price}
            </span>
          </li>
        ))}
      </ul>
      <p>
        <strong>Total Price:</strong> $
        {currentOrder.items.reduce((sum, item) => sum + item.price, 0)}
      </p>
    </div>
  ) : null;

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Orders</h2>
        <Search
          placeholder="Search orders..."
          onChange={(e) => setSearchText(e.target.value)}
          className="w-72"
          allowClear
        />
      </div>
      <div className="bg-white p-5 rounded shadow-md">
        <Table
          columns={columns}
          dataSource={paginatedData}
          pagination={false}
          rowKey="id"
          scroll={{ x: "max-content" }}
        />
        <div className="flex justify-center mt-4">
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={filteredData.length}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
          />
        </div>
      </div>

      {/* Modal to show the order details */}
      <Modal
        title="Order Details"
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="close" onClick={handleCancel}>
            Close
          </Button>,
        ]}
        className="order-modal"
      >
        {modalContent}
      </Modal>
    </div>
  );
};

export default OrderList;
