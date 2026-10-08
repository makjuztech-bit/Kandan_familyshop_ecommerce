# Kandan Family Shop (demo)

Run `npm install`, copy `.env.example` to `.env`, configure Gmail SMTP as below, then run `npm run dev`. Vite prints the storefront URL. Build the frontend with `npm run build`. The root `.env` is read by the mail API; Vite uses a separate `client-env/` directory so editing server mail settings does not restart and stop the API.

Order notifications are sent by the local Node API, never directly from the browser. To enable sending:

1. Turn on 2-Step Verification for the shop Google account.
2. Create a Google App Password for this app.
3. Put the account in `GMAIL_USER` and its App Password in `GMAIL_APP_PASSWORD` in `.env`. Set `SHOP_EMAIL` to the receiving shop inbox.
4. Restart `npm run dev`. Check `http://localhost:3001/api/health`; `emailConfigured` should be `true`.

Do not commit `.env` or expose the App Password in frontend code. The order page shows whether the email was sent and allows retry after a delivery error. Checkout remains a demo and does not collect payment or arrange shipping.

Edit shop address/phone/email/social/WhatsApp/image paths in `src/config/shop.js`; products in `src/data/products.js`. Images go in `public/images/` (hero-silk-showroom.jpg, bridal-banner.jpg, about-draping.jpg, collections/, and products/). Missing images show a silk-coloured placeholder.

The login page includes a demo mobile OTP flow. It generates a code in the browser for local testing and does not send SMS; do not use this client-side demo flow for production authentication. A production OTP flow needs server-side verification and an SMS provider.

Customer reviews are stored in SQLite at `server/data/reviews.sqlite` (or the optional `REVIEWS_DB_PATH`). Public pages show approved reviews only. Set a random `REVIEWS_ADMIN_TOKEN` of at least 32 characters and a separate `REVIEWS_VOTE_SALT` in `.env` to use the protected Admin > Reviews moderation tools. Review photos are limited to 2 MB. Keep `.env` and the SQLite database private and use persistent storage in deployment.

The Reviews page is available from the main navigation. Reviews submitted by customers remain pending until moderated; the storefront does not seed fictional testimonials or rating totals.
