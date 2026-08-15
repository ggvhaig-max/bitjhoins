# BitJhoins — Cambio de divisas

## Supabase

- **Proyecto:** `agsapmcfwzudkyfmtifi`
- Servidor propio: esta app **no** está en el consolidado.

**OJO — el error que más tiempo cuesta:** los servidores viejos
(`qzsxynppfyjciffxphat` de e-Comercio y `ymvhxbxyowhbvvxpyfmn` del CRM)
siguen encendidos y responden a las consultas. Si algo "no aparece" en la
base o si sale "no tienes permiso", revisar primero a **cuál** servidor se le
está preguntando. La verdad está en el `.env` del proyecto, no en la memoria
ni en la documentación vieja.


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
