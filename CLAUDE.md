# BitJhoins — Cambio de divisas

App **Vite + React + TypeScript + Supabase** (SPA), NO estática.

## Estructura
- `src/pages`: PublicRates (tasas públicas), CreateOrder, CustomerAccess/CustomerOrders (cliente), AdminLogin/AdminDashboard + AdminCustomers/AdminOrders/AdminPaymentAccounts.
- `src/components`: CalculatorWidget, RateGraphic, SponsorCarousel, Logo.
- `supabase/functions` y `supabase/migrations`: edge functions y esquema de base de datos.
- Variables de entorno en `.env` (no versionado): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Despliegue en Vercel

Igual que Prime Ride: necesita las `VITE_*` horneadas en el build. Desplegar como prebuilt:

```bash
npm run build
mkdir -p .vercel/output
# .vercel/output/config.json:
#   {"version":3,"routes":[{"handle":"filesystem"},{"src":"/.*","dest":"/index.html"}]}
rm -rf .vercel/output/static && mkdir -p .vercel/output/static && cp -r dist/* .vercel/output/static/
vercel deploy --prebuilt --prod
```

**Permanente (recomendado):** agregar las 3 variables `VITE_*` en Vercel (Settings → Environment Variables, target Production) para que un build normal en Vercel también funcione.
