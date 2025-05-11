import React from 'react';
import { IoArrowBackCircle } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
    const navigate = useNavigate();
    
    const handleNavigate = () => {
        navigate("/");

        setTimeout(() => {
            window.location.reload()
        }, 100)
    }
    return (
        <main className="grid min-h-lvh place-items-center bg-[#1b1b1b] px-6 py-24 sm:py-32 lg:px-8">
            <div className="text-center">
                <p className="text-8xl font-semibold text-[#FDBE02]">404</p>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">Page not found</h1>
                <p className="mt-6 text-base leading-7 text-gray-300">Sorry, we couldn't find the page you're looking for.</p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                    <button
                        onClick={handleNavigate}
                        className="px-5 py-2 border-2 border-[#FDBE02] relative rounded-full shadow flex"
                    >
                        <span className="ml-8 text-white">Go back home</span>
                        <span className="absolute top-0 left-0 bottom-0">
                            <IoArrowBackCircle size={40} className="text-[#FDBE02]"/>
                        </span>
                    </button>
                </div>
            </div>
        </main>
    );
};

export default NotFound;