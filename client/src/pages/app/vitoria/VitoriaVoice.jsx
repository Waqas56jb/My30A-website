import { useCallback, useEffect, useRef, useState } from 'react'
import { Captions, CaptionsOff, Mic, MicOff, PhoneOff } from 'lucide-react'
import { errorText, guest } from '../../../lib/guestApi.js'
import { PlaceCard } from '../AppVitoria.jsx'
import VoiceOrb from './VoiceOrb.jsx'

// Live speech-to-speech with Vitoria (OpenAI Realtime over WebRTC). Our server mints a 10-minute
// key; the browser streams the mic straight to OpenAI and plays Vitoria's voice back. Tool calls
// (restaurants, events, beaches, bookings, prices) run on our API and their cards show on screen.
// When the call ends the transcript is saved into the normal chat history.
const STATUS = {
  connecting: 'Connecting…',
  listening: 'Listening…',
  hearing: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Vitoria is speaking',
  ended: 'Call ended',
}

function levelOf(analyser, buf) {
  if (!analyser) return 0
  analyser.getByteTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i += 1) {
    const v = (buf[i] - 128) / 128
    sum += v * v
  }
  return Math.min(1, Math.sqrt(sum / buf.length) * 4.2)
}

export default function VitoriaVoice({ onClose }) {
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [captions, setCaptions] = useState(true)
  const [userLine, setUserLine] = useState('')
  const [aiLine, setAiLine] = useState('')
  const [cards, setCards] = useState([])

  const stateRef = useRef('connecting')
  const levelRef = useRef(0)
  const pcRef = useRef(null)
  const dcRef = useRef(null)
  const micRef = useRef(null)
  const audioRef = useRef(null)
  const turnsRef = useRef([])
  const pendingCardsRef = useRef([])
  const toolRunsRef = useRef([])
  const closedRef = useRef(false)

  const setState = (s) => {
    stateRef.current = s
    setStatus(s)
  }

  const send = (event) => {
    const dc = dcRef.current
    if (dc && dc.readyState === 'open') dc.send(JSON.stringify(event))
  }

  const hangUp = useCallback(async () => {
    if (closedRef.current) return
    closedRef.current = true
    try {
      dcRef.current?.close()
      pcRef.current?.getSenders().forEach((s) => s.track?.stop())
      pcRef.current?.close()
      micRef.current?.getTracks().forEach((t) => t.stop())
    } catch {
      /* already closed */
    }
    const turns = turnsRef.current.filter((t) => t.content)
    if (turns.length) await guest.voiceLog(turns).catch(() => {})
    onClose?.(turns.length)
  }, [onClose])

  const handleEvent = useCallback(async (e) => {
    switch (e.type) {
      case 'input_audio_buffer.speech_started':
        setState('hearing')
        setUserLine('')
        break
      case 'input_audio_buffer.speech_stopped':
        setState('thinking')
        break
      case 'conversation.item.input_audio_transcription.completed':
        if (e.transcript?.trim()) {
          setUserLine(e.transcript.trim())
          turnsRef.current.push({ role: 'user', content: e.transcript.trim() })
        }
        break
      case 'response.output_audio_transcript.delta':
        setAiLine((line) => line + (e.delta || ''))
        break
      case 'response.output_audio_transcript.done':
        if (e.transcript?.trim()) {
          turnsRef.current.push({ role: 'assistant', content: e.transcript.trim(), places: pendingCardsRef.current })
          pendingCardsRef.current = []
        }
        break
      case 'output_audio_buffer.started':
        setState('speaking')
        break
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        setState('listening')
        break
      case 'response.created':
        setAiLine('')
        break
      case 'response.function_call_arguments.done': {
        setState('thinking')
        const run = guest
          .voiceTool(e.name, e.arguments)
          .then(({ result, cards: found }) => {
            if (found?.length) {
              setCards(found)
              pendingCardsRef.current = found
            }
            send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: e.call_id, output: JSON.stringify(result) } })
          })
          .catch((err) =>
            send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: e.call_id, output: JSON.stringify({ error: errorText(err) }) } })
          )
        toolRunsRef.current.push(run)
        break
      }
      case 'response.done': {
        // Tool results are in — ask Vitoria to answer with them (once per response).
        const runs = toolRunsRef.current
        toolRunsRef.current = []
        if (runs.length) {
          await Promise.allSettled(runs)
          send({ type: 'response.create' })
        }
        break
      }
      case 'error':
        if (e.error?.message) setError(e.error.message)
        break
      default:
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let raf = 0
    let audioCtx = null
    closedRef.current = false // React dev mode mounts effects twice — each start is a fresh call

    async function start() {
      if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Voice chat needs a browser with microphone support.')
      }
      const mic = await navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        .catch(() => {
          throw new Error('Allow microphone access to talk with Vitoria.')
        })
      if (cancelled) return mic.getTracks().forEach((t) => t.stop())
      micRef.current = mic

      const session = await guest.voiceSession()
      if (cancelled) return

      const pc = new RTCPeerConnection()
      pcRef.current = pc
      const audio = audioRef.current
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const micAnalyser = audioCtx.createAnalyser()
      micAnalyser.fftSize = 512
      audioCtx.createMediaStreamSource(mic).connect(micAnalyser)
      let aiAnalyser = null
      pc.ontrack = (ev) => {
        audio.srcObject = ev.streams[0]
        audio.play().catch(() => {})
        aiAnalyser = audioCtx.createAnalyser()
        aiAnalyser.fftSize = 512
        audioCtx.createMediaStreamSource(ev.streams[0]).connect(aiAnalyser)
      }
      mic.getTracks().forEach((track) => pc.addTrack(track, mic))

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onmessage = (msg) => {
        try {
          handleEvent(JSON.parse(msg.data))
        } catch {
          /* ignore malformed */
        }
      }
      dc.onopen = () => {
        setState('thinking')
        send({ type: 'response.create' }) // Vitoria greets first
      }
      pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected'].includes(pc.connectionState) && !closedRef.current) setError('The call dropped — tap end and try again.')
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const res = await fetch(session.calls_url || 'https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${session.client_secret}`, 'Content-Type': 'application/sdp' },
      })
      if (!res.ok) {
        throw new Error(
          res.status === 429 || res.status === 402
            ? 'Vitoria’s voice is unavailable right now. You can still type your question.'
            : 'Could not reach Vitoria’s voice service. Please try again.'
        )
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() })

      // Drive the orb from whoever is talking.
      const buf = new Uint8Array(512)
      const tick = () => {
        const s = stateRef.current
        const mine = levelOf(micAnalyser, buf)
        const hers = levelOf(aiAnalyser, buf)
        levelRef.current = s === 'speaking' ? hers : s === 'hearing' || s === 'listening' ? mine : Math.max(mine, hers) * 0.5
        raf = requestAnimationFrame(tick)
      }
      tick()
    }

    start().catch((err) => {
      if (!cancelled) {
        setError(errorText(err))
        setState('ended')
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      audioCtx?.close().catch(() => {})
      // Tear down this attempt's media without marking the call as hung up (hangUp does that).
      dcRef.current?.close()
      pcRef.current?.close()
      micRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [handleEvent])

  const toggleMute = () => {
    const next = !muted
    micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next))
    setMuted(next)
  }

  return (
    <div className={`app-voice is-${status}`} role="dialog" aria-label="Voice chat with Vitoria">
      <span className="app-voice-aurora" aria-hidden="true" />
      <header className="app-voice-head">
        <span className={`app-voice-live${['connecting', 'ended'].includes(status) ? ' is-idle' : ''}`}>
          <span className="app-live-dot" aria-hidden="true" />
          {status === 'connecting' ? 'Connecting to Vitoria' : status === 'ended' ? 'Vitoria' : 'Live with Vitoria'}
        </span>
      </header>

      <div className="app-voice-stage">
        <VoiceOrb levelRef={levelRef} stateRef={stateRef} size={300} />
        <p className="app-voice-status" aria-live="polite">
          {error ? '' : muted && status !== 'speaking' ? 'Microphone muted' : STATUS[status]}
        </p>
        {error ? (
          <div className="app-voice-error">
            <p>{error}</p>
            <button type="button" onClick={hangUp}>
              Type instead
            </button>
          </div>
        ) : null}
      </div>

      {captions && (userLine || aiLine) ? (
        <div className="app-voice-captions" aria-live="polite">
          {userLine ? <p className="is-user">{userLine}</p> : null}
          {aiLine ? <p className="is-ai">{aiLine}</p> : null}
        </div>
      ) : null}

      {cards.length ? (
        <div className="app-vit-cards app-voice-cards" role="list" aria-label="Places Vitoria mentioned">
          {cards.map((place, i) => (
            <PlaceCard key={`${place.name}-${i}`} place={place} />
          ))}
        </div>
      ) : null}

      <div className="app-voice-controls">
        <button type="button" className={`app-voice-btn${muted ? ' is-on' : ''}`} onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>
          {muted ? <MicOff size={22} strokeWidth={1.8} /> : <Mic size={22} strokeWidth={1.8} />}
        </button>
        <button type="button" className="app-voice-btn is-end" onClick={hangUp} aria-label="End voice chat">
          <PhoneOff size={24} strokeWidth={1.9} />
        </button>
        <button type="button" className={`app-voice-btn${captions ? '' : ' is-on'}`} onClick={() => setCaptions(!captions)} aria-pressed={!captions} aria-label={captions ? 'Hide captions' : 'Show captions'}>
          {captions ? <Captions size={22} strokeWidth={1.8} /> : <CaptionsOff size={22} strokeWidth={1.8} />}
        </button>
      </div>
      <audio ref={audioRef} autoPlay playsInline hidden />
    </div>
  )
}
