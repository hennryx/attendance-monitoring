import React, { useEffect, useState } from "react";
import Table from "./table";
import Modal from "./modal";
import useAuthStore from "../../../../services/stores/authStore";
import useUsersStore from "../../../../services/stores/users/usersStore";
import Swal from "sweetalert2";

const info = {
  firstname: "",
  middlename: "",
  lastname: "",
  email: "",
  password: "",
  department: "",
  position: "",
  role: "STAFF",
};

const AddNewUser = () => {
  const { token } = useAuthStore();
  const { getUsers, data, user, reset, message, isSuccess } = useUsersStore();
  const [toggleAdd, setToggleAdd] = useState(false);
  const [usersData, setUsersData] = useState([]);
  const [isUpdate, setIsUpdate] = useState(false);
  const [newUser, setNewUser] = useState(info);

  useEffect(() => {
    if (token) {
      getUsers(token);
    }
  }, [token]);

  useEffect(() => {
    if (data) {
      setUsersData(data);
    }
  }, [data]);

  const handleUpdate = (user) => {
    setToggleAdd(true);
    setNewUser(user);
    setIsUpdate(true);
    console.log(user);
  };

  useEffect(() => {
    if (isSuccess && message) {
      setToggleAdd(false);

      setNewUser(info);

      console.log(user);

      if (Object.keys(user).length > 0 && isUpdate) {
        const updatedUsers = usersData.map((u) =>
          u._id === user._id ? user : u
        );
        setUsersData(updatedUsers);
        setIsUpdate(false);
      } else if (Object.keys(user).length > 0) {
        setUsersData((prev) => {
          const exists = prev.some((u) => u._id === user._id);

          if (exists) {
            return prev.filter((u) => u._id !== user._id);
          } else {
            return [...prev, user];
          }
        });
      }

      reset();
      Swal.fire({
        title: "Saved!",
        text: message,
        icon: "success",
      });
    } else if (message) {
      reset();
      Swal.fire({
        title: "Error!",
        text: message,
        icon: "error",
      });
    }
  }, [isSuccess, message, user]);

  return (
    <div className="relative isolate min-h-lvh overflow-hidden bg-[linear-gradient(to_bottom,#1b1b1b_25%,#FAFAFA_25%)]">
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

      <div className="container mx-auto p-4">
        <div className="flex flex-col gap-5 pt-4">
          <div className="">
            <h2 className="text-3xl font-semibold text-white">
              Add New Member
            </h2>
            <p className="text-sm text-[#989797]">
              {toggleAdd && "Add New Member"}
            </p>
          </div>
          <div>
            <Table
              data={usersData}
              toggleAdd={setToggleAdd}
              handleUpdate={handleUpdate}
            />
          </div>
        </div>
      </div>
      <Modal
        isOpen={toggleAdd}
        setIsOpen={setToggleAdd}
        setUserData={setNewUser}
        userData={newUser}
        isUpdate={isUpdate}
        setIsUpdate={setIsUpdate}
        initialData={info}
      />
    </div>
  );
};

export default AddNewUser;
