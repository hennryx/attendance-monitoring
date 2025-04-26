import React from 'react';

const Home = ({ handleToggle = () => { } }) => {
  return (
    <div className="relative bg-[#f3f6fd] px-6 pt-14 lg:px-16 h-screen overflow-hidden">

      <div className="max-w-4xl pt-28 sm:pt-36 lg:pt-40 relative z-10">
        <h1 className="text-4xl sm:text-6xl font-bold text-green-800 leading-tight text-shadow-base-300">
          ATTENDANCE <br /> MONITORING SYSTEM
        </h1>
        <p className="mt-6 w-full sm:w-2/3 text-base sm:text-lg text-black font-medium leading-relaxed">
          Lorem Ipsum is simply dummy text of the printing and typesetting industry.
          Lorem Ipsum has been the industry's standard dummy text ever since the 1500s,
          when an unknown printer took a galley of type and scrambled it to make a type specimen book.
        </p>
        <div className="mt-8">
          <button
            onClick={() => handleToggle("login", true)}
            className="px-5 py-3 bg-indigo-600 text-white rounded-md shadow hover:bg-indigo-700 transition"
          >
            Get started
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
