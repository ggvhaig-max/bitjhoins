import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const STATUS_MESSAGES: Record<string, (orderNumber: string, customerName: string) => string> = {
  order_created: (n, name) => `¡Hola ${name}! Tu orden ${n} fue creada. Realiza tu pago para conservar tu cotización. — BitJhoins`,
  payment_reported: (n, name) => `¡Hola ${name}! Hemos recibido tu comprobante de pago para la orden ${n}. Nuestro equipo está verificando. — BitJhoins`,
  payment_confirmed: (n, name) => `¡Hola ${name}! Tu pago fue confirmado. Estamos procesando tu cambio. Orden ${n}. — BitJhoins`,
  exchange_processing: (n, name) => `¡Hola ${name}! Tu cambio está en proceso. Orden ${n}. — BitJhoins`,
  sending_to_beneficiary: (n, name) => `¡Hola ${name}! Estamos enviando los fondos a tu beneficiario. Orden ${n}. — BitJhoins`,
  sent: (n, name) => `¡Hola ${name}! Hemos enviado la transferencia a tu beneficiario. Revisa el comprobante en la app. Orden ${n}. — BitJhoins`,
  completed: (n, name) => `¡Hola ${name}! Tu orden ${n} está completada. ¡Gracias por confiar en BitJhoins!`,
  cancelled: (n, name) => `¡Hola ${name}! Tu orden ${n} fue cancelada. Si tienes dudas, contáctanos. — BitJhoins`,
  expired: (n, name) => `¡Hola ${name}! Tu orden ${n} expiró por falta de pago. Puedes crear una nueva cuando quieras. — BitJhoins`,
  admin_message: (n, name) => `¡Hola ${name}! Tienes un nuevo mensaje en tu orden ${n}. Revísalo en la app. — BitJhoins`,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      type, order_id, order_number, customer_name, source_amount, source_currency,
      dest_currency, whatsapp, message_text,
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: settings } = await supabase
      .from('site_settings')
      .select('whatsapp_number')
      .eq('id', 'main')
      .maybeSingle();

    const adminWhatsapp = settings?.whatsapp_number ?? '';

    let adminMessage = '';
    let customerMessage = '';
    const targetPhone = adminWhatsapp;

    if (type === 'order_created') {
      adminMessage = `Nueva operación BitJhoins.
Orden ${order_number}.
Cliente: ${customer_name}.
${source_amount} ${source_currency} -> ${dest_currency}.
Estado: esperando pago.`;
      customerMessage = STATUS_MESSAGES.order_created(order_number, customer_name);
    } else if (type === 'admin_message' && message_text) {
      customerMessage = message_text;
    } else if (STATUS_MESSAGES[type]) {
      customerMessage = STATUS_MESSAGES[type](order_number, customer_name);
    }

    if (adminMessage && targetPhone && order_id) {
      console.log(`[WhatsApp -> admin ${targetPhone}]: ${adminMessage}`);
      await supabase.from('order_notifications').insert({
        order_id,
        channel: 'whatsapp',
        recipient: targetPhone,
        event_type: type,
        message: adminMessage,
      });
    }

    if (customerMessage && whatsapp && order_id) {
      console.log(`[WhatsApp -> customer ${whatsapp}]: ${customerMessage}`);
      await supabase.from('order_notifications').insert({
        order_id,
        channel: 'whatsapp',
        recipient: whatsapp,
        event_type: type,
        message: customerMessage,
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification logged' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
