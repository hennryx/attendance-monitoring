import React, { useEffect, useState } from 'react'
import Table from './table'
import Modal from './modal';
import useAuthStore from '../../../../services/stores/authStore';
import useUsersStore from '../../../../services/stores/users/usersStore';
import Swal from 'sweetalert2';

const info = {
    firstname: "",
    middlename: "",
    lastname: "",
    email: "",
    password: "",
    role: "STAFF"
}

const AddNewUser = () => {
    const { token } = useAuthStore();
    const { getUsers, data, user, reset, message, isSuccess } = useUsersStore();
    const [toggleAdd, setToggleAdd] = useState(false);
    const [usersData, setUsersData] = useState([])
    const [isUpdate, setIsUpdate] = useState(false)
    const [newUser, setNewUser] = useState(info);

    useEffect(() => {
        if (token) {
            getUsers(token);
        }

    }, [token]);

    useEffect(() => {
        if (data) {
            setUsersData(data)
        }
    }, [data]);

    const handleUpdate = (user) => {
        setToggleAdd(true);
        setNewUser(user);
        setIsUpdate(true);
        console.log(user);
    }

    useEffect(() => {
        if (isSuccess && message) {
            setToggleAdd(false);

            setNewUser(info);

            if (user && isUpdate) {
                const updatedUsers = usersData.map(u =>
                    u._id === user._id ? user : u
                );
                setUsersData(updatedUsers);
                setIsUpdate(false);

            } else if (user) {
                setUsersData((prev) => {
                    const exists = prev.some(u => u._id === user._id);

                    if(exists) {
                        return prev.filter(u => u._id !== user._id);
                    }else {
                        return [...prev, user];
                    }
                })
            }

            reset()
            Swal.fire({
                title: "Saved!",
                text: message,
                icon: "success"
            });


        } else if (message) {
            reset()
            Swal.fire({
                title: "Error!",
                text: message,
                icon: "error"
            });
        }
    }, [isSuccess, message, user])

    return (
        <>
            <div className='container'>
                <div className="flex flex-col gap-5 pt-4">
                    <div className=''>
                        <h2 className='text-xl text-[#4154F1]'>Add new user</h2>
                        <p className='text-sm text-[#989797]'>Users / {toggleAdd && "Add new user"}</p>
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
            />
        </>
    )
}

export default AddNewUser