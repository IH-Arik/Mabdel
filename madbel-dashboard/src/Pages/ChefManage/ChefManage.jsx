"use client";

import { useState } from "react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { Link } from "react-router-dom";

const ChefManage = () => {
  const [activeFilter, setActiveFilter] = useState("verified");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; 

  const chefs = [
       {
      id: "#12342",
      name: "tomanderson",
      experience: "6 years Ex.",
      rating: 4.5,
      totalRestaurants: "08",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12343",
      name: "jennifertaylor",
      experience: "2 years Ex.",
      rating: 4.3,
      totalRestaurants: "03",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: false,
    },
    {
      id: "#12344",
      name: "robertmiller",
      experience: "4 years Ex.",
      rating: 4.8,
      totalRestaurants: "06",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12333",
      name: "dindiniya",
      experience: "2 years Ex.",
      rating: 4.5,
      totalRestaurants: "02",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12334",
      name: "johnsmith",
      experience: "3 years Ex.",
      rating: 4.2,
      totalRestaurants: "05",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12335",
      name: "maryjane",
      experience: "1 year Ex.",
      rating: 4.8,
      totalRestaurants: "01",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: false,
    },
    {
      id: "#12336",
      name: "alexbrown",
      experience: "4 years Ex.",
      rating: 4.3,
      totalRestaurants: "03",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12337",
      name: "sarahwilson",
      experience: "2 years Ex.",
      rating: 4.6,
      totalRestaurants: "02",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: false,
    },
    {
      id: "#12338",
      name: "mikejohnson",
      experience: "5 years Ex.",
      rating: 4.9,
      totalRestaurants: "07",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12339",
      name: "emilydavis",
      experience: "2 years Ex.",
      rating: 4.4,
      totalRestaurants: "04",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12340",
      name: "davidlee",
      experience: "3 years Ex.",
      rating: 4.1,
      totalRestaurants: "02",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: false,
    },
    {
      id: "#12341",
      name: "lisagarcia",
      experience: "1 year Ex.",
      rating: 4.7,
      totalRestaurants: "01",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
       {
      id: "#12342",
      name: "tomanderson",
      experience: "6 years Ex.",
      rating: 4.5,
      totalRestaurants: "08",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12343",
      name: "jennifertaylor",
      experience: "2 years Ex.",
      rating: 4.3,
      totalRestaurants: "03",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: false,
    },
    {
      id: "#12344",
      name: "robertmiller",
      experience: "4 years Ex.",
      rating: 4.8,
      totalRestaurants: "06",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
       {
      id: "#12342",
      name: "tomanderson",
      experience: "6 years Ex.",
      rating: 4.5,
      totalRestaurants: "08",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12343",
      name: "jennifertaylor",
      experience: "2 years Ex.",
      rating: 4.3,
      totalRestaurants: "03",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: false,
    },
    {
      id: "#12344",
      name: "robertmiller",
      experience: "4 years Ex.",
      rating: 4.8,
      totalRestaurants: "06",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
       {
      id: "#12342",
      name: "tomanderson",
      experience: "6 years Ex.",
      rating: 4.5,
      totalRestaurants: "08",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12343",
      name: "jennifertaylor",
      experience: "2 years Ex.",
      rating: 4.3,
      totalRestaurants: "03",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: false,
    },
    {
      id: "#12344",
      name: "robertmiller",
      experience: "4 years Ex.",
      rating: 4.8,
      totalRestaurants: "06",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12342",
      name: "tomanderson",
      experience: "6 years Ex.",
      rating: 4.5,
      totalRestaurants: "08",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
    {
      id: "#12343",
      name: "jennifertaylor",
      experience: "2 years Ex.",
      rating: 4.3,
      totalRestaurants: "03",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: false,
    },
    {
      id: "#12344",
      name: "robertmiller",
      experience: "4 years Ex.",
      rating: 4.8,
      totalRestaurants: "06",
      avatar: "/placeholder.svg?height=40&width=40",
      verified: true,
    },
  ];

  const handleBack = () => {
    alert("Navigating back");
  };

  const handleViewDetails = (chefId) => {
    alert(`Viewing details for chef ${chefId}`);
  };

  const filteredChefs = chefs.filter((chef) => {
    if (activeFilter === "verified") return chef.verified;
    if (activeFilter === "unverified") return !chef.verified;
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredChefs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentChefs = filteredChefs.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-gray-700">{rating}</span>
        <svg
          className="w-4 h-4 text-yellow-400 fill-current"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </div>
    );
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-3 text-sm font-medium rounded-full transition-colors ${
            currentPage === i
              ? "bg-green-500 text-white"
              : "text-gray-700 hover:bg-gray-100 border border-gray-300"
          }`}
        >
          {i}
        </button>
      );
    }

    return pages;
  };

  return (
    <div className="min-h-screen p-6 mt-16 ml-20 bg-gray-50">
      <div className="min-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to={"/"} className="flex items-center text-[#555555] gap-x-3">
              <FaArrowLeftLong size={20} />
              <h1 className="text-2xl font-semibold ">Chef Manage</h1>
            </Link>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleFilterChange("verified")}
              className={`px-4 py-3 rounded-full text-sm font-medium transition-colors ${
                activeFilter === "verified"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Verified Chef
            </button>
            <button
              onClick={() => handleFilterChange("unverified")}
              className={`px-4 py-3 rounded-full text-sm font-medium transition-colors ${
                activeFilter === "unverified"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Unverified Chef
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-sm font-medium text-left text-gray-700">
                    S no.
                  </th>
                  <th className="px-6 py-3 text-sm font-medium text-left text-gray-700">
                    Chef Name
                  </th>
                  <th className="px-6 py-3 text-sm font-medium text-left text-gray-700">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-sm font-medium text-left text-gray-700">
                    Total Restaurant
                  </th>
                  <th className="px-6 py-3 text-sm font-medium text-left text-gray-700">
                    View Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentChefs.map((chef, index) => (
                  <tr
                    key={index}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {chef.id}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={chef.avatar || "/placeholder.svg"}
                          alt={chef.name}
                          className="object-cover w-10 h-10 rounded-full"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {chef.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {chef.experience}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">{renderStars(chef.rating)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {chef.totalRestaurants}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleViewDetails(chef.id)}
                        className="text-gray-400 transition-colors hover:text-gray-600"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-6 px-6 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, filteredChefs.length)} of{" "}
                {filteredChefs.length} results
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Previous Button */}
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className={`px-3 py-3 text-sm font-medium rounded-md transition-colors ${
                  currentPage === 1
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-gray-700 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex gap-1 ">{renderPageNumbers()}</div>

              {/* Next Button */}
              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className={`px-3 py-3 text-sm font-medium rounded-md transition-colors ${
                  currentPage === totalPages
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-gray-700 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChefManage;
