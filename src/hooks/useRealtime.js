import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to Supabase Realtime for a table.
 * Calls `onchange` whenever any row is inserted, updated, or deleted.
 *
 * Usage:
 *   useRealtime('wallets', load)        // reload on any wallet change
 *   useRealtime(['wallets','transactions'], load)  // multiple tables
 */
export function useRealtime(tables, onchange) {
  useEffect(() => {
    const tableList = Array.isArray(tables) ? tables : [tables]
    const channelName = `realtime-${tableList.join('-')}-${Math.random().toString(36).slice(2)}`

    let ch = supabase.channel(channelName)
    for (const table of tableList) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, onchange)
    }
    ch.subscribe()

    return () => { supabase.removeChannel(ch) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
