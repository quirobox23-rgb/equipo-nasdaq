import { NextRequest, NextResponse } from 'next/server'

const NOVA_URL = process.env.NOVA_API_URL || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  try {
    const response = await fetch(`${NOVA_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: `Nova error ${response.status}: ${text}` },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: `No se pudo conectar con Nova: ${String(err)}` },
      { status: 503 }
    )
  }
}