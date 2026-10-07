import { SHOP } from '../config/shop'

export function createGmailDraftUrl({ subject, body }) {
  const recipient = (SHOP.email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.includes('[') || recipient.includes(']')) {
    return null
  }

  const query = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: recipient,
    su: subject,
    body,
  })
  return `https://mail.google.com/mail/u/0/?${query.toString()}`
}

export async function sendOrderNotification(order) {
  let response
  try {
    response = await fetch('/api/order-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    })
  } catch {
    throw new Error('Could not reach the email service. Check the server is running, then retry.')
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error(`Email service returned an invalid response (HTTP ${response.status}).`)
  }

  if (!response.ok || !result.ok) {
    throw new Error(result.error || `Email service failed (HTTP ${response.status}).`)
  }

  return result
}
