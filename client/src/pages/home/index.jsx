import React, { useState } from "react";
import { Route, Routes as Switch } from "react-router-dom";

import Login from "./login";
import Home from "./pages/home";
import Header from "./header";
import Footer from "../../components/footer";
import AboutUs from "../home/pages/about-us";
import Fingerprint from "./pages/fingerPrint";
import NotFound from "../notFound";
import Services from "./pages/services";

const HeroPage = () => {
  const [toggle, setToggle] = useState({
    login: false,
    register: false,
    home: true,
  });

  const handleToggle = (name, val = false) => {
    setToggle({
      login: false,
      register: false,
      home: val ? val : true,
      [name]: val,
    });
  };

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1" style={{ backgroundColor: "#f3f6fd" }}>
        <Header handleToggle={handleToggle} />
        <div className="w-full h-full">
          <Switch>
            <Route path="/" element={<Home />} />
            <Route path="/about-us" Component={AboutUs} />
            <Route path="/services" Component={Services} />
            <Route path="/fingerprint" Component={Fingerprint} />
            <Route path="/*" Component={NotFound} />
          </Switch>
        </div>

        <Login
          isOpen={toggle.login}
          handleClose={() => handleToggle("login", false)}
          handleToggle={handleToggle}
        />
      </div>
      <Footer className="bg-[#1b1b1b] shadow-md text-white" />
    </main>
  );
};

export default HeroPage;
