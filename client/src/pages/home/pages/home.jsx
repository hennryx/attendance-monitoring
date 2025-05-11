import React from "react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="relative bg-[#f3f6fd] px-6 pt-14 lg:px-16 h-screen overflow-hidden">
      <div className="max-w-4xl pt-28 sm:pt-36 lg:pt-40 relative z-10">
        <h1 className="text-4xl sm:text-6xl font-bold text-green-800 leading-tight text-shadow-base-300">
          ATTENDANCE <br /> MONITORING SYSTEM
        </h1>
        <p className="mt-6 w-full sm:w-2/3 text-base sm:text-lg text-black font-medium leading-relaxed">
          Lorem Ipsum is simply dummy text of the printing and typesetting
          industry. Lorem Ipsum has been the industry's standard dummy text
          ever since the 1500s, when an unknown printer took a galley of type
          and scrambled it to make a type specimen book.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => navigate('/fingerprint')}
            className="px-5 py-3 border-2 border-green-400 text-green-400 rounded-md shadow hover:bg-indigo-700 transition"
          >
            Get attendance
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;