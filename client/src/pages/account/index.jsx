import React, { useState } from 'react';
import useAuthStore from '../../services/stores/authStore';

const Account = () => {
    const { auth, logout } = useAuthStore();
    const [editMode, setEditMode] = useState(false);

    const [form, setForm] = useState({
        firstname: auth?.firstname || '',
        middlename: auth?.middlename || '',
        lastname: auth?.lastname || '',
        email: auth?.email || '',
        password: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveChanges = () => {
        console.log('Updated Info:', form);
        setEditMode(false); // Exit edit mode after saving
    };

    return (
        <div className="w-full mt-10 p-6 bg-white shadow-md rounded-md">
            <h2 className="text-2xl font-semibold mb-6">Account Settings</h2>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Profile Picture */}
                <div className="flex justify-center md:justify-start">
                    <div className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                        {auth?.profileImage ? (
                            <img
                                src={auth.profileImage}
                                alt="Profile"
                                className="object-cover w-full h-full"
                            />
                        ) : (
                            <span className="text-gray-500">No Image</span>
                        )}
                    </div>
                </div>

                {/* Info Section */}
                <div className="flex-1">
                    {editMode ? (
                        <div className="space-y-4">
                            {/* Editable fields */}
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700">First Name</label>
                                <input
                                    type="text"
                                    name="firstname"
                                    value={form.firstname}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700">Middle Name</label>
                                <input
                                    type="text"
                                    name="middlename"
                                    value={form.middlename}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700">Last Name</label>
                                <input
                                    type="text"
                                    name="lastname"
                                    value={form.lastname}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                            </div>

                            <div className="flex justify-end gap-4 items-center mt-6">
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div><strong>First Name:</strong> {form.firstname}</div>
                            <div><strong>Middle Name:</strong> {form.middlename}</div>
                            <div><strong>Last Name:</strong> {form.lastname}</div>
                            <div><strong>Email:</strong> {form.email}</div>
                        </div>
                    )}

                    <div className='flex gap-4 mt-4'>
                        <button
                            type="button"
                            onClick={() => setEditMode(!editMode)}
                            className="text-blue-800 bg-blue-200 p-2 rounded-md hover:bg-blue-300"
                        >
                            {editMode ? 'Cancel' : 'Update Info'}
                        </button>

                        {editMode ? (
                            <button
                                type="button"
                                onClick={handleSaveChanges}
                                className="bg-green-200 text-green-800 p-2 rounded hover:bg-green-300"
                            >
                                Save Changes
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={logout}
                                className="bg-red-200 text-red-800 p-2 rounded hover:bg-red-300"
                            >
                                Logout
                            </button>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Account;
