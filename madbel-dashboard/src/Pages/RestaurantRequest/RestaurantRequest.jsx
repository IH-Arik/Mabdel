import React from "react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { Link } from "react-router-dom";

const RestaurantRequest = () => {
  const requests = [
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
    {
      id: "#12333",
      name: "dindiniya",
      email: "bockelboy@att.com",
      contactNumber: "(201) 555-0124",
      location: "Kent, Utah",
    },
  ];

  return (
    <div className="min-h-screen px-6 py-8 mt-16 ml-20 ">
      <div>
        <Link to={"/"} className="flex items-center text-[#555555] gap-x-3">
          <FaArrowLeftLong size={20} />
          <h1 className="text-2xl font-semibold ">Restaurant Request</h1>
        </Link>
      </div>
      <table className="min-w-full bg-white">
        <thead>
          <tr className="border-b">
            <th className="px-6 py-3 text-sm font-medium text-left">
              S no.
            </th>
            <th className="px-6 py-3 text-sm font-medium text-left">
              Restaurant Name
            </th>
            <th className="px-6 py-3 text-sm font-medium text-left">
              Email
            </th>
            <th className="px-6 py-3 text-sm font-medium text-left">
              Contact Number
            </th>
            <th className="px-6 py-3 text-sm font-medium text-left">
              Location
            </th>
            <th className="px-6 py-3 text-sm font-medium text-left">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request, index) => (
            <tr key={index} className="border-b">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                {request.id}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {request.name}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {request.email}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {request.contactNumber}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {request.location}
              </td>
              <td className="flex gap-2 px-6 py-4 text-sm text-gray-500">
                <button className="px-4 py-2 text-white bg-green-500 rounded-full">
                  Approve
                </button>
                <button className="px-4 py-2 text-white bg-red-500 rounded-full">
                  Cancel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RestaurantRequest;
