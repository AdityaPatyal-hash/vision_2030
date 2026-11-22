// Indian Sign Language (ISL) Alphabet Classifier from MediaPipe Hand Landmarks (21 points)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

function fingerExtended(lm, tip, pip, wrist) {
  return dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.12
}

export function classifyLetter(lm) {
  if (!lm || lm.length < 21) return null

  const wrist = lm[0]
  const handSize = dist(lm[0], lm[9]) || 0.001

  // Finger extension flags
  const index = fingerExtended(lm, 8, 6, wrist)
  const middle = fingerExtended(lm, 12, 10, wrist)
  const ring = fingerExtended(lm, 16, 14, wrist)
  const pinky = fingerExtended(lm, 20, 18, wrist)

  // Thumb analysis
  const thumbOut = dist(lm[4], lm[17]) / handSize > 1.25
  const thumbUp = lm[4].y < lm[3].y && lm[3].y < lm[2].y
  const thumbTouchIndex = dist(lm[4], lm[8]) < handSize * 0.28
  const thumbTouchMiddle = dist(lm[4], lm[12]) < handSize * 0.32

  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length

  // Helper distances
  const indexMiddleDist = dist(lm[8], lm[12])
  const isHorizontal = (tip, mcp) => Math.abs(lm[tip].x - lm[mcp].x) > Math.abs(lm[tip].y - lm[mcp].y) * 0.85
  const isPointingDown = (tip, pip) => lm[tip].y > lm[pip].y && lm[pip].y > lm[0].y

  // 1. Four fingers extended (B, C)
  if (extendedCount === 4) {
    if (!thumbOut) return 'B'
    return 'B'
  }

  // 2. Three fingers extended (W, F)
  if (extendedCount === 3) {
    if (thumbTouchIndex && middle && ring && pinky) return 'F'
    if (index && middle && ring && !pinky) return 'W'
  }

  // 3. Two fingers extended (V, U, R, K, H, P)
  if (index && middle && !ring && !pinky) {
    if (isPointingDown(8, 6) && isPointingDown(12, 10)) return 'P'
    if (isHorizontal(8, 5) && isHorizontal(12, 9)) return 'H'
    // Crossed fingers
    if (indexMiddleDist < handSize * 0.16) return 'R'
    // Thumb between index and middle
    if (thumbUp && dist(lm[4], lm[10]) < handSize * 0.32) return 'K'
    // Spread vs together
    if (indexMiddleDist > handSize * 0.28) return 'V'
    return 'U'
  }

  // 4. One finger extended (L, D, G, I, J, X, Z)
  if (index && !middle && !ring && !pinky) {
    if (thumbOut && dist(lm[4], lm[8]) > handSize * 0.65) return 'L'
    if (thumbTouchMiddle) return 'D'
    if (isHorizontal(8, 5)) return 'G'
    if (isPointingDown(8, 6) && lm[4].y > lm[2].y) return 'Q'
    // Hooked index
    const indexHooked = dist(lm[8], lm[5]) < handSize * 0.52
    if (indexHooked) return 'X'
    return 'Z'
  }

  // Only pinky extended (I, Y)
  if (!index && !middle && !ring && pinky) {
    if (thumbOut) return 'Y'
    return 'I'
  }

  // 5. Thumb + Pinky only (Y or J)
  if (thumbOut && pinky && !index && !middle && !ring) {
    return 'Y'
  }

  // 6. Curved Hand (C, O)
  const isCurved = dist(lm[8], lm[0]) < dist(lm[6], lm[0]) * 1.15 && dist(lm[8], lm[0]) > dist(lm[5], lm[0]) * 0.9
  if (isCurved && dist(lm[4], lm[8]) < handSize * 0.45 && !thumbTouchIndex) {
    if (dist(lm[4], lm[8]) < handSize * 0.26 && dist(lm[4], lm[12]) < handSize * 0.32) return 'O'
    return 'C'
  }

  // 7. Closed Fist Shapes (0 extended fingers: A, E, M, N, S, T)
  if (extendedCount === 0) {
    // Thumb tucked between index and middle
    if (dist(lm[4], lm[6]) < handSize * 0.26) return 'T'
    // Thumb tucked under ring finger
    if (dist(lm[4], lm[14]) < handSize * 0.28) return 'M'
    // Thumb tucked under middle finger
    if (dist(lm[4], lm[10]) < handSize * 0.28) return 'N'
    // Thumb crossed in front of fingers
    if (dist(lm[4], lm[9]) < handSize * 0.35 && lm[4].y < lm[10].y) return 'S'
    // E: Fingertips curled against palm, thumb tucked at bottom
    if (lm[4].y > lm[8].y && lm[4].y > lm[12].y) return 'E'
    // A: Thumb upright or alongside index
    if (thumbUp || lm[4].y < lm[6].y) return 'A'
    return 'A'
  }

  return null
}

export const LETTER_GUIDES = {
  A: { en: 'Make a fist with your thumb resting upright alongside your index finger.', hi: 'मुट्ठी बनाएँ, अंगूठा तर्जनी की बगल में सीधा रखें।' },
  B: { en: 'Hold four fingers straight up together, thumb folded across your palm.', hi: 'चारों उंगलियाँ सीधी ऊपर सटाकर रखें और अंगूठे को हथेली पर मोड़ें।' },
  C: { en: 'Curve your fingers and thumb forward into a C shape.', hi: 'उंगलियों और अंगूठे को मोड़कर C का आकार बनाएँ।' },
  D: { en: 'Index finger pointing straight up, thumb touching middle fingertip to form a loop.', hi: 'तर्जनी सीधी ऊपर रखें, अंगूठे को मध्यमा से मिलाकर घेरा बनाएँ।' },
  E: { en: 'Curl all fingertips tightly down into your palm with thumb tucked underneath.', hi: 'सभी उंगलियाँ नीचे मोड़ें और अंगूठे को नीचे दबाएँ।' },
  F: { en: 'Touch index tip to thumb tip, keeping other three fingers extended straight up.', hi: 'तर्जनी और अंगूठे के सिरे मिलाएँ, बाकी तीन उंगलियाँ ऊपर सीधी रखें।' },
  G: { en: 'Point your index finger horizontally forward with thumb parallel.', hi: 'तर्जनी उंगली को क्षैतिज रूप से आगे की ओर करें।' },
  H: { en: 'Extend index and middle fingers together horizontally forward.', hi: 'तर्जनी और मध्यमा दोनों उंगलियाँ आगे की ओर सीधी रखें।' },
  I: { en: 'Extend only your pinky finger straight up, keeping other fingers closed.', hi: 'सिर्फ सबसे छोटी उंगली (कनिष्ठिका) को ऊपर सीधा रखें।' },
  J: { en: 'Extend your pinky finger and trace a small hook shape.', hi: 'छोटी उंगली सीधी रखकर हल्का सा घुमावदार आकार बनाएँ।' },
  K: { en: 'Extend index finger up, middle finger forward, thumb between them.', hi: 'तर्जनी सीधी ऊपर, मध्यमा आगे और अंगूठा दोनों के बीच रखें।' },
  L: { en: 'Extend your index finger up and thumb sideways to form an L shape.', hi: 'तर्जनी सीधी ऊपर और अंगूठा फैलाकर L आकार बनाएँ।' },
  M: { en: 'Fold your three fingers (index, middle, ring) over your tucked thumb.', hi: 'अंगूठे को मोड़कर उसके ऊपर तीन उंगलियाँ रखें।' },
  N: { en: 'Fold your index and middle fingers over your tucked thumb.', hi: 'अंगूठे के ऊपर सिर्फ दो उंगलियाँ (तर्जनी व मध्यमा) रखें।' },
  O: { en: 'Touch all fingertips to your thumb tip forming an O shape.', hi: 'सभी उंगलियों के सिरे अंगूठे से मिलाकर O का आकार बनाएँ।' },
  P: { en: 'Point your index and middle fingers downwards with thumb supporting.', hi: 'तर्जनी और मध्यमा को नीचे की ओर झुकाकर रखें।' },
  Q: { en: 'Point index and thumb downward together like a hook.', hi: 'तर्जनी और अंगूठे को नीचे की ओर हुक के रूप में रखें।' },
  R: { en: 'Cross your middle finger over your index finger.', hi: 'मध्यमा उंगली को तर्जनी के ऊपर क्रॉस करके रखें।' },
  S: { en: 'Make a tight fist with thumb folded across the front of all fingers.', hi: 'मुट्ठी बनाएँ और अंगूठे को उंगलियों के ऊपर कसकर रखें।' },
  T: { en: 'Tuck thumb between your index and middle finger in a fist.', hi: 'अंगूठे को तर्जनी और मध्यमा के बीच से बाहर निकालें।' },
  U: { en: 'Hold index and middle fingers straight up tightly together.', hi: 'तर्जनी और मध्यमा दोनों उंगलियों को सटाकर सीधा ऊपर रखें।' },
  V: { en: 'Extend index and middle fingers spread apart in a V shape.', hi: 'तर्जनी और मध्यमा उंगलियाँ फैलाकर V आकार बनाएँ।' },
  W: { en: 'Extend index, middle, and ring fingers spread apart in a W.', hi: 'तर्जनी, मध्यमा और अनामिका तीनों उंगलियाँ फैलाकर W बनाएँ।' },
  X: { en: 'Bend your index finger into a hook shape, others closed.', hi: 'तर्जनी उंगली को मोड़कर हुक का आकार बनाएँ।' },
  Y: { en: 'Extend your thumb and pinky finger outward, other three folded.', hi: 'अंगूठा और छोटी उंगली बाहर फैलाएँ, बाकी तीन मोड़ें।' },
  Z: { en: 'Point index finger forward and trace a Z shape.', hi: 'तर्जनी उंगली से हवा में Z का आकार बनाएँ।' },
}

export const EMERGENCY_PHRASES = [
  { en: 'Help me', hi: 'मेरी मदद करें' },
  { en: 'Call an ambulance', hi: 'एम्बुलेंस बुलाएँ' },
  { en: 'I am injured', hi: 'मुझे चोट लगी है' },
  { en: 'I need a doctor', hi: 'मुझे डॉक्टर चाहिए' },
  { en: 'Call the police', hi: 'पुलिस को बुलाएँ' },
]

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
