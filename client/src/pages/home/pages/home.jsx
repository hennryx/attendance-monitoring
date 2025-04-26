import React from 'react';

import drinks from "../../../assets/drinks.png";
import can1 from "../../../assets/can1.png"; // RC
import can2 from "../../../assets/can2.png"; // 7Up
import can3 from "../../../assets/can3.png"; // Lemon
import can4 from "../../../assets/can4.png"; // Coke
import can5 from "../../../assets/can5.png"; // Mountain Dew
import leaf1 from "../../../assets/leaf1.png"; // Big leaf
import leaf2 from "../../../assets/leaf2.png"; // Small leaf

const Home = ({ handleToggle = () => { } }) => {
  return (
    <div className="relative bg-[#f3f6fd] px-6 pt-14 lg:px-16 h-screen overflow-hidden">
      <img src={can1} alt="RC" className="absolute top-[80px] left-[460px] w-25" />
      <img src={can2} alt="7Up" className="absolute top-[150px] left-[660px] w-30" />
      <img src={can3} alt="Lemon" className="absolute top-[80px] left-[660px] w-16" />
      <img src={can4} alt="Coke" className="absolute bottom-[200px] left-[320px] w-20" />
      <img src={can5} alt="Mountain Dew" className="absolute bottom-[100px] left-[100px] w-25" />

      <img src={leaf1} alt="Big leaf" className="absolute top-[150px] left-[300px] w-28" />
      <img src={leaf2} alt="Small leaf" className="absolute bottom-[100px] left-[520px] w-25" />

      <img src={drinks} alt="drinks" className="absolute bottom-0 right-0 w-[500px] max-w-[50vw]" />

      <div className="max-w-4xl pt-28 sm:pt-36 lg:pt-40 relative z-10">
        <h1 className="text-4xl sm:text-6xl font-bold text-red-500 leading-tight">
          INVENTORY <br /> MANAGEMENT SYSTEM
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
