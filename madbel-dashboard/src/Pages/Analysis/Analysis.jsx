import React from "react";
import { useParams, Link } from "react-router-dom";
import { FaArrowLeftLong } from "react-icons/fa6";

const Analysis = () => {
  const { id } = useParams();  // Grab id from URL
  // Here you would typically fetch data using this id from your API or state

  // For demonstration purposes, I'll use dummy data
  const sneakerData = {
    id,
    name: "Basketball Sneakers",
    brand: "Nike",
    code: "#8566 664",
    aiReview: "Authentic",
    confidenceScore: "80%",
    images: [
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/c576e5afc4db4e3e81ba2df74cd064bd_9366/Anthony_Edwards_1_Low_Shoes_Grey_JS1775_01_00_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/c576e5afc4db4e3e81ba2df74cd064bd_9366/Anthony_Edwards_1_Low_Shoes_Grey_JS1775_01_00_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/c576e5afc4db4e3e81ba2df74cd064bd_9366/Anthony_Edwards_1_Low_Shoes_Grey_JS1775_01_00_standard.jpg",
    ]
  };

  return (
    <div className="min-h-screen px-6 py-8 mt-16 text-black">
      <Link to="/" className="flex items-center text-white gap-x-3">
        <FaArrowLeftLong size={20} />
        <h1 className="text-2xl font-semibold ">Analysis</h1>
      </Link>
      {/* Images */}
      <div className="flex justify-between w-full mt-5 mb-10">
        {sneakerData.images.map((src, index) => (
          <div key={index} className="overflow-hidden border-2 rounded-lg border-lime-500">
            <img
              src={src}
              alt={`Sneaker ${index + 1}`}
              className="object-cover  h-[350px]"
            />
          </div>
        ))}
      </div>

      {/* Info Table */}
      <div className="mb-8 space-y-3">
        <div className="p-3 bg-gray-900 rounded-md">
          <span className="font-bold">Name</span>: {sneakerData.name}
        </div>
        <div className="p-3 bg-gray-900 rounded-md">
          <span className="font-bold">Brand</span>: {sneakerData.brand}
        </div>
        <div className="p-3 bg-gray-900 rounded-md">
          <span className="font-bold">Code</span>: {sneakerData.code}
        </div>
        <div className="p-3 bg-gray-900 rounded-md">
          <span className="font-bold">AI Review</span>: {sneakerData.aiReview}
        </div>
        <div className="p-3 bg-gray-900 rounded-md">
          <span className="font-bold">Confidence Score</span>: {sneakerData.confidenceScore}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-6">
        <button className="px-6 py-2 text-red-500 transition bg-transparent border border-red-500 rounded hover:bg-red-500 hover:text-white">
          Decline
        </button>
        <button className="px-6 py-2 text-black transition rounded bg-lime-500 hover:bg-lime-600">
          <Link to="/analysis-page">Approve</Link>
        </button>
      </div>
    </div>
  );
};

export default Analysis;
