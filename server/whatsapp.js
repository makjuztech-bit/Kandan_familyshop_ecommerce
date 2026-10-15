/**
 * Sri Kandan Family Shop - Automated WhatsApp Notification Engine
 * 
 * Supports:
 * 1. Meta / WhatsApp Cloud API (Primary Business API)
 * 2. Twilio WhatsApp API (Alternative Business Gateway)
 * 3. Fallback direct WhatsApp Click-to-Chat URL generator
 */

import { SHOP } from '../src/config/shop.js'

export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return ''
  const clean = phone.replace(/\D/g, '')
  if (!clean) return ''
  // If Indian 10-digit number, prepend 91 country code
  if (clean.length === 10) return '91' + clean
  // If 11-digit starting with 0, replace with 91
  if (clean.length === 11 && clean.startsWith('0')) return '91' + clean.slice(1)
  return clean
}

export function formatOrderPlacedMessage(order) {
  const items = Array.isArray(order.items)
    ? order.items.map(it => `• ${it.name} × ${it.q} (₹${(it.price * it.q).toLocaleString('en-IN')})`).join('\n')
    : '• Saree Collection Order'

  return `🛍️ *Order Confirmed — Sri Kandan Family Shop*

Namaste *${order.name || order.customerName || 'Customer'}*,
Thank you for shopping with us! Your authentic handloom order has been successfully placed.

📋 *Order Number:* ${order.no}
💳 *Total Amount:* ₹${Number(order.total || 0).toLocaleString('en-IN')}
💵 *Payment Method:* ${order.paymentMethod || 'COD'} (${order.paymentStatus || 'Pending'})
📍 *Delivery Address:* ${order.address || 'Address provided'}

📦 *Items Ordered:*
${items}

🚚 *Track Delivery Live:*
https://kandan-ecommerce.web.app/delivery?order=${encodeURIComponent(order.no)}

For any enquiries, reply here or call us at 04446 621728 / 89251 55521.
*Sri Kandan Family Shop, Kanchipuram*`
}

export function formatOrderStatusMessage(order, newStatus) {
  const statusEmoji = {
    Confirmed: '📋',
    Processing: '⚙️',
    Packed: '📦',
    Delivered: '🎉',
    Cancelled: '⚠️',
    Refunded: '💳'
  }[newStatus] || '🚚'

  return `${statusEmoji} *Order Update — Sri Kandan Family Shop*

Dear *${order.name || order.customerName || 'Customer'}*,
Your order *#${order.no}* status is now: *${newStatus.toUpperCase()}*

📍 *Delivery To:* ${order.address || 'Address on file'}
💰 *Order Total:* ₹${Number(order.total || 0).toLocaleString('en-IN')}

🚚 *Track live progress:*
https://kandan-ecommerce.web.app/delivery?order=${encodeURIComponent(order.no)}

Thank you for your patronage!
*Sri Kandan Family Shop, Kanchipuram*`
}

/**
 * Dispatches an automated WhatsApp notification via configured provider.
 */
export async function sendWhatsAppNotification({ toPhone, message, orderNo, eventType }) {
  const recipient = normalizePhoneNumber(toPhone)
  if (!recipient || recipient.length < 10) {
    return {
      ok: false,
      error: 'Invalid recipient phone number for WhatsApp dispatch.',
      recipient,
      status: 'error'
    }
  }

  // 1. Meta / WhatsApp Cloud API
  const metaToken = (process.env.WHATSAPP_API_TOKEN || process.env.META_WHATSAPP_TOKEN || '').trim()
  const phoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim()

  if (metaToken && phoneId && !metaToken.includes('REPLACE')) {
    try {
      const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { preview_url: true, body: message }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${metaToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data?.messages?.[0]?.id) {
        console.log(`[WhatsApp Meta API] Accepted message ${data.messages[0].id} to +${recipient} for order ${orderNo}`)
        return {
          ok: true,
          provider: 'Meta WhatsApp Cloud API',
          status: 'accepted',
          messageId: data.messages[0].id,
          recipient
        }
      }

      console.error('[WhatsApp Meta API Error]:', data)
      throw new Error(data?.error?.message || 'Meta Cloud API rejected the message dispatch.')
    } catch (err) {
      console.error(`[WhatsApp Meta API Delivery Failed]:`, err.message)
      return {
        ok: false,
        provider: 'Meta WhatsApp Cloud API',
        status: 'error',
        error: err.message,
        recipient
      }
    }
  }

  // 2. Twilio WhatsApp Gateway
  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || '').trim()
  const twilioAuth = (process.env.TWILIO_AUTH_TOKEN || '').trim()
  const twilioFrom = (process.env.TWILIO_WHATSAPP_NUMBER || '').trim() // e.g. whatsapp:+14155238886

  if (twilioSid && twilioAuth && twilioFrom && !twilioSid.includes('REPLACE')) {
    try {
      const formattedFrom = twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`
      const formattedTo = `whatsapp:+${recipient}`
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`

      const params = new URLSearchParams()
      params.append('To', formattedTo)
      params.append('From', formattedFrom)
      params.append('Body', message)

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      })

      const data = await res.json()
      if (data.sid) {
        console.log(`[WhatsApp Twilio API] Accepted message ${data.sid} to ${formattedTo} for order ${orderNo}`)
        return {
          ok: true,
          provider: 'Twilio WhatsApp API',
          status: 'accepted',
          messageId: data.sid,
          recipient
        }
      }

      throw new Error(data.message || 'Twilio WhatsApp message rejected.')
    } catch (err) {
      console.error(`[WhatsApp Twilio Error]:`, err.message)
      return {
        ok: false,
        provider: 'Twilio WhatsApp API',
        status: 'error',
        error: err.message,
        recipient
      }
    }
  }

  // 3. Provider credentials unconfigured
  const directLink = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`
  console.info(`[WhatsApp Notice]: Automated WhatsApp API provider is unconfigured in .env. Manual dispatch URL ready: ${directLink}`)

  return {
    ok: false,
    unconfigured: true,
    status: 'unconfigured',
    message: 'WhatsApp Business API is not configured on the backend. To enable automatic messaging, add WHATSAPP_API_TOKEN & WHATSAPP_PHONE_NUMBER_ID or TWILIO credentials to server .env.',
    directLink,
    recipient
  }
}

/**
 * Generates direct WhatsApp chat URL for customer or admin
 */
export function getDirectWhatsAppUrl(phone, text) {
  const clean = normalizePhoneNumber(phone)
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}
