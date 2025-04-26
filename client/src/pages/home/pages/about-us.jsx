import React from 'react';

const AboutUs = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-6 text-center">About Prince Nazareth Hotel</h1>
      
      <div className="max-w-3xl mx-auto">
        <p className="text-lg mb-4">
          Welcome to Prince Nazareth Hotel, where luxury meets comfort in the heart of the city.
          Our establishment has been providing exceptional hospitality services since its founding.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Our Story</h2>
        <p className="mb-4">
          Founded with a vision to create an unforgettable hospitality experience, Prince Nazareth Hotel
          has grown to become one of the premier destinations for travelers seeking quality accommodations
          and excellent service.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Our Mission</h2>
        <p className="mb-4">
          At Prince Nazareth Hotel, we are committed to providing our guests with memorable experiences
          through exceptional service, comfortable accommodations, and attention to detail. We strive to exceed
          expectations and create a home away from home for all our visitors.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>
        <p className="mb-4">
          For reservations or inquiries, please contact our front desk at:
        </p>
        <ul className="list-disc pl-6 mb-6">
          <li>Phone: +1 (555) 123-4567</li>
          <li>Email: info@princenazarethhotel.com</li>
          <li>Address: 123 Hospitality Drive, Royal City</li>
        </ul>
      </div>
    </div>
  );
};

export default AboutUs;