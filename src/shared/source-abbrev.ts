import { resolveSourceAbbrev } from './source-map'

export function getSourceColorClass(source: string): string {
  if (['XPHB', 'PHB', 'XGE', 'TCE', 'XDMG', 'DMG', 'XMM', 'MM'].includes(source)) {
    return 'source-badge-core'
  }
  if (['AAG', 'SCC', 'EGW', 'ERLW', 'GGR', 'MOT', 'FTD', 'VRGR'].includes(source)) {
    return 'source-badge-setting'
  }
  if (['FRHoF', 'RHW', 'ABH', 'LFL', 'EFA', 'BMT', 'FRAiF'].includes(source)) {
    return 'source-badge-supplement'
  }
  return 'source-badge-other'
}

export function formatSourceAbbrev(source: string): string {
  return resolveSourceAbbrev(source)
}

export interface SourceDisplay {
  abbrev: string
  fullName: string
  colorClass: string
}

export function getSourceDisplay(source: string, fullName?: string): SourceDisplay {
  return {
    abbrev: formatSourceAbbrev(source),
    fullName: fullName ?? source,
    colorClass: getSourceColorClass(source)
  }
}
