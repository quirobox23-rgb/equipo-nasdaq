'use client'
import { useEffect, useRef } from 'react'

export function AnimatedParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Resize canvas to window
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Partículas
    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      opacity: number
      pulseSpeed: number
      pulsePhase: number
    }

    const particles: Particle[] = []
    const particleCount = 60

    // Crear partículas
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.3,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
      })
    }

    let animationFrameId: number
    let time = 0

    const animate = () => {
      // Fondo negro sutil con trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Actualizar y dibujar partículas
      particles.forEach((p) => {
        // Movimiento
        p.x += p.vx
        p.y += p.vy

        // Bounce en bordes
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        // Mantener en limites
        p.x = Math.max(0, Math.min(canvas.width, p.x))
        p.y = Math.max(0, Math.min(canvas.height, p.y))

        // Pulse de opacity
        const pulse = Math.sin(time * p.pulseSpeed + p.pulsePhase) * 0.3 + 0.7
        const finalOpacity = p.opacity * pulse

        // Dibujar partícula (brillo verde tech)
        ctx.fillStyle = `rgba(34, 197, 94, ${finalOpacity})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()

        // Glow effect sutil
        ctx.strokeStyle = `rgba(34, 197, 94, ${finalOpacity * 0.4})`
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2)
        ctx.stroke()
      })

      // Dibujar líneas conectoras entre partículas cercanas
      const connectionDistance = 120
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.2
            ctx.strokeStyle = `rgba(34, 197, 94, ${opacity})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      time++
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  )
}
