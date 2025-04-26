import React from 'react';
import Logo from "../../assets/Logo.png"
import { FaFacebookF, FaInstagram } from "react-icons/fa";
import { MdOutlineMail } from "react-icons/md";
import { FaPhone } from "react-icons/fa6";
import { GrLocation } from "react-icons/gr";

const Footer = ({ className=""}) => {
    return (
        <footer className="footer">
            <div className={`flex flex-col sm:flex-row w-full p-8 gap-4 sm:gap-8 ${className} ${className.includes('bg-') ? className : 'bg-white'}`}>
                <div className="flex-1 flex flex-col gap-2">
                    <img alt="Logo" src={Logo} className="h-14 w-16" />
                    <p className='text-base'>A place for good drinks. 
                        we offer refreshing drinks </p>
                    <p className='text-base'>&copy; 2025 Night Owl. All rights reserved. </p>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                    <h1 className='font-bold text-lg'>Contact us</h1>
                    <div className='flex flex-row gap-2 items-center'>
                        <GrLocation size={20}/>
                        <p className='text-base'>Address: Brgy forest, General Tinio Nueva Ecija </p>
                    </div>
                    <div className='flex flex-row gap-2 items-center'>
                        <FaPhone size={20} />
                        <p className='text-base'>Phone: +63 907 117 7279</p>
                    </div>
                    <div className='flex flex-row gap-2 items-center'>
                        <MdOutlineMail size={20} />
                        <p className='text-base'>Email: <a href="mailto:info@sample.com">owl@gmail.com</a></p>
                    </div>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                    <h1 className='font-bold text-lg'>Socials</h1>
                    <div className='flex flex-row gap-2 items-center'>
                        <FaFacebookF size={20}/>
                        <p className='text-base'>Facebook</p>
                    </div>
                    <div className='flex flex-row gap-2 items-center'>
                        <FaInstagram size={20}/>
                        <p className='text-base'>Instagram</p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
