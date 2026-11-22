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

// Symmetric helper to test rules in both directions (h1 as base, h2 as acting OR h2 as base, h1 as acting)
function testBoth(h1, h2, fn) {
  return fn(h1, h2) || fn(h2, h1)
}

export function classifyISL(multiHands) {
  if (!multiHands || !multiHands.length) return null

  // If only 1 hand is visible
  if (multiHands.length === 1) {
    const h = getHandDetails(multiHands[0])
    // C is single-handed curved C shape
    const isCurved =
      dist(h.lm[8], h.lm[0]) < dist(h.lm[6], h.lm[0]) * 1.18 &&
      dist(h.lm[8], h.lm[0]) > dist(h.lm[5], h.lm[0]) * 0.8
    const thumbIndexGap = dist(h.lm[4], h.lm[8])
    if (isCurved && thumbIndexGap > h.handSize * 0.35 && thumbIndexGap < h.handSize * 1.0) {
      return 'C'
    }
    return null
  }

  // Two hands visible
  const h1 = getHandDetails(multiHands[0])
  const h2 = getHandDetails(multiHands[1])
  const avgHandSize = (h1.handSize + h2.handSize) / 2

  // ==========================================
  // 1. ISL LETTER 'X' (Both index fingers crossed)
  // ==========================================
  if (h1.index && !h1.ring && !h1.pinky && h2.index && !h2.ring && !h2.pinky) {
    const tipDist = dist(h1.lm[8], h2.lm[8])
    const cross1 = dist(h1.lm[8], h2.lm[6])
    const cross2 = dist(h2.lm[8], h1.lm[6])
    if (Math.min(tipDist, cross1, cross2) < avgHandSize * 0.45) {
      return 'X'
    }
  }

  // ==========================================
  // 2. ISL LETTER 'B' (Thumbs & index fingers of both hands touching in double-loop)
  // ==========================================
  const indexDist = dist(h1.lm[8], h2.lm[8])
  const thumbDist = dist(h1.lm[4], h2.lm[4])
  if (indexDist < avgHandSize * 0.48 && thumbDist < avgHandSize * 0.55) {
    return 'B'
  }

  // ==========================================
  // 3. ISL LETTER 'G' (Stacked fists, one above the other)
  // ==========================================
  if (h1.extendedCount === 0 && h2.extendedCount === 0) {
    const xDiff = Math.abs(h1.wrist.x - h2.wrist.x)
    const yDiff = Math.abs(h1.wrist.y - h2.wrist.y)
    if (xDiff < avgHandSize * 1.2 && yDiff > avgHandSize * 0.3 && yDiff < avgHandSize * 1.9) {
      return 'G'
    }
  }

  // ==========================================
  // 4. ISL LETTER 'W' (Both hands upright, fingers interlocked or aligned)
  // ==========================================
  if (h1.extendedCount >= 3 && h2.extendedCount >= 3) {
    const tipsClose = dist(h1.lm[8], h2.lm[8]) < avgHandSize * 0.55 && dist(h1.lm[12], h2.lm[12]) < avgHandSize * 0.6
    const bothUp = h1.lm[8].y < h1.lm[6].y && h2.lm[8].y < h2.lm[6].y
    if (tipsClose && bothUp) {
      return 'W'
    }
  }

  // ==========================================
  // 5. ISL LETTER 'F' (Two fingers of dominant hand crossing two fingers of non-dominant hand)
  // ==========================================
  const fCheck = (base, acting) => {
    if (base.index && base.middle && !base.ring && !base.pinky && acting.index && acting.middle && !acting.ring && !acting.pinky) {
      const crossDist = dist(acting.lm[8], base.lm[10])
      const crossDist2 = dist(acting.lm[12], base.lm[6])
      if (Math.min(crossDist, crossDist2) < avgHandSize * 0.45) return 'F'
    }
    return null
  }
  const fRes = testBoth(h1, h2, fCheck)
  if (fRes) return fRes

  // ==========================================
  // 6. ISL LETTERS D, P, K (Upright index on base hand)
  // ==========================================
  const uprightIndexCheck = (base, acting) => {
    // Base hand has index pointing up
    const baseUpright = base.index && !base.middle && !base.ring && !base.pinky && base.lm[8].y < base.lm[6].y
    if (!baseUpright) return null

    // P: Loop formed at the top of the upright index
    const loopAtTop = dist(acting.lm[8], base.lm[8]) < avgHandSize * 0.45 && dist(acting.lm[4], base.lm[8]) < avgHandSize * 0.52
    if (loopAtTop) return 'P'

    // D: Acting thumb and index form semicircle touching upright index tip & base
    const touchTop = dist(acting.lm[8], base.lm[8]) < avgHandSize * 0.55 || dist(acting.lm[4], base.lm[8]) < avgHandSize * 0.55
    const touchBottom = dist(acting.lm[4], base.lm[5]) < avgHandSize * 0.65 || dist(acting.lm[8], base.lm[5]) < avgHandSize * 0.65 || dist(acting.lm[4], base.wrist) < avgHandSize * 0.75
    if (touchTop && touchBottom) return 'D'

    // Also catch D when acting hand forms C touching upright index
    if (dist(acting.lm[8], base.lm[8]) < avgHandSize * 0.48 && dist(acting.lm[4], base.lm[6]) < avgHandSize * 0.55) {
      return 'D'
    }

    // K: Acting hooked index touches the joint (PIP) of base index
    if (dist(acting.lm[8], base.lm[6]) < avgHandSize * 0.42 && !acting.middle) {
      return 'K'
    }

    return null
  }
  const uprightRes = testBoth(h1, h2, uprightIndexCheck)
  if (uprightRes) return uprightRes

  // ==========================================
  // 7. ISL LETTER S (Pinkies hooked together)
  // ==========================================
  if (dist(h1.lm[20], h2.lm[20]) < avgHandSize * 0.35) {
    return 'S'
  }

  // ==========================================
  // 8. ISL LETTER Q (Hook through/into loop)
  // ==========================================
  const qCheck = (base, acting) => {
    const isLoop = dist(base.lm[4], base.lm[8]) < avgHandSize * 0.35
    if (isLoop && dist(acting.lm[8], base.lm[8]) < avgHandSize * 0.42) {
      return 'Q'
    }
    return null
  }
  const qRes = testBoth(h1, h2, qCheck)
  if (qRes) return qRes

  // ==========================================
  // 9. ISL VOWELS (A, E, I, O, U)
  // Open base hand (at least 2 fingers extended + thumb available).
  // Acting index touches: Thumb = A, Index = E, Middle = I, Ring = O, Pinky = U.
  // ==========================================
  const vowelCheck = (base, acting) => {
    // Base hand should be relatively open
    if (base.extendedCount >= 2) {
      const actingTip = acting.lm[8] // Pointer fingertip

      const dA = dist(actingTip, base.lm[4])  // Thumb tip
      const dE = dist(actingTip, base.lm[8])  // Index tip
      const dI = dist(actingTip, base.lm[12]) // Middle tip
      const dO = dist(actingTip, base.lm[16]) // Ring tip
      const dU = dist(actingTip, base.lm[20]) // Pinky tip

      const minVowelDist = Math.min(dA, dE, dI, dO, dU)

      // Generous distance threshold so touching is easy and natural
      if (minVowelDist < avgHandSize * 0.55) {
        if (minVowelDist === dA) return 'A'
        if (minVowelDist === dE) return 'E'
        if (minVowelDist === dI) return 'I'
        if (minVowelDist === dO) return 'O'
        if (minVowelDist === dU) return 'U'
      }
    }
    return null
  }
  const vowelRes = testBoth(h1, h2, vowelCheck)
  if (vowelRes) return vowelRes

  // ==========================================
  // 10. PALM INTERACTION CONSONANTS (M, N, V, L, Y, T, H, R, Z)
  // ==========================================
  const palmCheck = (base, acting) => {
    if (base.extendedCount >= 2) {
      const actingTip = acting.lm[8]
      const palmCenter = base.lm[9]
      const distToPalm = dist(actingTip, palmCenter)

      // Y: Dominant index placed in the crook/V between base thumb and index
      const distToCrook = dist(actingTip, base.lm[2])
      if (distToCrook < avgHandSize * 0.42 && base.thumbOut) {
        return 'Y'
      }

      // T: Dominant index touches lower edge near base wrist
      const distToWrist = dist(actingTip, base.wrist)
      if (distToWrist < avgHandSize * 0.45 && distToPalm > avgHandSize * 0.35) {
        return 'T'
      }

      // Touches on the palm surface
      if (distToPalm < avgHandSize * 0.65) {
        // V: Two fingers spread in V on palm
        if (acting.index && acting.middle && !acting.ring && !acting.pinky) {
          const spread = dist(acting.lm[8], acting.lm[12])
          if (spread > avgHandSize * 0.22) return 'V'
          // N: Two fingers together on palm
          return 'N'
        }

        // M: Three fingers (index, middle, ring) on palm
        if (acting.index && acting.middle && acting.ring && !acting.pinky) {
          return 'M'
        }

        // L: Single dominant index resting across palm
        if (acting.index && !acting.middle && !acting.ring && !acting.pinky && !acting.thumbOut) {
          return 'L'
        }

        // H: Both flat palms sliding across each other
        if (acting.extendedCount >= 3) {
          return 'H'
        }

        // R: Curled index on palm
        if (!acting.middle && !acting.ring && !acting.pinky) {
          return 'R'
        }

        // Z: Perpendicular hand edge touching palm
        return 'Z'
      }
    }
    return null
  }
  const palmRes = testBoth(h1, h2, palmCheck)
  if (palmRes) return palmRes

  return null
}

export const LETTER_GUIDES = {
  A: {
    en: 'Hold non-dominant hand flat palm forward; touch the THUMB tip with dominant index finger.',
    hi: 'एक हाथ खुला रखें; दूसरे हाथ की तर्जनी से उसके अंगूठे (Thumb) के सिरे को छुएँ।',
  },
  B: {
    en: 'Touch thumbs and index fingers of both hands together to form the double loop of B.',
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
    en: 'Hold non-dominant hand flat; touch the INDEX fingertip with dominant index finger.',
    hi: 'एक हाथ खुला रखें; दूसरे हाथ की तर्जनी से उसकी तर्जनी (Index finger) के सिरे को छुएँ।',
  },
  F: {
    en: 'Place two fingers (index & middle) of dominant hand across two fingers of non-dominant hand.',
    hi: 'एक हाथ की दो उंगलियों (तर्जनी व मध्यमा) पर दूसरे हाथ की दो उंगलियाँ क्रॉस करके रखें।',
  },
  G: {
    en: 'Make two closed fists and stack dominant fist directly on top of non-dominant fist.',
    hi: 'दोनों हाथों की मुट्ठियाँ बनाएँ और एक मुट्ठी को दूसरी मुट्ठी के ऊपर रखें।',
  },
  H: {
    en: 'Hold non-dominant hand flat; sweep dominant flat palm across it from wrist to fingers.',
    hi: 'एक हथेली सीधी रखें और दूसरे हाथ की हथेली से उस पर सीधी रेखा खींचें।',
  },
  I: {
    en: 'Hold non-dominant hand flat; touch the MIDDLE fingertip with dominant index finger.',
    hi: 'एक हाथ खुला रखें; दूसरे हाथ की तर्जनी से उसकी बीच वाली उंगली (मध्यमा) के सिरे को छुएँ।',
  },
  J: {
    en: 'Touch middle fingertip of non-dominant hand, then trace down into the palm.',
    hi: 'मध्यमा उंगली के सिरे से शुरू करके हथेली के बीच तक नीचे की ओर उंगली घुमाएँ।',
  },
  K: {
    en: 'Hold non-dominant index straight up; touch its middle joint with dominant hooked index finger.',
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
    en: 'Hold non-dominant hand flat; touch the RING fingertip with dominant index finger.',
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
    en: 'Hook dominant index finger and rest it curved in the palm of non-dominant hand.',
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
    en: 'Hold non-dominant hand flat; touch the PINKY fingertip with dominant index finger.',
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
