import { NextRequest, NextResponse } from 'next/server'

const BREVO_API_KEY = process.env.BREVO_API_KEY || ''
const BREVO_LIST_ID = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'hello@betwhisper.ai'
const FROM_NAME = 'BetWhisper'

const BREVO_API = 'https://api.brevo.com/v3'

async function brevoFetch(path: string, body: Record<string, unknown>) {
  return fetch(`${BREVO_API}${path}`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(body),
  })
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email required' },
        { status: 400 }
      )
    }

    if (!BREVO_API_KEY) {
      console.log('[Waitlist] No Brevo key — saving email locally:', email)
      return NextResponse.json({ success: true, message: 'Email recorded' })
    }

    // 1. Add contact to Brevo
    const contactBody: Record<string, unknown> = {
      email,
      updateEnabled: true,
    }
    if (BREVO_LIST_ID) {
      contactBody.listIds = [BREVO_LIST_ID]
    }

    const contactRes = await brevoFetch('/contacts', contactBody)

    if (!contactRes.ok && contactRes.status !== 204) {
      const err = await contactRes.json().catch(() => ({}))
      // "duplicate_parameter" means contact already exists — that's fine
      if (err.code !== 'duplicate_parameter') {
        console.error('[Waitlist] Brevo contact error:', err)
      }
    }

    console.log('[Waitlist] Contact added to Brevo:', email)

    // 2. Send welcome email
    try {
      await brevoFetch('/smtp/email', {
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email }],
        subject: "You're on the BetWhisper waitlist",
        htmlContent: `
          <div style="font-family: 'Courier New', monospace; max-width: 500px; margin: 0 auto; padding: 40px 20px; color: #000;">
            <div style="border-bottom: 2px solid #fff; padding-bottom: 20px; margin-bottom: 30px;">
              <h1 style="font-size: 24px; font-weight: 900; margin: 0; letter-spacing: 2px;">BETWHISPER</h1>
              <p style="color: #666; font-size: 11px; letter-spacing: 2px; margin: 4px 0 0 0;">TRADE POLYMARKET FROM YOUR GLASSES</p>
            </div>

            <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              You're in. We'll notify you as soon as BetWhisper launches on Meta Ray-Ban glasses.
            </p>

            <div style="background: #FAFAFA; border-left: 3px solid #000; padding: 16px 20px; margin: 24px 0;">
              <p style="font-size: 13px; margin: 0; font-weight: bold;">What's coming:</p>
              <ul style="font-size: 13px; padding-left: 16px; margin: 8px 0 0 0; line-height: 1.8;">
                <li>Trade prediction markets with your voice</li>
                <li>Sports, crypto, politics — anything on Polymarket</li>
                <li>No phone, no app switching, no screens</li>
              </ul>
            </div>

            <p style="font-size: 14px; line-height: 1.6; margin-top: 24px;">
              In the meantime, try the web app at
              <a href="https://betwhisper.ai/predict" style="color: #000; font-weight: bold;">betwhisper.ai/predict</a>
            </p>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E5E5; font-size: 11px; color: #777; letter-spacing: 1px;">
              BUILT ON MONAD &bull; POWERED BY POLYMARKET
            </div>
          </div>
        `,
      })
      console.log('[Waitlist] Welcome email sent to:', email)
    } catch (emailErr) {
      // Don't fail the request if welcome email fails
      console.error('[Waitlist] Welcome email failed:', emailErr)
    }

    return NextResponse.json({ success: true, message: "You're on the list!" })
  } catch (error) {
    console.error('[Waitlist] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
