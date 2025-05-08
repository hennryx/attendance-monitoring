import React, { useState } from "react";
import { Route, Routes as Switch } from "react-router-dom";

import Login from "./login";

import Home from "./pages/home";
import Header from "./header";
import Footer from "../../components/footer";
import AboutUs from "../home/pages/about-us";
import NotFound from "../notFound";

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
        <div className="my-16 w-full h-full">
          <Switch>
            <Route path="/" element={<Home />} />
            <Route path="/about-us" Component={AboutUs}></Route>
            <Route path="/*" Component={NotFound}></Route>
          </Switch>
        </div>

        <Login
          isOpen={toggle.login}
          handleClose={() => handleToggle("login", false)}
          handleToggle={handleToggle}
        />
      </div>
      <Footer className="bg-gray-200 shadow-md border-t-2 text-black" />
    </main>
  );
};

export default HeroPage;
