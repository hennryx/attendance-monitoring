import React from 'react';

const AboutUs = () => {
    return (
        <div className="relative isolate container lg:px-8 h-lvh text-black">
            <div className='text-start py-32 sm:py-48 lg:py-56 flex flex-col gap-4'>
                <h1 className="text-4xl font-bold mb-6 text-center">About this Project</h1>
                <div className="flex flex-col justify-center items-center w-full">
                    <div className="max-w-3xl mx-auto flex flex-col gap-3">
                        <p className="text-lg mb-4">
                            Welcome to Lorem ipsum dolor sit amet consectetur adipisicing elit. Eos perspiciatis possimus quas ut ab et non hic aspernatur praesentium. Quae, error quas maiores repudiandae voluptatibus sapiente molestias nemo fugit beatae.
                            Suscipit sapiente hic corrupti error, ullam, blanditiis veniam culpa facere sunt odit at nam id debitis repudiandae aperiam atque et molestias minima numquam unde labore voluptates doloribus autem! Vitae, natus?
                        </p>

                        <div>
                            <h2 className="text-2xl font-semibold mt-8 mb-4">Our Story</h2>
                            <p className="mb-4">
                                Lorem, ipsum dolor sit amet consectetur adipisicing elit. Neque illo at blanditiis consequatur, facere pariatur iste, sed reprehenderit vitae itaque dolorem exercitationem odio nam quo est sit, suscipit harum corrupti.
                                Iure sequi dolorum quod dolores voluptates deleniti quisquam numquam distinctio adipisci eaque veniam fugit cupiditate asperiores, vel atque cum possimus ullam voluptatibus, officiis expedita? Iusto quos mollitia vero sunt error.
                                Beatae blanditiis consequatur quo vel, accusamus fuga inventore ut veritatis culpa. Quisquam qui corporis fugiat, pariatur, officia excepturi animi nemo corrupti nihil, nam velit ipsum asperiores? Dolor maxime tempora exercitationem!
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-semibold mt-8 mb-4">Our Mission</h2>
                            <p className="mb-4">
                                Lorem ipsum dolor sit amet consectetur adipisicing elit. Iusto molestias perferendis sint nostrum ex explicabo asperiores pariatur minima expedita autem repellendus consequuntur sunt modi velit saepe, beatae exercitationem corporis vero.
                                Sint, voluptatibus? Voluptatum, quidem corrupti iusto, culpa qui ipsum velit possimus quos expedita mollitia iste praesentium quibusdam deleniti cumque? Dolore impedit et perspiciatis excepturi inventore rem nulla ut dolor hic?
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>
                            <p className="mb-4">
                                Lorem ipsum dolor sit, amet consectetur adipisicing elit. Nulla quis dolores eos consectetur culpa animi qui, eius nostrum quasi ad! Molestias illo explicabo magnam nam, porro voluptatum necessitatibus voluptate eius.:
                            </p>
                            <ul className="list-disc pl-6 mb-6">
                                <li>Phone: +63 922 222 2222</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutUs;