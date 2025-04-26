import React from 'react'
import drinks from "../../../assets/drinks.png"

const Home = ({ handleToggle = () => { } }) => {

    return (
        <div className="relative isolate px-6 pt-14 lg:px-8 h-lvh">
             <div
                aria-hidden="true"
                className="absolute sm:bottom-0 bottom-0 right-0"
            >
                <img src={drinks} alt="bg-image"/>
            </div>

            <div className="text-start py-32 sm:py-48 lg:py-56 flex flex-col gap-4">
                <h1 className="text-4xl font-bold tracking-tight text-red-500 sm:text-6xl">
                    INVENTORY <br />
                    MANAGEMENT SYSTEM
                </h1>
                <div className="w-5/12 text-start">
                    <p className="mt-6 text-lg leading-8 text-gray-600">
                        Lorem Ipsum is simply dummy text of the printing and typesetting industry.Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.
                    </p>

                </div>
                <div className="mt-10 flex items-start justify-start gap-x-6">
                    <div
                        className="rounded-md bg-indigo-200 px-3.5 py-2.5 text-base font-semibold text-indigo-800 shadow-sm hover:bg-indigo-300 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        onClick={() => handleToggle("login", true)}
                    >
                        Get started
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Home