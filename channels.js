// Popular YouTube Channels with their channel IDs and handles
const CHANNELS = [
  {
    id: "UCwqNzzV8FmCyGWLfJW8MMSg",
    name: "CodingWithJan",
    handle: "CodingWithJan",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCvleAzyRQAD2Lkq-WrepcWA",
    name: "stackingcontext",
    handle: "stackingcontext",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCtu2rdj3syMnfe3BxIIRMOQ",
    name: "bosidev",
    handle: "bosidev",
    category: "shopify",
    language: "english",
  },
  {
    id: "UC7JIu_5sHpbZUBQNPKDb2QA",
    name: "shopioso",
    handle: "shopioso",
    category: "shopify",
    language: "english",
  },
  // {
  //   id: "UCcYsEEKJtpxoO9T-keJZrEw",
  //   name: "shopifydevs",
  //   handle: "shopifydevs",
  //   category: "shopify",
  //   language: "english",
  // },
  {
    id: "UCf-fJjjCIpXbaUJRmevVLsg",
    name: "LiquidWeekly",
    handle: "LiquidWeekly",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCbxtV_oVIXBtLRmyPfcLKVg",
    name: "ChristheFreelancer",
    handle: "ChristheFreelancer",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCUa4yMJ3mVquTL5TIpxatqQ",
    name: "WeeklyHow",
    handle: "WeeklyHow",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCN7HxyZq6LuhzfrEUbHAB2A",
    name: "codingwithrobby",
    handle: "codingwithrobby",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCnj1BK9TU32-bOlZ9415fuw",
    name: "CodeInspire",
    handle: "CodeInspire",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCP1fEDtYRGzpLEeGQUEnkKQ",
    name: "stephanodev",
    handle: "stephanodev",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCzazWD0cFUOOQZEqhIoBeqA",
    name: "stackwisedev",
    handle: "stackwisedev",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCBYGj1RV9U1UE0fWPcP4NYg",
    name: "codepirates",
    handle: "codepirates",
    category: "shopify",
    language: "english",
  },
  {
    id: "UC3YsIFs1rQ0Um81rM57r_hQ",
    name: "devwithalex",
    handle: "devwithalex",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCyU5wkjgQYGRB0hIHMwm2Sg",
    name: "syntaxfm",
    handle: "syntaxfm",
    category: "web-dev",
    language: "english",
  },
  {
    id: "UCWv7vMbMWH4-V0ZXdmDpPBA",
    name: "programmingwithmosh",
    handle: "programmingwithmosh",
    category: "web-dev",
    language: "english",
  },
  // {
  //   id: "UCNxUdsuH8-kEGIwSD0r8RhQ",
  //   name: "maximilian-schwarzmueller",
  //   handle: "maximilian-schwarzmueller",
  //   category: "web-dev",
  //   language: "english",
  // },
  {
    id: "UCFM3gG5IHfogarxlKcIHCAg",
    name: "LearnwithSumit",
    handle: "LearnwithSumit",
    category: "web-dev",
    language: "bengali",
  },
  {
    id: "UCJZv4d5rbIKd4QHMPkcABCw",
    name: "KevinPowell",
    handle: "KevinPowell",
    category: "web-dev",
    language: "english",
  },
  {
    id: "UCCvVhSNCaxWlcQ2hlkLlwbw",
    name: "mhcconstructionltd",
    handle: "mhcconstructionltd",
    category: "others",
  },
  {
    id: "UCwkHodC3PikVnMUQ2w-LraA",
    name: "LearnWithHasinHayder",
    handle: "LearnWithHasinHayder",
    category: "web-dev",
    language: "bengali",
  },
  {
    id: "UC94qXY-Icq1xaoGCQI11-mw",
    name: "raselahmed7",
    handle: "raselahmed7",
    category: "web-dev",
    language: "bengali",
  },
  {
    id: "UCfk-c_Vx8Wo5Zu5dH96Yw0w",
    name: "EdCodes",
    handle: "EdCodes",
    category: "shopify",
    language: "english",
  },
  {
    id: "UCXgGY0wkgOzynnHvSEVmE3A",
    name: "HiteshCodeLab",
    handle: "HiteshCodeLab",
    category: "web-dev",
    language: "english",
  },
  {
    id: "UCNQ6FEtztATuaVhZKCY28Yw",
    name: "chaiaurcode",
    handle: "chaiaurcode",
    category: "web-dev",
    language: "english",
  },
  {
    id: "UCruRBI2b_5r9T6mcvIA_5BA",
    name: "ProcoderBD",
    handle: "ProcoderBD",
    category: "web-dev",
    language: "bengali",
  },
  {
    id: "UCmXmlB4-HJytD7wek0Uo97A",
    name: "javascriptmastery",
    handle: "javascriptmastery",
    category: "web-dev",
    language: "english",
  },
  {
    id: "UCFbNIlppjAuEX4znoulh0Cw",
    name: "WebDevSimplified",
    handle: "WebDevSimplified",
    category: "web-dev",
    language: "english",
  },
  {
    id: "UCsFmLpSNJuFzpKqdEj5jeHw",
    name: "TonyAlicea",
    handle: "TonyAlicea",
    category: "web-dev",
    language: "english",
  },
];

// Blocked channel IDs - add channel handles to block
const BLOCKED_CHANNELS = [
  // Example: '@someChannelHandle'
  // Add more channel handles to block here
];

// We'll add some fallback channel IDs that work well (confirmed working)
const FALLBACK_CHANNELS = [
  {
    id: "UCwqNzzV8FmCyGWLfJW8MMSg",
    name: "CodingWithJan",
    handle: "CodingWithJan",
  },
  {
    id: "UCf-fJjjCIpXbaUJRmevVLsg",
    name: "LiquidWeekly",
    handle: "LiquidWeekly",
  },
];

export default {
    CHANNELS,
    BLOCKED_CHANNELS,
    FALLBACK_CHANNELS
};
