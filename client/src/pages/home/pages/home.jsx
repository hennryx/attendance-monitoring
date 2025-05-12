import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowForwardCircle } from "react-icons/io5";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="relative isolate bg-[#1b1b1b] px-6 pt-14 lg:px-16 h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ffffff] to-[#eceaff] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

      <div className="max-w-4xl pt-28 sm:pt-36 lg:pt-40 relative z-10">
        <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight text-shadow-base-300">
          MANAGE EMPLOYEE ATTENDANCE WITH EASE USING OUR
          <span className="text-[#FDBE02]"> ATTENDANCE MONITORING SYSTEM</span>
        </h1>
        <p className="mt-6 w-full sm:w-2/3 text-base sm:text-lg text-white font-medium leading-relaxed">
          Out System is designed to be user-freindly and intuitive, so you can
          get started right away without any special training or technical
          knowledge
        </p>
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => navigate("/attendance")}
            className="px-5 py-2 border-2 border-[#FDBE02] relative rounded-full shadow flex"
          >
            <span className="mr-8 text-white">Get attendance</span>
            <span className="absolute top-0 right-0 bottom-0">
              <IoArrowForwardCircle size={40} className="text-[#FDBE02]" />
            </span>
          </button>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-100 -right-500 -z-10 transform-gpu overflow-hidden blur-3xl sm:-bottom-80"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ffffff] to-[#eceaff] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>
    </div>
  );
};

export default Home;
