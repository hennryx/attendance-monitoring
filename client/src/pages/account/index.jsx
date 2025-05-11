import React, { useState, useRef, useEffect } from 'react';
import useAuthStore from '../../services/stores/authStore';
import { toast } from 'react-toastify';
import axios from 'axios';
import { ENDPOINT } from '../../services/utilities';
import { BsEye, BsEyeSlash } from "react-icons/bs";
import NoImage from "../../assets/No-Image.png";

const Account = () => {
    const { auth, token, logout, validateToken } = useAuthStore();
    const [editMode, setEditMode] = useState(false);
    const [changePasswordMode, setChangePasswordMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [viewPass, setViewPass] = useState({
        current: false,
        new: false,
        confirm: false
    });
    const fileInputRef = useRef(null);

    const [passwordStrength, setPasswordStrength] = useState({
        length: false,
        hasNumber: false,
        hasSpecial: false
    });

    const [form, setForm] = useState({
        firstname: auth?.firstname || '',
        middlename: auth?.middlename || '',
        lastname: auth?.lastname || '',
        email: auth?.email || '',
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [imagePreview, setImagePreview] = useState(null);
    const [profileImage, setProfileImage] = useState(null);

    useEffect(() => {
        if (auth?.profileImage) {
            setImagePreview(`${ENDPOINT}/assets/profiles/${auth.profileImage}`);
        }
    }, [auth]);

    useEffect(() => {
        setPasswordStrength({
            length: passwordForm.newPassword.length >= 8,
            hasNumber: /\d/.test(passwordForm.newPassword),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(passwordForm.newPassword)
        });
    }, [passwordForm.newPassword]);

    const calculateStrengthPercentage = () => {
        const { length, hasNumber, hasSpecial } = passwordStrength;
        const criteriaCount = [length, hasNumber, hasSpecial].filter(Boolean).length;
        return (criteriaCount / 3) * 100;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordForm(prev => ({ ...prev, [name]: value }));
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file type
            if (!file.type.match('image.*')) {
                toast.error("Please select an image file");
                return;
            }

            // Check file size (limit to 2MB)
            if (file.size > 2 * 1024 * 1024) {
                toast.error("Image size should be less than 2MB");
                return;
            }

            // Save file for upload
            setProfileImage(file);

            // Create preview
            const reader = new FileReader();
            reader.onload = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProfile = async () => {
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('firstname', form.firstname);
            formData.append('middlename', form.middlename);
            formData.append('lastname', form.lastname);
            formData.append('email', form.email);

            if (profileImage) {
                formData.append('profileImage', profileImage);
            }

            const response = await axios.put(
                `${ENDPOINT}/users/update-profile`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            toast.success('Profile updated successfully');
            setEditMode(false);

            // Refresh user data
            validateToken();

        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        // Validate passwords
        if (!passwordForm.currentPassword) {
            toast.error('Please enter your current password');
            return;
        }

        if (!passwordForm.newPassword) {
            toast.error('Please enter a new password');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            toast.error('Password must be at least 8 characters long');
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.put(
                `${ENDPOINT}/users/update-password`,
                {
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            toast.success('Password changed successfully');
            setChangePasswordMode(false);
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });

        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to change password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative isolate h-screen overflow-hidden bg-[linear-gradient(to_bottom,#1b1b1b_25%,#FAFAFA_25%)]">
            <div
                aria-hidden="true"
                className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
            >
                <div
                    style={{
                        clipPath:
                            'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
                    }}
                    className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ffffff] to-[#eceaff] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
                />
            </div>

            <div className="container mx-auto p-4">

                <h2 className="text-3xl font-semibold mb-6 text-white">Account Settings</h2>

                <div className="flex flex-col md:flex-row gap-6 bg-white p-4 rounded-md shadow-xl">
                    {/* Profile Picture */}
                    <div className="flex flex-col items-center">
                        <div className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center mb-3">
                            {imagePreview ? (
                                <img
                                    src={imagePreview}
                                    alt="Profile"
                                    className="object-cover w-full h-full"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = NoImage;
                                    }}
                                />
                            ) : (
                                <span className="text-gray-500">No Image</span>
                            )}
                        </div>

                        {editMode && (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                                <button
                                    onClick={triggerFileInput}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                                >
                                    Change Photo
                                </button>
                            </>
                        )}
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
                            </div>
                        ) : changePasswordMode ? (
                            <div className="space-y-4">
                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-gray-700">Current Password</label>
                                    <div className="relative">
                                        <input
                                            type={viewPass.current ? "text" : "password"}
                                            name="currentPassword"
                                            value={passwordForm.currentPassword}
                                            onChange={handlePasswordChange}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 pr-10"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                                            onClick={() => setViewPass(prev => ({ ...prev, current: !prev.current }))}
                                        >
                                            {viewPass.current ? <BsEye /> : <BsEyeSlash />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-gray-700">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={viewPass.new ? "text" : "password"}
                                            name="newPassword"
                                            value={passwordForm.newPassword}
                                            onChange={handlePasswordChange}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 pr-10"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                                            onClick={() => setViewPass(prev => ({ ...prev, new: !prev.new }))}
                                        >
                                            {viewPass.new ? <BsEye /> : <BsEyeSlash />}
                                        </button>
                                    </div>

                                    {/* Password strength meter */}
                                    {passwordForm.newPassword && (
                                        <div className="mt-2">
                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full ${calculateStrengthPercentage() <= 33 ? 'bg-red-500' :
                                                        calculateStrengthPercentage() <= 66 ? 'bg-yellow-500' :
                                                            'bg-green-500'
                                                        }`}
                                                    style={{ width: `${calculateStrengthPercentage()}%` }}
                                                ></div>
                                            </div>

                                            <ul className="mt-2 text-xs text-gray-600 space-y-1">
                                                <li className={passwordStrength.length ? 'text-green-600' : ''}>
                                                    {passwordStrength.length ? '✓' : '•'} At least 8 characters
                                                </li>
                                                <li className={passwordStrength.hasNumber ? 'text-green-600' : ''}>
                                                    {passwordStrength.hasNumber ? '✓' : '•'} At least 1 number
                                                </li>
                                                <li className={passwordStrength.hasSpecial ? 'text-green-600' : ''}>
                                                    {passwordStrength.hasSpecial ? '✓' : '•'} At least 1 special character
                                                </li>
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-sm font-medium text-gray-700">Confirm New Password</label>
                                    <div className="relative">
                                        <input
                                            type={viewPass.confirm ? "text" : "password"}
                                            name="confirmPassword"
                                            value={passwordForm.confirmPassword}
                                            onChange={handlePasswordChange}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 pr-10"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                                            onClick={() => setViewPass(prev => ({ ...prev, confirm: !prev.confirm }))}
                                        >
                                            {viewPass.confirm ? <BsEye /> : <BsEyeSlash />}
                                        </button>
                                    </div>
                                    {passwordForm.newPassword && passwordForm.confirmPassword &&
                                        passwordForm.newPassword !== passwordForm.confirmPassword && (
                                            <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
                                        )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <h3 className="text-lg font-medium">Personal Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div className="bg-gray-50 p-3 rounded">
                                        <p className="text-sm text-gray-500">First Name</p>
                                        <p className="font-medium">{form.firstname}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <p className="text-sm text-gray-500">Middle Name</p>
                                        <p className="font-medium">{form.middlename || 'Not provided'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <p className="text-sm text-gray-500">Last Name</p>
                                        <p className="font-medium">{form.lastname}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <p className="text-sm text-gray-500">Email</p>
                                        <p className="font-medium">{form.email}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <p className="text-sm text-gray-500">Role</p>
                                        <p className="font-medium">{auth?.role || 'User'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className='flex gap-4 mt-6'>
                            {editMode ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setEditMode(false)}
                                        disabled={isLoading}
                                        className="text-gray-600 bg-gray-100 p-2 rounded-md hover:bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveProfile}
                                        disabled={isLoading}
                                        className="bg-green-200 text-green-800 p-2 rounded hover:bg-green-300"
                                    >
                                        {isLoading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </>
                            ) : changePasswordMode ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setChangePasswordMode(false)}
                                        disabled={isLoading}
                                        className="text-gray-600 bg-gray-100 p-2 rounded-md hover:bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleChangePassword}
                                        disabled={isLoading}
                                        className="bg-green-200 text-green-800 p-2 rounded hover:bg-green-300"
                                    >
                                        {isLoading ? 'Saving...' : 'Update Password'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setEditMode(true)}
                                        className="text-blue-800 bg-blue-200 p-2 rounded-md hover:bg-blue-300"
                                    >
                                        Edit Profile
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChangePasswordMode(true)}
                                        className="text-black bg-amber-300 p-2 rounded-md hover:bg-amber-400"
                                    >
                                        Change Password
                                    </button>
                                    <button
                                        type="button"
                                        onClick={logout}
                                        className="bg-red-200 text-red-800 p-2 rounded hover:bg-red-300"
                                    >
                                        Logout
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Account;