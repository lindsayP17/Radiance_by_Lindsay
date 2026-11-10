# RADIANCE 

A contemporary Bengali clothing storefront and virtual fitting studio.

# Live Storefront: [https://radiance-by-lindsay.onrender.com/](https://radiance-by-lindsay.onrender.com/)

# Features

- Artisanal Collection: Traditional Kurtis, tops, skirts, trousers, and scarves priced transparently between ৳1,000 and ৳5,000 BDT.
- Virtual Fitting Room: Try outfits on a mannequin with custom lighting presets and live size measurements (Inches & CM).
- AI Outfit Advisor: Personalized styling recommendations based on skin undertones, budget, and occasions powered by Google Gemini.
- Google Sign-In & Atelier Admin: Sign in with Google to save looks, view order receipts, and edit/add new pieces directly from the live site.
- Nationwide Delivery: Checkout across Bangladesh with Cash on Delivery (COD) and complimentary shipping on orders over ৳4,000.

# How to Run Locally

1. Clone & Install
bash
git clone https://github.com/YOUR_USERNAME/radiance-dhaka.git
cd radiance-dhaka
npm install --legacy-peer-deps

2. Set Up Environment
Create a .env file in the root folder:
Env
GEMINI_API_KEY="your_free_gemini_api_key_here"
APP_URL="http://localhost:3000"
Bash
npm run dev
Open http://localhost:3000 in your browser.

# Built With
Frontend: React, TypeScript, Tailwind CSS, Vite
Backend: Node.js, Express
Database & Auth: Firebase Firestore & Google Authentication
AI Engine: Google Gemini API (server-side integration)
Deployment: Render
