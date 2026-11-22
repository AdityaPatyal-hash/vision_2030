// Strictly Indian Sign Language (ISL) Two-Handed Alphabet Classifier from MediaPipe Landmarks
// ISL is predominantly a two-handed sign language (derived from the BANZSL family).
// Vowels (A, E, I, O, U) use the dominant index pointing to the 5 fingers of the non-dominant hand.
// Consonants use interactive two-handed shapes (B, D, F, G, H, K, L, M, N, P, Q, R, S, T, V, W, X, Y, Z).

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

function fingerExtended(lm, tip, pip, wrist) {
  return dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.12
}

function getHandDetails(lm) {
  const wrist = lm[0]
  const handSize = dist(lm[0], lm[9]) || 0.001

  const index = fingerExtended(lm, 8, 6, wrist)
  const middle = fingerExtended(lm, 12, 10, wrist)
  const ring = fingerExtended(lm, 16, 14, wrist)
  const pinky = fingerExtended(lm, 20, 18, wrist)

  const thumbOut = dist(lm[4], lm[17]) / handSize > 1.25
  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length

  return {
    lm,
    wrist,
    handSize,
    index,
    middle,
    ring,
    pinky,
    thumbOut,
    extendedCount,
  }
}

export function classifyISL(multiHands) {
  if (!multiHands || !multiHands.length) return null

  // If only 1 hand is visible
  if (multiHands.length === 1) {
    const h = getHandDetails(multiHands[0])
    // C is single-handed curved shape
    const isCurved =
      dist(h.lm[8], h.lm[0]) < dist(h.lm[6], h.lm[0]) * 1.15 &&
      dist(h.lm[8], h.lm[0]) > dist(h.lm[5], h.lm[0]) * 0.85
    const thumbIndexGap = dist(h.lm[4], h.lm[8])
    if (isCurved && thumbIndexGap > h.handSize * 0.4 && thumbIndexGap < h.handSize * 0.95) {
      return 'C'
    }
    return null
  }

  // Two hands visible
  const h1 = getHandDetails(multiHands[0])
  const h2 = getHandDetails(multiHands[1])
  const avgHandSize = (h1.handSize + h2.handSize) / 2

  // Determine base (passive open palm or pointing) vs acting (pointing/shaping) hand
  let base = h1
  let acting = h2
  if (h2.extendedCount > h1.extendedCount) {
    base = h2
    acting = h1
  }

  const actingTip = acting.lm[8] // Dominant index fingertip

  // ==========================================
  // 1. ISL VOWELS (A, E, I, O, U)
  // Non-dominant hand flat; dominant index touches one of the 5 fingertips.
  // Thumb = A, Index = E, Middle = I, Ring = O, Pinky = U
  // ==========================================
  if (base.extendedCount >= 3) {
    const dA = dist(actingTip, base.lm[4])  // Thumb tip
    const dE = dist(actingTip, base.lm[8])  // Index tip
    const dI = dist(actingTip, base.lm[12]) // Middle tip
    const dO = dist(actingTip, base.lm[16]) // Ring tip
    const dU = dist(actingTip, base.lm[20]) // Pinky tip

    const minVowelDist = Math.min(dA, dE, dI, dO, dU)
    if (minVowelDist < avgHandSize * 0.48) {
      if (minVowelDist === dA) return 'A'
      if (minVowelDist === dE) return 'E'
      if (minVowelDist === dI) return 'I'
      if (minVowelDist === dO) return 'O'
      if (minVowelDist === dU) return 'U'
    }

    // ==========================================
    // 2. PALM TOUCH CONSONANTS (M, N, L, V, H, R, Z, T)
    // Acting fingers resting on or touching base palm
    // ==========================================
    const palmCenter = base.lm[9] // MCP of middle finger (center of palm)
    const distToPalm = dist(actingTip, palmCenter)

    if (distToPalm < avgHandSize * 0.6) {
      // V: Dominant index & middle spread apart resting on base palm
      if (acting.index && acting.middle && !acting.ring && !acting.pinky) {
        const fingerSpread = dist(acting.lm[8], acting.lm[12])
        if (fingerSpread > avgHandSize * 0.25) return 'V'
        // N: Two fingers close together on base palm
        return 'N'
      }

      // M: Three fingers (index, middle, ring) on base palm
      if (acting.index && acting.middle && acting.ring && !acting.pinky) {
        return 'M'
      }

      // L: Single dominant index resting across base palm
      if (acting.index && !acting.middle && !acting.ring && !acting.pinky && !acting.thumbOut) {
        return 'L'
      }

      // H: Both flat palms sliding across each other
      if (acting.extendedCount >= 3) {
        return 'H'
      }

      // R: Curved index resting in palm
      if (!acting.middle && !acting.ring && !acting.pinky) {
        return 'R'
      }

      // Z: Perpendicular hand edge touching palm
      return 'Z'
    }

    // T: Dominant index touches lower edge of base hand near wrist
    if (dist(actingTip, base.wrist) < avgHandSize * 0.42) {
      return 'T'
    }

    // Y: Dominant index placed in the crook between thumb & index of base hand
    if (dist(actingTip, base.lm[2]) < avgHandSize * 0.4) {
      return 'Y'
    }
  }

  // ==========================================
  // 3. X: Crossed Index Fingers
  // ==========================================
  if (h1.index && !h1.ring && !h1.pinky && h2.index && !h2.ring && !h2.pinky) {
    const indexCrossDist = dist(h1.lm[8], h2.lm[7])
    const indexCrossDist2 = dist(h2.lm[8], h1.lm[7])
    const tipDist = dist(h1.lm[8], h2.lm[8])
    if (Math.min(indexCrossDist, indexCrossDist2, tipDist) < avgHandSize * 0.42) {
      return 'X'
    }
  }

  // ==========================================
  // 4. G: Stacked Fists (Both closed, one on top of the other)
  // ==========================================
  if (h1.extendedCount === 0 && h2.extendedCount === 0) {
    const xDiff = Math.abs(h1.wrist.x - h2.wrist.x)
    const yDiff = Math.abs(h1.wrist.y - h2.wrist.y)
    if (xDiff < avgHandSize * 1.1 && yDiff > avgHandSize * 0.35 && yDiff < avgHandSize * 1.8) {
      return 'G'
    }
  }

  // ==========================================
  // 5. B: Double Loop (Thumbs and index fingers of both hands touching)
  // ==========================================
  const indexDist = dist(h1.lm[8], h2.lm[8])
  const thumbDist = dist(h1.lm[4], h2.lm[4])
  if (indexDist < avgHandSize * 0.42 && thumbDist < avgHandSize * 0.42) {
    return 'B'
  }

  // ==========================================
  // 6. D, K, P: Upright Index Base Hand
  // Base index pointing up, acting hand forms loop or touches joint
  // ==========================================
  const isUpright = (h) => h.index && !h.middle && !h.ring && !h.pinky && h.lm[8].y < h.lm[6].y
  if (isUpright(base)) {
    // P: Loop formed at the top of the upright index
    if (dist(acting.lm[8], base.lm[8]) < avgHandSize * 0.38 && dist(acting.lm[4], base.lm[8]) < avgHandSize * 0.38) {
      return 'P'
    }
    // D: Acting thumb and index touch base index to complete 'D'
    if (dist(acting.lm[8], base.lm[8]) < avgHandSize * 0.45 && dist(acting.lm[4], base.lm[5]) < avgHandSize * 0.45) {
      return 'D'
    }
    // K: Acting hooked index touches the joint of base index
    if (dist(acting.lm[8], base.lm[6]) < avgHandSize * 0.38) {
      return 'K'
    }
  }

  // ==========================================
  // 7. F: Crossed Pairs of Fingers (2 fingers cross 2 fingers)
  // ==========================================
  if (h1.index && h1.middle && !h1.ring && !h1.pinky && h2.index && h2.middle && !h2.ring && !h2.pinky) {
    if (dist(h1.lm[8], h2.lm[10]) < avgHandSize * 0.45 && dist(h2.lm[8], h1.lm[10]) < avgHandSize * 0.45) {
      return 'F'
    }
  }

  // ==========================================
  // 8. W: Both Hands Interlocked/Upright (W Shape)
  // ==========================================
  if (h1.extendedCount >= 3 && h2.extendedCount >= 3) {
    if (dist(h1.lm[8], h2.lm[8]) < avgHandSize * 0.45 && dist(h1.lm[12], h2.lm[12]) < avgHandSize * 0.5) {
      return 'W'
    }
  }

  // ==========================================
  // 9. S: Pinkies Hooked Together
  // ==========================================
  if (dist(h1.lm[20], h2.lm[20]) < avgHandSize * 0.32) {
    return 'S'
  }

  // ==========================================
  // 10. Q: Hook through Loop
  // ==========================================
  const isLoop = (h) => dist(h.lm[4], h.lm[8]) < avgHandSize * 0.3
  if (isLoop(base) && dist(actingTip, base.lm[8]) < avgHandSize * 0.38) {
    return 'Q'
  }

  return null
}

export const LETTER_GUIDES = {
  A: {
    en: 'Hold your non-dominant hand flat; touch the THUMB tip with your dominant index finger.',
    hi: 'एक हाथ खुला रखें; दूसरे हाथ की तर्जनी से उसके अंगूठे (Thumb) के सिरे को छुएँ।',
  },
  B: {
    en: 'Touch the thumbs and index fingers of both hands together to form the double loop of B.',
    hi: 'दोनों हाथों के अंगूठे और तर्जनी को आपस में मिलाकर B के दो घेरे बनाएँ।',
  },
  C: {
    en: 'Curve your dominant hand into a C shape with fingers and thumb in an arc.',
    hi: 'अपने हाथ की उंगलियों और अंगूठे को मोड़कर C का स्पष्ट आकार बनाएँ।',
  },
  D: {
    en: 'Hold non-dominant index straight up; touch its tip and base with dominant thumb and index to form D.',
    hi: 'बाएँ हाथ की तर्जनी सीधी ऊपर रखें; दाएँ हाथ के अंगूठे व तर्जनी से अर्धवृत्त बनाकर D बनाएँ।',
  },
  E: {
    en: 'Hold non-dominant hand flat; touch the INDEX fingertip with your dominant index finger.',
    hi: 'एक हाथ खुला रखें; दूसरे हाथ की तर्जनी से उसकी तर्जनी (Index finger) के सिरे को छुएँ।',
  },
  F: {
    en: 'Place two fingers (index & middle) of dominant hand across two fingers of non-dominant hand.',
    hi: 'एक हाथ की दो उंगलियों (तर्जनी व मध्यमा) पर दूसरे हाथ की दो उंगलियाँ क्रॉस करके रखें।',
  },
  G: {
    en: 'Make two closed fists and stack your dominant fist directly on top of the non-dominant fist.',
    hi: 'दोनों हाथों की मुट्ठियाँ बनाएँ और एक मुट्ठी को दूसरी मुट्ठी के ऊपर रखें।',
  },
  H: {
    en: 'Hold non-dominant hand flat; sweep your dominant flat palm across it from wrist to fingers.',
    hi: 'एक हथेली सीधी रखें और दूसरे हाथ की हथेली से उस पर सीधी रेखा खींचें।',
  },
  I: {
    en: 'Hold non-dominant hand flat; touch the MIDDLE fingertip with your dominant index finger.',
    hi: 'एक हाथ खुला रखें; दूसरे हाथ की तर्जनी से उसकी बीच वाली उंगली (मध्यमा) के सिरे को छुएँ।',
  },
  J: {
    en: 'Touch the middle fingertip of non-dominant hand, then trace down into the center of the palm.',
    hi: 'मध्यमा उंगली के सिरे से शुरू करके हथेली के बीच तक नीचे की ओर उंगली घुमाएँ।',
  },
  K: {
    en: 'Hold non-dominant index straight up; touch its joint with dominant hooked index finger.',
    hi: 'एक हाथ की तर्जनी सीधी रखें, दूसरे हाथ की मुड़ी हुई तर्जनी से उसके जोड़ को छुएँ।',
  },
  L: {
    en: 'Hold non-dominant hand flat palm up; place dominant index finger flat across it to form L.',
    hi: 'खुली हथेली पर दूसरे हाथ की तर्जनी उंगली क्षैतिज रखकर L का आकार बनाएँ।',
  },
  M: {
    en: 'Place THREE fingers (index, middle, ring) of dominant hand on non-dominant open palm.',
    hi: 'खुली हथेली पर दूसरे हाथ की तीन उंगलियाँ (तर्जनी, मध्यमा, अनामिका) रखें।',
  },
  N: {
    en: 'Place TWO fingers (index, middle) of dominant hand on non-dominant open palm.',
    hi: 'खुली हथेली पर दूसरे हाथ की दो उंगलियाँ (तर्जनी व मध्यमा) रखें।',
  },
  O: {
    en: 'Hold non-dominant hand flat; touch the RING fingertip with your dominant index finger.',
    hi: 'एक हाथ खुला रखें; दूसरे हाथ की तर्जनी से उसकी अनामिका (Ring finger) के सिरे को छुएँ।',
  },
  P: {
    en: 'Hold non-dominant index straight up; form a loop with dominant thumb and index at its top.',
    hi: 'एक हाथ की तर्जनी सीधी ऊपर रखें; दूसरे हाथ के अंगूठे व तर्जनी से उसके शीर्ष पर P का घेरा बनाएँ।',
  },
  Q: {
    en: 'Form a circle with non-dominant thumb and index; hook your dominant index into it.',
    hi: 'एक हाथ से घेरा बनाएँ और दूसरे हाथ की तर्जनी को उसमें हुक की तरह जोड़ें।',
  },
  R: {
    en: 'Hook your dominant index finger and rest it curved in the palm of non-dominant hand.',
    hi: 'दाएँ हाथ की तर्जनी को हल्का सा मोड़कर बाएँ हाथ की खुली हथेली पर रखें।',
  },
  S: {
    en: 'Hook your dominant pinky finger over non-dominant pinky finger.',
    hi: 'दोनों हाथों की छोटी उंगलियों (पिंकी) को आपस में फँसाएँ।',
  },
  T: {
    en: 'Touch dominant index finger to the lower edge of non-dominant hand near the wrist.',
    hi: 'खुले हाथ के निचले किनारे पर दूसरे हाथ की तर्जनी उंगली छुएँ।',
  },
  U: {
    en: 'Hold non-dominant hand flat; touch the PINKY fingertip with your dominant index finger.',
    hi: 'एक हाथ खुला रखें; दूसरे हाथ की तर्जनी से उसकी सबसे छोटी उंगली (कनिष्ठिका) के सिरे को छुएँ।',
  },
  V: {
    en: 'Make a V sign (two spread fingers) with dominant hand and place its tips on non-dominant palm.',
    hi: 'दाएँ हाथ से V (दो उंगलियाँ फैलाकर) बनाएँ और बाएँ हाथ की हथेली पर रखें।',
  },
  W: {
    en: 'Interlock the fingers of both hands together with fingertips pointing upwards.',
    hi: 'दोनों हाथों की उंगलियों को आपस में जोड़कर W का आकार बनाएँ।',
  },
  X: {
    en: 'Cross both index fingers over each other to form an X shape.',
    hi: 'दोनों हाथों की तर्जनी उंगलियों को एक-दूसरे के ऊपर क्रॉस करके X बनाएँ।',
  },
  Y: {
    en: 'Spread non-dominant thumb and index; place dominant index in the crook between them.',
    hi: 'बाएँ हाथ के अंगूठे और तर्जनी के बीच दाएँ हाथ की तर्जनी उंगली रखें।',
  },
  Z: {
    en: 'Hold non-dominant hand vertical; place dominant hand flat against it perpendicularly.',
    hi: 'एक हाथ सीधा खड़ा रखें, दूसरा हाथ उसकी हथेली के बीच में 90 डिग्री पर रखें।',
  },
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
  ctx.strokeStyle = '#3ea6ff'
  ctx.fillStyle = '#ff4e45'
  ctx.lineWidth = 2.5
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath()
    ctx.moveTo(lm[a].x * w, lm[a].y * h)
    ctx.lineTo(lm[b].x * w, lm[b].y * h)
    ctx.stroke()
  }
  for (const p of lm) {
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}
