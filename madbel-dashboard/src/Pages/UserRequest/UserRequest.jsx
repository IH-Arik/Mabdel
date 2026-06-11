import React, { useState } from "react";
import { EyeOutlined } from "@ant-design/icons";
import { IoIosArrowBack, IoIosArrowForward, IoIosCheckmarkCircle, IoMdClose } from "react-icons/io";
import { MdBlock } from "react-icons/md";
// import userImage from "../../assets/image/admin.jpg";
// import nid from "../../assets/image/NID.png";


function UserRequest() {
  // Generate more sample data
  const initialUsers = [
    {
      id: "#01",
      name: "Alice Johnson",
      email: "alice.johnson@example.com",
      date: "05 Jan 2024",
      accType: "User",
    },
    {
      id: "#02",
      name: "Michael Smith",
      email: "michael.smith@example.com",
      date: "12 Feb 2024",
      accType: "Driver",
    },
    {
      id: "#03",
      name: "Emma Williams",
      email: "emma.williams@example.com",
      date: "23 Mar 2024",
      accType: "User",
    },
    {
      id: "#04",
      name: "Daniel Brown",
      email: "daniel.brown@example.com",
      date: "17 Apr 2024",
      accType: "Driver",
    },
    {
      id: "#05",
      name: "Olivia Davis",
      email: "olivia.davis@example.com",
      date: "08 May 2024",
      accType: "User",
    },
    {
      id: "#06",
      name: "Liam Miller",
      email: "liam.miller@example.com",
      date: "29 May 2024",
      accType: "User",
    },
    {
      id: "#07",
      name: "Sophia Wilson",
      email: "sophia.wilson@example.com",
      date: "14 Jun 2024",
      accType: "Driver",
    },
    {
      id: "#08",
      name: "Noah Moore",
      email: "noah.moore@example.com",
      date: "27 Jun 2024",
      accType: "User",
    },
    {
      id: "#09",
      name: "Isabella Taylor",
      email: "isabella.taylor@example.com",
      date: "09 Jul 2024",
      accType: "User",
    },
    {
      id: "#10",
      name: "James Anderson",
      email: "james.anderson@example.com",
      date: "21 Jul 2024",
      accType: "Driver",
    },
    {
      id: "#11",
      name: "Mia Thomas",
      email: "mia.thomas@example.com",
      date: "02 Aug 2024",
      accType: "User",
    },
    {
      id: "#12",
      name: "Benjamin Jackson",
      email: "benjamin.jackson@example.com",
      date: "15 Aug 2024",
      accType: "User",
    },
    {
      id: "#13",
      name: "Charlotte White",
      email: "charlotte.white@example.com",
      date: "28 Aug 2024",
      accType: "Driver",
    },
    {
      id: "#14",
      name: "Lucas Harris",
      email: "lucas.harris@example.com",
      date: "09 Sep 2024",
      accType: "User",
    },
    {
      id: "#15",
      name: "Amelia Martin",
      email: "amelia.martin@example.com",
      date: "20 Sep 2024",
      accType: "User",
    },
    {
      id: "#16",
      name: "Elijah Thompson",
      email: "elijah.thompson@example.com",
      date: "01 Oct 2024",
      accType: "Driver",
    },
    {
      id: "#17",
      name: "Harper Garcia",
      email: "harper.garcia@example.com",
      date: "12 Oct 2024",
      accType: "User",
    },
    {
      id: "#18",
      name: "William Martinez",
      email: "william.martinez@example.com",
      date: "24 Oct 2024",
      accType: "Driver",
    },
    {
      id: "#19",
      name: "Evelyn Robinson",
      email: "evelyn.robinson@example.com",
      date: "04 Nov 2024",
      accType: "User",
    },
    {
      id: "#20",
      name: "Henry Clark",
      email: "henry.clark@example.com",
      date: "16 Nov 2024",
      accType: "Driver",
    },
    {
      id: "#21",
      name: "Abigail Rodriguez",
      email: "abigail.rodriguez@example.com",
      date: "28 Nov 2024",
      accType: "User",
    },
    {
      id: "#22",
      name: "Sebastian Lewis",
      email: "sebastian.lewis@example.com",
      date: "09 Dec 2024",
      accType: "Driver",
    },
    {
      id: "#23",
      name: "Ella Lee",
      email: "ella.lee@example.com",
      date: "20 Dec 2024",
      accType: "User",
    },
    {
      id: "#24",
      name: "Alexander Walker",
      email: "alexander.walker@example.com",
      date: "31 Dec 2024",
      accType: "User",
    },
    {
      id: "#25",
      name: "Avery Hall",
      email: "avery.hall@example.com",
      date: "11 Jan 2025",
      accType: "Driver",
    },
    {
      id: "#26",
      name: "Jack Allen",
      email: "jack.allen@example.com",
      date: "22 Jan 2025",
      accType: "User",
    },
    {
      id: "#27",
      name: "Scarlett Young",
      email: "scarlett.young@example.com",
      date: "02 Feb 2025",
      accType: "User",
    },
    {
      id: "#28",
      name: "Levi Hernandez",
      email: "levi.hernandez@example.com",
      date: "14 Feb 2025",
      accType: "Driver",
    },
    {
      id: "#29",
      name: "Grace King",
      email: "grace.king@example.com",
      date: "25 Feb 2025",
      accType: "User",
    },
    {
      id: "#30",
      name: "Matthew Wright",
      email: "matthew.wright@example.com",
      date: "09 Mar 2025",
      accType: "User",
    },
  ];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalAccept, setIsModalAccept] = useState(false);
  const [isModalBlock, setIsModalBlock] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); // state to hold the selected user for modal
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredUsers, setFilteredUsers] = useState(initialUsers);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 14;

  // for user search functionality
  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.trim() === "") {
      setFilteredUsers(initialUsers);
    } else {
      const filtered = initialUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(term.toLowerCase()) ||
          user.email.toLowerCase().includes(term.toLowerCase()) ||
          user.accType.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
    setCurrentPage(1);
  };

  // for pagination functionality
  const indexOfLastUser = currentPage * pageSize;
  const indexOfFirstUser = indexOfLastUser - pageSize;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);

  const onPageChange = (page) => {
    setCurrentPage(page);
  };

  const handleViewUser = (user) => {
    setSelectedUser(user); // set the clicked user
    setIsModalOpen(true);
  };

  const handleBlockUser = (user) => {
    setSelectedUser(user); // set the clicked user
    setIsModalBlock(true);
  };

  const handleAcceptUser = (user) => {
    setSelectedUser(user); // set the clicked user
    setIsModalAccept(true);
  };

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  return (
    <>
      <div className="h-[calc(100vh-80px)] bg-[#E0F2F7] mt-16">
        {/* Header with search */}
        <div className="bg-[#4BADC9] p-4 flex justify-end">
          <div className="w-72">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full px-4 py-2 rounded-md"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto bg-[#4BADC9]">
          <table className="w-full">
            <thead>
              <tr className="bg-[#E0F2F7] text-gray-700">
                <th className="px-4 py-3 text-left">Serial</th>
                <th className="px-4 py-3 text-left">Users</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Acc Type</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((user, index) => (
                <tr key={index} className="bg-[#4BADC9] ">
                  <td className="px-4 my-3 text-white">{user.id}</td>
                 
                  <td className="px-4 my-3 overflow-hidden text-white w-11 h-11">
                    <img className="rounded-full w-11 h-11" src={userImage} alt="user" />
                  </td>
                  <td className="px-4 my-3 text-white">{user.name}</td>
                  <td className="px-4 my-3 text-white">{user.email}</td>
                  <td className="px-4 my-3 text-white">{user.date}</td>
                  <td className="px-4 my-3 text-white">{user.accType}</td>
                  <td className="flex px-4 py-3 space-x-4">
                    {/* for details details user  */}
                    <button
                      onClick={() => handleViewUser(user)}
                      className="text-white hover:text-gray-200"
                    >
                      <EyeOutlined size={20} />
                    </button>
                    {/* for accept user  */}
                    <button
                      onClick={() => handleAcceptUser(user)}
                      className="text-green-400 hover:text-gray-200"
                    >
                      <IoIosCheckmarkCircle size={20}/>
                     
                    </button>
                    {/* for block user  */}
                    <button
                      onClick={() => handleBlockUser(user)}
                      className="text-red-500 hover:text-red-300"
                    >
                      <MdBlock size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-end py-4">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            className="px-3 py-1 mx-1 text-black rounded-full disabled:opacity-50"
            disabled={currentPage === 1}
          >
            <IoIosArrowBack size={20} />
          </button>
          {[...Array(totalPages)].map((_, index) => (
            <button
              key={index}
              onClick={() => onPageChange(index + 1)}
              className={`px-3 py-1 mx-1 rounded-full ${
                currentPage === index + 1
                  ? "text-red-500"
                  : "bg-transparent text-black"
              }`}
            >
              {index + 1}
            </button>
          ))}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            className="px-3 py-1 mx-1 text-black rounded-full disabled:opacity-50"
            disabled={currentPage === totalPages}
          >
            <IoIosArrowForward size={20} />
          </button>
        </div>
      </div>

      {/* ================= Modal for user  details ============= */}
      {isModalOpen && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md p-4 overflow-hidden bg-white rounded-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative">
              {/* Modal Close Button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute p-1 text-white rounded-full right-2 top-2 bg-white/10 hover:bg-white/20"
              >
                <IoMdClose />
              </button>

              {/* Modal Header */}
              <div className="bg-[#52B5D1] p-6 text-center rounded-md">
                <div className="w-24 h-24 mx-auto mb-4 overflow-hidden border-4 border-white rounded-full">
                  <img src={userImage} className="object-cover w-full h-full" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  {selectedUser.name}
                </h2>
              </div>

              {/* Modal  Content  */}
              <div className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between">
                    <div className="w-2/3">
                      <h3 className="font-bold text-black ">Email</h3>
                      <p className="text-gray-700">{selectedUser.email}</p>
                    </div>
                    <div className="w-1/3">
                      <h3 className="font-bold text-black">Account Type</h3>
                      <p className="text-gray-700">{selectedUser.accType}</p>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <div className="w-2/3">
                      <h3 className="font-bold text-black">Date Joined</h3>
                      <p className="text-gray-700">{selectedUser.date}</p>
                    </div>
                    <div className="w-1/3">
                      <h3 className="font-bold text-black">Location</h3>
                      <p className="text-gray-700">USA</p>{" "}
                      {/* You can customize */}
                    </div>
                  </div>
                </div>
                {/* Social Media Buttons */}
                <div className="mt-6">
                  <h3 className="mb-2 font-semibold text-black">
                  NID/Licence
                  </h3>
                  <div className="flex space-x-2">
                    <img src={nid} alt="" />
                    
     


                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= Modal for  Block Users ============= */}
      {isModalBlock && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsModalBlock(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden bg-white rounded-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative">
              {/* Modal Close Button */}
              <button
                onClick={() => setIsModalBlock(false)}
                this
                close
                not
                working
                className="absolute p-1 rounded-full right-2 top-2 bg-white/10 hover:bg-white/20"
              >
                <IoMdClose />
              </button>

              {/* Modal Header */}

              <div className="flex flex-col items-center justify-center py-12 space-y-4 px-11">
                <h2 className="text-xl font-bold text-[#39b4c0]">
                  Are You Sure You Want to Block?
                </h2>
                <p>Do you want to Block your Users profile ?</p>
                <button className="px-8 py-3 font-semibold text-white bg-red-500 rounded-md">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


        {/* ================= Modal for  Accept Users ============= */}
        {isModalAccept && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsModalAccept(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden bg-white rounded-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative">
              {/* Modal Close Button */}
              <button
                onClick={() => setIsModalAccept(false)}
                this
                close
                not
                working
                className="absolute p-1 rounded-full right-2 top-2 bg-white/10 hover:bg-white/20"
              >
                <IoMdClose />
              </button>

              {/* Modal Header */}

              <div className="flex flex-col items-center justify-center py-12 space-y-4 px-11">
                <h2 className="text-xl font-bold text-[#39b4c0]">
                  Are You Sure  ?
                </h2>
                <p>Do you want to Accept your Users profile ?</p>
                <button className="bg-[#52B5D1] py-3 px-8 rounded-md font-semibold text-white">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UserRequest;

