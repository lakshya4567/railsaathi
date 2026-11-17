// i18n.js — English / Hindi labels for the navbar, the Journey AI chat and the Services page.
// (Train and station names always stay exactly as stored in the database.)

export const LANGS = ['en', 'hi']
const KEY = 'railsaathi_lang'

export function getInitialLang() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'hi' || v === 'en' ? v : 'en'
  } catch { return 'en' }
}
export function saveLang(lang) { try { localStorage.setItem(KEY, lang) } catch { /* not persisted */ } }

const D = {
  en: {
    'nav.home': 'Overview', 'nav.trains': 'Trains', 'nav.stations': 'Stations', 'nav.map': 'Network map',
    'nav.assistant': 'Journey AI', 'nav.services': 'Services', 'nav.lang': 'हिं',
    'ai.greeting': "Hello! I'm your RailSaathi journey assistant. Ask me about trains, routes, timetables and stations across India. I look everything up in the railway database.",
    'ai.placeholder': 'Ask about trains, routes, or stations...', 'ai.send': 'Send message', 'ai.newChat': 'New chat',
    'ai.footnote': 'Answers come from the timetable database. Positions are timetable estimates, not live tracking.',
    'ai.checking': 'Checking the railway database…', 'ai.setup': 'Setup needed: the AI service is not configured on the server yet.',
    'ai.settings': 'Settings', 'ai.homeStation': 'My home station', 'ai.homeHint': 'Type a station name or code, then pick it.',
    'ai.clearHome': 'Remove', 'ai.speak': 'Read answers aloud', 'ai.autoSend': 'Send voice questions automatically',
    'ai.mic': 'Speak your question', 'ai.listening': 'Listening… speak now', 'ai.voiceUnsupported': 'Voice input is not supported in this browser.',
    'ai.attach': 'Attach a ticket photo', 'ai.readingTicket': 'Reading your ticket photo…',
    'ai.ticketBig': 'That image could not be prepared. Try a smaller photo.', 'ai.sug1': 'Tell me about train 12951',
    'ai.sug2': 'Trains from Raipur to Nagpur', 'ai.sug3': 'Where can I go from Raipur in 6 hours?', 'ai.sug4': 'Plan Raipur to Nagpur, then Mumbai',
    'ai.demoBadge': 'DEMO', 'ai.stop': 'Stop', 'ai.ticketDone': 'Here is what I could read from your photo. Please check it.', 'ai.homeSaved': 'Saved as your home station',
    'b.showRoute': 'Show route', 'b.timetable': 'Full timetable', 'b.trainsHere': 'Trains here', 'b.openMap': 'Open on network map',
    'b.showMap': 'Show map', 'b.hideMap': 'Hide map', 'b.onMap': 'Show on map', 'b.stops': 'Stops', 'b.between': 'in between', 'b.direct': 'direct',
    'b.shortest': 'Shortest scheduled', 'b.calendar': 'Add to calendar', 'b.share': 'Share', 'b.copied': 'Copied to clipboard',
    'b.shared': 'Shared', 'b.date': 'Travel date', 'b.estimate': 'Timetable estimate · not live tracking',
    'b.reach': 'Reachable from {name}', 'b.within': 'within {h} h', 'b.compare': 'Compare trains', 'b.halts': 'Longest halts',
    'b.trip': 'Your trip', 'b.transfer': 'Journeys with one change', 'b.layover': 'Change time', 'b.changeAt': 'Change at',
    'b.fastest': 'Shortest', 'b.speed': 'Avg speed', 'b.longestHalt': 'Longest halt', 'b.distance': 'Distance', 'b.duration': 'Duration',
    'b.runs': 'Runs', 'b.departs': 'Departs', 'b.arrives': 'Arrives', 'b.station': 'Station', 'b.arr': 'Arr', 'b.dep': 'Dep', 'b.halt': 'Halt',
    'b.day': 'Day', 'b.wait': 'Wait', 'b.ride': 'Ride', 'b.mapped': '{m} of {n} stops have stored coordinates',
    'b.ticket': 'Ticket photo, read automatically', 'b.ticketCheck': 'Please check every field. This is not a confirmed booking.',
    'b.matched': 'Matched in database', 'b.noMatch': 'No match in database', 'b.confidence': 'Confidence', 'b.notTicket': 'This does not look like a railway ticket.',
    'b.showTrain': 'Show this train', 'b.consistent': 'Stations match this train\'s route in order', 'b.inconsistent': 'These stations do not match this train\'s route order',
    'demo.banner': 'DEMO', 'demo.notice': 'Simulated data for demonstration only. It is not real booking, fare, availability, running-status or order information.',
    'sv.title': 'Services', 'sv.subtitle': 'Try PNR search, food ordering, fares, seats and running status. All of these are demonstrations.',
    'sv.demoAll': 'Real PNR status, fares, seat availability, live running status and food ordering need approved access to IRCTC and Railways systems, which this app does not have. Everything here is simulated, nothing is booked or paid, and no order reaches any vendor.',
    'sv.pnr': 'PNR finder', 'sv.food': 'Order food', 'sv.fare': 'Fare and seats', 'sv.live': 'Running status',
    'sv.pnrLabel': 'Enter a 10-digit PNR', 'sv.pnrGo': 'Find train', 'sv.pnrHow': 'How this demo works',
    'sv.pickTrain': 'Choose a train', 'sv.trainSearch': 'Search by train number or name', 'sv.boarding': 'Station where you receive the food',
    'sv.menu': 'Menu', 'sv.cart': 'Your order', 'sv.empty': 'Nothing added yet', 'sv.total': 'Total', 'sv.place': 'Place demo order',
    'sv.placed': 'Demo order placed', 'sv.history': 'Your demo orders', 'sv.noHistory': 'No demo orders yet', 'sv.veg': 'Veg', 'sv.nonveg': 'Non-veg',
    'sv.from': 'From', 'sv.to': 'To', 'sv.class': 'Class', 'sv.any': 'All classes', 'sv.fareGo': 'Estimate fare', 'sv.seatGo': 'Check seats',
    'sv.liveGo': 'Check running status', 'sv.loading': 'Loading…', 'sv.clear': 'Clear history', 'sv.passengers': 'Passengers', 'sv.status': 'Status',
    'sv.chart': 'Chart', 'sv.boardingAt': 'Boarding', 'sv.destination': 'Destination', 'sv.delay': 'Simulated delay', 'sv.minutes': 'min',
  },
  hi: {
    'nav.home': 'मुख्य पृष्ठ', 'nav.trains': 'ट्रेनें', 'nav.stations': 'स्टेशन', 'nav.map': 'रेल नक्शा', 'nav.assistant': 'यात्रा एआई',
    'nav.services': 'सेवाएँ', 'nav.lang': 'EN',
    'ai.greeting': 'नमस्ते! मैं आपका रेलसाथी यात्रा सहायक हूँ। भारत भर की ट्रेनों, रूट, समय सारिणी और स्टेशनों के बारे में पूछिए। मैं हर जानकारी रेलवे डेटाबेस से देखता हूँ।',
    'ai.placeholder': 'ट्रेन, रूट या स्टेशन के बारे में पूछिए...', 'ai.send': 'भेजें', 'ai.newChat': 'नई बातचीत',
    'ai.footnote': 'जवाब समय सारिणी डेटाबेस से आते हैं। स्थिति केवल समय सारिणी का अनुमान है, लाइव ट्रैकिंग नहीं।',
    'ai.checking': 'रेलवे डेटाबेस देख रहा हूँ…', 'ai.setup': 'सेटअप ज़रूरी: सर्वर पर एआई सेवा अभी कॉन्फ़िगर नहीं है।',
    'ai.settings': 'सेटिंग', 'ai.homeStation': 'मेरा होम स्टेशन', 'ai.homeHint': 'स्टेशन का नाम या कोड लिखें, फिर चुनें।',
    'ai.clearHome': 'हटाएँ', 'ai.speak': 'जवाब बोलकर सुनाएँ', 'ai.autoSend': 'आवाज़ से पूछा सवाल अपने आप भेजें',
    'ai.mic': 'बोलकर पूछें', 'ai.listening': 'सुन रहा हूँ… अब बोलिए', 'ai.voiceUnsupported': 'इस ब्राउज़र में आवाज़ से इनपुट उपलब्ध नहीं है।',
    'ai.attach': 'टिकट की फ़ोटो जोड़ें', 'ai.readingTicket': 'टिकट की फ़ोटो पढ़ रहा हूँ…',
    'ai.ticketBig': 'यह फ़ोटो तैयार नहीं हो सकी। छोटी फ़ोटो आज़माएँ।', 'ai.sug1': 'ट्रेन 12951 के बारे में बताओ',
    'ai.sug2': 'रायपुर से नागपुर की ट्रेनें', 'ai.sug3': 'रायपुर से 6 घंटे में कहाँ जा सकता हूँ?', 'ai.sug4': 'रायपुर से नागपुर, फिर मुंबई की योजना बनाओ',
    'ai.demoBadge': 'डेमो', 'ai.stop': 'रोकें', 'ai.ticketDone': 'आपकी फ़ोटो से मैं यह पढ़ सका। कृपया जाँच लें।', 'ai.homeSaved': 'होम स्टेशन के रूप में सेव हुआ',
    'b.showRoute': 'रूट दिखाएँ', 'b.timetable': 'पूरी समय सारिणी', 'b.trainsHere': 'यहाँ की ट्रेनें', 'b.openMap': 'रेल नक्शे पर खोलें',
    'b.showMap': 'नक्शा दिखाएँ', 'b.hideMap': 'नक्शा छिपाएँ', 'b.onMap': 'नक्शे पर दिखाएँ', 'b.stops': 'ठहराव', 'b.between': 'बीच में', 'b.direct': 'सीधी',
    'b.shortest': 'सबसे कम निर्धारित समय', 'b.calendar': 'कैलेंडर में जोड़ें', 'b.share': 'साझा करें', 'b.copied': 'क्लिपबोर्ड पर कॉपी हुआ',
    'b.shared': 'साझा किया', 'b.date': 'यात्रा की तारीख', 'b.estimate': 'समय सारिणी का अनुमान · लाइव ट्रैकिंग नहीं',
    'b.reach': '{name} से पहुँच सकने वाले स्टेशन', 'b.within': '{h} घंटे के अंदर', 'b.compare': 'ट्रेनों की तुलना', 'b.halts': 'सबसे लंबे ठहराव',
    'b.trip': 'आपकी यात्रा', 'b.transfer': 'एक बदलाव वाली यात्राएँ', 'b.layover': 'बदलने का समय', 'b.changeAt': 'यहाँ बदलें',
    'b.fastest': 'सबसे कम समय', 'b.speed': 'औसत गति', 'b.longestHalt': 'सबसे लंबा ठहराव', 'b.distance': 'दूरी', 'b.duration': 'अवधि',
    'b.runs': 'चलती है', 'b.departs': 'प्रस्थान', 'b.arrives': 'आगमन', 'b.station': 'स्टेशन', 'b.arr': 'आगमन', 'b.dep': 'प्रस्थान', 'b.halt': 'ठहराव',
    'b.day': 'दिन', 'b.wait': 'प्रतीक्षा', 'b.ride': 'सफ़र', 'b.mapped': '{n} में से {m} ठहरावों के निर्देशांक उपलब्ध हैं',
    'b.ticket': 'टिकट फ़ोटो, अपने आप पढ़ी गई', 'b.ticketCheck': 'कृपया हर जानकारी जाँच लें। यह पुष्ट बुकिंग नहीं है।',
    'b.matched': 'डेटाबेस में मिला', 'b.noMatch': 'डेटाबेस में नहीं मिला', 'b.confidence': 'भरोसा', 'b.notTicket': 'यह रेलवे टिकट जैसा नहीं लगता।',
    'b.showTrain': 'यह ट्रेन दिखाएँ', 'b.consistent': 'स्टेशन इस ट्रेन के रूट के क्रम में हैं', 'b.inconsistent': 'ये स्टेशन इस ट्रेन के रूट के क्रम से नहीं मिलते',
    'demo.banner': 'डेमो', 'demo.notice': 'केवल प्रदर्शन के लिए बनावटी डेटा। यह असली बुकिंग, किराया, उपलब्धता, चलने की स्थिति या ऑर्डर की जानकारी नहीं है।',
    'sv.title': 'सेवाएँ', 'sv.subtitle': 'पीएनआर खोज, खाना ऑर्डर, किराया, सीट और चलने की स्थिति आज़माएँ। ये सभी केवल डेमो हैं।',
    'sv.demoAll': 'असली पीएनआर स्थिति, किराया, सीट उपलब्धता, लाइव चलने की स्थिति और खाना ऑर्डर के लिए आईआरसीटीसी और रेलवे सिस्टम की मंज़ूर पहुँच चाहिए, जो इस ऐप के पास नहीं है। यहाँ सब कुछ बनावटी है, कोई बुकिंग या भुगतान नहीं होता और कोई ऑर्डर किसी विक्रेता तक नहीं जाता।',
    'sv.pnr': 'पीएनआर खोज', 'sv.food': 'खाना ऑर्डर', 'sv.fare': 'किराया और सीट', 'sv.live': 'चलने की स्थिति',
    'sv.pnrLabel': '10 अंकों का पीएनआर लिखें', 'sv.pnrGo': 'ट्रेन खोजें', 'sv.pnrHow': 'यह डेमो कैसे काम करता है',
    'sv.pickTrain': 'ट्रेन चुनें', 'sv.trainSearch': 'ट्रेन नंबर या नाम से खोजें', 'sv.boarding': 'जिस स्टेशन पर खाना चाहिए',
    'sv.menu': 'मेन्यू', 'sv.cart': 'आपका ऑर्डर', 'sv.empty': 'अभी कुछ नहीं जोड़ा', 'sv.total': 'कुल', 'sv.place': 'डेमो ऑर्डर दें',
    'sv.placed': 'डेमो ऑर्डर हो गया', 'sv.history': 'आपके डेमो ऑर्डर', 'sv.noHistory': 'अभी कोई डेमो ऑर्डर नहीं', 'sv.veg': 'शाकाहारी', 'sv.nonveg': 'मांसाहारी',
    'sv.from': 'कहाँ से', 'sv.to': 'कहाँ तक', 'sv.class': 'श्रेणी', 'sv.any': 'सभी श्रेणियाँ', 'sv.fareGo': 'किराया अनुमान', 'sv.seatGo': 'सीट देखें',
    'sv.liveGo': 'चलने की स्थिति देखें', 'sv.loading': 'लोड हो रहा है…', 'sv.clear': 'इतिहास मिटाएँ', 'sv.passengers': 'यात्री', 'sv.status': 'स्थिति',
    'sv.chart': 'चार्ट', 'sv.boardingAt': 'चढ़ने का स्टेशन', 'sv.destination': 'गंतव्य', 'sv.delay': 'बनावटी देरी', 'sv.minutes': 'मिनट',
  },
}

export function makeT(lang) {
  const table = D[lang] || D.en
  return (key, vars) => {
    let s = table[key] ?? D.en[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
    return s
  }
}
export const _dictionaries = D
