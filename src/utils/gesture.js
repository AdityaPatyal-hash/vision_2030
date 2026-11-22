// Heuristic ISL alphabet classifier from MediaPipe hand landmarks (21 points, normalized).
// Extended finger: fingertip is further from the wrist than the PIP joint.
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

function fingerExtended(lm, tip, pip) {
  const wrist = lm[0]
  return dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.12
}

export function classifyLetter(lm) {
  if (!lm || lm.length < 21) return null
  const wrist = lm[0]
  const index = fingerExtended(lm, 8, 6)
  const middle = fingerExtended(lm, 12, 10)
  const ring = fingerExtended(lm, 16, 14)
  const pinky = fingerExtended(lm, 20, 18)
  // Thumb "out": tip far from index MCP compared to hand size
  const handSize = dist(lm[5], wrist) || 0.001
  const thumbOut = dist(lm[4], lm[17]) / handSize > 1.35

  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length

  if (extendedCount === 0 && !thumbOut) return 'A'
  if (extendedCount === 4 && !thumbOut) return 'B'
  if (index && !middle && !ring && !pinky && thumbOut) return 'L'
  if (index && middle && !ring && !pinky) return 'V'
  if (!index && !middle && !ring && pinky && thumbOut) return 'Y'
  return null
}

export const LETTER_GUIDES = {
  A: { en: 'Make a fist with your thumb resting along the side of your index finger.', hi: 'मुट्ठी बनाएँ, अंगूठा तर्जनी की बगल में रखें।' },
  B: { en: 'Hold your four fingers up straight together and fold your thumb across your palm.', hi: 'चारों उंगलियाँ सीधी ऊपर रखें और अंगूठे को हथेली पर मोड़ें।' },
  L: { en: 'Extend your index finger and thumb to form an L shape.', hi: 'तर्जनी और अंगूठा फैलाकर L आकार बनाएँ।' },
  V: { en: 'Extend your index and middle fingers spread apart in a V.', hi: 'तर्जनी और मध्यमा फैलाकर V आकार बनाएँ।' },
  Y: { en: 'Extend your thumb and pinky, fold the other three fingers.', hi: 'अंगूठा और छोटी उंगली फैलाएँ, बाकी तीन मोड़ें।' },
}

export const EMERGENCY_PHRASES = [
  { en: 'Help me', hi: 'मेरी मदद करें' },
  { en: 'Call an ambulance', hi: 'एम्बुलेंस बुलाएँ' },
  { en: 'I am injured', hi: 'मुझे चोट लगी है' },
  { en: 'I need a doctor', hi: 'मुझे डॉक्टर चाहिए' },
  { en: 'Call the police', hi: 'पुलिस को बुलाएँ' },
]

// Drawing helpers for the hand skeleton overlay
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

export function drawHand(ctx, lm, w, h) {
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = '#3ea6ff'
  ctx.fillStyle = '#ff4e45'
  ctx.lineWidth = 2
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath()
    ctx.moveTo(lm[a].x * w, lm[a].y * h)
    ctx.lineTo(lm[b].x * w, lm[b].y * h)
    ctx.stroke()
  }
  for (const p of lm) {
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
}
