# FlywaysGo — iPad se setup karne ka guide

## 1. ZIP aur GitHub

1. ZIP ko download karke extract karo.
2. GitHub par apni `flyway` repository kholo.
3. Purani adhoori files ko ek-ek karke delete karne ke bajay pehle ZIP ka backup rakho.
4. GitHub website par folders upload karna mobile/iPad par mushkil ho sakta hai. Behtar hai GitHub ka **Add file → Upload files** use karke extracted project ki files/folders upload karo. Agar folder upload option na aaye, GitHub Desktop/computer ya kisi trusted Git client ka use karo.
5. `.github/workflows/deploy-pages.yml` bhi upload hona chahiye.
6. GitHub → Settings → Pages → Build and deployment mein **GitHub Actions** select karo.
7. Actions tab mein workflow green hone ke baad website link kholo.

## 2. Supabase

1. https://supabase.com par project banao.
2. SQL Editor kholo aur `supabase/schema.sql` ka poora code run karo.
3. Authentication → Users mein apna admin user banao.
4. Us user ka UUID copy karo.
5. SQL Editor mein ye query chalao (UUID ko apne UUID se replace karo):
   ```sql
   insert into public.admin_users(user_id) values ('PASTE-ADMIN-UUID-HERE');
   ```
6. Project Settings → API se Project URL, anon key aur service role key lo.
7. Service role key **sirf server/.env** mein rahegi. Ise GitHub ya frontend mein kabhi upload mat karna.

## 3. Razorpay

1. Razorpay account aur business/KYC requirements complete karo.
2. Pehle Test Mode keys hi use karo.
3. `server/.env` mein `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` aur `RAZORPAY_WEBHOOK_SECRET` bharo.
4. Webhook URL `https://YOUR-API-DOMAIN/api/payments/webhook` set karo.
5. `payment.captured` aur `payment.failed` events enable karo.
6. Real payments tabhi enable karo jab refund policy, customer support, business verification aur supplier/ticketing arrangement ready ho.

## 4. Environment files

- `server/.env.example` ko copy karke `server/.env` banao.
- `client/.env.example` ko copy karke `client/.env` banao.
- Dono mein apni values bharo. `.env` files GitHub par upload mat karna.

## 5. Frontend aur backend alag deploy honge

GitHub Pages React website ko host karega. Booking save karne, payment verify karne aur admin ticket upload ke liye Node backend alag host par deploy karna zaroori hai. Backend deploy hone ke baad `client/.env` mein `VITE_API_URL` set karke frontend dobara build/deploy karo.

## Yaad rakho

- Sample flights sirf DEMO hain, in par booking/payment disabled hai.
- Flight inventory aur final fare ko manually verify karke hi publish karo.
- Seat choice request hai, guaranteed seat nahi.
- Payment ke baad bhi admin ke confirmed ticket PDF/PNR upload karne par hi status `TICKET_ISSUED` hoga.
