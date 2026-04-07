const TEAM_CODE_BY_KEY: Record<string, string> = {
  mexico: 'MX',
  sudafrica: 'ZA',
  southafrica: 'ZA',
  republicadecorea: 'KR',
  coreadelsur: 'KR',
  southkorea: 'KR',
  korearepublic: 'KR',
  republicacheca: 'CZ',
  chequia: 'CZ',
  czechrepublic: 'CZ',
  czechia: 'CZ',
  canada: 'CA',
  bosniayherzegovina: 'BA',
  bosniaandherzegovina: 'BA',
  catar: 'QA',
  qatar: 'QA',
  suiza: 'CH',
  switzerland: 'CH',
  brasil: 'BR',
  brazil: 'BR',
  marruecos: 'MA',
  morocco: 'MA',
  haiti: 'HT',
  escocia: 'GB',
  scotland: 'GB',
  estadosunidos: 'US',
  eeuu: 'US',
  usa: 'US',
  unitedstates: 'US',
  paraguay: 'PY',
  australia: 'AU',
  turquia: 'TR',
  alemania: 'DE',
  germany: 'DE',
  curazao: 'CW',
  costademarfil: 'CI',
  cotedivoire: 'CI',
  ivorycoast: 'CI',
  ecuador: 'EC',
  paisesbajos: 'NL',
  holanda: 'NL',
  netherlands: 'NL',
  japon: 'JP',
  japan: 'JP',
  suecia: 'SE',
  sweden: 'SE',
  tunez: 'TN',
  tunisia: 'TN',
  belgica: 'BE',
  belgium: 'BE',
  egipto: 'EG',
  iran: 'IR',
  rideiran: 'IR',
  nuevazelanda: 'NZ',
  newzealand: 'NZ',
  espana: 'ES',
  spain: 'ES',
  caboverde: 'CV',
  islasdecaboverde: 'CV',
  capeverde: 'CV',
  arabiasaudi: 'SA',
  saudiarabia: 'SA',
  uruguay: 'UY',
  francia: 'FR',
  senegal: 'SN',
  irak: 'IQ',
  noruega: 'NO',
  argentina: 'AR',
  argelia: 'DZ',
  austria: 'AT',
  jordania: 'JO',
  portugal: 'PT',
  rdcongo: 'CD',
  rddecongo: 'CD',
  drcongo: 'CD',
  rddecongojamaica: 'CD',
  jamaicarddecongo: 'CD',
  jamaicardcongo: 'CD',
  jamaica: 'JM',
  uzbekistan: 'UZ',
  colombia: 'CO',
  inglaterra: 'GB',
  england: 'GB',
  croacia: 'HR',
  ghana: 'GH',
  panama: 'PA',
}

export function normalizeTeamKey(name: string | null | undefined): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function resolveTeamCode(name: string | null | undefined): string | null {
  const key = normalizeTeamKey(name)
  return key ? (TEAM_CODE_BY_KEY[key] || null) : null
}

export function teamFlagEmojiFromCode(code: string | null | undefined): string {
  const value = (code || '').toUpperCase().trim()

  if (!/^[A-Z]{2}$/.test(value)) {
    return String.fromCodePoint(0x1f3f3, 0xfe0f)
  }

  const first = 0x1f1e6 + (value.charCodeAt(0) - 65)
  const second = 0x1f1e6 + (value.charCodeAt(1) - 65)

  return String.fromCodePoint(first, second)
}
