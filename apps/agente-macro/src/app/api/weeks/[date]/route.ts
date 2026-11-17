import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { loadAutoWeek } from '@/lib/weekSource'
import { fillActualsFromFred } from '@/lib/fredCalendar'

const DATA_DIR = join(process.cwd(), 'src/data/weeks')
const HISTORY_DIR = join(process.cwd(), 'src/data/history')

export async function GET(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await params
    const filePath = join(DATA_DIR, `week_${date}.json`)

    let events = []
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      events = JSON.parse(content)
    } catch {
      events = []
    }

    if (Array.isArray(events) && events.length > 0) {
      // Archivo a mano: manda. Solo se completa el dato real que falte (FRED).
      const filled = await fillActualsFromFred(events)
      return NextResponse.json({ events: filled.events, date, status: 'loaded' })
    }

    // Semana sin archivo: Forex Factory, copia guardada o calendario de FRED
    // (ver lib/weekSource.ts). status: auto | saved | scheduled | not_found.
    const auto = await loadAutoWeek(date)
    return NextResponse.json({ events: auto.events, date, status: auto.status })
  } catch (error) {
    console.error('Error GET:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await params
    const body = await req.json()
    const { eventId, updates } = body

    const filePath = join(DATA_DIR, `week_${date}.json`)

    let events = []
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      events = JSON.parse(content)
    } catch {
      events = []
    }

    const idx = events.findIndex((e: any) => e.id === eventId)
    if (idx === -1) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }

    events[idx] = { ...events[idx], ...updates }
    await fs.writeFile(filePath, JSON.stringify(events, null, 2), 'utf-8')

    const historyPath = join(HISTORY_DIR, `history_${date}.json`)
    let history = []
    try {
      const content = await fs.readFile(historyPath, 'utf-8')
      history = JSON.parse(content)
    } catch {
      history = []
    }

    history.push({
      timestamp: new Date().toISOString(),
      eventId,
      eventName: events[idx].name,
      changes: updates,
      fullEvent: events[idx],
    })

    await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8')

    return NextResponse.json({ events, date, status: 'saved' })
  } catch (error) {
    console.error('Error POST:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}