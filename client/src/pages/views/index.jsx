import React from 'react';
import useAuthStore from '../../services/stores/authStore';
import Routes from '../Routes';
import Sidebar from '../../components/sidebar';
import Header from '../../components/header';

const Views = () => {
    const { role } = useAuthStore();

    return (
        <div className="flex h-screen w-screen overflow-hidden">
            {/* {role && <Sidebar role={role} />} */}
            <main className={`flex-1 relative flex flex-col bg-[#E4E9F7] overflow-hidden`}>
            {role && <Header role={role}/>}
                <div className="flex-1 overflow-y-auto text-black">
                    <Routes />
                </div>
            </main>
        </div>
    );
};

export default Views;
